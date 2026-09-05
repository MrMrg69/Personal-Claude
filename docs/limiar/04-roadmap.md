# LIMIAR — Roadmap de milestones

> Roadmap do **LIMIAR** (looter-shooter em primeira pessoa, Three.js + TypeScript + Vite, 100 % no navegador). Derivado do §13 do [design técnico](./02-design-tecnico.md) e da Seção 3 do master prompt. O design técnico é a fonte da verdade para arquitetura, contratos e números; este documento só organiza **o que entra em cada entrega, em que ordem e como saber que ficou pronto**.
>
> Nomes de arquivos, funções e sistemas seguem a árvore planejada no §10 do design técnico. Onde o código real em `projects/limiar/` ainda não existe, o nome é **planejado**. O verificador de documentação marca o que existe de fato.
>
> Estado: **M0 em andamento** (esta entrega).

---

## 1. Como ler este documento

- `[ ]` item planejado e ainda não verificado no código.
- `[x]` item verificado no código (marcado pelo verificador de docs ou por quem fecha o milestone).
- Cada milestone tem: **objetivo**, **dependências**, **checklist verificável**, **critério de pronto** e **o que NÃO entra**.
- O princípio do master prompt vale para todos: *passos pequenos e verificáveis*. Um milestone só fecha com `npm run check` verde.

Comando único de verificação (definido em `projects/limiar/package.json`):

```bash
cd /home/user/Personal/projects/limiar
npm run check   # typecheck + vitest + vite build + smoke e2e
```

---

## 2. Visão geral

| Milestone | Nome | Entrega principal | Pilar do master prompt |
|---|---|---|---|
| **M0** | Esqueleto | Render Three.js, câmera FPS (WASD + mouse), Campo de Provas, loop fixo, colisão, testes, e2e | Seção 5 (primeira tarefa concreta) |
| **M1** | Gunplay | Auto rifle (Ferro) + shotgun (Afim) com recoil, hitmarker, som, viewmodel; crouch | Pilar 1 (feel de tiro) |
| **M2** | Inimigos, IA, vida/escudo | Atirador e Saqueador da Ferrugem; IA patrulha → detecção → ataque → cobertura; regeneração | Pilares 4 (parcial) e 9 |
| **M3** | Classe Rastreador | Granada, Golpe, Investida (dash), Ápice (super) com cooldowns e HUD | Pilares 2 e 3 |
| **M4** | Loot, inventário, Lume | Raridades, perks, drop, pickup, inventário DOM, Lume (power level), persistência | Pilares 6 e 7 |
| **M5** | Mapa de patrulha e loop | `patrol-ridge`, objetivos, chefe, minimapa, HUD final → **MVP completo** | Pilar 8 |
| M6–M9 | Pós-MVP | Outras classes, facções, evento público, armas Pesadas, Eco, mais mapas | Pilares 2, 4, 5, 9 (restante) |

Ordem obrigatória: M0 → M1 → M2 → M3 → M4 → M5. Cada milestone depende do anterior porque a arquitetura foi desenhada para **arquivos novos, nunca reescrita** (§11 do design técnico). Tuning de feel (dados em `src/data/*-config.ts` + painel lil-gui) continua em paralelo a partir de M0.

---

## 3. M0 — Esqueleto (esta entrega)

**Objetivo.** Cumprir a Seção 5 do master prompt: estrutura de pastas, `package.json`, janela Three.js renderizando, controle de câmera em primeira pessoa (WASD + mouse look), chão de teste — e **parar antes de armas e combate**. A arquitetura já sustenta o MVP inteiro sem reescrita.

**Dependências.** Nenhuma. Ambiente: Node ≥ 22.12, npm, Chromium headless em `/opt/pw-browsers/chromium` para o e2e (opcional: o smoke pula com mensagem clara se não houver Chromium).

**Estado no momento da escrita (verificado em `projects/limiar/`):** existiam `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`, `public/favicon.svg`, `e2e/artifacts/.gitkeep` e um `src/main.ts` provisório (checa WebGL2 e escreve uma mensagem em `#ui`). As pastas `src/core/`, `src/data/`, `src/entities/`, `src/world/`, `src/systems/`, `src/game/`, `src/ui/`, os testes e `e2e/smoke.mjs` estavam sendo escritos em paralelo. Os itens abaixo são o que o design técnico promete; o verificador marca o que existe.

### 3.1 Checklist — infraestrutura

- [ ] `package.json` com scripts `dev`, `build`, `preview`, `typecheck`, `test`, `test:watch`, `test:e2e`, `check` e versões exatas (`three 0.185.1`, `vite 8.2.2`, `vitest 5.0.0`, `typescript 5.9.3`, `@types/three 0.185.4`, `@types/node 22.20.1`, `playwright-core 1.63.0`)
- [ ] `tsconfig.json` estrito (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `verbatimModuleSyntax`) + `tsconfig.node.json` para `vite.config.ts`, `vitest.config.ts` e `e2e/`
- [ ] `vite.config.ts` com alias `@` → `src/`, `base: './'`, chunk separado para `three` (`build.rolldownOptions.output.codeSplitting`; desvio registrado em relação ao `advancedChunks` do design, ver §9 do design técnico) e `chunkSizeWarningLimit: 700`
- [ ] `vitest.config.ts` com `environment: 'node'` e `include: ['tests/**/*.test.ts']`
- [ ] `index.html` com `<canvas id="game">` + `<div id="ui">` e `src/main.ts`
- [ ] `.gitignore` (`node_modules/`, `dist/`, `e2e/artifacts/*`), `README.md` do projeto, `public/favicon.svg`

### 3.2 Checklist — `src/core/` (plataforma, não conhece o jogo)

- [ ] `time.ts` — `FIXED_DT = 1/60`, `MAX_FRAME_DT = 0.1`, `MAX_STEPS_PER_FRAME = 5`
- [ ] `loop.ts` — `GameLoop` com timestep fixo + interpolação (`alpha`), `pause`/`resume`, `stats.droppedSteps`
- [ ] `input.ts` — `InputState`: teclado por `KeyboardEvent.code`, mouse por `movementX/Y`, bordas limpas só em `endFixedStep()`, `inject()` para e2e/bots
- [ ] `pointer-lock.ts` — `requestPointerLock({ unadjustedMovement: true })` com fallback, cooldown de relock, modo `unlocked` (`?nolock=1`)
- [ ] `renderer.ts` — `createRenderer`, `applyRenderConfig`, `renderFrame` em duas passadas (mundo + viewmodel) com `shadowMap.autoUpdate = false`, render scale, resize
- [ ] `layers.ts` — `WORLD = 0`, `VIEWMODEL = 1`, `DEBUG = 2`
- [ ] `camera-rig.ts` — `CameraRig`: `root(yaw) → head(pitch + offsets) → worldCamera`; `viewmodelRoot → viewmodelCamera → weaponSocket` (vazio em M0); `setHfov`
- [ ] `events.ts` — `EventBus` tipado com `on/once/emit/queue/flush/clear`
- [ ] `entity.ts` — `EntityId`, `Transform`, `EntityBase`, `EntityStore` (`ofKind`, `flushRemovals`), `allocEntityId`
- [ ] `debug-stats.ts` — FPS, frame time (avg/max 1 s, média 3 s), `renderer.info`
- [ ] `storage.ts` — `SaveStore<T>` com envelope `{ version, savedAt, payload }` e `migrations`
- [ ] `url-flags.ts` — `?nolock`, `?shadows`, `?debug`, `?scale`, `?seed`, `?hud`
- [ ] `math/index.ts` (`clamp`, `lerp`, `damp`, `moveTowards`, `rayCapsule`, …), `math/spring.ts` (`Spring`), `math/random.ts` (`Random`, mulberry32)
- [ ] `physics/layers.ts` (`CollisionLayer` como objeto `as const`, não `const enum`), `physics/movement-config.ts` (tipo), `physics/capsule-body.ts` (`CapsuleBody`, `MoveIntent`, `integrateCapsuleBody` pura), `physics/collision-resolve.ts` (`resolveCapsuleCollision` com step-up e snap ao chão)
- [ ] Interface de consulta de colisão declarada em `core/physics/` (ex.: `collision-query.ts`) e implementada em `world/collision-world.ts` — mantém `core/` sem importar `world/`

### 3.3 Checklist — `src/data/` (dados e tipos; sem `three` como valor)

- [ ] `palette.ts` — cores nomeadas (ocre, ferrugem, ciano-vigia, magenta-maré, névoa, raridades)
- [ ] `elements.ts` — Brasa (`ember`), Ressonância (`resonance`), Névoa (`haze`)
- [ ] `factions.ts` — Axioma (`axiom`), Ferrugem (`rust`), Cepa (`strain`)
- [ ] `movement-config.ts`, `camera-config.ts`, `feel-config.ts`, `render-config.ts` — objetos mutáveis com `import.meta.hot.accept` + `Object.assign` (a aplicação de `render-config` fica em `game/`)
- [ ] `settings-defaults.ts` — `Settings` (sensibilidade, hFOV, sombras, render scale, HUD de debug) + versão do save
- [ ] `input-bindings.ts` — mapeamento `code → Action`
- [ ] `levels/level-def.ts` — `LevelDef`, `PrimitiveDef` (`box`/`ramp`/`cylinder`), `SpawnPoint`, `coverPoints`, `killPlaneY`
- [ ] `levels/test-ground.ts` — **Campo de Provas** (chão em 4 lajes com buraco, paredes de borda, régua, poste de 1,80 m, muretas, pilares, muro, caixotes, escada 0,25/0,50/0,75/1,00, rampas 20,6°/40°/53°, plataformas 1,2/1,8/2,6 m, torre, corredor 1,2 m, 5 alvos cilíndricos; 4 spawns `enemy` e 6 `coverPoints`)
- [ ] `index.ts` — `DEFS` + `validateDefs` + `DefinitionError`

### 3.4 Checklist — `src/world/`, `src/entities/`, `src/systems/`, `src/game/`, `src/ui/`

- [ ] `world/collision-world.ts` — `Octree` + `Capsule` de `three/addons`; `capsuleIntersect`, `raycast` com máscara, `addHitbox/removeHitbox`, `debugHelper`
- [ ] `world/level-builder.ts` — primitivas → geometrias com cor por vértice → 4 meshes por quadrante (`mergeGeometries`) + helpers na camada DEBUG
- [ ] `world/materials.ts` — cache de `MeshLambertMaterial` flat + vertex colors
- [ ] `world/lighting.ts` — hemisférica + direcional com sombra `PCFShadowMap` 2048² e snap de texel
- [ ] `entities/index.ts` (`AnyEntity`, type guards), `entities/player.ts` (`PlayerEntity`, `createPlayer`), `entities/static-world.ts`
- [ ] Sistemas de passo fixo: `player-input`, `character-physics`, `kill-plane`, `locomotion-state`
- [ ] Sistemas de frame: `player-look`, `camera-feel` (kick de pouso, slot de recoil por F9, FOV dinâmico de sprint, head-bob **desligado**), `view-sync`, `camera-sync`, `debug-stats-system` (auto-desligar sombras por medição)
- [ ] `game/game.ts`, `game/world.ts`, `game/events.ts` (`GameEvents` com eventos reservados para M1+), `game/state.ts`, `game/systems-list.ts` (única fonte da ordem), `game/debug-api.ts` (`window.__limiar`)
- [ ] `ui/styles.css`, `ui/overlay.ts` (clique para jogar / pausado / erro de lock / contexto perdido / sem WebGL2), `ui/debug-hud.ts` (F3), `ui/tuning-panel.ts` (F4, lil-gui por `import()` dinâmico, só DEV)
- [ ] Controles: WASD, mouse, Espaço (pulo com hold), Shift (sprint); atalhos F3/F4/F6/F7/F8/F9, P e T (com `?debug`), Esc (modo sem lock)

### 3.5 Checklist — testes e verificação

- [ ] `tests/architecture.test.ts` — regras de dependência entre pastas (§3.2 do design técnico)
- [ ] `tests/core/{loop,input,events,spring,random,storage}.test.ts`
- [ ] `tests/physics/integrate.test.ts` — altura de pulo de toque 1,40 ± 0,03 m; hold entre 2,0 e 2,4 m; coyote; jump buffer; controle aéreo
- [ ] `tests/physics/collision.test.ts` — rampas 40° (anda) e 53° (escorrega), degraus 0,25/0,35 (sobe) e 0,50 (não sobe), corredor de 1,2 m, `raycast` com `entity`
- [ ] `tests/data/definitions.test.ts` — `validateDefs(DEFS)` passa; ids únicos; cores hex; spawn `player`; `killPlaneY < 0`
- [ ] `tests/helpers/fake-storage.ts`
- [ ] `e2e/smoke.mjs` — build + preview, Chromium headless (SwiftShader), `?nolock=1&shadows=0&debug=1&seed=1`, `__limiar.input.inject({ forward: true })`, asserta: zero erros de console, `state === 'running'`, WebGL2, posição mudou, `grounded`, `drawCalls ≤ 30`, `fps > 5`; salva `e2e/artifacts/smoke.png` e `smoke.json`
- [ ] `npm run check` verde

### 3.6 Checklist — documentação

- [ ] `docs/limiar/01-visao-e-design.md` (GDD)
- [ ] `docs/limiar/02-design-tecnico.md` (fonte da verdade)
- [ ] `docs/limiar/04-roadmap.md` (este documento)
- [ ] `docs/limiar/performance.md` (orçamento de draw calls, medição, como ler o HUD)
- [ ] `docs/limiar/decisoes/0001`–`0007` (ADRs)
- [ ] `projects/limiar/README.md` (como rodar, controles, atalhos)

### 3.7 Critério de pronto de M0

- [ ] e2e verde em SwiftShader
- [ ] ≤ 16 draw calls com sombras no HUD de debug (esperado ≈ 12)
- [ ] 60 fps estáveis com sombras numa iGPU real — **ou** registro em `performance.md` de que não havia iGPU disponível e o número medido em SwiftShader
- [ ] 5 minutos andando e pulando no Campo de Provas sem prender em geometria, sem quicar em rampa, subindo os degraus de 0,25 m e 0,35 m
- [ ] Heap plano por 5 minutos (zero alocação por frame nos hot paths)
- [ ] HMR de `src/data/movement-config.ts` altera `walkSpeed` sem recarregar a página
- [ ] **Parar e mostrar rodando** (Seção 5 do master prompt)

### 3.8 O que NÃO entra em M0

- Armas, viewmodel com malha, tiro, hitscan em uso (só o `weaponSocket` vazio e o slot de recoil)
- Inimigos, IA, dano, vida/escudo
- Habilidades, classes
- Loot, inventário, Lume
- HUD de jogo (só HUD de debug)
- Crouch, slide, head-bob ligado
- Áudio

---

## 4. M1 — Gunplay (pilar nº 1)

**Objetivo.** Fazer atirar ser bom antes de qualquer outro sistema: duas armas com recoil, dispersão, hitmarker, som e viewmodel próprio. É o pilar 1 do master prompt e o item 2 da Seção 3.

**Dependências.** M0 completo: `rig.weaponSocket`, `viewmodelCamera` (camada 1, FOV 55°), slot de recoil em `camera-feel`, `collision.raycast` com `RayHit.entity`, evento `weapon:fired` já declarado em `game/events.ts`, `player.locomotion`.

### Checklist

- [ ] `src/data/weapons/weapon-def.ts` — `WeaponDef { id, slot, archetype, element, rpm, damage, critMultiplier, magazine, reserve, reloadTime, spread, recoilPattern, recovery, range, pellets? }`
- [ ] `src/data/weapons/auto-rifle-basic.ts` (slot Ferro) e `shotgun-basic.ts` (slot Afim, pellets), com HMR
- [ ] `DEFS.weapons` no registro + `validateDefs` checando `magazine ≤ reserve` e `weapon.element ∈ elements`
- [ ] Viewmodel low-poly como filho de `rig.weaponSocket`; `src/systems/viewmodel-anim.ts` (sway, ADS com `adsMultiplier` e FOV, pose de sprint)
- [ ] `src/systems/weapons.ts` (passo fixo, entre `kill-plane` e `locomotion-state`): cadência em passos fixos, magazine/reserve, reload, hitscan com `collision.raycast(…, World | Enemy)`, `emit('weapon:fired', { kick })`
- [ ] `recoilPattern` alimentando o slot de recoil por mola em `camera-feel` (substitui o kick sintético de F9)
- [ ] Dispersão por `player.locomotion` (hip / ADS / sprint)
- [ ] Alvos do Campo de Provas viram `Damageable` com hitbox (`collision.addHitbox`); hitmarker e números de dano em DOM (`src/ui/combat-hud.ts`)
- [ ] `src/core/audio.ts` (AudioContext + buffers pré-decodificados) + sons de tiro/impacto/reload (sintetizados ou CC0)
- [ ] Muzzle flash e impacto por `InstancedMesh`
- [ ] Crouch: cápsula 1,2 m, olho 1,05 m, `crouchSpeed 3,0` (as muretas de 1,1 m passam a fazer sentido)
- [ ] Testes: recoil volta a zero em < 0,4 s sem overshoot; rpm exato em passos fixos; shotgun com N pellets determinísticos por seed; `systems-list.ts` na ordem certa

### Critério de pronto

- [ ] Auto rifle e shotgun disparam, recarregam e acertam os alvos com hitmarker, som e recoil legíveis
- [ ] Nenhum contrato de `core/` ou `world/` alterado (prova de não-reescrita, §11 do design técnico)
- [ ] `npm run check` verde; e2e estendido com um disparo contra o alvo a 10 m
- [ ] Passe de feel com o painel F4 registrado em `feel-config.ts` / `weapons/*`

### O que NÃO entra

- Inimigos que reagem (alvos são estáticos)
- Slot Pesado (sniper, lançador) — M8
- Elementos aplicados a escudos — M2/M6
- Perks de arma — M4

---

## 5. M2 — Inimigos, IA, vida/escudo

**Objetivo.** Dois inimigos da Ferrugem com IA simples (patrulha → detecção → ataque → cobertura) e o sistema de vida/escudo do jogador com regeneração após X segundos sem dano. Itens 4 e 5 da Seção 3.

**Dependências.** M1 (dano por hitscan, `hit:confirmed`). De M0: `character-physics` já move qualquer entidade com `body` via `MoveIntent`; `level.spawnPoints` com tag `enemy`; `level.coverPoints`; `collision.raycast` para linha de visão; `EventBus.queue/flush` para `entity:died`.

### Checklist

- [ ] `src/data/enemies/enemy-def.ts` + **Atirador da Ferrugem** (`rust-gunner`, à distância) e **Saqueador da Ferrugem** (`rust-raider`, corpo a corpo); silhuetas low-poly distintas
- [ ] `src/entities/enemy.ts` — `EnemyEntity` (`body`, `intent`, `def`, `faction`, `ai`, hitbox); `AnyEntity` ganha `| EnemyEntity`
- [ ] `src/systems/spawn.ts` — lê `spawnPoints` com tag `enemy`
- [ ] `src/systems/ai.ts` — máquina de estados `patrol → detect → attack → cover` usando `coverPoints` e linha de visão por `raycast`; só escreve `intent`
- [ ] `src/entities/projectile.ts` + `src/systems/projectiles.ts` — projéteis inimigos como raio por passo contra `World | Player`
- [ ] `src/systems/damage.ts` — elemento × escudo (tabela em `data/elements.ts`), crítico por hitbox de cabeça, `queue('entity:died')`
- [ ] `src/systems/regen.ts` — vida/escudo do jogador regeneram após `regenDelay` s sem dano (`health.lastDamageAt` em `world.time.sim`)
- [ ] Morte do jogador → respawn no último spawn seguro
- [ ] HUD de combate em DOM: vida, escudo, munição
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

**Dependências.** M2 (alvos vivos para as habilidades causarem dano; `damage.ts`). De M0: `player.body.velocity` (dash é impulso por N passos), cooldowns em passos fixos, evento `camera:kick`.

### Checklist

- [ ] `src/data/classes/ranger.ts` — `ClassDef { id: 'ranger', moveMultiplier: 1.08, critMultiplier, abilities }`
- [ ] `src/data/abilities/*.ts` — `AbilityDef { cooldown, chargeRate?, effect }`: **Granada** (Brasa: área + queima), **Golpe** (melee), **Investida** (dash), **Ápice** (super de carga lenta: rajada de alto dano por 8 s)
- [ ] `src/systems/abilities.ts` — cooldowns em passos fixos; dash como impulso em `body.velocity` com sub-passos de colisão se > 24 m/s; Ápice acumula carga por dano e abates
- [ ] HUD de cooldowns e carga de Ápice em DOM
- [ ] Plataforma de 2,6 m do Campo de Provas alcançável com Investida + pulo
- [ ] `sprintSpeed` ganha `moveMultiplier` da classe (lido no uso, sem copiar em `init`)
- [ ] Testes: cooldowns exatos em passos; dash não tunela pela parede do corredor; carga de Ápice determinística

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

**Dependências.** M3 (jogador completo). De M0: `world.rng` seedável, `SaveStore` versionado com `migrations`, `EntityStore.flushRemovals`, `loot:dropped` / `item:equipped` / `power:changed` já declarados em `GameEvents`.

### Checklist

- [ ] `src/data/rarities.ts` — `RarityDef` comum/incomum/raro/lendário/exótico com cor (cinza/verde/azul/roxo/dourado) e nº de perks
- [ ] `src/data/perks/*.ts` — `PerkDef` com hooks `onHit/onKill/onReload/passive`
- [ ] `src/data/items/*.ts` — `ItemDef`; `src/data/loot-tables/*.ts` — `LootTableDef`
- [ ] `src/systems/loot.ts` — escuta `entity:died` (entregue no `flush`), `rollItem(def, rarityTable, rng)` puro, cria `LootEntity`
- [ ] `src/entities/loot.ts` — `LootEntity` com cor de raridade; `AnyEntity` ganha `| LootEntity`
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

**Dependências.** M4. De M0: `LevelDef` com `spawnPoints`/`coverPoints` (o mapa real usa o mesmo `level-builder`), orçamento de draw calls, HUD de debug para medir.

### Checklist

- [ ] `src/data/levels/patrol-ridge.ts` — `LevelDef` com terreno, coberturas, spawns de inimigos e objetivos (mesmo tipo do Campo de Provas)
- [ ] `InstancedMesh` para props repetidos no `level-builder`
- [ ] `src/systems/objectives.ts` — objetivos simples (matar N, ativar ponto) → chefe de missão (inimigo com mais vida e padrão de ataque) → loot → reinício com Lume maior
- [ ] Minimapa 2D em `<canvas>` no DOM lendo posições 10×/s
- [ ] HUD final: vida, escudo, munição, cooldowns, minimapa, Lume
- [ ] Passe de performance no mapa real: ≤ 150 draw calls, p95 < 16,6 ms em iGPU
- [ ] Passe de feel com o painel F4; valores gravados em `src/data/*-config.ts`
- [ ] Checklist da Seção 3 do master prompt inteiro marcado (tabela do §11 deste documento)

### Critério de pronto

- [ ] Uma sessão completa do loop (patrulha → objetivos → chefe → loot → repetir) sem erros de console
- [ ] Todos os itens da tabela de rastreabilidade (§11) com `[x]`
- [ ] `npm run check` verde; e2e cobre o mapa de patrulha além do Campo de Provas
- [ ] `docs/limiar/performance.md` atualizado com os números do mapa real

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
| **M8** | Polimento de áudio/VFX (pós-processamento só se sobrar orçamento de GPU); armas do slot **Pesado** (sniper, lançador de foguetes) |
| **M9** | Terceira facção **Cepa**; **Eco** (companheiro/IA); mais mapas |

Gatilhos técnicos que podem antecipar trabalho em qualquer milestone (§5.2 e §12 do design técnico): migrar `world/collision-world.ts` para `three-mesh-bvh` se a malha de colisão passar de 50k triângulos, se `raycast` passar de 0,3 ms com 40 inimigos ou se "grudar em quinas" não for resolvido; revisitar a decisão sem ECS só com > 2 000 entidades ativas.

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

| # | Item do master prompt | Milestone | Onde (planejado) | Estado |
|---|---|---|---|---|
| 1 | 1 classe jogável completa (dash + granada + melee + super) | **M3** | `data/classes/ranger.ts`, `data/abilities/*`, `systems/abilities.ts` | [ ] |
| 2 | 1 arma primária (auto rifle) e 1 especial (shotgun) com recoil, som e hitmarkers | **M1** | `data/weapons/*`, `systems/weapons.ts`, `systems/viewmodel-anim.ts`, `core/audio.ts`, `ui/combat-hud.ts` | [ ] |
| 3 | 1 mapa pequeno (patrulha) com terreno, cobertura e spawns de inimigos | **M5** (tipo e pipeline em **M0**) | `data/levels/level-def.ts` e `world/level-builder.ts` (M0); `data/levels/patrol-ridge.ts` (M5) | [ ] |
| 4 | 1 inimigo à distância + 1 corpo a corpo com IA (patrulha → detecção → ataque → cobertura) | **M2** | `data/enemies/*`, `entities/enemy.ts`, `systems/ai.ts`, `systems/spawn.ts`, `systems/projectiles.ts` | [ ] |
| 5 | Vida/escudo do jogador com regeneração após X s sem dano | **M2** | `systems/damage.ts`, `systems/regen.ts` | [ ] |
| 6 | Drop de loot ao matar, raridade visual (cor) e stats aleatórios | **M4** | `systems/loot.ts`, `entities/loot.ts`, `data/rarities.ts`, `core/math/random.ts` (M0) | [ ] |
| 7 | Inventário simples (equipar arma, ver stats) | **M4** | `ui/inventory.ts`, `systems/pickup.ts`, `core/storage.ts` (M0) | [ ] |
| 8 | HUD: vida, escudo, munição, cooldown de habilidades, minimapa básico | vida/escudo/munição **M2**, cooldowns **M3**, minimapa e HUD final **M5** | `ui/combat-hud.ts`, `ui/minimap.ts` | [ ] |
| — | Seção 5: estrutura + `package.json` + esqueleto rodando (render, WASD + mouse look, chão de teste) e parar | **M0** | `projects/limiar/` inteiro; `data/levels/test-ground.ts` | [ ] |

Pilares do master prompt (Seção 2) que o MVP cobre só em parte, com a continuação: pilar 2 (três classes) → M6; pilar 4 (2–3 elementos interagindo com escudos) → Brasa em M3, Ressonância e Névoa em M6; pilar 5 (slot Pesado e tipos variados) → M8; pilar 9 (três facções) → Ferrugem em M2, Axioma em M7, Cepa em M9.

---

## 12. Comandos úteis por milestone

```bash
cd /home/user/Personal/projects/limiar

npm install            # dependências (versões exatas, ~10 s)
npm run dev            # http://127.0.0.1:5173 — HMR de src/data/*-config.ts
npm run typecheck      # TS estrito (src, tests, configs, e2e)
npm test               # vitest (lógica pura em Node, sem WebGL)
npm run build          # vite build (imprime tamanho gz por chunk — orçamento < 250 KB gz)
npm run test:e2e       # smoke em Chromium headless (SwiftShader); pula com aviso se não houver Chromium
npm run check          # tudo acima em sequência — gate para fechar qualquer milestone
```

Flags de URL úteis durante o desenvolvimento: `?nolock=1` (sem pointer lock), `?shadows=0`, `?debug=1` (expõe `window.__limiar`, habilita P/T), `?scale=0.75`, `?seed=123`, `?hud=1`.

---

## 13. Regras para manter este roadmap

- Marcar `[x]` só com evidência: arquivo existente, teste verde ou número medido.
- Desvio em relação ao design técnico → registrar no próprio item (como o `codeSplitting` do Vite 8 em §3.1) e, se for decisão de arquitetura, em `docs/limiar/decisoes/`.
- Nunca mover item de milestone sem atualizar a tabela de rastreabilidade (§11).
- Um milestone novo entra só depois do §9 e nunca reabre o escopo excluído do §10 sem ADR.
