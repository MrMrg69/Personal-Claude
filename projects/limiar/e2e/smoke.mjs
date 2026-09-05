// Smoke test e2e (design §9): build → vite preview → Chromium headless
// (SwiftShader) → anda/olha/pula por window.__limiar.input.inject() no modo
// sem pointer lock (?nolock=1) → asserta loop vivo, zero erros, deslocamento,
// grounded e orçamento de draw calls. Sem @playwright/test: só playwright-core.
//
// SwiftShader não mede performance: fps > 5 só detecta loop quebrado.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const ARTIFACTS = join(ROOT, 'e2e', 'artifacts');
const VITE_BIN = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
/** Cópias dos screenshots fora do repositório (inspeção pelo orquestrador). */
const EXTRA_SCREENS_DIR = process.env.LIMIAR_E2E_SCREENS ?? '';

const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'];
const VIEWPORT = { width: 1280, height: 720 };
const READY_TIMEOUT_MS = 30_000;
const SERVER_TIMEOUT_MS = 20_000;
/** Durações em tempo SIMULADO (world.time.sim): em SwiftShader o relógio de parede não vale. */
const WALK_SIM_S = 1;
const TURN_WALK_SIM_S = 0.5;
const SIM_TIMEOUT_MS = 20_000;
const LAND_TIMEOUT_MS = 10_000;
const SETTLE_MS = 300;

/** Gates (design §9, passo 6). */
const GATES = {
  minWalkZ: 4, // andou ≥ 4 m para −Z
  maxDrawCalls: 30,
  minFps: 5,
  turnDeg: 90,
  minTurnWalkX: 1.5, // depois de virar ~90° e andar 0,5 s
};

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @returns {Promise<number>} porta TCP livre em 127.0.0.1 */
function freePort() {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port > 0 ? resolvePort(port) : reject(new Error('sem porta livre'))));
    });
  });
}

/**
 * Resolve o executável do Chromium: CHROMIUM_PATH → /opt/pw-browsers/chromium →
 * o que o playwright-core conhece. Devolve null se nenhum existir.
 * @returns {string | null}
 */
function resolveChromium() {
  const candidates = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'];
  for (const c of candidates) if (c && existsSync(c)) return c;
  try {
    const p = chromium.executablePath();
    if (p && existsSync(p)) return p;
  } catch {
    // playwright-core sem browsers instalados lança; tratado abaixo.
  }
  return null;
}

/**
 * @param {string[]} args
 * @param {{ wait?: boolean }} [opts]
 * @returns {import('node:child_process').ChildProcess}
 */
function vite(args, opts = {}) {
  const child = spawn(process.execPath, [VITE_BIN, ...args], { cwd: ROOT, stdio: opts.wait ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
  return child;
}

/** @returns {Promise<void>} */
function build() {
  return new Promise((res, rej) => {
    vite(['build'], { wait: true }).once('exit', (code) => (code === 0 ? res() : rej(new Error(`vite build saiu com ${code}`))));
  });
}

/**
 * @param {string} url
 * @returns {Promise<void>}
 */
async function waitForServer(url) {
  const until = Date.now() + SERVER_TIMEOUT_MS;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // ainda subindo
    }
    await sleep(150);
  }
  throw new Error(`servidor não respondeu em ${SERVER_TIMEOUT_MS} ms: ${url}`);
}

/**
 * @typedef {{ x: number, y: number, z: number }} Vec3Like
 * @typedef {{ pos: Vec3Like, vel: Vec3Like, grounded: boolean, yawDeg: number, locomotion: string, state: string, isWebGL2: boolean, fps: number, drawCalls: number, triangles: number, frameAvgMs: number, entities: number, seed: number, sensDegPerCount: number }} Probe
 */

/** Expressão avaliada na página: um snapshot serializável do estado do jogo. */
const PROBE_EXPR = `(() => {
  const api = window.__limiar;
  const p = api.world.player;
  const s = api.stats;
  return {
    pos: { x: p.transform.position.x, y: p.transform.position.y, z: p.transform.position.z },
    vel: { x: p.body.velocity.x, y: p.body.velocity.y, z: p.body.velocity.z },
    grounded: p.body.grounded,
    yawDeg: p.look.yaw * 180 / Math.PI,
    locomotion: p.locomotion,
    state: api.state,
    isWebGL2: api.renderer.gl.capabilities.isWebGL2,
    fps: s.fps, drawCalls: s.drawCalls, triangles: s.triangles, frameAvgMs: s.frameAvgMs,
    entities: api.world.entities.size,
    seed: api.world.rng.seed,
    sensDegPerCount: api.world.cfg.camera.sensitivityDegPerCount * api.world.settings.sensitivityMultiplier,
  };
})()`;

/**
 * @param {import('playwright-core').Page} page
 * @returns {Promise<Probe>}
 */
async function probe(page) {
  return /** @type {Promise<Probe>} */ (page.evaluate(PROBE_EXPR));
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} actionsJson  ex.: '{"forward":true}'
 * @param {[number, number]} [mouse]
 */
async function inject(page, actionsJson, mouse) {
  const mouseArg = mouse ? `, [${mouse[0]}, ${mouse[1]}]` : '';
  await page.evaluate(`window.__limiar.input.inject(${actionsJson}${mouseArg})`);
}

/**
 * Segura as ações por `seconds` de tempo simulado e solta. Esperar pelo relógio
 * de simulação (não pelo de parede) torna o teste determinístico em máquinas
 * lentas: frames acima de 0,1 s descartam tempo (MAX_FRAME_DT) e o jogador
 * andaria menos que o esperado.
 * @param {import('playwright-core').Page} page
 * @param {string} actionsJson
 * @param {number} seconds
 */
async function holdForSim(page, actionsJson, seconds) {
  const t0 = /** @type {number} */ (await page.evaluate('window.__limiar.world.time.sim'));
  await inject(page, actionsJson);
  await page.waitForFunction(`window.__limiar.world.time.sim >= ${t0 + seconds}`, null, { timeout: SIM_TIMEOUT_MS });
  await inject(page, '{}');
}

/**
 * @param {import('playwright-core').Page} page
 * @param {string} name
 */
async function shot(page, name) {
  const path = join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path });
  if (EXTRA_SCREENS_DIR) {
    mkdirSync(EXTRA_SCREENS_DIR, { recursive: true });
    copyFileSync(path, join(EXTRA_SCREENS_DIR, `${name}.png`));
  }
  return path;
}

async function main() {
  const executablePath = resolveChromium();
  if (!executablePath) {
    console.log(
      'e2e: Chromium não encontrado (CHROMIUM_PATH, /opt/pw-browsers/chromium ou playwright-core). ' +
        'Smoke test PULADO. Para instalar: npx playwright@1.63.0 install chromium e exporte CHROMIUM_PATH.',
    );
    return;
  }

  if (!existsSync(join(DIST, 'index.html'))) {
    console.log('e2e: dist/ ausente — rodando vite build');
    await build();
  }
  mkdirSync(ARTIFACTS, { recursive: true });

  const port = await freePort();
  const base = `http://127.0.0.1:${port}/`;
  const server = vite(['preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
  /** @type {string[]} */
  const serverLog = [];
  server.stdout?.on('data', (d) => serverLog.push(String(d)));
  server.stderr?.on('data', (d) => serverLog.push(String(d)));

  /** @type {import('playwright-core').Browser | null} */
  let browser = null;
  /** @type {string[]} */
  const failures = [];
  try {
    await waitForServer(base);
    browser = await chromium.launch({ executablePath, args: CHROMIUM_ARGS, headless: true });
    const page = await browser.newPage({ viewport: VIEWPORT });

    /** @type {string[]} */
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? '?'})`));

    await page.goto(`${base}?nolock=1&shadows=0&debug=1&seed=1`);
    await page.waitForFunction('window.__limiar && window.__limiar.ready === true', null, { timeout: READY_TIMEOUT_MS });
    await sleep(SETTLE_MS);
    const shotReady = await shot(page, 'smoke-ready');
    const before = await probe(page);

    // Clique no overlay → modo unlocked → running.
    await page.click('.overlay');
    await page.waitForFunction('window.__limiar.state === "running"', null, { timeout: READY_TIMEOUT_MS });

    // 1 s (simulado) para a frente (−Z).
    await holdForSim(page, '{"forward":true}', WALK_SIM_S);
    await sleep(SETTLE_MS);
    const afterWalk = await probe(page);
    const shotWalk = await shot(page, 'smoke-walk');

    // Vira ~90° à esquerda (yaw cresce; dx negativo) e anda 0,5 s → −X.
    const dx = -Math.round(GATES.turnDeg / afterWalk.sensDegPerCount);
    await inject(page, '{}', [dx, 0]);
    await sleep(SETTLE_MS);
    await holdForSim(page, '{"forward":true}', TURN_WALK_SIM_S);
    await sleep(SETTLE_MS);
    const afterTurn = await probe(page);

    // Pulo: espera sair do chão e pousar de novo.
    await inject(page, '{"jump":true}');
    await page.waitForFunction('window.__limiar.world.player.body.grounded === false', null, { timeout: LAND_TIMEOUT_MS });
    await inject(page, '{}');
    await page.waitForFunction('window.__limiar.world.player.body.grounded === true', null, { timeout: LAND_TIMEOUT_MS });
    await sleep(SETTLE_MS);

    // HUD de debug (F3 via ação sintética) para o screenshot final.
    await inject(page, '{"debugHud":true}');
    await sleep(SETTLE_MS);
    await inject(page, '{}');
    await sleep(SETTLE_MS);
    const final = await probe(page);
    const shotHud = await shot(page, 'smoke-hud');
    const shotFinal = await shot(page, 'smoke');

    // ---- Asserções ----
    const walked = before.pos.z - afterWalk.pos.z;
    const turnedDeg = ((afterTurn.yawDeg - afterWalk.yawDeg + 540) % 360) - 180;
    const strafed = afterWalk.pos.x - afterTurn.pos.x;
    /** @param {boolean} ok @param {string} msg */
    const check = (ok, msg) => {
      if (!ok) failures.push(msg);
    };
    check(errors.length === 0, `erros no navegador:\n  ${errors.join('\n  ')}`);
    check(final.state === 'running', `estado ${final.state} ≠ running`);
    check(final.isWebGL2, 'renderer não é WebGL2');
    check(walked >= GATES.minWalkZ, `andou ${walked.toFixed(2)} m para −Z (< ${GATES.minWalkZ})`);
    check(Math.abs(turnedDeg - GATES.turnDeg) < 5, `virou ${turnedDeg.toFixed(1)}° (esperado ~${GATES.turnDeg}°)`);
    check(strafed >= GATES.minTurnWalkX, `andou ${strafed.toFixed(2)} m para −X depois de virar (< ${GATES.minTurnWalkX})`);
    check(final.grounded, 'jogador não está no chão ao final');
    check(final.drawCalls <= GATES.maxDrawCalls, `drawCalls ${final.drawCalls} > ${GATES.maxDrawCalls}`);
    check(final.fps > GATES.minFps, `fps ${final.fps.toFixed(1)} ≤ ${GATES.minFps}`);

    const report = {
      ok: failures.length === 0,
      failures,
      fps: final.fps,
      frameAvgMs: final.frameAvgMs,
      drawCalls: final.drawCalls,
      triangles: final.triangles,
      walkedZ: walked,
      turnedDeg,
      strafedX: strafed,
      position: final.pos,
      grounded: final.grounded,
      locomotion: final.locomotion,
      entities: final.entities,
      seed: final.seed,
      errors,
      screenshots: [shotReady, shotWalk, shotHud, shotFinal],
      chromium: executablePath,
    };
    writeFileSync(join(ARTIFACTS, 'smoke.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close().catch(() => undefined);
    // O servidor morre SEMPRE, mesmo com exceção acima.
    server.kill('SIGTERM');
    if (failures.length > 0 && serverLog.length > 0) console.log(serverLog.join(''));
  }

  if (failures.length > 0) {
    console.error(`e2e FALHOU:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('e2e OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
