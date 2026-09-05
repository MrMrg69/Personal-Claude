# LIMIAR — Guia de desenvolvimento

> Como instalar, rodar, testar, depurar e estender o protótipo. Baseado no código real em `projects/limiar/` (estado: **M0 — esqueleto**). A fonte da verdade para arquitetura, contratos e valores é o [design técnico](02-design-tecnico.md); este guia é o "manual de bordo" do dia a dia.

Convenção deste documento: caminhos relativos a `projects/limiar/`, salvo indicação. Comandos assumem um terminal aberto nessa pasta.

---

## 1. Pré-requisitos

| Item | Versão | Observação |
|---|---|---|
| Node.js | ≥ 22.12 (`engines` do `package.json`) | Testado com 22.22. |
| npm | 10.x | Vem com o Node. |
| Navegador | Chrome/Edge/Firefox recentes | **WebGL2** obrigatório; o jogo mostra erro claro sem ele. |
| Chromium para o e2e | opcional | Só para `npm run test:e2e`. Ver [§7.2](#72-smoke-test-e2e). |

Sem GPU dedicada tudo funciona: o alvo é iGPU. Em máquinas sem GPU (SwiftShader) o jogo roda, mas o FPS não é representativo (ver [05-performance.md](05-performance.md)).

Dependências fixadas (versões exatas, sem `^`): `three 0.185.1`, `vite 8.2.2`, `vitest 5.0.0`, `typescript 5.9.3`, `playwright-core 1.63.0`, `@types/three 0.185.4`, `@types/node 22.20.1`.

## 2. Instalação

```sh
cd projects/limiar
npm install
```

Cerca de 10 s, ~50 pacotes. O `package-lock.json` está versionado: use `npm ci` em CI.

Lista de verificação pós-instalação:

- [ ] `npm run typecheck` sem erros.
- [ ] `npm test` verde (10 suítes, 135 testes).
- [ ] `npm run dev` abre em `http://127.0.0.1:5173` e o overlay "LIMIAR" aparece.

## 3. Scripts npm

Todos confirmados rodando neste repositório.

| Script | O que faz | Quando usar |
|---|---|---|
| `npm run dev` | `vite --host 127.0.0.1 --port 5173`. Servidor de desenvolvimento com HMR. HUD de debug ligado por padrão, painel `F4` disponível, `validateDefs(DEFS)` roda ao montar. | Desenvolvimento diário. |
| `npm run build` | `vite build` → `dist/`. O `three` sai em chunk próprio (`build.rolldownOptions.output.codeSplitting`). Resultado atual: índice ≈ 56 kB (20,5 kB gz) + three ≈ 539 kB (135 kB gz) + CSS 2,5 kB. `lil-gui` fica **fora** do bundle de produção (`import()` dinâmico, só em DEV). | Antes de medir performance real e antes do e2e. |
| `npm run preview` | `vite preview` em `http://127.0.0.1:4173` (`--strictPort`). Serve `dist/`. | Testar o build de produção. |
| `npm run typecheck` | `tsc --noEmit` em dois projetos: `tsconfig.json` (`src/` + `tests/`) e `tsconfig.node.json` (`vite.config.ts`, `vitest.config.ts`, `e2e/smoke.mjs` com `checkJs`). | Sempre antes de considerar algo pronto. |
| `npm test` | `vitest run` — testes unitários em Node (sem WebGL). | A cada mudança em `core/`, `data/`, `world/`. |
| `npm run test:watch` | `vitest` em modo watch. | Enquanto escreve testes. |
| `npm run test:e2e` | `node e2e/smoke.mjs` — build (se `dist/` não existir) → `vite preview` em porta livre → Chromium headless. | Antes de entregar; valida o jogo montado no navegador. |
| `npm run check` | `typecheck` → `test` → `build` → `test:e2e`, em sequência. | Gate completo (~1 min). |

`dist/` e `e2e/artifacts/*` (exceto `.gitkeep`) estão no `.gitignore`.

## 4. Controles e atalhos

### 4.1 Controles do jogo

Fonte: `src/data/input-bindings.ts`. Os mapeamentos são por `KeyboardEvent.code` (posição física da tecla), então funcionam igual em ABNT2, QWERTY e AZERTY.

| Entrada | Ação | Estado em M0 |
|---|---|---|
| `W A S D`, `↑` | mover | ativo |
| `Shift esq.` | correr (só empurrando para a frente) | ativo |
| `Espaço` | pular; segurar sobe mais (≈ 1,4 m toque, ≈ 2,2 m segurado) | ativo |
| mouse | olhar (0,022 °/contagem × multiplicador 1,5, sem suavização) | ativo |
| `Esc` | pausa (no modo sem pointer lock); com lock, o navegador solta o mouse e o jogo pausa | ativo |
| `Ctrl esq.`, `C` | agachar | mapeado, sem sistema (M1) |
| `Mouse0` / `Mouse2` | atirar / mirar | mapeado, sem sistema (M1) |
| `R`, `F`, `Q`, `E`, `X`, `G` | recarregar, melee, granada, habilidade de classe, Ápice, interagir | mapeado, sem sistema (M1–M3) |
| roda do mouse | trocar arma | mapeado, sem sistema (M1) |

Clique no overlay para começar. O jogo pede pointer lock; se o navegador recusar duas vezes seguidas (iframe, política do site), cai para o **modo sem captura do mouse** e a câmera segue o mouse sobre a página. O overlay avisa quando isso acontece.

### 4.2 Atalhos de debug

Fonte: `src/data/input-bindings.ts` (teclas) e `Game.handleDebugKeys` em `src/game/game.ts` (comportamento). Lidos por passo fixo, na borda de pressionar.

| Tecla | Faz | Persiste? |
|---|---|---|
| `F3` | liga/desliga o HUD de debug | sim (`settings.debugHud`) |
| `F4` | painel de tuning (lil-gui). Entra no **modo de tuning**: mouse livre, simulação continua rodando. `F4` de novo ou clique no canvas volta e pede o lock. **Só em `npm run dev`.** | não |
| `F6` | helpers na camada DEBUG: grade 1 m/10 m, eixos, nós do Octree (um único `LineSegments`), cápsula do jogador em wireframe | não |
| `F7` | sombras liga/desliga | sim (`settings.shadows`) |
| `F8` | render scale 1,0 ↔ 0,75 (`RENDER_SCALE_ALT`) | sim (`settings.renderScale`) |
| `F9` | kick sintético de recoil (afina a mola antes de existir arma; yaw com sinal aleatório do `rng`) | não |
| `P` | respawn no spawn do nível, zera o look | — (só com `debug`) |
| `T` | teleporta ao topo da torre (`TEST_GROUND_TOWER_TOP`, y ≈ 6 m); andar para fora dá queda de 6 m | — (só com `debug`) |

`debug` é verdadeiro em `npm run dev` **ou** com `?debug=1`. `F5` foi evitado de propósito (recarrega a página).

## 5. Flags de URL

Fonte: `src/core/url-flags.ts` (`parseUrlFlags`/`readUrlFlags`), aplicadas em `Game` (`src/game/game.ts`). Valores booleanos aceitam `1/0`, `true/false`, `on/off` e vazio (`?nolock` = ligado).

| Flag | Efeito | Padrão sem a flag |
|---|---|---|
| `?nolock=1` | força o `PointerLockController` em modo `unlocked`: nunca pede pointer lock. Usado pelo e2e e em iframes. | pede lock |
| `?shadows=0` / `1` | sombras iniciais | valor salvo em `settings` |
| `?scale=0.75` | render scale inicial (limitado a 0,25–1) | valor salvo |
| `?hud=1` / `0` | HUD de debug inicial | valor salvo (ligado em DEV) |
| `?debug=1` | ativa `P`/`T` e `window.__limiar` fora do `dev` | só em DEV |
| `?seed=123` | seed do `Random` em `world.rng` (reprodutibilidade) | `Date.now()` |

As flags **sobrepõem** as configurações salvas, mas não são gravadas: o `localStorage` (`limiar.settings`, versão 1, via `SaveStore`) só muda quando você usa `F3`/`F7`/`F8` ou o painel.

Exemplo útil para reproduzir um bug com tudo previsível:

```
http://127.0.0.1:5173/?nolock=1&shadows=0&debug=1&seed=1
```

## 6. Ferramentas de debug

### 6.1 HUD de debug (`F3`)

Arquivo: `src/ui/debug-hud.ts`. Um `<pre>` atualizado a cada frame com:

- FPS, frame médio/máximo (janela de 1 s), média de 3 s, passos por frame e passos descartados (`drop`).
- draw calls, triângulos, geometrias, texturas, programas (do `renderer.gl.info`).
- posição, velocidade, velocidade horizontal, estado de locomoção (`IDLE/WALK/SPRINT/AIR`), `grounded`/`air`, `n.y` da normal do chão, coyote e tempo no ar.
- yaw/pitch, estado do lock, estado do loop e do jogo, entidades, contagem de definições, seed.
- sombras: `ON`, `OFF` ou `AUTO-OFF (F7 religa)` quando o desligamento automático (§6.4 do design) atuou.

Como interpretar cada linha em detalhe: [05-performance.md, §5](05-performance.md).

Armadilha conhecida: `n.y` abaixo de 1 encostado em paredes ou na base de rampas é a normal **agregada** do Octree (chão + parede). Não é bug.

### 6.2 Painel de tuning (`F4`, só em dev)

Arquivo: `src/ui/tuning-panel.ts`. Carrega `lil-gui` por `import()` dinâmico (por isso nunca entra no bundle de produção). Pastas:

| Pasta | Edita |
|---|---|
| `movement` | `MOVEMENT` (`src/data/movement-config.ts`): velocidades, acelerações, gravidade, pulo, coyote, step-up… |
| `camera` | `CAMERA` (`src/data/camera-config.ts`): hFOV, sensibilidade, altura dos olhos… |
| `feel` → `landKick`, `recoil`, `headBob` | `FEEL` (`src/data/feel-config.ts`); botão "Kick de recoil (F9)" |
| `render` → `lights`, `shadow` | `RENDER` (`src/data/render-config.ts`): exposição, névoa, sol, sombras |
| `settings` | `Settings` do usuário (sensibilidade, hFOV, sombras, escala, HUD) — persistem |

Os controles usam `.listen()`: mudanças por atalho ou por HMR aparecem no painel. O botão **"Copiar JSON (cole em data/*-config.ts)"** copia o estado atual para a área de transferência (ou para `console.info` se o navegador negar o clipboard). Fluxo de tuning completo em [§9](#9-como-ajustar-valores-de-tuning).

### 6.3 `window.__limiar`

Arquivo: `src/game/debug-api.ts` (`LimiarDebugApi`). Existe em dev ou com `?debug=1`.

```ts
interface LimiarDebugApi {
  world: World;                 // entidades, eventos, cfg, settings, collision, rng, time...
  loop: GameLoop;               // pause()/resume(), stats
  renderer: Renderer;           // gl (WebGLRenderer), setRenderScale()
  stats: DebugStats;            // fps, frameAvgMs, drawCalls... snapshot()
  input: { inject: InputState['inject'] };
  respawn(): void;              // respawn de debug no spawn do nível
  state: GameState;             // 'ready' | 'running' | 'paused' | ...
  ready: boolean;               // true quando terminou de montar
}
```

Receitas no console do navegador:

```js
// Segurar "frente" sinteticamente (fica pressionado até o próximo inject/reset)
__limiar.input.inject({ forward: true });
__limiar.input.inject({});                     // solta tudo

// Virar 90° à esquerda: dx em contagens de mouse (yaw -= dx * sens)
const sens = __limiar.world.cfg.camera.sensitivityDegPerCount * __limiar.world.settings.sensitivityMultiplier;
__limiar.input.inject({}, [-90 / sens, 0]);

// Ouvir eventos do jogo
__limiar.world.events.on('player:landed', (e) => console.log('pousou a', e.fallSpeed, 'm/s'));

// Posição atual do jogador
__limiar.world.entities.ofKind('player')[0].transform.position;
```

`inject` é o **modo sintético** do `InputState`: gera bordas `justPressed`/`justReleased` exatamente como um teclado, por isso serve para o e2e e para reproduzir bugs de movimento sem pointer lock.

## 7. Testes

### 7.1 Testes unitários (vitest)

```sh
npm test              # uma passada
npm run test:watch    # modo watch
npx vitest run tests/physics/collision.test.ts -t rampa   # um arquivo / um nome
```

Rodam em Node, sem DOM nem WebGL. Config em `vitest.config.ts` (alias `@/` → `src/`).

| Arquivo | Cobre |
|---|---|
| `tests/core/loop.test.ts` | timestep fixo, clamp de frame, passos descartados |
| `tests/core/input.test.ts` | bordas por passo, eixo de movimento, `inject`, `reset` |
| `tests/core/events.test.ts` | `EventBus`: on/once/emit/queue/flush |
| `tests/core/spring.test.ts` | mola amortecida, inclusive frames longos (sub-passos) |
| `tests/core/random.test.ts` | `Random` determinístico |
| `tests/core/storage.test.ts` | `SaveStore`: versão, migrações, `validate` |
| `tests/physics/integrate.test.ts` | `integrateCapsuleBody` com os valores reais de `MOVEMENT` |
| `tests/physics/collision.test.ts` | `resolveCapsuleCollision` contra o **Octree real**: rampas 20,6°/40°/53°, degraus 0,25/0,35/0,50, corredor de 1,2 m, parede sem quicar, raycast, Campo de Provas inteiro |
| `tests/data/definitions.test.ts` | `validateDefs(DEFS)` e casos de dado inválido |
| `tests/architecture.test.ts` | regras de dependência entre pastas (lê os fontes como texto) |

O que **não** tem teste unitário (depende de DOM/WebGL) é coberto pelo e2e: `Renderer`, `PointerLockController`, `world/lighting.ts`, HUD, overlay.

### 7.2 Smoke test e2e

```sh
npm run test:e2e
```

Arquivo: `e2e/smoke.mjs` (`playwright-core`, Chromium headless com SwiftShader). O que ele faz:

1. Roda `vite build` se `dist/` não existir.
2. Sobe `vite preview --strictPort` em uma porta livre (`net.createServer(0)`).
3. Abre `/?nolock=1&shadows=0&debug=1&seed=1`, espera `__limiar.ready`, clica no overlay.
4. Injeta input via `__limiar.input.inject`: anda para −Z, vira 90°, anda para −X, pula e espera pousar, liga o HUD (`F3`).
5. As esperas de "andar" contam **tempo simulado** (`world.time.sim`), não relógio de parede — em SwiftShader frames > 0,1 s descartam tempo.
6. Asserta: zero `console.error`/`pageerror`/`requestfailed`; estado `running`; WebGL2; andou ≥ 4 m e ≥ 1,5 m; virou 90° ± 5°; `grounded` no final; draw calls ≤ 30; fps > 5.
7. Grava `e2e/artifacts/smoke.png`, `smoke-ready.png`, `smoke-walk.png`, `smoke-hud.png` e `smoke.json`. Mata o preview no `finally`. Sai com 1 em falha.

Variáveis de ambiente:

| Variável | Uso |
|---|---|
| `CHROMIUM_PATH` | caminho do executável do Chromium (tem prioridade) |
| `LIMIAR_E2E_SCREENS` | pasta extra para copiar as screenshots |

**Onde o e2e procura o Chromium**, nesta ordem: `CHROMIUM_PATH` → `/opt/pw-browsers/chromium` → `chromium.executablePath()` do `playwright-core`. Se nenhum existir, o teste **pula com exit 0** e imprime a instrução de instalação. O `npm run check` continua verde nesse caso.

Instalar o Chromium na sua máquina (uma vez; nunca rode `playwright install` dentro do projeto, que só tem `playwright-core`):

```sh
npx playwright@1.63.0 install chromium
# Depois aponte o executável instalado, por exemplo (Linux):
export CHROMIUM_PATH="$HOME/.cache/ms-playwright/chromium-*/chrome-linux/chrome"
npm run test:e2e
```

No macOS o caminho fica em `~/Library/Caches/ms-playwright/…/Chromium.app/Contents/MacOS/Chromium`; no Windows em `%LOCALAPPDATA%\ms-playwright\…\chrome.exe`. Um Chrome/Chromium do sistema também serve em `CHROMIUM_PATH`.

Lembrete: o e2e valida **funcionamento**, não performance. Medição real: [05-performance.md, §6](05-performance.md).

## 8. Convenções

### 8.1 Idiomas

- Identificadores (variáveis, funções, tipos, arquivos): **inglês**.
- Comentários de código, documentação, textos de UI e mensagens de erro: **PT-BR**.
- Nomes de entidades do jogo seguem o [léxico do design (§14)](02-design-tecnico.md#14-léxico): Vigia, Baluarte/Rastreador/Tecelão, Axioma/Ferrugem/Cepa, Brasa/Ressonância/Névoa, Ferro/Afim/Pesado, Ápice, Lume, Eco, a Maré. Nunca use nomes da Bungie para entidades do jogo; citar Destiny como inspiração em docs e comentários é aceitável.

### 8.2 Pastas e regras de dependência (testadas)

`tests/architecture.test.ts` lê todos os fontes de `src/` e falha se um `import` de **valor** violar a tabela abaixo (`import type` é sempre livre).

| Pasta | Pode importar de valor | Só como tipo |
|---|---|---|
| `core/` | `three`, `core` | — |
| `data/` | `data` | `core` |
| `entities/` | `three`, `core`, `data`, `world`, `entities` | — |
| `world/` | `three`, `core`, `data`, `world` | — |
| `systems/` | `three`, `core`, `data`, `entities`, `world`, `systems` | `game` |
| `ui/` | `core`, `data`, `ui` | `game` |
| `game/` | tudo acima | — |

Consequências práticas:

- `core/` não sabe que existe um "jogador": o que precisa de colisão consome a interface `CollisionQuery` (`core/physics/collision-query.ts`), implementada por `world/collision-world.ts`.
- `data/` nunca importa `three` como valor (cores são `number` hex; vetores são tuplas).
- Um sistema recebe o `World` (tipo de `game/`) como parâmetro, mas não importa `game/` como valor.
- `entities/ → world/` é um desvio registrado do §3.2 (necessário para `static-world.ts`; não há ciclo porque `world/` não importa `entities/`).

Alias de caminho: `@/` → `src/`. Use-o em imports entre pastas; imports relativos só dentro da mesma pasta.

### 8.3 Dados vs. código

- Tudo que é **número de tuning, cor, texto de definição ou nível** vive em `src/data/`. Fora de `data/` um número mágico é bug de revisão (exceções óbvias: 0, 1, 2, conversões de unidade).
- Definições usam `satisfies` (nunca `as`) e passam por `validateDefs(DEFS)` — roda em DEV ao montar e em `tests/data/definitions.test.ts`. Dado quebrado falha no `npm test` antes de chegar ao navegador (ADR 0005).
- Configs (`MOVEMENT`, `CAMERA`, `FEEL`, `RENDER`) são objetos **mutáveis** lidos no momento do uso (`world.cfg.movement.walkSpeed`), nunca copiados para variáveis locais duradouras — é isso que faz o HMR e o painel funcionarem sem reiniciar.
- Sem `const enum` (o projeto usa `isolatedModules` + `verbatimModuleSyntax`): use objeto `as const` + tipo derivado (`Layer`, `CollisionLayer`, `ENTITY_KINDS`).
- `exactOptionalPropertyTypes` está ligado: nunca atribua `undefined` a um campo opcional; quando um objeto reutilizado precisa "zerar" um campo, declare-o como `T | null` (é o caso de `RayHit.entity`).

### 8.4 Comentários

- Comentário explica a **decisão não óbvia**, não repete o código. Bom: "copie os campos sobre o objeto vivo; trocar a referência quebra o HMR". Ruim: "incrementa i".
- Referencie a seção do design quando o código a implementa (`// design §5.2`).
- Sem `TODO` vago. Um `TODO` precisa dizer o quê, quando (milestone) e por quê.
- Sem código morto nem `any`. `unknown` + type guard quando o tipo vem de fora (`localStorage`, `import.meta.hot`).

### 8.5 Zero alocação por frame

Nos hot paths (`fixedUpdate`, `frameUpdate`, sistemas, física, colisão) não se cria objeto por frame:

- Um `Vector3`/`Vector2`/`Capsule` de rascunho por módulo (`const scratch = new Vector3()` no topo do arquivo), reutilizado.
- Funções recebem `out` e devolvem `boolean` em vez de retornar objetos novos (`raycast(origin, dir, maxDist, mask, out)`).
- Sem `for…of` sobre `Map`/`Set` por frame: os sistemas percorrem arrays estáveis de `entities.ofKind(kind)` com índice.
- Alocar é permitido **fora** do hot path e está marcado no comentário: `stats.snapshot()`, `events.queue()`, `collision.debugHelper()`.
- Exceção conhecida e monitorada: `Octree.capsuleIntersect`/`rayIntersect` do addon oficial alocam internamente. É o gatilho da [ADR 0003](decisoes/0003-octree-three-addons.md).

Lista de verificação antes de abrir um PR:

- [ ] `npm run check` verde.
- [ ] Nenhum número novo fora de `src/data/`.
- [ ] Nenhum `new Vector3()`/`{}`/`[]` dentro de `update` de sistema.
- [ ] Comentários em PT-BR explicando o porquê.
- [ ] Contratos de `core/` alterados? Atualize o design técnico e, se for decisão, um ADR.
- [ ] Nomes do léxico respeitados.

## 9. Como ajustar valores de tuning

Três caminhos, do mais rápido ao definitivo:

**1. Painel `F4` (dev).** Mude os sliders com o jogo rodando. O modo de tuning deixa o mouse livre e a simulação continua, então dá para observar o efeito na hora. Quando gostar, clique em **"Copiar JSON"** e cole os valores no arquivo de `src/data/` correspondente. O painel não grava em arquivo.

**2. Editar `src/data/*-config.ts` com `npm run dev` aberto (HMR).** `movement-config.ts`, `camera-config.ts` e `feel-config.ts` se auto-aceitam: o `import.meta.hot.accept` copia os campos novos **sobre o objeto vivo** (`Object.assign`, e por sub-objeto no `FEEL`) sem recarregar a página. `render-config.ts` é aceito por `game.ts`, que reaplica renderer + luzes e preserva `shadows`/`renderScale` escolhidos pelo usuário. Regra: **nunca troque a referência** dos objetos de config (nada de `export let`).

**3. Teste.** Valores de movimento estão presos por `tests/physics/integrate.test.ts` e `collision.test.ts` (alturas de pulo, degraus que sobem ou não, rampas). Se mudar `jumpHeight`, `stepHeight` ou `slopeLimitDeg`, rode `npm test` e ajuste as asserções conscientemente — elas codificam o feel desejado do design (§5.1).

Onde está cada valor:

| Quero mudar… | Arquivo | Objeto |
|---|---|---|
| velocidade, aceleração, pulo, gravidade, step-up, rampa limite | `src/data/movement-config.ts` | `MOVEMENT` (+ `LOCOMOTION`, `RESPAWN`) |
| hFOV, sensibilidade, altura dos olhos, FOV do viewmodel, near/far | `src/data/camera-config.ts` | `CAMERA` |
| kick de pouso, molas de recoil, head bob | `src/data/feel-config.ts` | `FEEL` |
| exposição, névoa, sol, sombras, render scale alternativo, auto-off de sombras | `src/data/render-config.ts` | `RENDER`, `RENDER_SCALE_ALT`, `SHADOW_AUTO_OFF` |
| padrões e faixas do usuário | `src/data/settings-defaults.ts` | `DEFAULT_SETTINGS`, `SETTINGS_RANGES` |
| teclas | `src/data/input-bindings.ts` | `INPUT_BINDINGS` |
| cores | `src/data/palette.ts` | `PALETTE` |

Valores de referência e justificativas: [design técnico §5.1, §5.4, §5.5, §6](02-design-tecnico.md).

## 10. Passo a passo: adicionar um objeto ao Campo de Provas

O nível é **dado** (`src/data/levels/test-ground.ts`, tipo `LevelDef` em `level-def.ts`). `world/level-builder.ts` transforma a lista `props` em 4 meshes por quadrante (cor por vértice) e num `collisionRoot` que o `CollisionWorld` indexa no Octree. Nada de Three.js no nível.

### 10.1 Os tipos disponíveis

```ts
// src/data/levels/level-def.ts (real)
type Vec3 = readonly [number, number, number];      // metros; Y para cima; pos = centro da BASE

interface BoxDef      { kind: 'box';      pos; size: Vec3; color: number; rotY?: number; collider?: boolean; name?: string }
interface RampDef     { kind: 'ramp';     pos; run; rise; width; dirYawDeg; color; name? }
interface CylinderDef { kind: 'cylinder'; pos; radius; height; color; bands?: readonly number[]; segments?: number; name? }
```

Regras que valem para todos:

- `pos` é o centro da **base** (pé), não do volume. Um cubo de 1 m no chão fica em `[x, 0, z]`; empilhado em cima, `[x, 1, z]`.
- `color` vem de `PALETTE` (`src/data/palette.ts`). Não invente hex solto no nível.
- `name` é opcional, mas único dentro do nível (`validateDefs` acusa duplicata). Ajuda a achar o objeto em erro e nos testes.
- `collider: false` (só em `box`) coloca a peça numa mesh "decor" fora do Octree: só visual.
- Rampa: `dirYawDeg` usa a convenção de yaw do jogo (0 → −Z, 90 → −X). A aresta baixa fica em `pos − dir·run/2`, a alta em `pos + dir·run/2`. Ângulo = `atan(rise/run)`. Acima de `slopeLimitDeg` (46°) vira parede.
- Cilindro: `bands` colore faixas horizontais de baixo para cima (cor por centróide de triângulo); `heightSegments` = nº de faixas.

### 10.2 Exemplo: uma plataforma de 2 m com um totem em cima

1. Abra `src/data/levels/test-ground.ts`. Escolha um lugar livre dentro de `bounds.halfSize` (60 m) — a grade de `F6` ajuda a ler coordenadas.

2. Crie um grupo novo usando os helpers `box()`/`ramp()` já existentes no arquivo:

```ts
/** Plataforma de 2 m com totem: testa pulo segurado + silhueta alta. */
const TOTEM_STAND: readonly PrimitiveDef[] = [
  box([-20, 0, 20], [3, 2, 3], PALETTE.propSlate, { name: 'totem-stand' }),
  {
    kind: 'cylinder',
    pos: [-20, 2, 20],            // em cima da plataforma (base em y = 2)
    radius: 0.3,
    height: 2.5,
    color: PALETTE.propBone,
    bands: [PALETTE.propBone, PALETTE.wardenCyan],
    segments: 8,
    name: 'totem',
  },
];
```

3. Inclua o grupo em `TEST_GROUND.props` (a ordem só afeta a leitura do arquivo):

```ts
export const TEST_GROUND = {
  id: 'test-ground',
  name: 'Campo de Provas',
  props: [
    ...FLOOR,
    // ...
    ...TARGETS,
    ...TOTEM_STAND,
  ],
  spawnPoints: SPAWN_POINTS,
  coverPoints: COVER_POINTS,
  killPlaneY: -20,
  bounds: { halfSize: HALF_SIZE },
  debug: { grid: true, axes: true },
} satisfies LevelDef;
```

4. Com `npm run dev` aberto, salve. `test-ground.ts` **não** tem HMR próprio (o mundo é construído uma vez), então recarregue a página (`F5`). Em DEV, `validateDefs(DEFS)` roda ao montar: um erro sai como `DefinitionError` com caminho legível (`levels.test-ground.props[57].size[1]: deve ser > 0`).

5. Verifique no navegador:
   - [ ] O objeto aparece onde esperado (`F6` liga grade e eixos; `T`/`P` para se posicionar).
   - [ ] Colide: ande contra ele; o HUD mostra `grounded` ao pousar em cima.
   - [ ] Draw calls não mudaram (`F3`): primitivas são mescladas por quadrante — um objeto novo custa 0 draw calls a mais.
   - [ ] Contagem de triângulos no HUD subiu (uma caixa custa 12 triângulos; o cilindro depende de `segments` e das faixas).

6. Rode `npm test`: `tests/data/definitions.test.ts` valida o nível e `tests/physics/collision.test.ts` reconstrói o Campo de Provas real. Se o objeto novo cruzar uma trajetória usada nos testes (escada em x = 12, rampas em x ≈ −20, corredor em z = −26, buraco em (20, 20)), um teste pode acusar — mova o objeto ou ajuste o teste com justificativa.

7. Opcional: se o objeto serve à IA (M2), adicione um ponto em `COVER_POINTS`; se for spawn, em `SPAWN_POINTS` (dentro de `halfSize`, `yawDeg` finito).

### 10.3 Adicionar um nível inteiro (planejado para M5)

Crie `src/data/levels/<id>.ts` exportando um objeto `satisfies LevelDef`, registre-o em `LEVELS` (`src/data/index.ts`) com chave igual ao `id`, e troque `TEST_GROUND` por ele em `game.ts` (a seleção de nível por URL ainda não existe — é do roadmap M5). `validateDefs` já cobre qualquer nível registrado.

## 11. Onde olhar quando algo dá errado

| Sintoma | Primeiro lugar a olhar |
|---|---|
| Overlay "WebGL2 indisponível" | `src/core/renderer.ts` (`hasWebGL2`); ative a aceleração de hardware do navegador |
| Mouse não gira a câmera | estado do lock no HUD; `?nolock=1` para isolar; `src/core/pointer-lock.ts` |
| Jogador atravessa/tremula em um objeto | `tests/physics/collision.test.ts` (reproduza lá); `src/core/physics/collision-resolve.ts` |
| Config editada não muda nada | leu o valor para uma variável local? Sistemas devem ler `world.cfg.*` no uso |
| `DefinitionError` ao abrir | caminho no erro aponta o campo em `src/data/` |
| Draw calls altos com `F6` | esperado ≈ +5; se muito mais, `collision.debugHelper()` em `src/world/collision-world.ts` |
| FPS baixo sem GPU | normal em SwiftShader; ver [05-performance.md](05-performance.md) |
| Teste de arquitetura falhou | import de valor entre pastas proibidas; use `import type` ou mova o código |
