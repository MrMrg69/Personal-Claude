# LIMIAR — Design técnico final (M0: esqueleto)

> Documento consolidado pelo arquiteto-chefe a partir de três propostas técnicas julgadas por dois juízes independentes. Base: Proposta 3 ("performance e simplicidade"), vencedora no placar agregado. Enxertos: rig de câmera/viewmodel, hFOV, sensibilidade em °/contagem, offsets aditivos de cabeça + mola, HMR de configuração e painel lil-gui (Proposta 1); `queue/flush` no event bus, `CollisionLayer`, RNG seedável, `SaveStore` versionado, física de cápsula generalizada, injeção de input para e2e, teste de arquitetura e teste de definições (Proposta 2). Todos os erros factuais apontados pelos juízes estão corrigidos aqui (lista no §0.3).
>
> Este documento é **autocontido**: um implementador deve conseguir escrever o esqueleto (M0) só com ele. Código em inglês; comentários e documentação em português do Brasil.
>
> Escopo de M0 (Seção 5 do master prompt): estrutura de pastas + `package.json` + esqueleto rodando (janela Three.js, câmera em primeira pessoa WASD + mouse look, chão de teste) — e **parar**. Armas e combate entram em M1. A arquitetura abaixo, porém, já sustenta o MVP inteiro (Seção 3) e o roadmap sem reescrita (§11 e §13).

---

## 0. Resumo executivo

### 0.1 Decisões-chave (uma linha cada)

| # | Decisão | Por quê |
|---|---|---|
| 1 | Nome **LIMIAR**, slug `limiar` (`projects/limiar/`, `docs/limiar/`) | Original, curto, PT-BR, sem acento no slug. "Véspera" colide com *Vesper of Radius* / *Vesper's Host* de Destiny 2. |
| 2 | **Uma dependência de runtime: `three@0.185.1`.** Sem zod, sem three-mesh-bvh, sem physics WASM, sem pós-processamento em M0 | Bundle < 250 KB gz; menor risco; cada KB futuro precisa justificar. |
| 3 | Arquitetura **híbrida sem ECS genérico**: entidades tipadas por `kind` num `EntityStore`, sistemas em lista ordenada, `EventBus` tipado com `emit` síncrono + `queue/flush` por passo fixo | Escala do jogo é centenas de entidades; ECS não resolve o gargalo real (draw calls). `queue/flush` evita o bug "morte durante iteração". |
| 4 | **Loop com timestep fixo 60 Hz + interpolação**; look do mouse aplicado no frame de render; bordas de input limpas em `endFixedStep()` | Determinismo/testes; mira sem latência; pulo não se perde a 144 Hz. |
| 5 | Colisão **cápsula × `Octree` de `three/addons`** atrás da interface `CollisionWorld` (com `CollisionLayer`, `RayHit.entity` e registro de hitboxes) | 0 KB extra; gatilho explícito para migrar a `three-mesh-bvh`. |
| 6 | Física de cápsula **genérica** (`integrateCapsuleBody`) consumida por jogador hoje e inimigos cinemáticos depois via `MoveIntent` | IA só escreve intenção; nada de `enemy-movement.ts` paralelo. |
| 7 | **Rig**: `root(yaw) → head(pitch + offsets aditivos) → worldCamera` e `viewmodelRoot → viewmodelCamera(layer 1, FOV 55°) → weaponSocket`; duas passadas com `clearDepth` e `shadowMap.autoUpdate=false` | Arma não atravessa parede nem estica em FOV alto; sombra renderiza 1× por frame. |
| 8 | **hFOV 95°** como fonte da verdade; sensibilidade **0,022°/contagem × multiplicador**; clamp de pitch aplicado **depois** de somar recoil | Convenções comparáveis com outros shooters; ultrawide não "zooma". |
| 9 | Dados em **módulos TS `satisfies XDef`** + `validateDefs()` em DEV + `definitions.test.ts` (ids únicos, refs cruzadas) | Custo zero de runtime; validação onde importa (teste). |
| 10 | Configs de feel (movimento/câmera/feel/render) com **`import.meta.hot.accept` + `Object.assign`** e painel **lil-gui** (de `three/addons`, `import()` dinâmico só em DEV) | Ajustar feel em < 100 ms sem dependência nova. |
| 11 | Render: `MeshLambertMaterial` flat + vertex colors, 1 hemisférica + 1 direcional, **`PCFShadowMap` 2048² com snap de texel**, `NeutralToneMapping`, `FogExp2 = clearColor`, DPR ≤ 1,5 + render scale | 60 fps em iGPU; matiz preservado para cores de raridade. |
| 12 | Mundo de teste é **dado** (`data/levels/test-ground.ts` → `world/level-builder.ts`), com `spawnPoints`/`coverPoints` já no tipo | Mesmo caminho do mapa de patrulha do MVP. |
| 13 | Pointer lock com **modo fallback sem lock** + `window.__limiar.input.inject()` → e2e determinístico em Chromium headless | Pointer lock não funciona em headless. |
| 14 | Escopo M0 disciplinado: sprint, pulo com hold, step-up, kick de pouso e slot de recoil **sim**; crouch/slide/head-bob **não** (head-bob fica na config, desligado) | "Parar e mostrar rodando" antes de armas. |

### 0.2 O que foi enxertado (origem)

- P1: rig de duas câmeras/camadas (§5.3, §6.3), hFOV e sensibilidade em °/contagem (§5.4), offsets aditivos + `Spring` (§5.5), `jumpHoldGravityScale` (§5.1), HMR + lil-gui (§3.5), alvos cilíndricos e poste de 1,80 m (§7), auto-desligar sombras e `?shadows=0` (§6.4), critério objetivo de "pronto" (§13).
- P2: `queue/flush` (§3.4), `CollisionLayer` + `RayHit.entity` (§5.2), `Random` mulberry32 (§3.6), `SaveStore` com envelope versionado (§3.6), `integrateCapsuleBody` genérica (§5.1), `input.inject()` (§4.3, §9), `tests/architecture.test.ts` e `definitions.test.ts` (§9), `elements.ts`/`factions.ts` já no registro (§3.5), ADRs numeradas em `docs/limiar/decisoes/` (§10), nome de facção "Axioma" (§2).
- P3 (base): tudo o mais.

### 0.3 Erros factuais corrigidos (em relação às propostas)

1. `Octree` de three r185 **tem** `rayIntersect(ray)` acelerado por sub-árvores (menos eficiente que BVH, mas não força bruta). Usado aqui para hitscan até o gatilho de migração.
2. `WebGLCapabilities` **não** detecta mobile; heurística de hardware fraco aqui é por **medição** (média de frame > 20 ms por 3 s).
3. Bordas de input **não** são descartadas por frame: limpas só em `endFixedStep()` (a 144 Hz há frames sem passo fixo).
4. e2e **não** depende de pointer lock: usa `?nolock=1` + `input.inject()`.
5. Duas passadas de render **não** renderizam o shadow map duas vezes: `shadowMap.autoUpdate = false` + `needsUpdate = true` uma vez por frame.
6. Vite 8 (rolldown): `build.rollupOptions.output.advancedChunks` no lugar do deprecado `manualChunks`.
7. `@types/node` alinhado ao runtime alvo: `22.20.1` (não 26.x).
8. Componentes de entidade são **interfaces de dados**, não classes; serialização por `JSON.stringify` funciona sem registro extra.
9. Rampa de teste especificada por **projeção horizontal × subida** (sem inconsistência trigonométrica).
10. Buraco no chão construído com **4 lajes** (não "2 caixas + recorte").
11. Nenhuma "rampa lenta": inclinação abaixo do limite é chão normal; acima é parede (escorrega). Ponto.
12. Nomes com colisão removidos: sem `drifter`/Errante, sem `rift`/Fenda, sem `surge`, sem `bastion`, sem Arcanista, sem Faísca, sem Deriva, sem Eclipse (Lightfall = "Eclipse" em espanhol).

---

## 1. Nome do jogo e identidade

**Nome: LIMIAR.** Slug `limiar`. Código em `/home/user/Personal/projects/limiar/`, documentação em `/home/user/Personal/docs/limiar/`.

Justificativa: uma palavra, PT-BR, sem acento, evoca "a fronteira entre o que ainda vive e o que já foi engolido". "Véspera" (proposto por P1 e P2) foi descartado por colidir com *Vesper of Radius* (exótico de Warlock) e *Vesper's Host* (dungeon) de Destiny 2.

**Frase de identidade:**

> *Um planeta-fronteira na órbita de uma estrela que apaga. Uma Maré de silêncio avança pela superfície e desfaz tudo o que toca. Os Vigias seguram a última faixa iluminada — o Limiar — com armas recuperadas de três eras de guerra, sob um crepúsculo que nunca termina.*

**Identidade visual (que é também a estratégia de performance):** low-poly com *flat shading*, sem texturas (cor por vértice), silhuetas grandes e legíveis a 20–60 m. Paleta de **crepúsculo permanente**: chão ocre/terracota, paredes cinza-quente, céu/névoa lilás-acinzentado, sol baixo âmbar; **ciano-esverdeado** é a tecnologia dos Vigias, **magenta** é a cor da Maré. Sem PBR, sem HDRI, sem pós-processamento no MVP. A leitura de raridade por cor (cinza/verde/azul/roxo/dourado) depende de tone mapping que preserve matiz — por isso `NeutralToneMapping` (§6).

---

## 2. Nomenclatura original

Todos os nomes são originais; a coluna "≈ Destiny" é apenas referência interna e nunca aparece no jogo. Léxico completo com ids no §14.

| Conceito | Nome em LIMIAR | Id em código |
|---|---|---|
| Jogador ("Guardião") | **Vigia** (pl. Vigias) | `warden` |
| Classe tanque | **Baluarte** | `bulwark` |
| Classe mobilidade (MVP) | **Rastreador** | `ranger` |
| Classe área/suporte | **Tecelão / Tecelã** | `weaver` |
| Facção robótica | **Axioma** (unidades: Lema, Corolário, Postulado) | `axiom` |
| Facção pirata-tecnológica | **Ferrugem** (Corsários da Ferrugem) | `rust` |
| Facção orgânica-fanática | **Cepa** | `strain` |
| Elemento queima contínua | **Brasa** (laranja) | `ember` |
| Elemento cadeia/atordoamento | **Ressonância** (ciano) | `resonance` |
| Elemento enfraquecimento | **Névoa** (roxo-magenta) | `haze` |
| Slots de arma | **Ferro / Afim / Pesado** | `iron` / `attuned` / `heavy` |
| Super | **Ápice** | `apex` |
| Unidade de poder | **Lume** ("Lume 240") | `lume` |
| Companheiro/IA (pós-MVP) | **Eco** | `echo` |
| Antagonista ambiental | **a Maré** | `tide` |

Por que não "Arcanista"/"Caçador"/"Vanguarda" do master prompt: "Arcano" e "Caçador" são os nomes oficiais em PT-BR de Destiny 2 e "Vanguarda" é uma entidade da franquia; o master prompt pede nomes próprios. `elements.ts` e `factions.ts` já entram em M0 como dados (§3.5) para provar o pipeline e aparecer no HUD de debug.

---

## 3. Arquitetura de código

### 3.1 Padrão: módulos + entidades tipadas + sistemas ordenados + eventos (sem ECS genérico)

**Por que não ECS (bitecs/miniplex/próprio)?** Pico do MVP: 1 jogador, ≤ 40 inimigos, ≤ 100 projéteis/efeitos, ≤ 30 drops — centenas de entidades, não milhares. O gargalo em Three.js é draw call/fill-rate, não o loop JS. Um ECS próprio com queries incrementais é o componente de maior risco de bug sutil; um ECS de terceiros é dependência para ~200 linhas. Registrado em `docs/limiar/decisoes/0001-sem-ecs-generico.md`; revisitar apenas se > 2 000 entidades ativas.

**Por que não classes gordas com `update()`?** A ordem de atualização (input → movimento → colisão → armas → IA → câmera) precisa ser explícita e testável.

**O que fica:**

- **Entidades** são interfaces TS de dados puros (sem métodos) com um discriminador `kind`. Cada `kind` tem uma fábrica `createX()` em `entities/`. Vivem num `EntityStore` (core) que mantém listas por `kind` e um mapa por id. Composição transversal é feita por interfaces (`Damageable`, `HasCapsuleBody`) e type guards — nunca por herança.
- **Sistemas** são objetos `{ name, fixedUpdate?, frameUpdate?, dispose? }` registrados numa **lista ordenada única** em `src/game/systems-list.ts`. Sistemas não guardam estado de entidades; só caches próprios.
- **Dados** (config de jogador/câmera/feel/render, nível, elementos, facções; depois armas, inimigos, itens, classes) são módulos TS `satisfies XDef`, validados em DEV e em teste (§3.5).
- **Three.js é detalhe de renderização.** A simulação lê/escreve `transform` das entidades; só `view-sync`/`camera-sync` tocam `Object3D`. Testes de movimento rodam em Node sem WebGL.
- **EventBus tipado** com `emit` síncrono (recoil no mesmo frame) e `queue/flush` ao fim de cada passo fixo (morte/loot sem mutar listas durante iteração).

### 3.2 Regras de dependência entre pastas (verificadas por teste)

| Pasta | Pode importar | Não pode importar |
|---|---|---|
| `src/core/` | `three`, `core/` | `data/`, `entities/`, `systems/`, `world/`, `ui/`, `game/` |
| `src/data/` | `data/`, **`import type`** de `core/` | `three` (valor), qualquer outra pasta |
| `src/entities/` | `three`, `core/`, `data/` | `systems/`, `ui/`, `game/` |
| `src/world/` | `three`, `core/`, `data/` | `entities/`, `systems/`, `ui/`, `game/` |
| `src/systems/` | `three`, `core/`, `data/`, `entities/`, `world/`, `import type` de `game/world` | `ui/` |
| `src/ui/` | `core/`, `data/`, `import type` de `game/` | `three` (HUD é DOM), `systems/` |
| `src/game/` | tudo | — |

`tests/architecture.test.ts` lê os fontes via `import.meta.glob('/src/**/*.ts', { query: '?raw', import: 'default', eager: true })` e aplica regex sobre os `import` de cada arquivo (ignora `import type`). Custa 20 linhas e impede o esqueleto de degradar.

### 3.3 Contratos TS principais (assinaturas que serão escritas)

```ts
// src/core/time.ts
export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.1;
export const MAX_STEPS_PER_FRAME = 5;

// src/core/loop.ts
export interface LoopCallbacks {
  fixedUpdate(dt: number): void;                  // 0..N vezes por frame
  frameUpdate(dt: number, alpha: number): void;   // 1x por frame; alpha ∈ [0,1]
  render(): void;
}
export class GameLoop {
  constructor(cb: LoopCallbacks, fixedDt?: number);
  tick(nowMs: number): void;        // chamado por renderer.setAnimationLoop
  pause(): void;                    // congela simulação; render continua
  resume(): void;                   // zera acumulador e lastMs
  readonly paused: boolean;
  readonly stats: { stepsLastFrame: number; frameDt: number; simTime: number; droppedSteps: number };
}

// src/core/entity.ts
export type EntityId = number & { readonly __brand: 'EntityId' };
export interface Transform {
  position: THREE.Vector3;        // pés da entidade, em metros
  prevPosition: THREE.Vector3;    // passo anterior, para interpolação
  yaw: number;                    // rad; corpo gira só em Y
}
export interface EntityBase {
  readonly id: EntityId;
  readonly kind: string;          // discriminador; cada kind tem sua interface em entities/
  alive: boolean;                 // false = removida no próximo flush do EntityStore
  transform: Transform;
  view?: THREE.Object3D;          // presença visual opcional
}
export class EntityStore<E extends EntityBase> {
  add<T extends E>(e: T): T;                                  // efetivo imediatamente
  remove(id: EntityId): void;                                 // marca alive=false; removido em flushRemovals()
  get(id: EntityId): E | undefined;
  ofKind<K extends E['kind']>(kind: K): readonly Extract<E, { kind: K }>[];  // array estável por kind
  all(): Iterable<E>;
  flushRemovals(): void;                                      // chamado pelo loop ao fim de cada passo fixo
  readonly size: number;
}
export function allocEntityId(): EntityId;

// src/entities/index.ts — união discriminada; cresce a cada kind novo
export type AnyEntity = PlayerEntity | StaticWorldEntity;   // M2+: | EnemyEntity | ProjectileEntity | LootEntity
export type EntityKind = AnyEntity['kind'];

// src/core/physics/capsule-body.ts
export interface CapsuleBody {
  radius: number; height: number;          // cápsula: altura total dos pés ao topo
  velocity: THREE.Vector3;
  grounded: boolean; groundNormal: THREE.Vector3;
  timeSinceGrounded: number;               // coyote time
  jumpBufferTimer: number;                 // jump buffer
  jumpHoldTimer: number;                   // tempo com pulo segurado desde o salto
  airborneByJump: boolean;                 // evita "pulo duplo" via coyote depois de pular
  layer: CollisionLayer; mask: CollisionLayer;
}
export interface MoveIntent {
  dir: THREE.Vector2;      // (x = direita, y = frente) em [-1,1], espaço local do yaw
  yaw: number;             // rad; direção "frente"
  sprint: boolean;
  jumpPressed: boolean;    // borda
  jumpHeld: boolean;       // nível
}
export function integrateCapsuleBody(
  t: Transform, body: CapsuleBody, intent: MoveIntent, cfg: MovementConfig, dt: number,
  out: { jumped: boolean },
): void;   // função pura (sem colisão); ver §5.1

// src/entities/player.ts
export interface PlayerEntity extends EntityBase {
  kind: 'player';
  body: CapsuleBody;
  intent: MoveIntent;          // escrito por player-input; lido por player-physics
  look: { yaw: number; pitch: number };   // yaw/pitch da cabeça (rad); yaw copiado para transform.yaw
  locomotion: 'idle' | 'walk' | 'sprint' | 'air';
  lastSafePosition: THREE.Vector3;        // respawn (kill plane)
}
export function createPlayer(cfg: MovementConfig, spawn: SpawnPoint): PlayerEntity;

// src/entities/static-world.ts
export interface StaticWorldEntity extends EntityBase { kind: 'static'; root: THREE.Group }

// src/systems/system.ts
export interface System {
  readonly name: string;
  init?(world: World): void;
  fixedUpdate?(world: World, dt: number): void;
  frameUpdate?(world: World, dt: number, alpha: number): void;
  dispose?(world: World): void;
}

// src/game/world.ts — contexto injetado em todo sistema (nada global)
export interface World {
  readonly scene: THREE.Scene;
  readonly rig: CameraRig;                    // §5.3
  readonly input: InputState;                 // §4.3
  readonly events: EventBus<GameEvents>;      // §3.4
  readonly collision: CollisionWorld;         // §5.2
  readonly rng: Random;                       // §3.6
  readonly entities: EntityStore<AnyEntity>;
  readonly cfg: GameConfig;                   // { movement, camera, feel, render } — objetos mutáveis (HMR/painel)
  readonly level: LevelDef;
  readonly settings: Settings;                // persistidas (sensibilidade, hfov, sombras, renderScale, debugHud)
  readonly stats: DebugStats;
  player: PlayerEntity;
  state: GameState;                           // ver §4.4
  time: { sim: number; frame: number; step: number };
}
```

### 3.4 EventBus tipado

```ts
// src/core/events.ts
export class EventBus<E extends Record<string, object>> {
  on<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void;   // retorna unsubscribe
  once<K extends keyof E>(type: K, fn: (p: E[K]) => void): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): void;                // síncrono
  queue<K extends keyof E>(type: K, payload: E[K]): void;               // entregue em flush()
  flush(): void;                                                         // chamado pelo loop ao fim de cada passo fixo
  clear(): void;
}

// src/game/events.ts
export interface GameEvents {
  'game:stateChanged': { from: GameState; to: GameState };
  'game:paused': { reason: 'pointerlock' | 'visibility' | 'user' };
  'game:resumed': Record<string, never>;
  'input:lockChanged': { locked: boolean; mode: 'locked' | 'unlocked' };
  'player:jumped': { fromGround: boolean };
  'player:landed': { fallSpeed: number };           // m/s, positivo
  'player:locomotionChanged': { from: PlayerEntity['locomotion']; to: PlayerEntity['locomotion'] };
  'player:respawned': { reason: 'killplane' | 'debug' };
  'camera:kick': { pitchDeg: number; yawDeg: number; posBack: number };  // slot de recoil (F9 em M0; armas em M1)
  'render:shadowsChanged': { enabled: boolean; auto: boolean };
  'config:changed': { path: string };               // HMR ou painel
  // Reservados (assinaturas fixadas agora; sistemas em M1+):
  'weapon:fired': { weaponId: string; kick: { pitchDeg: number; yawDeg: number; posBack: number } };
  'hit:confirmed': { entity: EntityId; damage: number; crit: boolean; killed: boolean };
  'entity:died': { entity: EntityId; killer: EntityId | null };
  'loot:dropped': { itemInstanceId: string; position: [number, number, number] };
  'item:equipped': { slot: WeaponSlotId; itemInstanceId: string };
  'power:changed': { lume: number };
}
```

Regra: `emit` para reações no mesmo frame (recoil, hitmarker, som); `queue` para consequências que criam/removem entidades (`entity:died` → loot). O loop chama `events.flush()` **e depois** `entities.flushRemovals()` ao fim de cada passo fixo.

### 3.5 Dados: formato, registro e validação

- **Formato: módulos TS.** `export const AUTO_RIFLE_BASIC = { ... } satisfies WeaponDef;` — tipagem no editor, tree-shaking, zero parse em runtime, referências por import.
- **Registro:** `src/data/index.ts` exporta `DEFS = { elements, factions, levels, /* M1+: weapons, enemies, items, lootTables, classes, abilities */ }` como `Record<string, Readonly<Record<string, Def>>>`; ids são `keyof typeof X` (id errado = erro de compilação).
- **Validação de runtime só em DEV:** `validateDefs(DEFS)` roda em `game.ts` dentro de `if (import.meta.env.DEV)`; checa ids únicos por família, referências cruzadas declaradas (ex.: `faction.color` é hex válido; em M1: `weapon.element ∈ elements`, `enemy.lootTable ∈ lootTables`) e regras numéricas (`magazine ≤ reserve`). Lança `DefinitionError('weapons.auto-rifle-basic.magazine: ...')`.
- **A mesma função roda em `tests/data/definitions.test.ts`** — dado quebrado falha no `npm test` antes de chegar ao navegador. Isso substitui o zod com custo zero de bundle. Se um dia dados vierem de JSON externo (modding), `valibot` entra só na fronteira de carregamento (decisão adiada, ADR 0005).
- **Já em M0:** `data/elements.ts` (Brasa/Ressonância/Névoa com cor e descrição), `data/factions.ts` (Axioma/Ferrugem/Cepa com cor, descrição de silhueta), `data/levels/test-ground.ts`, `data/movement-config.ts`, `data/camera-config.ts`, `data/feel-config.ts`, `data/render-config.ts`, `data/input-bindings.ts`, `data/palette.ts`, `data/settings-defaults.ts`.

**Configs mutáveis com HMR (enxerto da P1, versão enxuta):**

```ts
// src/data/movement-config.ts
import type { MovementConfig } from '@/core/physics/movement-config';
export const MOVEMENT: MovementConfig = { walkSpeed: 6.0, /* ... §5.1 */ };
// HMR: nunca troque a referência — sistemas leem MOVEMENT.x no momento do uso.
if (import.meta.hot) {
  import.meta.hot.accept((mod) => { if (mod) Object.assign(MOVEMENT, mod.MOVEMENT); });
}
```

Regra de código: sistemas **leem `world.cfg.movement.walkSpeed` no momento do uso**, nunca copiam para variáveis em `init`. Assim HMR e painel (§8) valem no próximo passo. `render-config` é a exceção: mudanças de render precisam de aplicação explícita (`applyRenderConfig(renderer, cfg)`), chamada pelo painel e pelo callback de HMR.

### 3.6 Utilidades de core previstas para o roadmap (implementadas em M0 porque são pequenas)

- `core/math/random.ts`: `class Random { constructor(seed: number); next(): number /*[0,1)*/; range(min,max); int(min,max); pick<T>(arr); seed }` — mulberry32. `World.rng` é criado com `?seed=` da URL ou `Date.now()`. Loot com rolagem reprodutível em teste depende disso.
- `core/storage.ts`: `SaveStore<T>` com envelope `{ version, savedAt, payload }` em `localStorage`, `migrations: Array<(old: unknown) => unknown>` aplicadas em sequência, `load(): T | null`, `save(payload)`, `clear()`. Em M0 persiste só `Settings` (chave `limiar.settings`). Inventário/loadout/progressão em M4 usam a mesma classe.
- `core/math/spring.ts`: `class Spring { value; velocity; constructor(zeta, omega); kick(dv); kickToPeak(peak); step(dt); reset(); static peakFactor(zeta) }` — mola amortecida integrada pela solução fechada do oscilador (exata para qualquer dt, sem sub-passos). `kickToPeak(peak)` = `kick(peak·ω / peakFactor(ζ))`: a resposta ao impulso só atinge `peakFactor(ζ)·v0/ω` (≈ 0,50 em ζ = 0,6; e⁻¹ em ζ = 1), então o pico anunciado no config é o pico real. Usada pelo kick de pouso e pelo slot de recoil.
- `core/math/index.ts`: `clamp`, `lerp`, `damp(a,b,lambda,dt)` (= `MathUtils.damp`), `moveTowards`, `moveTowardsVec2XZ`, `deg`, `rad`, `snapToGrid`, `rayCapsule(origin, dir, capsule, out)`.
- `core/url-flags.ts`: lê `?nolock=1`, `?shadows=0`, `?debug=1`, `?scale=0.75`, `?seed=123`, `?hud=1`.

---

## 4. Game loop

### 4.1 Timestep fixo com interpolação (decisão)

Simulação a **60 Hz fixos** (`FIXED_DT = 1/60`), render na taxa do monitor via `renderer.setAnimationLoop(t => loop.tick(t))`. Posições renderizadas = `lerp(prevPosition, position, alpha)`. Determinismo prático: pulo sobe a mesma altura em 60 e 144 Hz; deslocamento máximo por passo conhecido (12 m/s × 1/60 = 0,2 m < raio 0,4 m → sem tunelamento); cooldowns e recoil em passos inteiros; testes chamam `fixedUpdate` N vezes e comparam números exatos. Timestep variável e semi-fixo rejeitados (ADR 0002).

### 4.2 Algoritmo

```ts
tick(nowMs) {
  const frameDt = Math.min((nowMs - this.lastMs) / 1000, MAX_FRAME_DT);
  this.lastMs = nowMs;
  if (!this.paused) {
    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.cb.fixedUpdate(FIXED_DT); this.acc -= FIXED_DT; steps++;
    }
    if (this.acc >= FIXED_DT) { this.stats.droppedSteps++; this.acc = 0; } // não tenta "alcançar"
    this.stats.stepsLastFrame = steps;
  }
  this.cb.frameUpdate(frameDt, this.paused ? 1 : this.acc / FIXED_DT);
  this.cb.render();
}
```

Relógio: o `timestamp` do `setAnimationLoop` (≡ `performance.now()`). Não usamos `THREE.Timer`/`Clock` — o loop controla acumulador e pausa; `resume()` zera `lastMs` e `acc` (não integra 30 s de aba oculta; o clamp de 0,1 s é a segunda rede).

**Ordem em `fixedUpdate`** (lista em `game/systems-list.ts`):

| # | Sistema | Faz |
|---|---|---|
| 1 | `player-input` | `InputState` + `look.yaw` → `player.intent` (dir, sprint, jumpPressed, jumpHeld) |
| 2 | `character-physics` | para toda entidade com `body`: `integrateCapsuleBody` + `resolveCapsuleCollision` (§5.1–5.2), eventos `player:jumped/landed` |
| 3 | `kill-plane` | `y < level.killPlaneY` → respawn em `lastSafePosition`, `player:respawned` |
| 4 | `locomotion-state` | deriva `player.locomotion` de velocidade/grounded/sprint; emite `player:locomotionChanged` |
| — | (M1+: `weapons` → `projectiles` → `ai` → `damage` → `abilities` → `loot` → `pickup` → `lifetime`) | entram entre 3 e 4 |
| fim | loop | `events.flush()` → `entities.flushRemovals()` → `input.endFixedStep()` |

**Ordem em `frameUpdate`:**

| # | Sistema | Faz |
|---|---|---|
| 1 | `player-look` | `input.consumeMouseDelta` → `look.yaw/pitch` (§5.4); `transform.yaw = look.yaw` |
| 2 | `camera-feel` | molas (kick de pouso, recoil), FOV dinâmico, head-bob (se ligado) → offsets do `head` |
| 3 | `view-sync` | `lerp(prev, pos, alpha)` → `entity.view.position` para toda entidade com `view` |
| 4 | `camera-sync` | `rig.root.position` = pé interpolado; `rig.root.rotation.y = yaw`; `head` = pitch + offsets; câmera de sombra segue o jogador com snap |
| 5 | `debug-stats` | acumula frame time, lê `renderer.info` (após o render do frame anterior) |
| — | (M1+: `viewmodel-anim`, `hud`, `audio`, `vfx`) | entram entre 4 e 5 |

`render()` é o `Renderer.renderFrame()` de §6.3.

### 4.3 Amostragem de input

```ts
// src/core/input.ts
export type Action =
  | 'forward' | 'back' | 'left' | 'right' | 'jump' | 'sprint' | 'crouch'
  | 'fire' | 'aim' | 'reload' | 'melee' | 'grenade' | 'classAbility' | 'super' | 'interact' | 'swapWeapon'
  | 'debugHud' | 'debugPanel' | 'debugHelpers' | 'debugShadows' | 'debugRenderScale' | 'debugKick'
  | 'debugRespawn' | 'debugTeleport' | 'pause';
export interface InputState {
  isDown(a: Action): boolean;
  justPressed(a: Action): boolean;     // borda; limpa só em endFixedStep()
  justReleased(a: Action): boolean;
  moveAxis(out: THREE.Vector2): THREE.Vector2;           // (x=direita, y=frente) normalizado
  consumeMouseDelta(out: THREE.Vector2): THREE.Vector2;  // contagens acumuladas desde a última chamada; zera
  endFixedStep(): void;                // limpa bordas
  reset(): void;                       // solta tudo (pausa, perda de foco)
  inject(partial: Partial<Record<Action, boolean>>, mouseDelta?: [number, number]): void;  // e2e/bots
  attach(target: HTMLElement): void; detach(): void;
}
```

- Teclado: `keydown`/`keyup` no `window`, indexado por **`KeyboardEvent.code`** (`KeyW` funciona em ABNT2/AZERTY). `preventDefault` só para códigos mapeados (evita rolar a página com espaço e abrir busca com F3). `event.repeat` ignorado.
- Mouse: `mousemove` acumula `movementX/Y` (com `unadjustedMovement`, ≈ contagens do sensor); botões via `mousedown/mouseup` (`button` 0 = `fire`, 2 = `aim`); `contextmenu` bloqueado no canvas; `wheel` → `swapWeapon`.
- **Bordas (`justPressed`) são limpas apenas em `endFixedStep()`**, nunca por frame. A 144 Hz ~58 % dos frames têm zero passos fixos; um toque de pulo nesses frames precisa sobreviver até o próximo passo. Com 2 passos num frame, o primeiro consome a borda — correto. Teste unitário: "pressionar, rodar 2 frames sem passo, rodar 1 passo → `justPressed` true; segundo passo → false".
- `inject()` marca ações como "seguradas até o próximo `inject`/`reset`" (modo sintético) — o e2e usa isso porque não há pointer lock em headless; o mesmo mecanismo serve para replay/bots.
- Mapeamento `code → Action` em `data/input-bindings.ts` (rebind futuro sem tocar em `core/input.ts`):
  `KeyW/ArrowUp forward`, `KeyS back`, `KeyA left`, `KeyD right`, `Space jump`, `ShiftLeft sprint`, `ControlLeft/KeyC crouch` (reservado), `Mouse0 fire`, `Mouse2 aim`, `KeyR reload`, `KeyF melee`, `KeyQ grenade`, `KeyE classAbility`, `KeyX super`, `KeyG interact`, `Wheel swapWeapon`, `F3 debugHud`, `F4 debugPanel`, `F6 debugHelpers`, `F7 debugShadows`, `F8 debugRenderScale`, `F9 debugKick`, `KeyP debugRespawn` (com `?debug`), `KeyT debugTeleport` (com `?debug`), `Escape pause` (só no modo sem lock).

### 4.4 Estado, pausa e pointer lock

```ts
export type GameState = 'booting' | 'ready' | 'running' | 'paused' | 'error';
export type InputMode = 'locked' | 'unlocked';   // unlocked = fallback sem pointer lock
```

- `booting` → cria renderer/cena/mundo → `ready` (overlay "Clique para jogar").
- Clique no overlay → tenta `canvas.requestPointerLock({ unadjustedMovement: true })` (Promise no Chromium; se rejeitar com `NotSupportedError`, tenta sem opções; Firefox devolve `undefined`). Se `?nolock=1` **ou** `pointerlockerror` **ou** a Promise rejeitar por outro motivo → **modo `unlocked`**: overlay some, `running`, o mouse gira a câmera por `movementX/Y` mesmo sem lock, e `Escape` pausa (overlay volta). Isso serve iframes, Safari antigo e o e2e.
- `pointerlockchange` com `pointerLockElement !== canvas` **e** `inputMode === 'locked'` **e** `!tuningMode` → `paused` (`reason: 'pointerlock'`), `input.reset()`, overlay "Pausado — clique para continuar".
- `visibilitychange` → hidden: `document.exitPointerLock()` + `paused` (`reason: 'visibility'`).
- Enquanto `paused`: loop **continua renderizando** (cena parada atrás do overlay, resize funciona) com `alpha = 1`, sem passos fixos.
- Cooldown do Chromium (~1 s para relock após Esc): `pointerlockerror` → overlay "Aguarde um instante e clique de novo" com botão desabilitado por 1,2 s (contador).
- **Modo de tuning (F4, só DEV):** `tuningMode = true`, `document.exitPointerLock()`, painel lil-gui visível, **simulação continua rodando** (WASD funciona, mouse livre para o painel). F4 de novo ou clique no canvas → relock e painel esconde. Sem isso, o painel seria inútil (pausaria o que se quer observar).
- `webglcontextlost` → `error`, overlay "Contexto gráfico perdido — recarregue a página". Sem WebGL2 → `error` com mensagem antes de criar o loop.

---

## 5. Controlador em primeira pessoa

### 5.1 Física do movimento (valores em `data/movement-config.ts`)

Unidade: **1 unidade = 1 metro**, Y para cima. Convenção de yaw: `yaw = 0` olha para **−Z**; `forward = (−sin yaw, 0, −cos yaw)`, `right = (cos yaw, 0, −sin yaw)`.

| Parâmetro | Valor | Justificativa |
|---|---|---|
| `capsuleRadius` / `capsuleHeight` | **0,40 m / 1,80 m** (segmento de 1,0 m entre centros; `start = pés + 0,4`, `end = pés + 1,4`) | Base arredondada ajuda em quinas; 0,4 m > deslocamento máximo por passo. |
| `eyeHeight` | **1,62 m** | |
| `walkSpeed` | **6,0 m/s** | Destiny ≈ 6–7 m/s; mapa de 120 m em 20 s. |
| `sprintSpeed` | **8,5 m/s** (Shift, só com `dir.y > 0,5`) | Rastreador ganha +8 % via `ClassDef` em M3. |
| `groundAccel` | **60 m/s²** | 0 → 6 m/s em 0,1 s: responsivo com peso. |
| `groundDecel` | **80 m/s²** | Para em ~0,08 s. Destiny não desliza ao soltar a tecla. |
| `airAccel` | **12 m/s²** | Corrige pulos; não "voa". |
| `airMaxSpeed` | = `walkSpeed` | Controle aéreo não **ganha** velocidade acima de andar — e nunca **freia** o momentum já existente (sprint-jump mantém 8,5 m/s segurando W). |
| `gravity` | **−24 m/s²** | ≈ 2,45 g: descida "snappy". |
| `jumpHeight` | **1,40 m** (toque) | Sobe um caixote de 1 m e a plataforma de 1,2 m; não sobe 1,8 m sem segurar. |
| `jumpHoldGravityScale` / `jumpHoldDeadTime` / `jumpHoldMaxTime` | **0,50 / 0,08 s / 0,25 s** | Segurar pulo → ≈ **2,1 m**: toque flutuante de Destiny sem duplo pulo (que é habilidade de classe). A zona morta existe porque o keydown que salta já chega com `jumpHeld = true`: um toque humano (≤ ~80 ms) fica em 1,40 m; 133 ms dá ≈ 1,6 m (< 1,7 m); só segurar de verdade sobe 2,1 m. |
| `maxFallSpeed` | −40 m/s | Clamp. |
| `coyoteTime` / `jumpBufferTime` | **0,10 s / 0,10 s** | |
| `slopeLimitDeg` | **46°** (`normal.y ≥ cos 46° = 0,695`) | Abaixo: chão. Acima: parede (escorrega). Não existe "rampa lenta". |
| `stepHeight` | **0,35 m** | Degraus e beiradas sem pulo (só quando `grounded`). |
| `groundSnapDistance` | **0,40 m** | Mantém `grounded` descendo rampas e degraus (evita "quicar"). Regra: ≥ `stepHeight` + queda por passo no limite de rampa em sprint (0,35 + 8,5/60 · tan 46° ≈ 0,50 m seria o teto seguro); 0,40 cobre o Campo de Provas e ainda não gruda ao sair de um caixote de 1 m. Com 0,20 m a rampa de 40° lançava o jogador no ar e a escada de 0,25 m dava 4 quedas. |

**Velocidade de salto com correção de discretização.** Em Euler semi-implícito a 60 Hz a altura real fica ~`v0·dt/2` abaixo da analítica. Usamos `jumpSpeed = √(2·|g|·jumpHeight) + |g|·dt/2` = 8,198 + 0,2 = **8,40 m/s**, e o teste exige altura de toque **1,40 ± 0,03 m** e de hold entre **2,0 e 2,4 m**.

**`integrateCapsuleBody(t, body, intent, cfg, dt, out)` — função pura, por passo fixo:**

1. Timers: se `!grounded` → `timeSinceGrounded += dt`; `jumpBufferTimer = max(0, jumpBufferTimer − dt)`; se `intent.jumpPressed` → `jumpBufferTimer = cfg.jumpBufferTime`.
2. Horizontal: `wish = right·dir.x + forward·dir.y` (normalizado se |dir| > 1); `speed = sprint && dir.y > 0,5 ? sprintSpeed : walkSpeed`; `target = wish·speed`. Se `grounded`: `accel = |wish| > 0 ? groundAccel : groundDecel`; `vel.xz = moveTowards(vel.xz, target, accel·dt)`. Senão (no ar, com input) *air-accelerate* com cap de módulo: `u = wish/|wish|`; `cap = min(speed, airMaxSpeed)`; `along = vel.xz · u`; `add = min(airAccel·dt, max(0, cap − along))`; `vel.xz += u · add`; depois `limit = max(|vel.xz| anterior, airMaxSpeed)` e, se `|vel.xz| > limit`, escala `vel.xz` para `limit`. Só soma ao longo do `wish` até o cap — nunca reduz o módulo existente (frear é só empurrando contra a velocidade) — e o clamp impede ganhar velocidade por strafe. (No ar sem input, a velocidade horizontal **não** decai — sem atrito aéreo.)
3. Pulo: se `jumpBufferTimer > 0 && (grounded || (timeSinceGrounded ≤ coyoteTime && !airborneByJump))` → `vel.y = jumpSpeed`, `grounded = false`, `airborneByJump = true`, `jumpBufferTimer = 0`, `jumpHoldTimer = 0`, `out.jumped = true`.
4. Vertical: `jumpHoldTimer += dt` se `airborneByJump && intent.jumpHeld && vel.y > 0` (tempo total segurado desde o salto); `holdActive = airborneByJump && intent.jumpHeld && vel.y > 0 && jumpHoldTimer > jumpHoldDeadTime && jumpHoldTimer ≤ jumpHoldDeadTime + jumpHoldMaxTime`; `g = gravity · (holdActive ? jumpHoldGravityScale : 1)`; `vel.y = max(vel.y + g·dt, maxFallSpeed)`.
5. `prevPosition.copy(position)`; `position += vel·dt`. A colisão (§5.2) corrige depois.

Sem massa/força: modelo "velocidade desejada + aceleração" (Destiny/Halo), não fricção Source/Quake. O dash do Rastreador (M3) é um impulso em `body.velocity` por N passos — não toca esta função.

### 5.2 Colisão: cápsula × Octree de triângulos (`three/addons/math/Octree.js` + `Capsule.js`)

Avaliação (mantida da P3, corrigida):

| Opção | Bundle | Rampas/malha arbitrária | Raycast | Veredito |
|---|---|---|---|---|
| AABB manual | 0 | não | manual | Rejeitado (o chão de teste tem rampas). |
| **`Octree` + `Capsule` (three/addons)** | **0** | sim | **sim** (`rayIntersect`, podado por sub-árvore — menos eficiente que BVH, não força bruta) | **Escolhido.** Mesma técnica do exemplo oficial `games_fps`. |
| `three-mesh-bvh@0.9.14` | ~40–60 KB gz | sim, melhor em malhas grandes | sim (`raycastFirst`, `shapecast`) | **Upgrade com gatilho**: malha de colisão > 50k triângulos, ou `raycast` > 0,3 ms no profile com 40 inimigos, ou "grudar em quinas" não resolvido. Troca isolada em `world/collision-world.ts`. |
| Rapier (WASM) | ~400 KB gz + init assíncrono | sim + corpos rígidos | sim | Rejeitado: sem corpos rígidos no roadmap (inimigos cinemáticos, projéteis = raios/esferas). |

```ts
// src/core/physics/layers.ts
export const enum CollisionLayer { None = 0, World = 1, Player = 2, Enemy = 4, Projectile = 8, Pickup = 16, All = 0xffff }

// src/world/collision-world.ts
export interface CapsuleHit { normal: THREE.Vector3; depth: number }
export interface RayHit { point: THREE.Vector3; normal: THREE.Vector3; distance: number; layer: CollisionLayer; entity?: EntityId }
export interface Hitbox { entity: EntityId; layer: CollisionLayer; capsule: Capsule }   // esfera = cápsula com start = end
export class CollisionWorld {
  rebuildStatic(root: THREE.Object3D): void;                       // Octree.fromGraphNode(root); build()
  capsuleIntersect(c: Capsule, out: CapsuleHit): boolean;          // só World em M0 (hitboxes dinâmicas: M2, cápsula×cápsula analítica)
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, mask: CollisionLayer, out: RayHit): boolean;
  addHitbox(h: Hitbox): void; removeHitbox(entity: EntityId): void;
  readonly bounds: THREE.Box3;                                     // octree.bounds
  debugHelper(): THREE.Object3D;                                   // Box3Helper dos nós (camada DEBUG)
}
```

`raycast` testa o Octree (`rayIntersect` → `{distance, triangle, position}`; normal por `triangle.getNormal`) quando `mask & World`, e cada hitbox cujo `layer & mask` com `rayCapsule` analítico; devolve o mais próximo. Hitscan de M1 já distingue mundo de inimigo pelo `layer`/`entity`.

**Resolução por passo (`systems/character-physics.ts`, função `resolveCapsuleCollision(t, body, collision, cfg)`), até 5 iterações:**

```
wasGrounded = body.grounded; body.grounded = false
capsule = Capsule(pos + (0, r, 0), pos + (0, h − r, 0), r)
repita ≤ 5×:
  se !collision.capsuleIntersect(capsule, hit): pare
  capsule.translate(hit.normal · (hit.depth + 1e-3))
  se hit.normal.y ≥ cos(slopeLimit):  body.grounded = true; groundNormal = normal; vel.y = max(vel.y, 0)
  senão (parede ou rampa íngreme):     vel −= normal · dot(vel, normal)      // desliza
  se wasGrounded && hit.normal.y < 0.3 && stepHeight > 0: tente step-up (abaixo)
pos = capsule.start − (0, r, 0)
se wasGrounded && !body.grounded && vel.y ≤ 0 && !jumpedThisStep:   // snap ao chão
  se collision.raycast(pos + (0, 0.05, 0), (0,-1,0), groundSnapDistance + 0.05, World, hit) && hit.normal.y ≥ cos(slopeLimit):
    pos.y = hit.point.y + r·(1/hit.normal.y − 1); body.grounded = true; vel.y = 0   // esfera de baixo tangente ao plano (pés no ponto = serrote de 12 cm a 40°)
se body.grounded: timeSinceGrounded = 0; airborneByJump = false
se !wasGrounded && body.grounded: emit player:landed { fallSpeed: −velYAntesDoPasso }
```

**Step-up explícito** (evita a subida parcial/trepidante que o push-out sozinho causa): copie a cápsula, eleve `stepHeight`, se `capsuleIntersect` for falso (ou só contato com `normal.y ≥ cos(slopeLimit)`), faça `raycast` para baixo do centro da base elevada até `stepHeight + 0,05`; se acertar chão caminhável, aceite a cápsula com a base em `hit.point.y` e mantenha `grounded`. Senão, fique com a posição empurrada. Só quando `wasGrounded` (nunca no ar).

`grounded` é reavaliado a cada passo; sem contato caminhável → `air`, e o coyote timer cuida da borda. O chão é um colisor real (não "plano infinito"); paredes de borda seguram o jogador; kill plane cobre o buraco (§7).

Custo: Octree de ~5k triângulos, `capsuleIntersect` × ≤ 5 + 1–2 raycasts → < 0,1 ms/passo. Build único no carregamento.

### 5.3 Rig de câmera (hierarquia preparada para arma e recoil)

```
rig.root (Object3D)                   posição = pés interpolados; rotation.y = yaw
└── rig.head (Object3D)               position.y = eyeHeight + landKickPosY (+ bobY); rotation 'YXZ':
    │                                 x = pitch + recoilPitch + landKickPitch + bobPitch  (clamp ±89° DEPOIS da soma)
    │                                 y = recoilYaw (local);  z = bobRoll
    ├── rig.worldCamera (PerspectiveCamera)   layers {WORLD=0, DEBUG=2}; near 0,05; far 300; vfov de hFOV
    └── rig.viewmodelRoot (Object3D)          "ombro" da arma: sway/ADS/sprint pose (M1)
        ├── rig.viewmodelCamera (PerspectiveCamera)  layers {VIEWMODEL=1}; fov 55° vertical fixo; near 0,01; far 5
        └── rig.weaponSocket (Object3D)       vazio em M0; a arma é filha daqui em M1
```

- Corpo só tem yaw; pitch fica na cabeça → recoil rotacional não inclina a cápsula; IA/rede futura só precisa de `transform.yaw`.
- Ordem `'YXZ'` (yaw global, depois pitch local) — a convenção do `PointerLockControls` do three; evita roll induzido.
- **Offsets aditivos somados por frame e nunca acumulados**: cada contribuição decai sozinha (mola ou damp). É o que faz o recoil "voltar" sem a câmera puxar.
- `PointerLockControls` de `three/addons` foi avaliado e descartado: rotaciona a câmera direto (colide com a hierarquia), sensibilidade interna fixa `0.002·pointerSpeed` (não em °/contagem), não separa yaw do corpo. `core/pointer-lock.ts` (~60 linhas) + `core/camera-rig.ts` (~80 linhas) fazem o necessário.

### 5.4 Look, FOV e sensibilidade (`data/camera-config.ts`)

| Parâmetro | Valor | Detalhe |
|---|---|---|
| `hfovDeg` | **95°** (faixa 80–110 nas configurações) | `PerspectiveCamera.fov` é vertical: `vfov = 2·atan(tan(hfov/2) / aspect)` recalculado no resize (a 16:9 → 63,1°). hFOV é a fonte: ultrawide não "zooma". |
| `sprintFovAddDeg` / `fovDampLambda` | +6° h / 10 | FOV dinâmico por `locomotion` (damp exponencial ≈ 0,15 s). Kick de pouso: −3° por 0,1 s. |
| `viewmodelFovDeg` | 55° vertical, fixo | Arma não estica em FOV alto. |
| `sensitivityDegPerCount` | **0,022** | Convenção CS/Source. `yaw −= dx · 0,022 · mult · DEG2RAD`; `pitch −= dy · 0,022 · mult · DEG2RAD`. |
| `settings.sensitivityMultiplier` | **1,5** padrão (0,1–5,0), persistido | ≈ 27,8 cm por 360° a 1000 DPI. |
| `adsMultiplier` | 0,8 (previsto; usado em M1) | |
| `pitchClampDeg` | ±89° | Aplicado **depois** de somar recoil/kicks: recoil nunca vira a câmera. |
| `near` / `far` | 0,05 / 300 m | `far` casado com a névoa. |
| Suavização/aceleração de mouse | **nenhuma** | Matam o feel. `unadjustedMovement: true` desliga a aceleração do SO. |

`yaw` é normalizado com `MathUtils.euclideanModulo(yaw, 2π)`. O look é aplicado em `frameUpdate` (taxa do monitor, sem latência de interpolação); a simulação lê `look.yaw` no início do passo fixo (o corpo segue a cabeça).

### 5.5 Feel de câmera em M0 (`systems/camera-feel.ts`, valores em `data/feel-config.ts`)

- **Kick de pouso:** em `player:landed`, `amp = clamp(fallSpeed / 20, 0, 1)`; `landKickPitch.kickToPeak(−amp · 2,5°)`, `landKickPosY.kickToPeak(−amp · 0,06 m)` (pitch negativo = olhar para baixo; o impulso é calibrado para que 2,5° / 6 cm sejam o **pico** real); molas ζ 0,6, ω 22 rad/s.
- **Slot de recoil:** `recoilPitch`/`recoilYaw` são `Spring`s (ζ 0,55, ω 26) com uma componente `recoilOffset` que a arma (M1) desloca e o `recoveryPerSec` (18°/s) traz de volta. Em M0 o evento `camera:kick` (tecla **F9**) dispara `{ pitchDeg: 1,2, yawDeg: ±0,3, posBack: 0,02 }` para afinar a mola antes de existir arma.
- **Head-bob:** `feel.headBob = { enabled: false, ampY: 0,018, ampX: 0,010, rollDeg: 0,25, hz: 1,9 }` — implementado (15 linhas: `y = A·|sin(2πft)|`, `x = A_x·sin(πft)`, amplitude escalada por `speed/walkSpeed`, 0 no ar, com damp) mas **desligado por padrão** (acessibilidade e escopo). Toggle no painel.
- **Crouch/slide:** fora de M0 (M1 traz crouch; slide é pós-MVP). Não há campos deles na config em M0 — evitar config morta.

---

## 6. Renderização

### 6.1 Decisões

| Item | Decisão | Motivo |
|---|---|---|
| Renderer | `new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false })` | MSAA é barato e essencial para arestas duras; sem stencil = menos memória. WebGPU adiado (r185 ainda muda API). |
| Pixel ratio | `setPixelRatio(min(devicePixelRatio, cfg.render.pixelRatioCap = 1,5))` + **render scale** independente (`setSize(w·s, h·s, false)`, CSS mantém 100 %; F8 alterna 1,0 ↔ 0,75; `?scale=`) | Fill-rate é o gargalo de iGPU. |
| Materiais | `MeshLambertMaterial({ flatShading: true, vertexColors: true })` compartilhado via `world/materials.ts` (`Map<string, Material>`); emissivo para elementos/tecnologia | Iluminação por vértice; flat + Lambert = "papel dobrado". Nada de PBR. Um material para todo o mundo estático → mescla máxima. |
| Luzes | `HemisphereLight(céu 0x8d7f9c, chão 0x5a4634, 1.0)` + `DirectionalLight(0xffc98a, 2.2)` a 22° de elevação (sol moribundo), azimute 35° | Duas luzes = custo nulo. Intensidades no modelo físico (padrão desde r155). |
| Sombras | `shadowMap.enabled = true; type = THREE.PCFShadowMap` (duro, não Soft); `mapSize 2048²`; câmera ortográfica 60×60 m, `near 1 / far 150`, `bias −0,0005`, `normalBias 0,02`; **segue o jogador com snap à grade de texels** (60/2048 = 0,0293 m, no espaço da luz); `shadowMap.autoUpdate = false` e `needsUpdate = true` **uma vez por frame** antes da passada de mundo | Sombras duras combinam com flat shading e dão leitura de altura (pulos). ~1–1,5 ms em iGPU. `castShadow` em props/inimigos/jogador; chão só `receiveShadow`. |
| Névoa/céu | `scene.fog = new FogExp2(0x8d7f9c, 0.010)`; `renderer.setClearColor(0x8d7f9c)`; sem skybox | Horizonte some sem draw call; mascara o `far`. |
| Tone mapping | `NeutralToneMapping` (constante `7` em r185), `toneMappingExposure = 1.0` | Preserva matiz (paleta restrita e cores de raridade). ACES dessatura magenta/ciano. |
| Color space | `outputColorSpace = SRGBColorSpace`, `ColorManagement.enabled = true` (padrões, explícitos); cores hex são sRGB | Evita "tudo lavado". |
| Resize | `ResizeObserver` no container → `renderer.setSize(w·s, h·s, false)`, `vfov` das duas câmeras recalculado de hFOV, `updateProjectionMatrix()`; aplicado no próximo frame | Funciona com HUD lateral futuro. |
| Pós-processamento | **Nenhum** no MVP. Hitmarker/flash de dano são DOM/CSS | Cada pass full-screen custa 1–2 ms em iGPU. |

### 6.2 Snap da câmera de sombra

Por frame (`camera-sync`): `target = player.pos + forward·8 m` (sombra à frente do olhar); transformar `target` para o espaço da luz (`light.shadow.camera.matrixWorldInverse`), arredondar x/y para múltiplos de `texel = frustumSize / mapSize`, voltar ao mundo; `light.position = targetSnapped + lightDir·80`; `light.target.position = targetSnapped`; `light.target.updateMatrixWorld()`. Elimina o shimmer ao andar.

### 6.3 Passadas (`core/renderer.ts` → `renderFrame(scene, rig)`)

```ts
renderer.autoClear = false;
renderer.shadowMap.needsUpdate = true;            // sombra 1x por frame, só nesta passada
renderer.clear();                                 // cor + profundidade
renderer.render(scene, rig.worldCamera);          // camadas 0 (+2 se helpers ligados)
renderer.clearDepth();
renderer.render(scene, rig.viewmodelCamera);      // camada 1 (vazia em M0; custa 1 clearDepth + 1 render vazio)
```

Camadas em `core/layers.ts`: `WORLD = 0`, `VIEWMODEL = 1`, `DEBUG = 2`. Luzes com `light.layers.enableAll()` para iluminar a arma. A segunda passada roda sempre (mesmo vazia) para que o número de performance de M0 seja honesto.

### 6.4 Sombras adaptativas e flags

- **Auto-desligar:** se a média de frame nos últimos 3 s > 20 ms (medido por `debug-stats`), `shadowMap.enabled = false` uma única vez, evento `render:shadowsChanged { enabled: false, auto: true }` e aviso no HUD ("sombras desligadas automaticamente — F7 religa"). Heurística por medição, porque `WebGLCapabilities` não detecta hardware fraco.
- `?shadows=0` inicia sem sombras (e2e em SwiftShader). `settings.shadows` persiste a escolha do usuário.

### 6.5 Orçamento de draw calls (por frame, **incluindo** a passada de sombra)

| Categoria | M0 | MVP | Como |
|---|---|---|---|
| Mundo estático | 4 (+4 sombra) | ≤ 12 | `mergeGeometries` com cor por vértice, **um material**, mesclado **por quadrante** (4 chunks mantêm frustum culling). |
| Props repetidos | 0 | ≤ 10 | `InstancedMesh` quando um prop repetir > 20× (M5). |
| Inimigos | 0 | ≤ 40 | Low-poly rígido, partes como children; materiais compartilhados. |
| Projéteis/efeitos | 0 | ≤ 6 | `InstancedMesh` por tipo. |
| Viewmodel | 0 (passada vazia) | 2–3 | Camada 1, câmera própria. |
| Helpers de debug | 0–3 | 0–3 | Só com F6. |
| HUD | **0** | **0** | 100 % DOM. |
| **Total** | **≤ 16 (gate e2e: ≤ 30)** | **≤ 150** | `renderer.info.render.calls` no HUD; e2e falha acima de 30. |

Triângulos ≤ 300k/frame no MVP; texturas: nenhuma. Zero alocação no hot path (scratch `Vector3` por módulo, pools em M1+); heap plano por 5 min.

### 6.6 Plano de medição

`performance.mark/measure` em `sim`, `frame`, `render`; HUD de debug (§8) com FPS/avg/max de 1 s e `renderer.info`. Alvo: **frame time p95 < 16,6 ms em Intel UHD 620, 1080p, DPR 1, sombras ligadas**. SwiftShader no CI valida **funcionamento** e draw calls, não performance (checklist manual em `docs/limiar/performance.md`).

---

## 7. Mundo de teste (`data/levels/test-ground.ts`)

O nível é **dado**; `world/level-builder.ts` gera as meshes mescladas por quadrante e o `Group` que alimenta `collision.rebuildStatic`. O mapa de patrulha do MVP usa o mesmo caminho.

```ts
// src/data/levels/level-def.ts
export type Vec3 = readonly [number, number, number];
export interface BoxDef      { kind: 'box'; pos: Vec3; size: Vec3; color: number; rotY?: number; collider?: boolean; castShadow?: boolean; name?: string }
export interface RampDef     { kind: 'ramp'; pos: Vec3; run: number; rise: number; width: number; dirYawDeg: number; color: number; name?: string }
export interface CylinderDef { kind: 'cylinder'; pos: Vec3; radius: number; height: number; color: number; bands?: readonly number[]; segments?: number; name?: string }
export type PrimitiveDef = BoxDef | RampDef | CylinderDef;
export interface SpawnPoint { pos: Vec3; yawDeg: number; tag?: 'player' | 'enemy' | 'boss' }
export interface LevelDef {
  id: string; name: string;
  props: readonly PrimitiveDef[];
  spawnPoints: readonly SpawnPoint[];       // [0] com tag 'player' é o spawn inicial
  coverPoints: readonly Vec3[];             // usados pela IA em M2 (vazio ok)
  killPlaneY: number;
  bounds: { halfSize: number };
  debug?: { grid: boolean; axes: boolean };
}
```

`pos` é sempre o **centro da base** (pé) da primitiva. Rampa: bloco cujo topo sobe `rise` ao longo de `run` (projeção horizontal); ângulo = `atan(rise/run)`; gerada como `BoxGeometry` rotacionada + base preenchida (prisma triangular via `ExtrudeGeometry` simples de um triângulo, para não ter face flutuante).

Escala 1 u = 1 m. Spawn em **(0, 0, 12)** olhando −Z (`yawDeg: 0`). Limite ±60 m. Kill plane **y = −20**.

| Elemento | Especificação | Testa |
|---|---|---|
| Chão | **4 lajes** (topo em y = 0, espessura 1 m) deixando um buraco 4×4 em (20, 20): `x∈[−60,18]` inteira; `x∈[22,60]` inteira; `x∈[18,22], z∈[−60,18]`; `x∈[18,22], z∈[22,60]`. Cor ocre `0xa67c52`. Recebe sombra, colisor | Base; buraco → kill plane |
| Grade/eixos | `GridHelper(120, 120, 0x6d5138, 0x8f6f4d)` (1 m) + `GridHelper(120, 12, ...)` (10 m) em y = 0,01 e `AxesHelper(2)`, **camada DEBUG** (F6) | Escala/velocidade |
| Paredes de borda | 4 caixas 120×3×0,5 em ±60, cinza-quente `0x6b5f5a` | Não sair do mundo |
| Régua | 3 colunas 0,3×{1,2,3}×0,3 em x = −6/−5/−4, z = 8, cores distintas | Referência 1/2/3 m |
| Poste humano | 4 blocos 0,12×0,45×0,12 empilhados (1,80 m) com cores alternadas, em (3, 0, 8) | Altura do jogador |
| Muretas de cobertura | 6 caixas 2,0×**1,1**×0,5 em arco, z ∈ [−4, −20], x ∈ [−8, 8] | Cobertura de peito (cobre agachado em M1); `coverPoints` atrás de cada uma |
| Pilares | 4 caixas 1,0×2,6×1,0 nos cantos (±16, ±16) | Cobertura em pé; strafe-peek |
| Muro longo | 12×3,2×0,4 em (−14, 0, −8) | Deslizar lateral |
| Caixotes | 8 cubos 1 m; 2 pilhas de 2 (2 m) em torno de (8, 0, 0) | Pulo de toque sobe 1; não sobe 2 sem hold |
| Blocos grandes | 3 caixas 3×2,5×3 | Colisão lateral em quinas |
| Escada | degraus 0,25 / 0,50 / 0,75 / 1,00 m (1 m de profundidade, 3 m de largura) em (12, 0, −6..−10) | Step-up (0,25 direto; 0,50 exige pulo) |
| Rampa suave | `run 8, rise 3, width 4` (20,6°) em (−20, 0, 0) subindo para −X, até plataforma 4×4 com topo a 3 m | Andar em rampa, snap ao descer, queda 3 m |
| Rampa limite | `run 4, rise 3.36, width 3` (40°) em (−20, 0, 8) | Abaixo de 46°: caminhável |
| Rampa íngreme | `run 3, rise 4, width 3` (53°) em (−20, 0, −8) | Acima de 46°: escorrega |
| Plataformas de pulo | 3 blocos 2×2 com topo a **1,2 / 1,8 / 2,6 m** em (−6..−12, 0, −14) | 1,2 = toque; 1,8 = hold; 2,6 = só dash/duplo pulo (M3) |
| Torre | 4×6×4 m em (24, 0, −20); tecla **T** teleporta ao topo (`?debug`) | Queda alta → `player:landed` forte, kick de pouso |
| Corredor | 2 paredes 10×3×0,3 com vão 1,2 m em (0, 0, −26) | Cápsula (0,8 m) em espaço apertado sem prender |
| Alvos | 5 cilindros r 0,25 × h 1,8 em x = 6, z = 2 / −8 / −18 / −33 / −48 (10/20/30/45/60 m do spawn), com 3 faixas coloridas (`bands`) | Legibilidade de silhueta à distância; hitscan em M1 |
| Céu | Nenhum mesh; `clearColor = névoa` | 0 draw calls |

Tudo estático vai num `Group` "static" (≈ 50 primitivas, ~4k triângulos) mesclado em **4 meshes por quadrante** com cor por vértice; helpers ficam fora da mescla. O mesmo `Group` alimenta o Octree. `spawnPoints` inclui 4 pontos `enemy` (para M2) e `coverPoints` as 6 muretas. Esperado: **≤ 12 draw calls com sombras**.

---

## 8. HUD de debug e ferramentas de tuning

### 8.1 HUD (`ui/debug-hud.ts`, tecla F3)

`<pre>` fixo no canto superior esquerdo, 12 px mono, fundo `rgba(0,0,0,.55)`, `pointer-events: none`. Atualiza **4×/s** via `textContent` (estatísticas acumuladas por frame em `core/debug-stats.ts`). Estado persistido em `settings.debugHud`. Ligado por padrão em DEV.

```
LIMIAR dev | FPS 60  frame 16.4 ms (avg) / 22.1 (max 1s) | sim 1 passo/frame  drop 0
draw 11  tris 4.2k  geom 9  tex 0  prog 3 | dpr 1.5  scale 1.00  1920x1080 | sombras ON
pos  0.00  0.00  12.00 | vel  0.00  0.00  0.00 | h 0.0 m/s | WALK  grounded (n.y 1.00)  coyote 0.00  ar 0.00 s
look yaw 0.0°  pitch −3.2° | hfov 95→95 (vfov 63.1) | sens 1.5
lock LOCKED  loop RUNNING | ents 2 | defs: 3 elementos, 3 facções, 1 nível | seed 1725000000
F3 hud  F4 painel  F6 helpers  F7 sombras  F8 escala  F9 kick  (P respawn  T torre)
```

Fontes: `renderer.info.render.calls/triangles`, `info.memory`, `info.programs.length`, `loop.stats`, `world.player`. Em DEV (ou `?debug=1`) expõe `window.__limiar = { world, loop, renderer, stats, input: { inject }, respawn(), ready: true }` para e2e e console.

### 8.2 Painel de tuning (`ui/tuning-panel.ts`, tecla F4, só DEV)

```ts
if (import.meta.env.DEV) {
  const { GUI } = await import('three/addons/libs/lil-gui.module.min.js');  // tipado em @types/three; fora do bundle de produção
  ...
}
```

Pastas: `movement`, `camera`, `feel`, `render`, `settings`. Liga direto nos objetos de `world.cfg` (mutação in-place; sistemas leem no uso). Mudanças em `render` chamam `applyRenderConfig`. Botão "Copiar JSON" → clipboard (cola de volta no arquivo `data/*-config.ts`). Botão "Kick de recoil" (= F9). Abrir o painel entra no **modo de tuning** (§4.4): mouse livre, simulação rodando.

### 8.3 Atalhos de debug

**F3** HUD · **F4** painel de tuning (DEV) · **F6** helpers (grade, eixos, Octree `Box3Helper`, cápsula do jogador em wireframe — camada DEBUG) · **F7** sombras · **F8** render scale 1,0 ↔ 0,75 · **F9** kick de recoil sintético · **P** respawn · **T** teleporte ao topo da torre (P/T só com `?debug` ou DEV). F5 foi evitado de propósito (recarregar página).

---

## 9. `package.json`, scripts, tsconfig e testes

```jsonc
{
  "name": "limiar",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12.0" },
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1 --port 4173 --strictPort",
    "typecheck": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "node e2e/smoke.mjs",
    "check": "npm run typecheck && npm run test && npm run build && npm run test:e2e"
  },
  "dependencies": {
    "three": "0.185.1"
  },
  "devDependencies": {
    "@types/node": "22.20.1",
    "@types/three": "0.185.4",
    "playwright-core": "1.63.0",
    "typescript": "5.9.3",
    "vite": "8.2.2",
    "vitest": "5.0.0"
  }
}
```

Compatibilidade (conferida no registry): `vitest@5.0.0` peer `vite ^6.4||^7||^8` e `@types/node ^22||>=24` → ok com `vite@8.2.2` e `@types/node@22.20.1`; `vite@8.2.2` engines `^20.19||>=22.12` → Node 22.22.2 ok; `@types/three@0.185.4` traz `lil-gui.module.min.d.ts`, `math/Octree.d.ts`, `math/Capsule.d.ts`, `utils/BufferGeometryUtils.d.ts`; `typescript@5.9.3` (não 7.0.2: toolchain validada em 5.x; trocar é uma linha); `playwright-core` sem browsers (usa `/opt/pw-browsers/chromium`; **nunca** `playwright install`). Versões **exatas**, sem `^`. `three-mesh-bvh@0.9.14` (peer `three >= 0.159`) e `valibot` ficam documentados como upgrades com gatilho, fora do `package.json`.

`tsconfig.json`:
```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "strict": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true, "useUnknownInCatchVariables": true,
    "isolatedModules": true, "verbatimModuleSyntax": true, "skipLibCheck": true,
    "noEmit": true, "baseUrl": ".", "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"]
}
```
`tsconfig.node.json`: `include: ["vite.config.ts", "vitest.config.ts", "e2e/**/*.mjs"]`, `allowJs`, `checkJs`, `types: ["node"]`, `module: "ESNext"`, `moduleResolution: "bundler"`, `noEmit`.

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: { output: { advancedChunks: { groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }] } } },
  },
  server: { port: 5173 },
});
```
(`advancedChunks` é a API do rolldown no Vite 8; `manualChunks` está deprecado. Se a versão exata reclamar do formato de `groups`, o chunking é otimização e pode ser removido sem afetar o jogo.)

`vitest.config.ts`: `import { defineConfig } from 'vitest/config'` com `test: { environment: 'node', include: ['tests/**/*.test.ts'] }` e o mesmo alias `@`. Testes de lógica pura rodam em Node: `three` (Vector3, Capsule, Octree, BoxGeometry, mergeGeometries) funciona sem WebGL/DOM.

**Testes vitest (M0):**

| Arquivo | Cobre |
|---|---|
| `tests/core/loop.test.ts` | nº de passos por frame, clamp 0,1 s, teto 5 + descarte, `alpha ∈ [0,1]`, pausa zera acumulador |
| `tests/core/input.test.ts` | borda sobrevive a 2 frames sem passo e é consumida por 1 passo; `reset` solta teclas; `inject` |
| `tests/core/events.test.ts` | on/once/emit/unsubscribe; `queue` só entrega em `flush`; emit durante handler não recursa infinitamente |
| `tests/core/spring.test.ts` | mola converge a 0; kick produz pico e retorno sem overshoot excessivo em ζ 0,6 |
| `tests/core/random.test.ts` | mesma seed → mesma sequência; distribuição de `range` em [0,1) |
| `tests/core/storage.test.ts` | envelope versionado, migrations em sequência, payload inválido → `null` (com `localStorage` fake) |
| `tests/physics/integrate.test.ts` | altura de toque (≤ 4 passos segurado) 1,40 ± 0,03; toque de 133 ms < 1,7; hold ∈ [2,0, 2,4]; velocidade máx; decel para em < 0,1 s; controle aéreo não excede `airMaxSpeed`; sprint-jump preserva 8,5 m/s; S freia; coyote e jump buffer |
| `tests/physics/collision.test.ts` | nível sintético (chão, parede, rampas 20,6°/40°/53°, degrau 0,25/0,5, corredor 1,2 m) via `level-builder` + `CollisionWorld`: grounded em rampa 40°, escorrega em 53°, sobe 0,25 e 0,35 (step-up), não sobe 0,5, não prende no corredor; `raycast` acerta chão e hitbox com `entity` |
| `tests/data/definitions.test.ts` | `validateDefs(DEFS)` passa; ids únicos; cores hex; nível tem spawn `player`; `killPlaneY < 0` |
| `tests/architecture.test.ts` | regras de dependência do §3.2 |

**e2e (`e2e/smoke.mjs`, ~100 linhas, sem `@playwright/test`):**
1. Se `dist/` não existir, roda `vite build`. Sobe `vite preview` como child process e espera a porta 4173.
2. `chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] })`.
3. Abre `http://127.0.0.1:4173/?nolock=1&shadows=0&debug=1&seed=1`, coleta erros de console/página, espera `window.__limiar?.ready === true` (timeout 30 s).
4. Clica no overlay (modo `unlocked` → `running`).
5. `__limiar.input.inject({ forward: true })`, espera 1 s, `inject({})`.
6. Lê `__limiar.stats` e `__limiar.world.player` e **asserta**: zero erros de console; `state === 'running'`; `renderer.capabilities.isWebGL2`; `player.transform.position.z < 8` (andou ≥ 4 m para −Z); `body.grounded === true`; `stats.drawCalls ≤ 30`; `stats.fps > 5` (SwiftShader não mede performance; só detecta loop quebrado).
7. Salva `e2e/artifacts/smoke.png` e `smoke.json` (fps, drawCalls, tris, posição). Sai com código ≠ 0 em falha.

---

## 10. Árvore de arquivos desta entrega

### 10.1 `projects/limiar/`

```
projects/limiar/
├── package.json                    — §9
├── package-lock.json               — gerado pelo npm install
├── tsconfig.json                   — TS estrito para src/ e tests/
├── tsconfig.node.json              — vite.config, vitest.config, e2e
├── vite.config.ts                  — alias @, base './', advancedChunks three
├── vitest.config.ts                — environment node, include tests/**
├── index.html                      — <div id="app"><canvas id="game"></canvas><div id="ui"></div></div> + script src/main.ts
├── .gitignore                      — node_modules, dist, e2e/artifacts
├── README.md                       — como rodar, controles, atalhos, link para docs/limiar
├── public/favicon.svg              — linha do horizonte
├── e2e/
│   ├── smoke.mjs                   — §9
│   └── artifacts/.gitkeep
├── tests/                          — §9 (10 arquivos)
│   ├── architecture.test.ts
│   ├── core/{loop,input,events,spring,random,storage}.test.ts
│   ├── physics/{integrate,collision}.test.ts
│   ├── data/definitions.test.ts
│   └── helpers/fake-storage.ts     — localStorage em memória
└── src/
    ├── main.ts                     — bootstrap: checa WebGL2, cria Game em #app, trata erro fatal
    ├── vite-env.d.ts               — /// <reference types="vite/client" /> + declaração de window.__limiar
    ├── core/                       — plataforma; não conhece o jogo
    │   ├── time.ts                 — FIXED_DT, MAX_FRAME_DT, MAX_STEPS_PER_FRAME
    │   ├── loop.ts                 — GameLoop (§4.2)
    │   ├── input.ts                — InputState (§4.3): teclado por code, mouse, bordas por passo, inject
    │   ├── pointer-lock.ts         — request com unadjustedMovement + fallback, eventos, cooldown, modo unlocked
    │   ├── renderer.ts             — createRenderer, applyRenderConfig, renderFrame (2 passadas), resize, render scale
    │   ├── layers.ts               — WORLD=0, VIEWMODEL=1, DEBUG=2
    │   ├── camera-rig.ts           — CameraRig (§5.3): root/head/worldCamera/viewmodelRoot/viewmodelCamera/weaponSocket; setHfov
    │   ├── events.ts               — EventBus<E> (emit/queue/flush)
    │   ├── entity.ts               — EntityId, Transform, EntityBase, EntityStore, allocEntityId
    │   ├── debug-stats.ts          — FPS/frame time (avg/max 1 s, média 3 s), renderer.info, performance.mark
    │   ├── storage.ts              — SaveStore<T> versionado (localStorage)
    │   ├── url-flags.ts            — ?nolock ?shadows ?debug ?scale ?seed ?hud
    │   ├── math/
    │   │   ├── index.ts            — clamp, lerp, damp, moveTowards, deg/rad, snapToGrid, rayCapsule
    │   │   ├── spring.ts           — Spring(ζ, ω)
    │   │   └── random.ts           — Random (mulberry32)
    │   └── physics/
    │       ├── layers.ts           — CollisionLayer bitmask
    │       ├── movement-config.ts  — interface MovementConfig (tipo; valores em data/)
    │       ├── capsule-body.ts     — CapsuleBody, MoveIntent, createCapsuleBody, integrateCapsuleBody (puro)
    │       └── collision-resolve.ts — resolveCapsuleCollision(t, body, collision, cfg, out) com step-up e snap (puro sobre a interface CollisionWorld)
    ├── data/                       — só dados e tipos de dados; sem three
    │   ├── index.ts                — DEFS + validateDefs + DefinitionError
    │   ├── palette.ts              — cores nomeadas (ocre, ferrugem, ciano-vigia, magenta-maré, névoa, raridades)
    │   ├── elements.ts             — Brasa, Ressonância, Névoa
    │   ├── factions.ts             — Axioma, Ferrugem, Cepa
    │   ├── movement-config.ts      — MOVEMENT (§5.1) + HMR
    │   ├── camera-config.ts        — CAMERA (§5.4) + HMR
    │   ├── feel-config.ts          — FEEL (§5.5) + HMR
    │   ├── render-config.ts        — RENDER (§6) + HMR (chama applyRenderConfig via evento config:changed)
    │   ├── settings-defaults.ts    — Settings + defaults + versão do save
    │   ├── input-bindings.ts       — code → Action (§4.3)
    │   └── levels/
    │       ├── level-def.ts        — LevelDef/PrimitiveDef/SpawnPoint (§7)
    │       └── test-ground.ts      — o mundo de teste (§7)
    ├── entities/
    │   ├── index.ts                — AnyEntity, EntityKind, type guards (hasBody, ...)
    │   ├── player.ts               — PlayerEntity + createPlayer (cápsula, intent, look, view = Group vazio para futuro corpo/sombra)
    │   └── static-world.ts         — StaticWorldEntity + createStaticWorld(levelDef) → usa world/level-builder
    ├── world/
    │   ├── collision-world.ts      — CollisionWorld sobre Octree/Capsule + hitboxes + raycast com máscara
    │   ├── level-builder.ts        — buildLevel(def): primitivas → geometrias com cor por vértice → 4 meshes por quadrante + helpers
    │   ├── materials.ts            — cache de MeshLambertMaterial flat/vertexColors
    │   └── lighting.ts             — createLighting(scene, cfg): hemisférica + sol com sombra; updateShadowFollow (snap)
    ├── systems/
    │   ├── system.ts               — interface System
    │   ├── player-input.ts         — fixed: InputState → player.intent
    │   ├── character-physics.ts    — fixed: para toda entidade com body: integrate + resolve; eventos jumped/landed
    │   ├── kill-plane.ts           — fixed: respawn
    │   ├── locomotion-state.ts     — fixed: idle/walk/sprint/air + evento
    │   ├── player-look.ts          — frame: mouse → look (sensibilidade, clamp)
    │   ├── camera-feel.ts          — frame: molas de kick/recoil, FOV dinâmico, head-bob → offsets do head
    │   ├── view-sync.ts            — frame: interpolação → Object3D
    │   ├── camera-sync.ts          — frame: rig segue jogador; sombra segue com snap
    │   └── debug-stats-system.ts   — frame: alimenta DebugStats; auto-desliga sombras
    ├── game/
    │   ├── game.ts                 — classe Game: renderer, cena, luzes, mundo, entidades, sistemas, loop, pausa, atalhos de debug, HMR de render
    │   ├── world.ts                — interface World + createWorld()
    │   ├── events.ts               — GameEvents (§3.4)
    │   ├── state.ts                — GameState, InputMode
    │   ├── systems-list.ts         — LISTA ORDENADA (única fonte da ordem)
    │   └── debug-api.ts            — window.__limiar
    └── ui/
        ├── styles.css              — reset, canvas full-screen, overlay, hud
        ├── overlay.ts              — clique-para-jogar / pausado / erro de lock / contexto perdido / sem WebGL2
        ├── debug-hud.ts            — F3 (§8.1)
        └── tuning-panel.ts         — F4, lil-gui por import() dinâmico (§8.2)
```

≈ 60 arquivos, todos pequenos; nenhum é descartado quando armas/inimigos/loot entrarem.

### 10.2 `docs/limiar/`

```
docs/limiar/
├── README.md                — visão, frase de identidade, léxico resumido, como rodar, estado atual (M0)
├── design.md                — este documento
├── roadmap.md               — §13 com checklists
├── performance.md           — orçamento de draw calls, checklist de medição em iGPU real, como ler o HUD
└── decisoes/
    ├── 0001-sem-ecs-generico.md
    ├── 0002-fixed-timestep-60hz.md
    ├── 0003-octree-three-addons.md          (gatilho para three-mesh-bvh)
    ├── 0004-sem-pos-processamento.md
    ├── 0005-dados-em-ts-sem-zod.md
    ├── 0006-viewmodel-duas-cameras.md
    └── 0007-hfov-e-sensibilidade-por-contagem.md
```

Raiz do monorepo: `README.md` (lista de projetos, 5 linhas) e `.gitignore` (`node_modules/`, `dist/`, `**/e2e/artifacts/`).

---

## 11. Como armas, inimigos, loot, classes e power level plugam depois (prova de não-reescrita)

**Armas (M1).** `data/weapons/{weapon-def.ts, auto-rifle-basic.ts, shotgun-basic.ts, index.ts}` com `WeaponDef { id, slot: WeaponSlotId ('iron'|'attuned'|'heavy'), archetype, element: ElementId | null, rpm, damage, critMultiplier, magazine, reserve, reloadTime, spread: {hip, ads, sprint}, recoilPattern: {pitchDeg, yawDeg}[], recovery, range, pellets? }`. A arma é filha de `rig.weaponSocket` (camada 1, câmera e FOV próprios — já existe). `systems/weapons.ts` (`fixedUpdate`, entre `kill-plane` e `locomotion-state`) lê `input.isDown('fire')`/`justPressed('reload')`, respeita `rpm` em passos fixos, faz hitscan com `collision.raycast(origem da worldCamera, dir, range, World | Enemy)` — `RayHit.entity` já distingue inimigo de parede — e `emit('weapon:fired', { kick })`; `camera-feel` já tem o slot de recoil por mola (troca o kick sintético de F9 pelo `recoilPattern`). Dispersão consulta `player.locomotion` (evento já existe). `hit:confirmed` → `ui/combat-hud.ts` (hitmarker DOM). Som: `core/audio.ts` (AudioContext + buffers pré-decodificados) reagindo a eventos. `systems/viewmodel-anim.ts` (frame) faz sway/ADS/sprint pose no `viewmodelRoot`. Nada do esqueleto muda; `systems-list.ts` ganha 2 linhas.

**Inimigos e IA (M2).** `entities/enemy.ts`: `EnemyEntity extends EntityBase & Damageable & { kind: 'enemy'; body: CapsuleBody; intent: MoveIntent; def: EnemyDef; faction: FactionId; ai: AiState; hitbox }`. `AnyEntity` ganha `| EnemyEntity`. **`character-physics` já move qualquer entidade com `body`** — a IA (`systems/ai.ts`, máquina de estados `patrol → detect → attack → cover` usando `level.coverPoints` e `collision.raycast` para linha de visão) só escreve `intent`. `createEnemy` chama `collision.addHitbox`. `systems/spawn.ts` lê `level.spawnPoints` com tag `enemy`. `systems/damage.ts` resolve `element × shield.element` (tabela em `data/elements.ts`) e `queue('entity:died')`. Vida/escudo com regeneração: `systems/regen.ts` lê `health.lastDamageAt` (`world.time.sim`). Projéteis: `ProjectileEntity` + `systems/projectiles.ts` (raio por passo contra `collision.raycast` com máscara `World | Player`).

**Classes e habilidades (M3).** `data/classes/ranger.ts` (`ClassDef { id, moveMultiplier, abilities: { grenade, melee, classAbility, apex } }`), `data/abilities/*.ts` (`AbilityDef { cooldown, chargeRate?, effect }`), `systems/abilities.ts` com cooldowns em passos fixos; dash = impulso em `player.body.velocity` por N passos (sub-passos de colisão se > 24 m/s); Ápice acumula carga por dano/kills. HUD de cooldowns em DOM.

**Loot, inventário, power level e persistência (M4).** `systems/loot.ts` escuta `entity:died` (entregue no `flush`, fora da iteração), rola com `world.rng` (`rollItem(def, rarityTable, rng)` puro e testado com seed) e cria `LootEntity` (cor da raridade). `systems/pickup.ts` faz overlap esfera-cápsula. `player.inventory` e `player.loadout` são dados puros serializados por `SaveStore` (envelope versionado já existe; `migrations` cobrem mudanças de formato). `powerLevel(loadout)` é função pura (`systems/power-level.ts`) → `Lume`; `damage.ts` aplica um único multiplicador `attackerLume/defenderLume`. `definitions.test.ts` passa a checar `item.perks ⊂ perks`, `weapon.element ⊂ elements`, `enemy.lootTable ⊂ lootTables`.

**Mapa de patrulha, HUD completo, minimapa (M5).** `data/levels/patrol-ridge.ts` no mesmo `LevelDef` (com `spawnPoints`/`coverPoints`/`objectives`); `InstancedMesh` para props repetidos no `level-builder`; minimapa é um `<canvas 2D>` no DOM lendo posições 10×/s.

Em todos os casos: **arquivos novos** em `data/`, `entities/`, `systems/`, `ui/` + linhas em `systems-list.ts` + uma alternativa a mais em `AnyEntity`. Os contratos de `core/` e `world/` não mudam.

---

## 12. Riscos técnicos e mitigação

| Risco | Prob./impacto | Mitigação |
|---|---|---|
| Cápsula "gruda" em quinas ou treme em rampas com push-out do Octree | média / médio | 5 iterações + epsilon 1 mm; step-up explícito; snap ao chão; `tests/physics/collision.test.ts` com corredor, quina e rampas; F6 mostra Octree e cápsula. Se persistir: migrar `collision-world.ts` para `three-mesh-bvh` `shapecast` (interface preservada, ADR 0003). |
| Tunelamento em alta velocidade (dash em M3) | média / alto | Deslocamento por passo < raio (0,4 m ⇒ ≤ 24 m/s a 60 Hz); acima disso, sub-passos de colisão no mesmo `fixedUpdate`. |
| Fill-rate em iGPU / telas 1440p+ | alta / alto | DPR ≤ 1,5, render scale 0,75 (F8/`?scale`), sombras desligáveis + auto-desligar por medição; alvo p95 < 16,6 ms. |
| Shimmer de sombra ao andar | alta / baixo | Snap da câmera de sombra à grade de texels no espaço da luz; `PCFShadowMap` duro. |
| Sombra renderizada 2× por causa das duas passadas | certa se ignorado / médio | `shadowMap.autoUpdate = false` + `needsUpdate = true` uma vez por frame (§6.3). |
| Bordas de input perdidas a 144 Hz | média / médio | Limpeza só em `endFixedStep()`; teste unitário do caso "frame sem passo". |
| Pointer lock: cooldown de relock, iframes, headless | alta / baixo | `pointerlockerror` com mensagem e contador; modo `unlocked` de fallback; e2e usa `?nolock=1` + `inject()`. |
| Pausas de GC no hot loop | média / médio | Zero alocação em `fixedUpdate`/`frameUpdate` (scratch `Vector3` por módulo, `out` params); heap plano por 5 min no painel Memory. |
| HMR de config invalidando referências | média / baixo | `Object.assign` no objeto existente; sistemas leem no uso; `config:changed` para render. |
| Feel virando polimento infinito antes de M1 | média / alto | Critério de pronto objetivo (§13, M0) e head-bob/crouch/slide fora de M0. Tuning continua em paralelo com M1 porque está em dados. |
| `advancedChunks` com formato diferente na versão exata do Vite 8 | baixa / baixo | Bloco removível; sem plugins de Vite. |
| Vite 8 / Vitest 5 / TS 5.9 recentes | baixa / médio | Versões exatas + lock; `npm run check` como gate; `vite 7.x` compatível com o mesmo código se o rolldown der problema. |
| `three` r185 addons mudarem sem aviso em upgrade | baixa / médio | Pin exato; `Capsule`, `Octree`, `BufferGeometryUtils`, `lil-gui` isolados em `world/` e `ui/`; upgrade só com `check` verde. |
| Crescimento do bundle (áudio, GLTF, bvh) | média / baixo | Orçamento: `three` (~150–170 KB gz tree-shaken) + jogo < 250 KB gz no MVP; `vite build` imprime tamanhos; nova dependência exige justificar KB. |
| SwiftShader não mede performance | certa / baixo | e2e valida funcionamento e draw calls; performance real medida manualmente (`docs/limiar/performance.md`). |
| Tentação de "fazer o ECS logo" com 5 tipos de entidade | média / médio | ADR 0001; `EntityStore.ofKind` + type guards cobrem o roadmap; revisitar só com > 2 000 entidades ativas. |
| `exactOptionalPropertyTypes` + campos opcionais | baixa / baixo | Nunca atribuir `undefined`; usar type guards em `entities/index.ts`. |

---

## 13. Roadmap de milestones

### M0 — Esqueleto (esta entrega)

> **Nota de conformidade (M0 entregue; verificação final da documentação).** Tudo abaixo existe e `npm run check` está verde (11 suítes / 150 testes; e2e `ok: true`). Desvios reais em relação ao texto deste documento, todos registrados com motivo na [seção 19 da arquitetura](./03-arquitetura.md#19-divergências-entre-o-design-técnico-e-o-código): (1) HMR de configuração por `keepLive` em `data/hot-config.ts` (objeto vivo em `import.meta.hot.data`) + `import.meta.hot.accept()` literal, não pelo callback de `accept` do §3.5 — `render-config.ts` também se auto-aceita e `game/game.ts` reaplica via `onConfigHotUpdate`; (2) `CollisionLayer` é objeto `as const` + `CollisionMask`, não `const enum`; `CapsuleHit`/`RayHit`/`CollisionQuery` vivem em `core/physics/collision-query.ts`; `RayHit.entity` é `EntityId | null`; (3) `Spring` usa a solução fechada do oscilador com `kickToPeak`/`peakFactor`; (4) `groundSnapDistance` 0,40 m com snap tangente; step-up dispara em qualquer contato não caminhável; slide no chão só pela projeção horizontal da normal; (5) `Renderer` é classe (`applyConfig`/`renderFrame`/`setRenderScale`); `RenderConfig` inclui `lights`/`shadow`/`fogDensity`; (6) `vite.config.ts` usa `build.rolldownOptions.output.codeSplitting`, não `advancedChunks`; (7) `tests/` tem 11 arquivos (mais `tests/data/hot-config.test.ts`) e o e2e usa porta livre, vira 90°, pula e liga o HUD; (8) `entities/static-world.ts` importa `world/level-builder` (sem ciclo); (9) `docs/limiar/` usa os nomes `01…06-*.md` (não `design.md`/`roadmap.md`/`performance.md`); (10) draw calls medidos: **4** sem sombras, **8** com sombras (não ≈ 12) — o chão entra nos chunks com `castShadow`; (11) `debugHelper()` é um único `LineSegments`, não `Box3Helper` por nó; (12) auto-desligar sombras só após 6 s com sombras ligadas, só em `running`, sem tocar `settings.shadows`. Pendências do critério de pronto (não são desvios): medição em iGPU real, sessão manual de 5 min e heap plano — ver [roadmap §3.7](./04-roadmap.md).

- [x] Pastas, `package.json`, `tsconfig`, `vite.config`, `vitest.config`, `.gitignore`, `README.md`
- [x] `core/`: time, loop, input (bordas por passo, inject), pointer-lock (fallback unlocked), renderer (2 passadas, render scale, resize), layers, camera-rig (hFOV, viewmodel camera, weaponSocket), events (queue/flush), entity (EntityStore), debug-stats, storage, url-flags, math (spring, random, rayCapsule), physics (layers, capsule-body, collision-resolve)
- [x] `data/`: palette, elements, factions, movement/camera/feel/render configs com HMR, settings-defaults, input-bindings, level-def, test-ground, index + validateDefs
- [x] `world/`: collision-world (Octree + hitboxes + raycast com máscara), level-builder (4 chunks por quadrante, cor por vértice, rampas, cilindros com faixas, helpers), materials, lighting (snap de sombra)
- [x] `entities/`: player, static-world; `systems/`: player-input, character-physics (step-up, snap, eventos), kill-plane, locomotion-state, player-look, camera-feel (kick de pouso, slot de recoil, FOV dinâmico, head-bob desligado), view-sync, camera-sync, debug-stats-system (auto-desligar sombras)
- [x] `game/`: game, world, events, state, systems-list, debug-api; `ui/`: overlay, debug-hud, tuning-panel (lil-gui via import dinâmico)
- [x] 11 suítes vitest verdes (150 testes); `e2e/smoke.mjs` verde em SwiftShader; `npm run check` verde
- [x] `docs/limiar/`: README, design.md, roadmap.md, performance.md, decisoes/0001–0007 (entregues como `README.md`, `01-visao-e-design.md`, `02-design-tecnico.md`, `03-arquitetura.md`, `04-roadmap.md`, `05-performance.md`, `06-guia-de-desenvolvimento.md`, `decisoes/0001–0007`)
- [ ] **Critério de pronto** (parcial — cumprido: e2e verde; 8 draw calls com sombras; HMR de `walkSpeed` verificado manualmente; pendente: iGPU real, sessão manual de 5 min, heap plano — detalhes no [roadmap §3.7](./04-roadmap.md)): e2e verde; ≤ 16 draw calls com sombras no HUD; 60 fps estáveis com sombras numa iGPU real (ou registrado em `performance.md` que não havia iGPU disponível e o número em SwiftShader); 5 minutos andando/pulando no mundo de teste sem prender em geometria, sem quicar em rampa e subindo o degrau de 0,25 m e 0,35 m; heap plano por 5 min; HMR de `movement-config.ts` altera `walkSpeed` sem recarregar a página.
- [x] Parar e mostrar rodando (screenshots em `e2e/artifacts/smoke*.png`).

### M1 — Gunplay (pilar nº 1)

- [ ] `WeaponDef` + auto rifle (Ferro) + shotgun (Afim, pellets) em dados, HMR
- [ ] Viewmodel low-poly no `weaponSocket`; `viewmodel-anim` (sway, ADS com `adsMultiplier` e FOV, sprint pose)
- [ ] `weapons` (rpm, magazine/reserve, reload, hitscan com `RayHit.entity`), `recoilPattern` alimentando o slot de recoil; dispersão por `locomotion`
- [ ] Alvos do mundo de teste viram `Damageable` com hitbox (usam `addHitbox`) — hitmarker e números de dano em DOM
- [ ] `core/audio.ts` + sons de tiro/impacto/reload (sintetizados ou CC0), muzzle flash e impacto por `InstancedMesh`
- [ ] Crouch (cápsula 1,2 m, olho 1,05 m, `crouchSpeed 3,0`) — as muretas de 1,1 m passam a fazer sentido
- [ ] Teste: recoil retorna ao zero em < 0,4 s sem overshoot; rpm exato em passos fixos; shotgun com N pellets determinísticos por seed

### M2 — Inimigos, IA, vida/escudo

- [ ] `EnemyDef` + 2 arquétipos da Ferrugem: **Atirador** (à distância) e **Saqueador** (corpo a corpo); silhuetas low-poly; `spawn` por `spawnPoints`
- [ ] `ai` (patrulha → detecção → ataque → cobertura via `coverPoints`, linha de visão por `raycast`), `projectiles` inimigos
- [ ] `damage` (elemento × escudo, crítico por hitbox de cabeça), `regen` (vida/escudo do jogador após X s sem dano), morte do jogador → respawn
- [ ] HUD de combate: vida, escudo, munição
- [ ] Teste: IA testável em vitest (máquina de estados com mundo sintético); `entity:died` via `queue` durante iteração sem corromper listas

### M3 — Classe Rastreador e habilidades

- [ ] `ClassDef` Rastreador (`moveMultiplier 1,08`, `critMultiplier`), `AbilityDef`: Granada (Brasa, área + queima), Golpe (melee), Investida (dash), **Ápice** (super de carga lenta: rajada de alto dano por 8 s)
- [ ] `abilities` com cooldowns em passos fixos, HUD de cooldowns e carga de Ápice
- [ ] Plataforma de 2,6 m do mundo de teste alcançável com Investida + pulo

### M4 — Loot, inventário, Lume (power level), persistência

- [ ] `RarityDef` (comum/incomum/raro/lendário/exótico com cor e nº de perks), `PerkDef` (hooks `onHit/onKill/onReload/passive`), `ItemDef`, `LootTableDef`
- [ ] `loot` (rolagem com `world.rng`), `LootEntity` com cor de raridade, `pickup`
- [ ] Inventário DOM (equipar por slot Ferro/Afim/Pesado, ver stats/perks), `SaveStore` para inventário/loadout/progressão com migrations
- [ ] `power-level` (Lume = média dos slots) escalando dano/dificuldade; HUD mostra "Lume N"
- [ ] Teste de distribuição de raridade com seed fixa

### M5 — Mapa de patrulha e loop de jogo → **MVP completo**

- [ ] `patrol-ridge` (LevelDef com terreno, coberturas, spawns, objetivos), `InstancedMesh` para props
- [ ] Objetivos simples (matar N, ativar ponto) → chefe de missão (inimigo com mais vida e padrão) → loot → repetir com Lume maior
- [ ] Minimapa 2D em DOM; HUD final (vida, escudo, munição, cooldowns, minimapa, Lume)
- [ ] Passe de performance no mapa real (≤ 150 draw calls, p95 < 16,6 ms em iGPU), passe de feel com o painel
- [ ] Checklist do master prompt §3 inteiro marcado

### Pós-MVP (listado, não planejado em detalhe)

- M6: Baluarte e Tecelão/Tecelã com habilidades próprias; Ressonância e Névoa completos com interações de escudo
- M7: Evento público opcional na patrulha, segunda facção (Axioma) com silhueta e IA distintas, slide
- M8: Áudio/VFX de polimento (pós-processamento só se sobrar orçamento de GPU), armas Pesadas (sniper, lançador)
- M9: Terceira facção (Cepa), Eco (companheiro), mais mapas
- Fora do escopo declarado pelo master prompt: multiplayer, PvP, raides, sistema de facções sociais, crafting, economia, cutscenes

---

## 14. Léxico

Nomes em jogo, ids em código e o equivalente Destiny **apenas como referência interna** (nunca exibido).

| Categoria | Nome (PT-BR) | Id | ≈ Destiny (referência) | Cor / nota |
|---|---|---|---|---|
| Jogo | **Limiar** | `limiar` | — | a última faixa iluminada |
| Jogador | **Vigia** (pl. Vigias) | `warden` | Guardian | HUD: "Vigia, Lume 240" |
| Classe tanque | **Baluarte** | `bulwark` | Titan | melee pesado, barreiras (M6) |
| Classe mobilidade | **Rastreador** | `ranger` | Hunter | dash, crítico (M3, classe do MVP) |
| Classe área/suporte | **Tecelão / Tecelã** | `weaver` | Warlock | área, cura, granadas (M6) |
| Super | **Ápice** | `apex` | Super | carga lenta, alto impacto |
| Habilidade de classe (Rastreador) | **Investida** | `dash` | Dodge | impulso em `velocity` |
| Melee especial | **Golpe** | `melee` | Melee | |
| Granada | **Granada** | `grenade` | Grenade | elemento da classe |
| Facção robótica | **Axioma** (unidades Lema, Corolário, Postulado) | `axiom` | Vex | prismas, luz branca-azulada (M7) |
| Facção pirata-tecnológica | **Ferrugem** (Corsários da Ferrugem) | `rust` | Fallen | assimetria, laranja/enferrujado (M2) |
| Inimigo à distância (MVP) | **Atirador da Ferrugem** | `rust-gunner` | Dreg/Vandal (papel) | |
| Inimigo corpo a corpo (MVP) | **Saqueador da Ferrugem** | `rust-raider` | — | |
| Facção orgânica-fanática | **Cepa** | `strain` | Hive | curvas, esporos, verde-pálido/roxo (M9) |
| Elemento queima | **Brasa** | `ember` | Solar | `#ff7a1a` |
| Elemento cadeia/atordoamento | **Ressonância** | `resonance` | Arc | `#3fd2c7` |
| Elemento enfraquecimento | **Névoa** | `haze` | Void | `#b04ac8` |
| Slot 1 (sem elemento) | **Ferro** | `iron` | Kinetic | |
| Slot 2 (com elemento) | **Afim** | `attuned` | Energy | |
| Slot 3 | **Pesado** | `heavy` | Power/Heavy | |
| Raridades | **Comum / Incomum / Raro / Lendário / Exótico** | `common/uncommon/rare/legendary/exotic` | mesmos termos (padrão do gênero) | cinza `#b5b5b5` / verde `#4fbf6a` / azul `#4a8fe0` / roxo `#9b5de5` / dourado `#e8c04a` |
| Unidade de poder | **Lume** | `lume` | Light / Power Level | "Lume 240" |
| Companheiro/IA | **Eco** | `echo` | Ghost | reservado (M9) |
| Antagonista ambiental | **a Maré** (de silêncio) | `tide` | Darkness (papel) | magenta `#c83aa0` |
| Cor dos Vigias | ciano-esverdeado | `warden-cyan` | — | `#3fd2c7` |
| Mundo de teste | **Campo de Provas** | `test-ground` | — | |
| Mapa do MVP | **Crista da Patrulha** | `patrol-ridge` | patrol zone | (M5) |
