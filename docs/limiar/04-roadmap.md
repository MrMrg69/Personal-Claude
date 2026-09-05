# LIMIAR — Roadmap de milestones

> Roadmap do **LIMIAR** (looter-shooter em primeira pessoa, Three.js + TypeScript + Vite, 100 % no navegador). Derivado do §13 do [design técnico](./02-design-tecnico.md) e da Seção 3 do master prompt. O design técnico é a fonte da verdade para arquitetura, contratos e números; este documento só organiza **o que entra em cada entrega, em que ordem e como saber que ficou pronto**.
>
> Nomes de arquivos, funções e sistemas de **M0** são os do código real em `projects/limiar/`. Nomes de M1 em diante seguem a árvore planejada no §10/§11 do design técnico e são **planejados** (ainda não existem no código).
>
> Estado: **M0 entregue** (esta entrega). Próximo: M1 — gunplay.

Documentos relacionados: [visão e design](./01-visao-e-design.md) · [design técnico](./02-design-tecnico.md) · [arquitetura como está no código](./03-arquitetura.md) · [performance](./05-performance.md) · [guia de desenvolvimento](./06-guia-de-desenvolvimento.md) · [decisões (ADRs)](./decisoes/README.md).

---

## 1. Como ler este documento

- `[x]` item verificado no código, em teste verde ou em número medido.
- `[ ]` item planejado, ou que existe mas ainda não foi verificado (o texto diz qual dos dois).
- Cada milestone tem: **objetivo**, **dependências**, **checklist verificável**, **critério de pronto** e **o que NÃO entra**.
- O princípio do master prompt vale para todos: *passos pequenos e verificáveis*. Um milestone só fecha com `npm run check` verde.

Comando único de verificação (definido em `projects/limiar/package.json`):

```bash
cd /home/user/Personal/projects/limiar
npm run check   # typecheck + vitest + vite build + smoke e2e
```

---

## 2. Visão geral

| Milestone | Nome | Entrega principal | Pilar do master prompt | Estado |
|---|---|---|---|---|
| **M0** | Esqueleto | Render Three.js, câmera FPS (WASD + mouse), Campo de Provas, loop fixo, colisão de cápsula, testes, e2e | Seção 5 (primeira tarefa concreta) | **entregue** |
| **M1** | Gunplay | Auto rifle (Ferro) + shotgun (Afim) com recoil, hitmarker, som, viewmodel; crouch | Pilar 1 (feel de tiro) | planejado |
| **M2** | Inimigos, IA, vida/escudo | Atirador e Saqueador da Ferrugem; IA patrulha → detecção → ataque → cobertura; regeneração | Pilares 4 (parcial) e 9 | planejado |
| **M3** | Classe Rastreador | Granada, Golpe, Investida (dash), Ápice (super) com cooldowns e HUD | Pilares 2 e 3 | planejado |
| **M4** | Loot, inventário, Lume | Raridades, perks, drop, pickup, inventário DOM, Lume (power level), persistência | Pilares 6 e 7 | planejado |
| **M5** | Mapa de patrulha e loop | Crista da Patrulha (`patrol-ridge`), objetivos, chefe, minimapa, HUD final → **MVP completo** | Pilar 8 | planejado |
| M6–M9 | Pós-MVP | Outras classes, facções, evento público, armas Pesadas, Eco, mais mapas | Pilares 2, 4, 5, 9 (restante) | listado |

Ordem obrigatória: M0 → M1 → M2 → M3 → M4 → M5. Cada milestone depende do anterior porque a arquitetura foi desenhada para **arquivos novos, nunca reescrita** (§11 do design técnico). Tuning de feel (dados em `src/data/*-config.ts` + painel F4) continua em paralelo a partir de M0.

---

## 3. M0 — Esqueleto (esta entrega)

**Objetivo.** Cumprir a Seção 5 do master prompt: estrutura de pastas, `package.json`, janela Three.js renderizando, controle de câmera em primeira pessoa (WASD + mouse look), chão de teste — e **parar antes de armas e combate**. A arquitetura já sustenta o MVP inteiro sem reescrita.

**Dependências.** Nenhuma. Ambiente: Node ≥ 22.12, npm, Chromium headless para o e2e (opcional: `e2e/smoke.mjs` pula com mensagem clara e `exit 0` se não houver Chromium).

**Estado no momento da escrita.** Código em `projects/limiar/` (commits `d0205d3` — esqueleto — e `1b98b93` — auditoria — mais as correções desta rodada): 62 arquivos em `src/` (61 `.ts` + `styles.css`), 11 suítes de teste, `e2e/smoke.mjs`. Verificado nesta máquina: `npm run typecheck` verde; `vitest` **11 suítes / 150 testes verdes**; `e2e/artifacts/smoke.json` com `ok: true`, zero erros de console, 4 draw calls (sombras desligadas por `?shadows=0`), ≈ 21 fps em SwiftShader. Desvios em relação ao design estão na [seção 19 da arquitetura](./03-arquitetura.md#19-divergências-entre-o-design-técnico-e-o-código).

### 3.1 Checklist — infraestrutura

- [x] `package.json` com scripts `dev`, `build`, `preview`, `typecheck`, `test`, `test:watch`, `test:e2e`, `check` e versões exatas (`three 0.185.1`, `vite 8.2.2`, `vitest 5.0.0`, `typescript 5.9.3`, `@types/three 0.185.4`, `@types/node 22.20.1`, `playwright-core 1.63.0`)
- [x] `tsconfig.json` estrito (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`) + `tsconfig.node.json` para `vite.config.ts`, `vitest.config.ts` e `e2e/`
- [x] `vite.config.ts` com alias `@` → `src/`, `base: './'`, chunk separado para `three` via `build.rolldownOptions.output.codeSplitting.groups` (desvio registrado: o design cita `advancedChunks`; é o formato do Vite 8/rolldown) e `chunkSizeWarningLimit: 700`
- [x] `vitest.config.ts` com `environment: 'node'` e `include: ['tests/**/*.test.ts']`
- [x] `index.html` com `<div id="app"><canvas id="game"><div id="ui">` e `src/main.ts`
- [x] `.gitignore` (`node_modules/`, `dist/`, `e2e/artifacts/*` menos `.gitkeep`), `README.md` do projeto, `public/favicon.svg`

### 3.2 Checklist — `src/core/` (plataforma, não conhece o jogo)

- [x] `time.ts` — `FIXED_DT`, `MAX_FRAME_DT`, `MAX_STEPS_PER_FRAME`
- [x] `loop.ts` — `GameLoop` com timestep fixo + interpolação (`alpha`), clamp de frame, limite de passos (testado em `tests/core/loop.test.ts`)
- [x] `input.ts` — `InputState` (classe): teclado por `KeyboardEvent.code`, mouse por `movementX/Y`, bordas limpas só por passo fixo, `inject()` para e2e; lista `ACTIONS` já reserva `fire`, `aim`, `reload`, `melee`, `grenade`, `classAbility`, `super`, `interact`, `swapWeapon` para M1–M3
- [x] `pointer-lock.ts` — `unadjustedMovement` com fallback; 1ª falha → cooldown, 2ª → modo `unlocked` (`?nolock=1`)
- [x] `renderer.ts` — classe `Renderer` (`applyConfig`, `renderFrame` em duas passadas mundo + viewmodel, `setRenderScale`), `createRenderer`, `hasWebGL2`; `shadowMap.autoUpdate = false`
- [x] `layers.ts` — `WORLD = 0`, `VIEWMODEL = 1`, `DEBUG = 2`
- [x] `camera-rig.ts` — `CameraRig`: `root(yaw) → head(pitch + offsets) → worldCamera`; `viewmodelRoot → viewmodelCamera → weaponSocket` (vazio em M0); `setHfov`
- [x] `events.ts` — `EventBus` tipado com `on/once/emit/queue/flush/clear` (testado)
- [x] `entity.ts` — `EntityId`, `Transform`, `EntityBase`, `EntityStore` (`ofKind`, `flushRemovals`), `allocEntityId`
- [x] `debug-stats.ts` — FPS, frame time (avg/max 1 s, média 3 s), `renderer.info`
- [x] `storage.ts` — `SaveStore<T>` com envelope `{ version, savedAt, payload }`, `validate` obrigatório e `migrations` (testado com `tests/helpers/fake-storage.ts`)
- [x] `url-flags.ts` — `parseUrlFlags`/`readUrlFlags`: `?nolock`, `?shadows`, `?debug`, `?scale`, `?seed`, `?hud`
- [x] `math/index.ts` (`clamp`, `lerp`, `damp`, `moveTowards`, `rayCapsule`, …), `math/spring.ts` (`Spring` com solução fechada do oscilador, exata para qualquer dt; `kickToPeak`/`peakFactor`), `math/random.ts` (`Random`, mulberry32)
- [x] `physics/layers.ts` (`CollisionLayer` como objeto `as const` + `CollisionMask`, não `const enum`), `physics/movement-config.ts` (tipo), `physics/capsule-body.ts` (`CapsuleBody`, `MoveIntent`, `integrateCapsuleBody` pura), `physics/collision-resolve.ts` (`resolveCapsuleCollision` com step-up e snap ao chão)
- [x] `physics/collision-query.ts` — interface `CollisionQuery` (`CapsuleHit`, `RayHit`) declarada em `core/` e implementada por `world/collision-world.ts` — mantém `core/` sem importar `world/`

### 3.3 Checklist — `src/data/` (dados e tipos; sem `three` como valor)

- [x] `palette.ts` — cores nomeadas (ocre, ferrugem, ciano-vigia, magenta-maré, névoa, raridades)
- [x] `elements.ts` — Brasa (`ember`), Ressonância (`resonance`), Névoa (`haze`)
- [x] `factions.ts` — Axioma (`axiom`), Ferrugem (`rust`), Cepa (`strain`)
- [x] `hot-config.ts` (`keepLive`, `onConfigHotUpdate`), `movement-config.ts`, `camera-config.ts`, `feel-config.ts` — objetos mutáveis: `keepLive(import.meta.hot, chave, valores)` (mesma referência via `import.meta.hot.data`) + `import.meta.hot.accept()` literal
- [x] `render-config.ts` — `RENDER` (`keepLive` com `assignRenderConfig`), `RENDER_SCALE_ALT`, `SHADOW_AUTO_OFF`; o módulo também se auto-aceita, e a **aplicação** (renderer + luzes) fica em `game/game.ts`, que ouve `onConfigHotUpdate('render')`, porque `data/` não conhece o renderer (desvio nº 5 da arquitetura)
- [x] `settings-defaults.ts` — `Settings` (sensibilidade, hFOV, sombras, render scale, HUD de debug) + versão do save
- [x] `input-bindings.ts` — mapeamento `code → Action`; já inclui `KeyC` crouch, `KeyR` reload, `KeyF` melee, `KeyQ` granada, `KeyE` habilidade de classe, `KeyX` super, `KeyG` interagir (sem efeito até M1–M3)
- [x] `levels/level-def.ts` — `LevelDef`, `PrimitiveDef` (`box`/`ramp`/`cylinder`), `SpawnPoint`, `coverPoints`, `killPlaneY`
- [x] `levels/test-ground.ts` — **Campo de Provas**: spawn `player` em (0, 0, 12) olhando −Z, 4 spawns `enemy`, 6 `coverPoints`, `killPlaneY: −20`, rampas 20,6°/40°/53°, escada 0,25 m, corredor de 1,2 m, plataformas, torre (testado em `tests/data/definitions.test.ts` e `tests/physics/collision.test.ts`)
- [x] `index.ts` — `DEFS` + `validateDefs` + `DefinitionError`

### 3.4 Checklist — `src/world/`, `src/entities/`, `src/systems/`, `src/game/`, `src/ui/`

- [x] `world/collision-world.ts` — `CollisionWorld implements CollisionQuery` sobre `Octree` + `Capsule` de `three/addons`; `capsuleIntersect`, `raycast` com máscara e `RayHit.entity`, `addHitbox/removeHitbox`, `debugHelper` (um `LineSegments` só)
- [x] `world/level-builder.ts` — primitivas → geometrias com cor por vértice → ≤ 4 meshes por quadrante (`mergeGeometries`) + helpers na camada DEBUG
- [x] `world/materials.ts` — cache de `MeshLambertMaterial` flat + vertex colors
- [x] `world/lighting.ts` — hemisférica + direcional com sombra 2048², `updateShadowFollow` com snap de texel
- [x] `entities/index.ts` (`AnyEntity`, `ENTITY_KINDS`, type guards), `entities/player.ts` (`PlayerEntity`, `createPlayer`), `entities/static-world.ts`
- [x] Sistemas de passo fixo, na ordem de `game/systems-list.ts`: `player-input`, `character-physics`, `kill-plane`, `locomotion-state`
- [x] Sistemas de frame: `player-look`, `camera-feel` (kick de pouso, slot de recoil por F9, FOV dinâmico de sprint, head-bob **desligado**), `view-sync`, `camera-sync`, `debug-stats-system` (auto-desligar sombras por medição após 6 s de graça)
- [x] `game/game.ts` (classe `Game`), `game/world.ts` (`World`, `createWorld`), `game/events.ts` (`GameEvents` com `weapon:fired`, `hit:confirmed`, `entity:died`, `loot:dropped`, `item:equipped`, `power:changed` já declarados para M1+), `game/state.ts`, `game/systems-list.ts` (`createSystems`, única fonte da ordem), `game/debug-api.ts` (`installDebugApi` → `window.__limiar`)
- [x] `ui/styles.css`, `ui/overlay.ts` (clique para jogar / pausado / erro de lock / contexto perdido / sem WebGL2), `ui/debug-hud.ts` (F3), `ui/tuning-panel.ts` (F4, lil-gui de `three/addons` por `import()` dinâmico, só DEV)
- [x] Controles: WASD, mouse, Espaço (pulo com hold), Shift (sprint); atalhos F3/F4/F6/F7/F8/F9, P e T (com `?debug=1` ou dev), Esc (pausa)

### 3.5 Checklist — testes e verificação

- [x] `tests/architecture.test.ts` — regras de dependência entre pastas (§3.2 do design técnico)
- [x] `tests/core/{loop,input,events,spring,random,storage}.test.ts`
- [x] `tests/physics/integrate.test.ts` — pulo de toque 1,40 ± 0,03 m (zona morta do hold); hold entre 2,0 e 2,4 m; coyote time; jump buffer; controle aéreo (sprint-jump preserva 8,5 m/s; strafe não passa de `airMaxSpeed`; S freia); `maxFallSpeed`
- [x] `tests/physics/collision.test.ts` — rampas 20,6° (snap), 40° (sobe e desce, andando e em sprint, sem perder o chão) e 53° (escorrega); degraus 0,25/0,35 (sobe) e 0,50 (só com pulo); escada descida sem ar nem pouso; sair de um caixote de 1 m continua queda; corredor de 1,2 m; parede sem quicar; `raycast` com máscara, `entity` e hitbox; Campo de Provas real construído
- [x] `tests/data/definitions.test.ts` — `validateDefs(DEFS)` passa; ids; cores; spawn `player`; `killPlaneY < 0`; rampas e limites do Campo de Provas
- [x] `tests/data/hot-config.test.ts` — `keepLive` (HMR de configuração: mesmo objeto, valores novos)
- [x] `tests/helpers/fake-storage.ts`
- [x] `e2e/smoke.mjs` — build + preview em porta livre, Chromium headless (SwiftShader), `?nolock=1&shadows=0&debug=1&seed=1`, `window.__limiar.input.inject(...)` (anda, vira 90°, anda de lado, pula, liga o HUD); asserta zero erros de console, `state === 'running'`, WebGL2, andou ≥ 4 m, `grounded`, `drawCalls ≤ 30`, `fps > 5`; salva `e2e/artifacts/smoke*.png` e `smoke.json`
- [x] `npm run check` verde (typecheck + 150 testes + build + e2e `ok: true`)

### 3.6 Checklist — documentação

- [x] `docs/limiar/README.md` (índice, estado atual)
- [x] `docs/limiar/01-visao-e-design.md` (GDD)
- [x] `docs/limiar/02-design-tecnico.md` (fonte da verdade)
- [x] `docs/limiar/03-arquitetura.md` (como o design virou código; divergências na seção 19)
- [x] `docs/limiar/04-roadmap.md` (este documento)
- [x] `docs/limiar/05-performance.md` (orçamento de draw calls, medição, como ler o HUD)
- [x] `docs/limiar/06-guia-de-desenvolvimento.md`
- [x] `docs/limiar/decisoes/0001`–`0007` + `README.md` (ADRs)
- [x] `projects/limiar/README.md` (como rodar, controles, atalhos, flags)

### 3.7 Critério de pronto de M0

- [x] e2e verde em SwiftShader (`e2e/artifacts/smoke.json`: `ok: true`, `errors: []`)
- [x] ≤ 16 draw calls **com sombras** no HUD de debug — medido **8** (4 chunks + 4 da passada de sombra; 13 com os helpers de F6) em Chromium headless com `?shadows=1` (sonda por `window.__limiar.stats`, registrada em `05-performance.md` §7); o e2e mede 4 sem sombras
- [x] 60 fps estáveis com sombras numa iGPU real — **ou** registro de que não havia iGPU: registrado (`05-performance.md` §7 "nenhuma medição em iGPU real" e `03-arquitetura.md` §19: SwiftShader ≈ 20 fps a 1280 × 720). A medição em iGPU continua pendente e reabre este item quando houver máquina
- [ ] 5 minutos andando e pulando no Campo de Provas sem prender em geometria, sem quicar em rampa, subindo os degraus de 0,25 m e 0,35 m — coberto por testes unitários; a sessão manual de 5 min ainda não foi feita
- [ ] Heap plano por 5 minutos (zero alocação por frame nos hot paths) — só mensurável no painel Memory de um navegador real; checklist em `05-performance.md` §6.4
- [x] HMR de `src/data/movement-config.ts` altera `walkSpeed` sem recarregar a página — verificado manualmente com `vite dev` + Chromium (`walkSpeed` 6 → 7 → 8 → 9 sem reload; registrado em `03-arquitetura.md` §15.1/§19 e no comentário de `src/data/hot-config.ts`); a lógica de `keepLive` é coberta por `tests/data/hot-config.test.ts`. Sem automação permanente desse caminho
- [x] **Parar e mostrar rodando** (Seção 5 do master prompt) — screenshots em `e2e/artifacts/smoke-ready.png`, `smoke-walk.png`, `smoke-hud.png`

### 3.8 O que NÃO entra em M0

- Armas, viewmodel com malha, tiro, hitscan em uso (só o `weaponSocket` vazio, o slot de recoil e as ações `fire`/`aim`/`reload` sem efeito)
- Inimigos, IA, dano, vida/escudo
- Habilidades, classes
- Loot, inventário, Lume
- HUD de jogo (só HUD de debug)
- Crouch, slide, head-bob ligado (`KeyC` já está mapeado, sem efeito)
- Áudio

---

## 4. M1 — Gunplay (pilar nº 1)

**Objetivo.** Fazer atirar ser bom antes de qualquer outro sistema: duas armas com recoil, dispersão, hitmarker, som e viewmodel próprio. É o pilar 1 do master prompt e o item 2 da Seção 3.

**Dependências.** M0 completo. Já existem no código: `rig.weaponSocket` e `viewmodelCamera` (camada `VIEWMODEL`, passada própria em `Renderer.renderFrame`), slot de recoil em `systems/camera-feel.ts` (kick sintético por F9), `CollisionWorld.raycast` com máscara e `RayHit.entity`, eventos `weapon:fired`/`hit:confirmed` em `game/events.ts`, `WeaponSlotId = 'iron' | 'attuned' | 'heavy'`, ações `fire`/`aim`/`reload`/`swapWeapon` em `core/input.ts`, `player.locomotion`.

### Checklist (planejado)

- [ ] `src/data/weapons/weapon-def.ts` — `WeaponDef { id, slot, archetype, element, rpm, damage, critMultiplier, magazine, reserve, reloadTime, spread, recoilPattern, recovery, range, pellets? }`
- [ ] `src/data/weapons/auto-rifle-basic.ts` (slot Ferro) e `shotgun-basic.ts` (slot Afim, pellets), com HMR; `src/data/weapons/index.ts`
- [ ] `DEFS.weapons` no registro + `validateDefs` checando `magazine ≤ reserve` e `weapon.element ∈ elements`
- [ ] Viewmodel low-poly como filho de `rig.weaponSocket`; `src/systems/viewmodel-anim.ts` (frame: sway, ADS com `adsMultiplier` e FOV, pose de sprint)
- [ ] `src/systems/weapons.ts` (passo fixo, entre `kill-plane` e `locomotion-state` em `systems-list.ts`): cadência em passos fixos, magazine/reserve, reload, hitscan com `collision.raycast(…, World | Enemy)`, `emit('weapon:fired', { weaponId, kick })`
- [ ] `recoilPattern` alimentando o slot de recoil por mola em `camera-feel` (substitui o kick sintético de F9)
- [ ] Dispersão por `player.locomotion` (hip / ADS / sprint)
- [ ] Alvos do Campo de Provas viram `Damageable` com hitbox (`collision.addHitbox`); hitmarker e números de dano em DOM (`src/ui/combat-hud.ts`)
- [ ] `src/core/audio.ts` (AudioContext + buffers pré-decodificados) + sons de tiro/impacto/reload (sintetizados ou CC0)
- [ ] Muzzle flash e impacto por `InstancedMesh`
- [ ] Crouch (`KeyC`, já mapeado): cápsula 1,2 m, olho 1,05 m, `crouchSpeed 3,0` — as muretas de 1,1 m passam a fazer sentido
- [ ] Testes: recoil volta a zero em < 0,4 s sem overshoot; rpm exato em passos fixos; shotgun com N pellets determinísticos por seed; `systems-list.ts` na ordem certa

### Critério de pronto

- [ ] Auto rifle e shotgun disparam, recarregam e acertam os alvos com hitmarker, som e recoil legíveis
- [ ] Nenhum contrato de `core/` ou `world/` alterado (prova de não-reescrita, §11 do design técnico)
- [ ] `npm run check` verde; e2e estendido com um disparo contra o alvo a 10 m
- [ ] Passe de feel com o painel F4 registrado em `feel-config.ts` / `data/weapons/*`

### O que NÃO entra

- Inimigos que reagem (alvos são estáticos)
- Slot Pesado (sniper, lançador) — M8
- Elementos aplicados a escudos — M2/M6
- Perks de arma — M4

---

## 5. M2 — Inimigos, IA, vida/escudo

**Objetivo.** Dois inimigos da Ferrugem com IA simples (patrulha → detecção → ataque → cobertura) e o sistema de vida/escudo do jogador com regeneração após X segundos sem dano. Itens 4 e 5 da Seção 3.

**Dependências.** M1 (dano por hitscan, `hit:confirmed`). Já existem no código: `systems/character-physics.ts` move qualquer entidade com `body` via `MoveIntent`; `TEST_GROUND.spawnPoints` com 4 pontos `enemy` e 6 `coverPoints`; `CollisionWorld.raycast` para linha de visão; `EventBus.queue/flush` e o evento `entity:died`; `data/factions.ts` com `rust`; `ENTITY_KINDS` + `AnyEntity` prontos para uma alternativa a mais.

### Checklist (planejado)

- [ ] `src/data/enemies/enemy-def.ts` + **Atirador da Ferrugem** (`rust-gunner`, à distância) e **Saqueador da Ferrugem** (`rust-raider`, corpo a corpo); silhuetas low-poly distintas
- [ ] `src/entities/enemy.ts` — `EnemyEntity` (`body`, `intent`, `def`, `faction`, `ai`, hitbox); `AnyEntity` e `ENTITY_KINDS` ganham `enemy`
- [ ] `src/systems/spawn.ts` — lê `level.spawnPoints` com tag `enemy`
- [ ] `src/systems/ai.ts` — máquina de estados `patrol → detect → attack → cover` usando `level.coverPoints` e linha de visão por `raycast`; só escreve `intent`
- [ ] `src/entities/projectile.ts` + `src/systems/projectiles.ts` — projéteis inimigos como raio por passo contra `World | Player`
- [ ] `src/systems/damage.ts` — elemento × escudo (tabela em `data/elements.ts`), crítico por hitbox de cabeça, `queue('entity:died')`
- [ ] `src/systems/regen.ts` — vida/escudo do jogador regeneram após `regenDelay` s sem dano (`health.lastDamageAt` em `world.time.sim`)
- [ ] Morte do jogador → respawn (reaproveita `respawnPlayer` de `systems/kill-plane.ts`)
- [ ] HUD de combate em DOM (`ui/combat-hud.ts`): vida, escudo, munição
- [ ] Testes: IA em vitest com mundo sintético (transições de estado); `entity:died` via `queue` durante iteração sem corromper listas; regeneração em passos fixos

### Critério de pronto

- [ ] 4 inimigos ativos no Campo de Provas patrulham, detectam, atacam e procuram cobertura
- [ ] Jogador toma dano, escudo quebra antes da vida, ambos regeneram após o intervalo configurado
- [ ] ≤ 40 inimigos sem cair de 60 fps em iGPU (orçamento do design técnico)
- [ ] `npm run check` verde

### O que NÃO entra

- Facções Axioma e Cepa — M7 e M9
- Chefe de missão — M5
- Interações elementais completas (Ressonância em cadeia, Névoa) — M6
- Loot ao morrer — M4 (o evento `entity:died` já fica pronto para isso)

---

## 6. M3 — Classe Rastreador e habilidades

**Objetivo.** Uma classe jogável completa — o **Rastreador** (mobilidade, dash, crítico) — com granada, melee especial, habilidade de classe e Ápice (super), todos com cooldown. Item 1 da Seção 3 e pilares 2 e 3.

**Dependências.** M2 (alvos vivos para as habilidades causarem dano; `damage.ts`). Já existem no código: `player.body.velocity` (dash é impulso por N passos), passos fixos para cooldowns, evento `camera:kick`, ações `grenade`/`melee`/`classAbility`/`super` mapeadas em Q/F/E/X.

### Checklist (planejado)

- [ ] `src/data/classes/ranger.ts` — `ClassDef { id: 'ranger', moveMultiplier: 1.08, critMultiplier, abilities }`
- [ ] `src/data/abilities/*.ts` — `AbilityDef { cooldown, chargeRate?, effect }`: **Granada** (Brasa: área + queima), **Golpe** (melee), **Investida** (dash), **Ápice** (super de carga lenta: rajada de alto dano por 8 s)
- [ ] `src/systems/abilities.ts` — cooldowns em passos fixos; dash como impulso em `body.velocity` com sub-passos de colisão se > 24 m/s; Ápice acumula carga por dano e abates
- [ ] HUD de cooldowns e carga de Ápice em DOM
- [ ] Plataforma de 2,6 m do Campo de Provas alcançável com Investida + pulo
- [ ] `sprintSpeed` ganha `moveMultiplier` da classe (lido no uso, sem copiar em `init`)
- [ ] Testes: cooldowns exatos em passos; dash não tunela pela parede do corredor de 1,2 m; carga de Ápice determinística

### Critério de pronto

- [ ] Teclas Q / F / E / X disparam as quatro habilidades com feedback visual e cooldown visível
- [ ] Rastreador é jogável do início ao fim do Campo de Provas contra os inimigos de M2
- [ ] `npm run check` verde

### O que NÃO entra

- Baluarte e Tecelão/Tecelã — M6
- Árvore de habilidades, escolha de subclasse
- Elementos de habilidade além de Brasa

---

## 7. M4 — Loot, inventário, Lume (power level), persistência

**Objetivo.** Drop de loot ao matar inimigos com raridade visual e stats aleatórios; inventário simples (equipar, ver stats); nível de poder **Lume** escalando dano e dificuldade; tudo persistido no navegador. Itens 6 e 7 da Seção 3 e pilares 6 e 7.

**Dependências.** M3 (jogador completo). Já existem no código: `world.rng` seedável (`core/math/random.ts`, `?seed=`), `SaveStore` versionado com `validate` e `migrations` (`core/storage.ts`), `EntityStore.flushRemovals`, cores de raridade em `data/palette.ts`, eventos `loot:dropped` / `item:equipped` / `power:changed` em `GameEvents`, ação `interact` (`KeyG`).

### Checklist (planejado)

- [ ] `src/data/rarities.ts` — `RarityDef` comum/incomum/raro/lendário/exótico com cor (cinza/verde/azul/roxo/dourado) e nº de perks
- [ ] `src/data/perks/*.ts` — `PerkDef` com hooks `onHit/onKill/onReload/passive`
- [ ] `src/data/items/*.ts` — `ItemDef`; `src/data/loot-tables/*.ts` — `LootTableDef`
- [ ] `src/systems/loot.ts` — escuta `entity:died` (entregue no `flush`), `rollItem(def, rarityTable, rng)` puro, cria `LootEntity`
- [ ] `src/entities/loot.ts` — `LootEntity` com cor de raridade; `AnyEntity` e `ENTITY_KINDS` ganham `loot`
- [ ] `src/systems/pickup.ts` — overlap esfera-cápsula; `item:equipped` ao equipar
- [ ] `src/ui/inventory.ts` — inventário DOM: equipar por slot Ferro / Afim / Pesado, ver stats e perks
- [ ] `player.inventory` e `player.loadout` como dados puros serializados por `SaveStore` (chave própria, `migrations`)
- [ ] `src/systems/power-level.ts` — `powerLevel(loadout)` pura → Lume (média dos slots); `damage.ts` aplica `attackerLume / defenderLume`; HUD mostra "Lume N"
- [ ] `validateDefs` passa a checar `item.perks ⊂ perks`, `enemy.lootTable ⊂ lootTables`
- [ ] Testes: distribuição de raridade com seed fixa; migração de save de versão N para N+1; `powerLevel` com loadout parcial

### Critério de pronto

- [ ] Matar inimigos dropa itens com cor de raridade; pegar, abrir inventário, equipar e ver o Lume mudar
- [ ] Recarregar a página mantém inventário, loadout e Lume
- [ ] `npm run check` verde

### O que NÃO entra

- Economia, moedas, vendedores, crafting — fora do MVP por decisão do master prompt
- Armas do slot Pesado como drops — M8
- Cofre, desmontar item, infusão

---

## 8. M5 — Mapa de patrulha e loop de jogo → MVP completo

**Objetivo.** Fechar o loop do pilar 8: patrulha em zona aberta pequena → matar inimigos e completar objetivos → chefe de missão → loot → repetir com Lume maior. Itens 3 e 8 da Seção 3 (mapa e HUD com minimapa).

**Dependências.** M4. Já existem no código: `LevelDef` com `spawnPoints`/`coverPoints` (o mapa real usa o mesmo `world/level-builder.ts` e `createStaticWorld`), orçamento de draw calls (`05-performance.md`), HUD de debug (F3) para medir.

### Checklist (planejado)

- [ ] `src/data/levels/patrol-ridge.ts` — **Crista da Patrulha**: `LevelDef` com terreno, coberturas, spawns de inimigos e objetivos (mesmo tipo do Campo de Provas; `LevelDef` ganha `objectives`)
- [ ] `InstancedMesh` para props repetidos no `level-builder`
- [ ] `src/systems/objectives.ts` — objetivos simples (matar N, ativar ponto) → chefe de missão (inimigo com mais vida e padrão de ataque) → loot → reinício com Lume maior
- [ ] `src/ui/minimap.ts` — minimapa 2D em `<canvas>` no DOM lendo posições 10×/s
- [ ] HUD final: vida, escudo, munição, cooldowns, minimapa, Lume
- [ ] Passe de performance no mapa real: ≤ 150 draw calls, p95 < 16,6 ms em iGPU
- [ ] Passe de feel com o painel F4; valores gravados em `src/data/*-config.ts`
- [ ] Checklist da Seção 3 do master prompt inteiro marcado (tabela da seção 11 deste documento)

### Critério de pronto

- [ ] Uma sessão completa do loop (patrulha → objetivos → chefe → loot → repetir) sem erros de console
- [ ] Todos os itens da tabela de rastreabilidade (seção 11) com `[x]`
- [ ] `npm run check` verde; e2e cobre a Crista da Patrulha além do Campo de Provas
- [ ] `docs/limiar/05-performance.md` atualizado com os números do mapa real

### O que NÃO entra

- Evento público — M7
- Segunda facção — M7
- Cutscenes, narrativa ambiental com diálogo — fora do MVP

---

## 9. Pós-MVP (listado, não planejado em detalhe)

| Milestone | Conteúdo |
|---|---|
| **M6** | Classes **Baluarte** (tanque: melee pesado, barreiras) e **Tecelão/Tecelã** (área, cura, granadas) com habilidades próprias; elementos **Ressonância** e **Névoa** completos com interações de escudo |
| **M7** | Evento público opcional na patrulha; segunda facção **Axioma** (Lema, Corolário, Postulado) com silhueta e IA distintas; slide |
| **M8** | Polimento de áudio/VFX (pós-processamento só se sobrar orçamento de GPU — ADR 0004); armas do slot **Pesado** (sniper, lançador de foguetes) |
| **M9** | Terceira facção **Cepa**; **Eco** (companheiro/IA); mais mapas |

Gatilhos técnicos que podem antecipar trabalho em qualquer milestone (§5.2 e §12 do design técnico; ADR 0003): migrar `world/collision-world.ts` para `three-mesh-bvh` se a malha de colisão passar de 50k triângulos, se `raycast` passar de 0,3 ms com 40 inimigos, se o heap subir por causa das alocações de `Octree.capsuleIntersect`/`rayIntersect`, ou se "grudar em quinas" não for resolvido; revisitar a decisão sem ECS (ADR 0001) só com > 2 000 entidades ativas.

---

## 10. Fora do escopo (declarado pelo master prompt)

O master prompt (Seção 3, "Não fazer no MVP") retira explicitamente do MVP — e este roadmap **não planeja nem em M6–M9**, salvo decisão futura registrada em ADR:

- **Multiplayer** (cooperativo ou qualquer sincronização de rede)
- **PvP**
- **Raides**
- **Sistema de facções sociais** (reputação, vendedores de facção)
- **Crafting**
- **Economia** (moedas, loja, comércio)
- **Cutscenes**

A arquitetura não os impede (corpo só com `yaw` em `transform`, entidades como dados puros serializáveis), mas nenhum código será escrito para eles antes do MVP.

---

## 11. Rastreabilidade — checklist do MVP (Seção 3 do master prompt) → milestone

| # | Item do master prompt | Milestone | Onde | Estado |
|---|---|---|---|---|
| 1 | 1 classe jogável completa (dash + granada + melee + super) | **M3** | planejado: `data/classes/ranger.ts`, `data/abilities/*`, `systems/abilities.ts`; existe: teclas Q/F/E/X em `data/input-bindings.ts` | [ ] |
| 2 | 1 arma primária (auto rifle) e 1 especial (shotgun) com recoil, som e hitmarkers | **M1** | planejado: `data/weapons/*`, `systems/weapons.ts`, `systems/viewmodel-anim.ts`, `core/audio.ts`, `ui/combat-hud.ts`; existe: `rig.weaponSocket`, slot de recoil em `systems/camera-feel.ts`, `weapon:fired`/`hit:confirmed` | [ ] |
| 3 | 1 mapa pequeno (patrulha) com terreno, cobertura e spawns de inimigos | **M5** (tipo e pipeline em **M0**) | existe: `data/levels/level-def.ts`, `world/level-builder.ts`, Campo de Provas com 4 spawns `enemy` e 6 `coverPoints`; planejado: `data/levels/patrol-ridge.ts` | [ ] (pipeline [x]) |
| 4 | 1 inimigo à distância + 1 corpo a corpo com IA (patrulha → detecção → ataque → cobertura) | **M2** | planejado: `data/enemies/*`, `entities/enemy.ts`, `systems/ai.ts`, `systems/spawn.ts`, `systems/projectiles.ts`; existe: `character-physics` genérico, `raycast` com máscara, `data/factions.ts` | [ ] |
| 5 | Vida/escudo do jogador com regeneração após X s sem dano | **M2** | planejado: `systems/damage.ts`, `systems/regen.ts` | [ ] |
| 6 | Drop de loot ao matar, raridade visual (cor) e stats aleatórios | **M4** | planejado: `systems/loot.ts`, `entities/loot.ts`, `data/rarities.ts`; existe: `core/math/random.ts`, cores de raridade em `data/palette.ts`, `entity:died`/`loot:dropped` | [ ] |
| 7 | Inventário simples (equipar arma, ver stats) | **M4** | planejado: `ui/inventory.ts`, `systems/pickup.ts`; existe: `core/storage.ts` (`SaveStore` com migrations), `item:equipped` | [ ] |
| 8 | HUD: vida, escudo, munição, cooldown de habilidades, minimapa básico | vida/escudo/munição **M2**, cooldowns **M3**, minimapa e HUD final **M5** | planejado: `ui/combat-hud.ts`, `ui/minimap.ts`; existe: `ui/debug-hud.ts` (só debug) | [ ] |
| — | Seção 5: estrutura + `package.json` + esqueleto rodando (render, WASD + mouse look, chão de teste) e parar | **M0** | `projects/limiar/` inteiro; `data/levels/test-ground.ts`; `e2e/artifacts/smoke*.png` | [x] |

Pilares do master prompt (Seção 2) que o MVP cobre só em parte, com a continuação: pilar 2 (três classes) → M6; pilar 4 (2–3 elementos interagindo com escudos) → Brasa em M3, Ressonância e Névoa em M6; pilar 5 (slot Pesado e tipos variados) → M8; pilar 9 (três facções) → Ferrugem em M2, Axioma em M7, Cepa em M9.

---

## 12. Comandos úteis por milestone

```bash
cd /home/user/Personal/projects/limiar

npm install            # dependências (versões exatas, ~10 s)
npm run dev            # http://127.0.0.1:5173 — HMR de src/data/*-config.ts, HUD de debug ligado
npm run typecheck      # TS estrito (src, tests, configs, e2e)
npm test               # vitest (lógica pura em Node, sem WebGL) — 11 suítes, 150 testes
npm run build          # vite build (imprime tamanho gz por chunk — orçamento < 250 KB gz)
npm run preview        # serve dist/ em http://127.0.0.1:4173 (use este para medir performance)
npm run test:e2e       # smoke em Chromium headless (SwiftShader); pula com aviso se não houver Chromium
npm run check          # tudo acima em sequência — gate para fechar qualquer milestone
```

Sem Chromium local: `CHROMIUM_PATH=/caminho/para/chromium npm run test:e2e` ou `npx playwright@1.63.0 install chromium`.

Flags de URL úteis durante o desenvolvimento: `?nolock=1` (sem pointer lock), `?shadows=0`, `?debug=1` (expõe `window.__limiar`, habilita P/T), `?scale=0.75`, `?seed=123`, `?hud=1`.

---

## 13. Regras para manter este roadmap

- Marcar `[x]` só com evidência: arquivo existente, teste verde ou número medido.
- Desvio em relação ao design técnico → registrar no próprio item (como o `codeSplitting` do Vite 8 em 3.1) e na seção 19 de `03-arquitetura.md`; se for decisão de arquitetura, também em `docs/limiar/decisoes/`.
- Ao começar um milestone, trocar "planejado:" por nomes reais conforme os arquivos forem criados.
- Nunca mover item de milestone sem atualizar a tabela de rastreabilidade (seção 11).
- Um milestone novo entra só depois da seção 9 e nunca reabre o escopo excluído da seção 10 sem ADR.
