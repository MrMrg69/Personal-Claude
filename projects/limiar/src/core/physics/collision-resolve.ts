import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import type { Transform } from '../entity';
import { rad } from '../math';
import type { CapsuleBody } from './capsule-body';
import type { CapsuleHit, CollisionQuery, RayHit } from './collision-query';
import { CollisionLayer } from './layers';
import type { MovementConfig } from './movement-config';

export interface CollisionResolveResult {
  /** Passou de "no ar" para "no chão" neste passo. */
  landed: boolean;
  /** m/s, positivo: velocidade vertical de queda antes do passo (para o kick de pouso). */
  fallSpeed: number;
}

/** Iterações de push-out por passo; suficiente para quinas de 3 planos. */
const MAX_ITERATIONS = 5;
/** Folga (m) somada ao push-out para não ficar em contato numérico. */
const PUSH_EPSILON = 1e-3;
/** Componente horizontal mínima de um contato para saber "de que lado" está o obstáculo. */
const MIN_HORIZONTAL_NORMAL = 1e-3;
/** Margem (m) dos raycasts de step-up/snap para não começar exatamente na superfície. */
const RAY_MARGIN = 0.05;

const capsule = new Capsule();
const stepCapsule = new Capsule();
const hit: CapsuleHit = { normal: new THREE.Vector3(), depth: 0 };
const stepHit: CapsuleHit = { normal: new THREE.Vector3(), depth: 0 };
const rayHit: RayHit = {
  point: new THREE.Vector3(),
  normal: new THREE.Vector3(),
  distance: 0,
  layer: CollisionLayer.None,
  entity: null,
};
const DOWN = new THREE.Vector3(0, -1, 0);
const scratch = new THREE.Vector3();
const pushed = new THREE.Vector3();
const probe = new THREE.Vector3();

function setCapsuleAtFeet(c: Capsule, feet: THREE.Vector3, body: CapsuleBody): void {
  c.start.set(feet.x, feet.y + body.radius, feet.z);
  c.end.set(feet.x, feet.y + body.height - body.radius, feet.z);
  c.radius = body.radius;
}

/**
 * Step-up explícito (design §5.2). Testa a cápsula na posição *antes* do
 * push-out (onde ela penetrou o degrau), elevada de stepHeight; se lá não há
 * parede, um raio para baixo procura o topo do degrau. Se for chão caminhável
 * e a subida couber em stepHeight, aceita a cápsula em cima.
 *
 * Detalhe geométrico que o design não explicita: para degraus mais baixos que
 * o raio (todos os que se sobem sem pulo) a esfera de baixo toca a ARESTA
 * superior do degrau, não a face — a normal é diagonal (0,25 m → normal.y ≈
 * 0,44) e o centro da cápsula ainda está sobre o piso de baixo. Por isso
 * (a) qualquer contato não caminhável dispara a tentativa (a rampa íngreme é
 * rejeitada pela checagem do chão de pouso) e (b) o raio é lançado do lado do
 * contato (centro + r na direção do obstáculo), não do centro.
 * Só é chamado quando o corpo estava no chão.
 */
function tryStepUp(
  query: CollisionQuery,
  body: CapsuleBody,
  cfg: MovementConfig,
  cosSlope: number,
  pushVec: THREE.Vector3,
): boolean {
  // Direção horizontal do obstáculo = oposta ao empurrão.
  probe.set(-pushVec.x, 0, -pushVec.z);
  const horiz = probe.length();
  if (horiz < MIN_HORIZONTAL_NORMAL) return false;
  probe.multiplyScalar(body.radius / horiz);

  stepCapsule.copy(capsule);
  stepCapsule.start.sub(pushVec).y += cfg.stepHeight;
  stepCapsule.end.sub(pushVec).y += cfg.stepHeight;

  if (query.capsuleIntersect(stepCapsule, stepHit)) {
    // Contato caminhável lá em cima é tolerado (empurra uma vez); parede não.
    if (stepHit.normal.y < cosSlope) return false;
    stepCapsule.translate(scratch.copy(stepHit.normal).multiplyScalar(stepHit.depth + PUSH_EPSILON));
  }

  const feetBeforeY = capsule.start.y - body.radius;
  const maxDist = body.radius + cfg.stepHeight + RAY_MARGIN;
  probe.add(stepCapsule.start);
  if (!query.raycast(probe, DOWN, maxDist, CollisionLayer.World, rayHit)) return false;
  if (rayHit.normal.y < cosSlope) return false;

  const rise = rayHit.point.y - feetBeforeY;
  if (rise <= 0 || rise > cfg.stepHeight + PUSH_EPSILON) return false;

  const feetY = rayHit.point.y + PUSH_EPSILON;
  capsule.start.set(stepCapsule.start.x, feetY + body.radius, stepCapsule.start.z);
  capsule.end.set(stepCapsule.start.x, feetY + body.height - body.radius, stepCapsule.start.z);
  body.grounded = true;
  body.groundNormal.copy(rayHit.normal);
  if (body.velocity.y < 0) body.velocity.y = 0;
  return true;
}

/**
 * Slide contra parede/rampa íngreme (e degrau alto demais): remove só a
 * componente da velocidade que entra na superfície; um step-up aceito antes
 * preserva o avanço.
 *
 * Com o corpo no chão a normal usada é só a projeção HORIZONTAL: o Octree
 * devolve a normal AGREGADA quando a cápsula toca chão + parede ao mesmo tempo
 * (diagonal, ex.: (−0,8, 0,6, 0)), e o slide completo converteria o avanço em
 * velocidade vertical — o corpo "quicava" contra a parede alternando air/
 * grounded a cada passo. No ar (pulo contra parede, deslizar por rampa de 53°)
 * a normal completa vale: a velocidade fica tangente à superfície. Teto
 * (normal.y < 0) usa sempre a normal completa para matar a subida.
 */
function slide(vel: THREE.Vector3, normal: THREE.Vector3, onGround: boolean): void {
  if (onGround && normal.y >= 0) {
    const len = Math.hypot(normal.x, normal.z);
    if (len < MIN_HORIZONTAL_NORMAL) return;
    const nx = normal.x / len;
    const nz = normal.z / len;
    const into = vel.x * nx + vel.z * nz;
    if (into < 0) {
      vel.x -= nx * into;
      vel.z -= nz * into;
    }
    return;
  }
  const into = vel.dot(normal);
  if (into < 0) vel.addScaledVector(normal, -into);
}

/**
 * Sonda de chão para o snap: raio do centro dos pés e, se falhar e o corpo
 * estiver se movendo, um segundo raio na borda dianteira da cápsula (centro +
 * r na direção da velocidade). O segundo cobre o instante em que o centro
 * ainda não cruzou a aresta de um degrau recém-subido — sem ele o corpo cai
 * um passo e sobe de novo (trepidação). Andar para fora de uma beirada não é
 * afetado: a borda dianteira já está sobre o vazio.
 */
function probeGround(query: CollisionQuery, body: CapsuleBody, feet: THREE.Vector3, maxDist: number, cosSlope: number): boolean {
  scratch.set(feet.x, feet.y + RAY_MARGIN, feet.z);
  if (query.raycast(scratch, DOWN, maxDist, CollisionLayer.World, rayHit) && rayHit.normal.y >= cosSlope) return true;

  const vx = body.velocity.x;
  const vz = body.velocity.z;
  const speed = Math.hypot(vx, vz);
  if (speed < MIN_HORIZONTAL_NORMAL) return false;
  scratch.x += (vx / speed) * body.radius;
  scratch.z += (vz / speed) * body.radius;
  return query.raycast(scratch, DOWN, maxDist, CollisionLayer.World, rayHit) && rayHit.normal.y >= cosSlope;
}

/**
 * Resolve a colisão da cápsula contra o mundo (design §5.2): push-out iterativo
 * com slide em paredes/rampas íngremes, step-up explícito e snap ao chão ao
 * descer rampas. Puro sobre CollisionQuery; sem alocação.
 */
export function resolveCapsuleCollision(
  t: Transform,
  body: CapsuleBody,
  query: CollisionQuery,
  cfg: MovementConfig,
  out: CollisionResolveResult,
): void {
  const vel = body.velocity;
  const cosSlope = Math.cos(rad(cfg.slopeLimitDeg));
  const wasGrounded = body.grounded;
  const velYBefore = vel.y;
  body.grounded = false;

  setCapsuleAtFeet(capsule, t.position, body);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (!query.capsuleIntersect(capsule, hit)) break;

    pushed.copy(hit.normal).multiplyScalar(hit.depth + PUSH_EPSILON);
    capsule.translate(pushed);

    if (hit.normal.y >= cosSlope) {
      body.grounded = true;
      body.groundNormal.copy(hit.normal);
      if (vel.y < 0) vel.y = 0;
    } else if (!(wasGrounded && cfg.stepHeight > 0 && tryStepUp(query, body, cfg, cosSlope, pushed))) {
      slide(vel, hit.normal, wasGrounded);
    }
  }

  t.position.set(capsule.start.x, capsule.start.y - body.radius, capsule.start.z);

  // Snap ao chão: estava no chão, perdeu contato descendo (rampa) → gruda se o chão está perto.
  if (wasGrounded && !body.grounded && vel.y <= 0) {
    if (probeGround(query, body, t.position, cfg.groundSnapDistance + RAY_MARGIN, cosSlope)) {
      // Esfera de baixo TANGENTE ao plano, não os pés no ponto: colocar os pés no
      // ponto penetra r·(1−cosθ) na rampa e o push-out do passo seguinte devolve
      // r·(1/cosθ−1) — serrote de 12 cm a 40°.
      t.position.y = rayHit.point.y + body.radius * (1 / rayHit.normal.y - 1);
      body.grounded = true;
      body.groundNormal.copy(rayHit.normal);
      vel.y = 0;
    }
  }

  if (body.grounded) {
    body.timeSinceGrounded = 0;
    body.airborneByJump = false;
  }

  out.landed = !wasGrounded && body.grounded;
  out.fallSpeed = out.landed ? Math.max(0, -velYBefore) : 0;
}
