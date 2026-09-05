# LIMIAR — Guia de desenvolvimento

> Como instalar, rodar, testar, depurar e estender o protótipo. Baseado no **código real** em `projects/limiar/` (estado: **M0 — esqueleto**). A fonte da verdade para arquitetura, contratos e valores é o [design técnico](02-design-tecnico.md); como o design virou código está em [03 — Arquitetura](03-arquitetura.md). Este guia é o manual de bordo do dia a dia.

Convenções deste documento: caminhos relativos a `projects/limiar/`, salvo indicação. Comandos assumem um terminal aberto nessa pasta. Tudo que está marcado como *planejado* ainda não existe no código e usa o nome do design técnico.

---

## 1. Pré-requisitos

| Item | Versão | Observação |
|---|---|---|
| Node.js | ≥ 22.12 (`engines` do `package.json`) | Verificado com 22.22. |
| npm | 10.x | Vem com o Node. |
| Navegador | Chrome/Edge/Firefox recentes | **WebGL2** obrigatório; sem ele o jogo mostra um overlay de erro claro. |
| Chromium para o e2e | opcional | Só para `npm run test:e2e`. Ver [§7.2](#72-smoke-test-e2e). |

GPU dedicada não é necessária: o alvo é iGPU. Em máquinas sem GPU (SwiftShader) o jogo roda, mas o FPS não é representativo (ver [05-performance.md](05-performance.md)).

Dependências fixadas com versão exata (sem `^`): `three 0.185.1`, `@types/three 0.185.4`, `vite 8.2.2`, `vitest 5.0.0`, `typescript 5.9.3`, `@types/node 22.20.1`, `playwright-core 1.63.0`. Não há outras dependências de runtime; `lil-gui` vem de `three/addons` e só entra em DEV.

## 2. Instalação

```sh
cd projects/limiar
npm install
```

Cerca de 10 s, ~50 pacotes. O `package-lock.json` está versionado: em CI use `npm ci`.

Lista de verificação pós-instalação:

- [ ] `npm run typecheck` sem erros.
- [ ] `npm test` verde (11 suítes, 150 testes).
- [ ] `npm run dev` abre `http://127.0.0.1:5173` e o overlay "LIMIAR" aparece.

## 3. Scripts npm

Todos confirmados rodando neste repositório (última passada: `npm run check` verde).

| Script | Comando real | O que faz | Quando usar |
|---|---|---|---|
| `npm run dev` | `vite --host 127.0.0.1 --port 5173` | Servidor de desenvolvimento com HMR. HUD de debug ligado por padrão, painel `F4` disponível, `validateDefs(DEFS)` roda ao montar. | Desenvolvimento diário. |
| `npm run build` | `vite build` | Gera `dist/`. O `three` sai em chunk próprio (`build.rolldownOptions.output.codeSplitting`). Resultado atual: índice ≈ 59 kB (21,4 kB gz) + three ≈ 539 kB (135 kB gz) + CSS 2,6 kB, sem avisos. | Antes de medir performance real. |
| `npm run preview` | `vite preview --host 127.0.0.1 --port 4173 --strictPort` | Serve `dist/`. | Testar o build de produção. |
| `npm run typecheck` | `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.node.json` | Dois projetos: `src/` + `tests/` e os arquivos de Node (`vite.config.ts`, `vitest.config.ts`, `e2e/smoke.mjs` com `checkJs`). | Sempre antes de considerar algo pronto. |
| `npm test` | `vitest run` | Testes unitários em Node (sem DOM nem WebGL). | A cada mudança em `core/`, `data/`, `world/`. |
| `npm run test:watch` | `vitest` | Modo watch. | Enquanto escreve testes. |
| `npm run test:e2e` | `node e2e/smoke.mjs` | Build (se `dist/` não existir) → `vite preview` em porta livre → Chromium headless. Pula com exit 0 se não achar Chromium. | Antes de entregar; valida o jogo montado no navegador. |
| `npm run check` | `typecheck` → `test` → `build` → `test:e2e` | Gate completo (~1 min com Chromium). | Antes de abrir PR. |

`dist/` e `e2e/artifacts/*` (exceto `.gitkeep`) estão no `.gitignore`.

## 4. Controles e atalhos

### 4.1 Controles do jogo

Fonte: `src/data/input-bindings.ts` (`INPUT_BINDINGS`). Os mapeamentos são por `KeyboardEvent.code` (posição física da tecla), então funcionam igual em ABNT2, QWERTY e AZERTY.

| Entrada | Ação (`Action`) | Estado em M0 |
|---|---|---|
| `W A S D`, `↑` | `forward`/`back`/`left`/`right` | ativo |
| `Shift esq.` | `sprint` — só vale empurrando para a frente (`dir.y > 0,5`) | ativo |
| `Espaço` | `jump` — segurar sobe mais (≈ 1,4 m no toque, ≈ 2,1 m segurando) | ativo |
| mouse | olhar: 0,022 °/contagem × multiplicador 1,5, sem suavização | ativo |
| `Esc` | `pause` — no modo sem pointer lock pausa direto; com lock, o próprio navegador solta o mouse e o jogo pausa | ativo |
| `Ctrl esq.`, `C` | `crouch` | mapeado, sem sistema |
| `Mouse0` / `Mouse2` | `fire` / `aim` | mapeado, sem sistema (M1) |
| `R`, `F`, `Q`, `E`, `X`, `G` | `reload`, `melee`, `grenade`, `classAbility`, `super` (Ápice), `interact` | mapeado, sem sistema (M1–M3) |
| roda do mouse | `swapWeapon` | mapeado, sem sistema (M1) |

Clique no overlay para começar. O jogo pede pointer lock; se o navegador recusar duas vezes seguidas (iframe, política do site — `failuresBeforeFallback: 2` em `src/core/pointer-lock.ts`), cai para o **modo sem captura do mouse** e a câmera segue o mouse sobre a página. O overlay avisa quando isso acontece.

### 4.2 Atalhos de debug

Fonte: `src/data/input-bindings.ts` (teclas) e `Game.handleDebugKeys` em `src/game/game.ts` (comportamento). São lidos na borda de pressionar. `F3`/`F7`/`F8` (`handleDisplayKeys`, só apresentação/settings) funcionam também com o jogo pausado (`ready`/`paused`); os demais são lidos no **passo fixo** e só respondem em `running`.

| Tecla | Faz | Persiste? |
|---|---|---|
| `F3` | liga/desliga o HUD de debug | sim (`settings.debugHud`) |
| `F4` | painel de tuning (lil-gui). Entra no **modo de tuning**: mouse livre, simulação continua rodando. `F4` de novo ou clique no canvas volta e pede o lock. **Só em `npm run dev`.** | não |
| `F6` | helpers na camada DEBUG: grade 1 m/10 m, eixos, nós do Octree (um único `LineSegments`), cápsula do jogador em wireframe. Custa +5 draw calls (grade 1 m, grade 10 m, eixos, Octree, cápsula). | não |
| `F7` | sombras liga/desliga (também religa depois do desligamento automático) | sim (`settings.shadows`) |
| `F8` | render scale 1,0 ↔ 0,75 (`RENDER_SCALE_ALT`) | sim (`settings.renderScale`) |
| `F9` | kick sintético de recoil (`FEEL.recoil.debugKick`; afina a mola antes de existir arma) | não |
| `P` | respawn no spawn do nível, zera o look | — (só com `debug`) |
| `T` | teleporta ao topo da torre (`TEST_GROUND_TOWER_TOP`, y ≈ 6 m); andar para fora dá queda de 6 m | — (só com `debug`) |

`debug` é verdadeiro em `npm run dev` **ou** com `?debug=1`. `F5` foi evitado de propósito (recarrega a página).

## 5. Flags de URL

Fonte: `src/core/url-flags.ts` (`parseUrlFlags`/`readUrlFlags`), aplicadas no construtor de `Game` (`src/game/game.ts`). Booleanos aceitam `1/0`, `true/false`, `on/off` e vazio (`?nolock` = ligado).

| Flag | Efeito | Padrão sem a flag |
|---|---|---|
| `?nolock=1` | força o `PointerLockController` em modo `unlocked`: nunca pede pointer lock. Usado pelo e2e e em iframes. | pede lock |
| `?shadows=0` / `1` | sombras iniciais | valor salvo em `settings` |
| `?scale=0.75` | render scale inicial (limitado a 0,25–1) | valor salvo |
| `?hud=1` / `0` | HUD de debug inicial | valor salvo (ligado em DEV) |
| `?debug=1` | ativa `P`/`T` e `window.__limiar` fora do `dev` | só em DEV |
| `?seed=123` | seed do `Random` em `world.rng` (reprodutibilidade) | `Date.now()` |

As flags **sobrepõem** as configurações salvas na sessão, mas não são gravadas: o `localStorage` (`limiar.settings`, versão 1, via `SaveStore`) só muda quando você usa `F3`/`F7`/`F8` ou o painel.

URL para reproduzir um bug com tudo previsível (é a mesma do e2e):

```
http://127.0.0.1:5173/?nolock=1&shadows=0&debug=1&seed=1
```

## 6. Ferramentas de debug

### 6.1 HUD de debug (`F3`)

Arquivo: `src/ui/debug-hud.ts`. Um `<pre>` cujo texto é reformatado 4×/s (`update` é chamado a cada frame, o DOM só muda a `HUD_HZ`), seis linhas:

1. `LIMIAR <tag> | FPS, frame médio (1 s) / máximo (1 s) / médio (3 s) | passos por frame, passos descartados (drop)`.
2. `draw, tris, geom, tex, prog | dpr, scale, resolução | sombras ON / OFF / AUTO-OFF (F7 religa)`.
3. `pos | vel | velocidade horizontal | IDLE/WALK/SPRINT/AIR, grounded/air (n.y da normal do chão), coyote, tempo no ar`.
4. `look yaw/pitch | hfov pedido → aplicado (vfov) | sens`.
5. `lock, loop RUNNING/PAUSED, estado do jogo | entidades | defs (elementos, facções, níveis) | seed`.
6. Lembrete dos atalhos.

Como interpretar cada linha em detalhe: [05-performance.md](05-performance.md). Armadilha conhecida: `n.y` abaixo de 1 encostado em paredes ou na base de rampas é a normal **agregada** do Octree (chão + parede); não é bug.

### 6.2 Painel de tuning (`F4`, só em dev)

Arquivo: `src/ui/tuning-panel.ts`. Carrega `lil-gui` (`three/addons/libs/lil-gui.module.min.js`) por `import()` dinâmico, por isso nunca entra no bundle de produção. Pastas (nomes reais do `addFolder`):

| Pasta | Edita |
|---|---|
| `movement` | `MOVEMENT` (`src/data/movement-config.ts`): velocidades, acelerações, gravidade, pulo, coyote, step-up… |
| `camera` | `CAMERA` (`src/data/camera-config.ts`): FOV dinâmico de sprint, damp do FOV, kick de FOV no pouso, sensibilidade (°/contagem), clamp de pitch (hFOV e sensibilidade do usuário ficam em `settings`; altura dos olhos em `movement`) |
| `feel` → `landKick`, `recoil`, `headBob` | `FEEL` (`src/data/feel-config.ts`); botão de kick de recoil (mesmo que `F9`) |
| `render` → `lights`, `shadow` | `RENDER` (`src/data/render-config.ts`): exposição, névoa, sol, sombras |
| `settings` | `Settings` do usuário (sensibilidade, hFOV, sombras, escala, HUD) — persistem |

Todos os controles usam `.listen()`: mudanças por atalho ou por HMR aparecem no painel. O botão **"Copiar JSON (cole em data/*-config.ts)"** copia o estado atual para a área de transferência (ou para `console.info` se o navegador negar o clipboard). Fluxo completo em [§9](#9-como-ajustar-valores-de-tuning).

### 6.3 `window.__limiar`

Arquivo: `src/game/debug-api.ts` (`LimiarDebugApi`, `installDebugApi`). Existe em dev ou com `?debug=1`; `src/vite-env.d.ts` tipa `window.__limiar`.

```ts
interface LimiarDebugApi {
  readonly world: World;      // entidades, eventos, cfg, settings, collision, rng, time, rig...
  readonly loop: GameLoop;    // pause()/resume(), stats
  readonly renderer: Renderer;// gl (WebGLRenderer), setRenderScale()
  readonly stats: DebugStats; // fps, frameAvgMs, drawCalls... snapshot()
  readonly input: { inject: InputState['inject'] };
  respawn(): void;            // respawn de debug no spawn do nível
  readonly state: GameState;  // 'ready' | 'running' | 'paused' | ...
  ready: boolean;             // true quando terminou de montar
}
```

Receitas no console do navegador:

```js
// Segurar "frente" sinteticamente (fica pressionado até o próximo inject/reset)
__limiar.input.inject({ forward: true });
__limiar.input.inject({});                     // solta tudo

// Virar 90° à esquerda: dx em contagens de mouse (yaw -= dx * sens)
const sens = __limiar.world.cfg.camera.sensitivityDegPerCount * __limiar.world.settings.sensitivityMultiplier;
__limiar.input.inject({}, [-Math.round(90 / sens), 0]);

// Pular uma vez (borda), depois soltar
__limiar.input.inject({ jump: true }); __limiar.input.inject({});

// Ouvir eventos do jogo
__limiar.world.events.on('player:landed', (e) => console.log('pousou a', e.fallSpeed, 'm/s'));
__limiar.world.events.on('config:changed', (e) => console.log('config', e.path));

// Posição atual do jogador e tempo simulado
__limiar.world.entities.ofKind('player')[0].transform.position;
__limiar.world.time.sim;
```

`inject` é o **modo sintético** do `InputState` (`src/core/input.ts`): gera bordas `justPressed`/`justReleased` exatamente como um teclado. Por isso serve para o e2e e para reproduzir bugs de movimento sem pointer lock.

## 7. Testes

### 7.1 Testes unitários (vitest)

```sh
npm test              # uma passada (11 suítes, 150 testes)
npm run test:watch    # modo watch
npx vitest run tests/physics/collision.test.ts -t rampa   # um arquivo / um nome
```

Rodam em Node, sem DOM nem WebGL. Config em `vitest.config.ts` (alias `@/` → `src/`).

| Arquivo | Cobre |
|---|---|
| `tests/core/loop.test.ts` | timestep fixo, clamp de frame, passos descartados |
| `tests/core/input.test.ts` | bordas por passo, eixo de movimento, `inject`, `reset` |
| `tests/core/events.test.ts` | `EventBus`: on/once/emit/queue/flush |
| `tests/core/spring.test.ts` | mola amortecida com solução fechada: frames longos sem divergir, 1 × 0,5 s ≡ 30 × 1/60 s, `kickToPeak` atinge o pico pedido |
| `tests/core/random.test.ts` | `Random` determinístico (mulberry32) |
| `tests/core/storage.test.ts` | `SaveStore`: versão, migrações, `validate` |
| `tests/physics/integrate.test.ts` | `integrateCapsuleBody` com os valores reais de `MOVEMENT` |
| `tests/physics/collision.test.ts` | `resolveCapsuleCollision` contra o **Octree real**: rampas 20,6°/40°/53°, degraus 0,25/0,35/0,50, corredor de 1,2 m, parede sem quicar, raycast, Campo de Provas inteiro |
| `tests/data/definitions.test.ts` | `validateDefs(DEFS)` e casos de dado inválido |
| `tests/data/hot-config.test.ts` | `keepLive`: mesma referência após várias "edições", chaves separadas, `assign` aninhado, ouvintes |
| `tests/architecture.test.ts` | regras de dependência entre pastas (lê os fontes como texto) |

O que **não** tem teste unitário (depende de DOM/WebGL) é coberto pelo e2e: `Renderer`, `PointerLockController`, o caminho DOM do `InputState`, `world/lighting.ts`, HUD, overlay.

### 7.2 Smoke test e2e

```sh
npm run test:e2e
```

Arquivo: `e2e/smoke.mjs` (`playwright-core`, Chromium headless com SwiftShader). O que ele faz:

1. Roda `vite build` se `dist/` não existir.
2. Sobe `vite preview --strictPort` em uma porta livre.
3. Abre `/?nolock=1&shadows=0&debug=1&seed=1`, espera `__limiar.ready`, clica no overlay (`.overlay`) → estado `running`.
4. Injeta input via `__limiar.input.inject`: anda para −Z, vira 90° (mouse sintético), anda para −X, pula e espera pousar, liga o HUD (`debugHud`).
5. As esperas de "andar" contam **tempo simulado** (`world.time.sim`), não relógio de parede — em SwiftShader frames > 0,1 s descartam tempo (`MAX_FRAME_DT`).
6. Asserta: zero `console.error`/`pageerror`/`requestfailed`; estado `running`; WebGL2; andou o mínimo para −Z e −X; virou 90° ± 5°; `grounded` no final; draw calls ≤ 30; fps > 5.
7. Grava `e2e/artifacts/smoke-ready.png`, `smoke-walk.png`, `smoke-hud.png`, `smoke.png` e `smoke.json`. Mata o preview no `finally`. Sai com 1 em falha.

Resultado da última passada neste repositório (`e2e/artifacts/smoke.json`): `ok: true`, 4 draw calls, 1 128 triângulos, andou 5,85 m para −Z, virou 90,0°, andou 3,23 m para −X, `grounded`, zero erros. O FPS (~20, frame 50,8 ms) é do SwiftShader e não vale como medida.

Variáveis de ambiente:

| Variável | Uso |
|---|---|
| `CHROMIUM_PATH` | caminho do executável do Chromium (tem prioridade) |
| `LIMIAR_E2E_SCREENS` | pasta extra para copiar as screenshots (fora do repositório) |

**Onde o e2e procura o Chromium**, nesta ordem: `CHROMIUM_PATH` → `/opt/pw-browsers/chromium` → `chromium.executablePath()` do `playwright-core`. Se nenhum existir, o teste **pula com exit 0** e imprime a instrução de instalação. O `npm run check` continua verde nesse caso.

Instalar o Chromium na sua máquina (uma vez; o projeto só tem `playwright-core`, então rode o instalador pelo `npx`, não `playwright install` dentro do projeto):

```sh
npx playwright@1.63.0 install chromium
# Depois aponte o executável instalado, por exemplo (Linux):
export CHROMIUM_PATH="$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux/chrome | head -1)"
npm run test:e2e
```

No macOS o caminho fica em `~/Library/Caches/ms-playwright/chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium`; no Windows em `%LOCALAPPDATA%\ms-playwright\chromium-*\chrome-win\chrome.exe`. Um Chrome/Chromium do sistema também serve em `CHROMIUM_PATH`.

Lembrete: o e2e valida **funcionamento**, não performance. Medição real: [05-performance.md](05-performance.md).

## 8. Convenções

### 8.1 Idiomas

- Identificadores (variáveis, funções, tipos, arquivos): **inglês**.
- Comentários de código, documentação, textos de UI e mensagens de erro: **PT-BR**.
- Nomes de entidades do jogo seguem o [léxico do design (§14)](02-design-tecnico.md): Vigia, Baluarte/Rastreador/Tecelão, Axioma/Ferrugem/Cepa, Brasa/Ressonância/Névoa, Ferro/Afim/Pesado, Ápice, Lume, Eco, a Maré. Nunca use nomes da Bungie para entidades do jogo; citar Destiny como inspiração em docs e comentários é aceitável.

### 8.2 Pastas e regras de dependência (testadas)

`tests/architecture.test.ts` lê todos os fontes de `src/` e falha se um `import` de **valor** violar a tabela abaixo (`import type` — ou `import { type A, type B }` só com tipos — é livre).

| Pasta | Pode importar de valor | Só como tipo |
|---|---|---|
| `core/` | `three`, `core` | — |
| `data/` | `data` | `core` |
| `entities/` | `three`, `core`, `data`, `world`, `entities` | — |
| `world/` | `three`, `core`, `data`, `world` | — |
| `systems/` | `three`, `core`, `data`, `entities`, `world`, `systems` | `game` |
| `ui/` | `core`, `data`, `ui` | `game` |
| `game/` e `src/main.ts` | tudo acima | — |

Consequências práticas:

- `core/` não sabe que existe um "jogador": o que precisa de colisão consome a interface `CollisionQuery` (`src/core/physics/collision-query.ts`), implementada por `src/world/collision-world.ts`.
- `data/` nunca importa `three` como valor (cores são `number` hex; vetores são tuplas `Vec3`).
- Um sistema recebe o `World` (tipo de `game/`) como parâmetro, mas não importa `game/` como valor.
- `entities/ → world/` é um desvio registrado do §3.2 do design (necessário para `entities/static-world.ts`; não há ciclo porque `world/` não importa `entities/`).
- HMR que precisa aplicar algo (renderer, luzes) fica em `game/`, ouvindo `onConfigHotUpdate` de `src/data/hot-config.ts`; `data/` nunca chama código de outra pasta.

Alias de caminho: `@/` → `src/`. Use-o em imports entre pastas; imports relativos só dentro da mesma pasta.

### 8.3 Dados vs. código

- Tudo que é **número de tuning, cor, texto de definição ou nível** vive em `src/data/`. Fora de `data/` um número mágico é bug de revisão (exceções óbvias: 0, 1, 2, conversões de unidade, constantes de algoritmo como o multiplicador do mulberry32).
- Definições usam `satisfies` (nunca `as`) e passam por `validateDefs(DEFS)` — roda em DEV ao montar e em `tests/data/definitions.test.ts`. Dado quebrado falha no `npm test` antes de chegar ao navegador ([ADR 0005](decisoes/0005-dados-em-ts-sem-zod.md)).
- Configs (`MOVEMENT`, `CAMERA`, `FEEL`, `RENDER`) são objetos **mutáveis** lidos no momento do uso (`world.cfg.movement.walkSpeed`), nunca copiados para variáveis locais duradouras — é isso que faz o HMR e o painel funcionarem sem reiniciar.
- Sem `const enum` (o projeto usa `isolatedModules` + `verbatimModuleSyntax`): use objeto `as const` + tipo derivado (`Layer`, `CollisionLayer`, `ENTITY_KINDS`).
- `exactOptionalPropertyTypes` está ligado: nunca atribua `undefined` a um campo opcional; quando um objeto reutilizado precisa "zerar" um campo, declare-o como `T | null` (é o caso de `RayHit.entity`).

### 8.4 Comentários

- Comentário explica a **decisão não óbvia**, não repete o código. Bom: "copie os campos sobre o objeto vivo; trocar a referência quebra o HMR". Ruim: "incrementa i".
- Referencie a seção do design quando o código a implementa (`// design §5.2`).
- Sem `TODO` vago. Um `TODO` precisa dizer o quê, quando (milestone) e por quê.
- Sem código morto nem `any`. `unknown` + type guard quando o tipo vem de fora (`localStorage`, `import.meta.hot.data`).

### 8.5 Zero alocação por frame

Nos hot paths (`fixedUpdate`, `frameUpdate`, sistemas, física, colisão) não se cria objeto por frame:

- Um `Vector3`/`Vector2`/`Capsule` de rascunho por módulo (`const scratch = new Vector3()` no topo do arquivo), reutilizado.
- Funções recebem `out` e devolvem `boolean` em vez de retornar objetos novos (`raycast(origin, dir, maxDist, mask, out)`).
- Sem iteração de `Map`/`Set` por frame: os sistemas percorrem arrays estáveis de `entities.ofKind(kind)` com índice.
- Alocar é permitido **fora** do hot path e está marcado no comentário: `stats.snapshot()`, `events.queue()`, `collision.debugHelper()`, criação dos helpers de `F6`.
- Exceção conhecida e monitorada: `Octree.capsuleIntersect`/`rayIntersect` do addon oficial alocam internamente. É o gatilho da [ADR 0003](decisoes/0003-octree-three-addons.md).

Lista de verificação antes de abrir um PR:

- [ ] `npm run check` verde.
- [ ] Nenhum número novo fora de `src/data/`.
- [ ] Nenhum `new Vector3()`/`{}`/`[]` dentro de `update` de sistema.
- [ ] Comentários em PT-BR explicando o porquê.
- [ ] Contratos de `core/` alterados? Atualize o design técnico, o [03 — Arquitetura](03-arquitetura.md) e, se for decisão, um ADR.
- [ ] Nomes do léxico respeitados.

## 9. Como ajustar valores de tuning

Três caminhos, do mais rápido ao definitivo:

**1. Painel `F4` (dev).** Mude os sliders com o jogo rodando. O modo de tuning deixa o mouse livre e a simulação continua, então dá para observar o efeito na hora. Quando gostar, clique em **"Copiar JSON"** e cole os valores no arquivo de `src/data/` correspondente. O painel não grava em arquivo.

**2. Editar `src/data/*-config.ts` com `npm run dev` aberto (HMR).** Os quatro módulos (`movement`, `camera`, `feel`, `render`) se auto-aceitam (`import.meta.hot.accept()`) e exportam o objeto por `keepLive(import.meta.hot, chave, valores, assign)` de `src/data/hot-config.ts`: o objeto vivo fica em `import.meta.hot.data`, a versão nova copia os valores por cima e reexporta a **mesma referência**. Funciona quantas vezes for (verificado: 6 → 7 → 8 → 9 em `walkSpeed`, zero reloads). Cada edição dispara `config:changed { path: 'movement' | 'camera' | 'feel' | 'render' }`; para `render`, `game.ts` reaplica renderer + luzes e preserva `shadows`/`renderScale` escolhidos pelo usuário. Regras: **nunca troque a referência** dos objetos de config (nada de `export let`) e, se criar uma config nova com sub-objetos, passe um `assign` que copie por sub-objeto (como `assignFeel`/`assignRenderConfig`) para não desligar os controles do painel.

**3. Teste.** Valores de movimento estão presos por `tests/physics/integrate.test.ts` e `collision.test.ts` (alturas de pulo, degraus que sobem ou não, rampas). Se mudar `jumpHeight`, `stepHeight` ou `slopeLimitDeg`, rode `npm test` e ajuste as asserções conscientemente — elas codificam o feel desejado do design (§5.1).

Onde está cada valor:

| Quero mudar… | Arquivo | Objeto |
|---|---|---|
| velocidade, aceleração, pulo, gravidade, step-up, rampa limite, snap ao chão, altura dos olhos, cápsula | `src/data/movement-config.ts` | `MOVEMENT` (+ `LOCOMOTION`, `RESPAWN`) |
| hFOV padrão, sensibilidade (°/contagem), FOV dinâmico de sprint, FOV do viewmodel, near/far, clamp de pitch, kick de FOV no pouso | `src/data/camera-config.ts` | `CAMERA` |
| kick de pouso, molas de recoil (inclusive o kick de `F9`), head bob | `src/data/feel-config.ts` | `FEEL` |
| exposição, névoa, sol, sombras, render scale alternativo, auto-off de sombras | `src/data/render-config.ts` | `RENDER`, `RENDER_SCALE_ALT`, `SHADOW_AUTO_OFF` |
| padrões e faixas do usuário | `src/data/settings-defaults.ts` | `DEFAULT_SETTINGS`, `SETTINGS_RANGES` |
| teclas | `src/data/input-bindings.ts` | `INPUT_BINDINGS` |
| cores | `src/data/palette.ts` | `PALETTE` |
| elementos e facções | `src/data/elements.ts`, `src/data/factions.ts` | `ELEMENTS`, `FACTIONS` |

Valores de referência e justificativas: [design técnico §5.1, §5.4, §5.5, §6](02-design-tecnico.md).

## 10. Passo a passo: adicionar um objeto ao Campo de Provas

O nível é **dado** (`src/data/levels/test-ground.ts`, tipo `LevelDef` em `src/data/levels/level-def.ts`). `src/world/level-builder.ts` transforma a lista `props` em 4 meshes por quadrante (cor por vértice) e num `collisionRoot` que o `CollisionWorld` indexa no Octree. Nada de Three.js no nível.

### 10.1 Os tipos disponíveis

Copiado de `src/data/levels/level-def.ts`:

```ts
type Vec3 = readonly [number, number, number];   // metros; Y para cima; pos = centro da BASE

interface BoxDef      { kind: 'box';      pos: Vec3; size: Vec3; color: number; rotY?: number; collider?: boolean; name?: string }
interface RampDef     { kind: 'ramp';     pos: Vec3; run: number; rise: number; width: number; dirYawDeg: number; color: number; name?: string }
interface CylinderDef { kind: 'cylinder'; pos: Vec3; radius: number; height: number; color: number; bands?: readonly number[]; segments?: number; name?: string }
type PrimitiveDef = BoxDef | RampDef | CylinderDef;

interface LevelDef {
  id: string; name: string;
  props: readonly PrimitiveDef[];
  spawnPoints: readonly SpawnPoint[];   // { pos, yawDeg, tag?: 'player' | 'enemy' | 'boss' }; o primeiro 'player' é o spawn
  coverPoints: readonly Vec3[];         // IA em M2 (vazio ok)
  killPlaneY: number;                   // negativo
  bounds: { halfSize: number };
  debug?: { grid: boolean; axes: boolean };
}
```

Regras que valem para todos:

- `pos` é o centro da **base** (pé), não do volume. Um cubo de 1 m no chão fica em `[x, 0, z]`; empilhado em cima, `[x, 1, z]`.
- `color` vem de `PALETTE` (`src/data/palette.ts`). Não invente hex solto no nível.
- `name` é opcional, mas único dentro do nível (`validateDefs` acusa duplicata). Ajuda a achar o objeto em erro e nos testes.
- `collider: false` (só em `box`) coloca a peça numa mesh "decor" fora do Octree: só visual.
- Rampa: `dirYawDeg` usa a convenção de yaw do jogo (0 → −Z, 90 → −X). A aresta baixa fica em `pos − dir·run/2`, a alta em `pos + dir·run/2`. Ângulo = `atan(rise/run)`. Acima de `slopeLimitDeg` (46°) vira parede.
- Cilindro: `bands` colore faixas horizontais de baixo para cima; `segments` são os segmentos radiais (padrão em `level-builder`).

### 10.2 Exemplo: uma plataforma de 2 m com um totem em cima

1. Abra `src/data/levels/test-ground.ts`. Escolha um lugar livre dentro de `bounds.halfSize` (60 m) — a grade de `F6` ajuda a ler coordenadas. Evite as trajetórias usadas pelos testes e pelo e2e: escada em x = 12, rampas em x ≈ −20, corredor em z = −26, buraco em (20, 20) e o eixo do spawn (0, 0, 12) para −Z.

2. Crie um grupo novo usando os helpers `box()`/`ramp()` já existentes no arquivo (assinaturas reais: `box(pos, size, color, extra?)` e `ramp(pos, run, rise, width, dirYawDeg, color, name)`):

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
    ...BORDER,
    // ... REFERENCES, COVER_WALLS, PILLARS, CRATES, BIG_BLOCKS, STAIRS, RAMPS, JUMP_PLATFORMS, STRUCTURES,
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

4. Com `npm run dev` aberto, salve. `test-ground.ts` **não** tem HMR próprio (o mundo é construído uma vez), então o Vite recarrega a página. Em DEV, `validateDefs(DEFS)` roda ao montar: um erro sai como `DefinitionError` com caminho legível (por exemplo `levels.test-ground.props[57].size[1]`).

5. Verifique no navegador:
   - [ ] O objeto aparece onde esperado (`F6` liga grade e eixos; `T`/`P` para se posicionar).
   - [ ] Colide: ande contra ele; o HUD mostra `grounded` ao pousar em cima.
   - [ ] Draw calls não mudaram (`F3`): primitivas são mescladas por quadrante — um objeto novo custa 0 draw calls a mais (um objeto que cruza a linha de dois quadrantes vai para o quadrante do seu centro).
   - [ ] Contagem de triângulos no HUD subiu (uma caixa custa 12 triângulos; o cilindro depende de `segments` e das faixas).

6. Rode `npm test`: `tests/data/definitions.test.ts` valida o nível e `tests/physics/collision.test.ts` reconstrói o Campo de Provas real. Se o objeto novo cruzar uma trajetória usada nos testes, um teste pode acusar — mova o objeto ou ajuste o teste com justificativa. Rode também `npm run test:e2e`: o smoke anda 6 m para −Z a partir do spawn e depois 3 m para −X.

7. Opcional: se o objeto serve à IA (M2), adicione um ponto em `COVER_POINTS`; se for spawn, em `SPAWN_POINTS` (dentro de `halfSize`, `yawDeg` finito, `tag: 'enemy'`).

### 10.3 Adicionar um nível inteiro (planejado)

Crie `src/data/levels/<id>.ts` exportando um objeto `satisfies LevelDef`, registre-o em `LEVELS` (`src/data/index.ts`) com chave igual ao `id`, e troque `TEST_GROUND` por ele em `src/game/game.ts`. A seleção de nível por URL ainda não existe (roadmap M5). `validateDefs` já cobre qualquer nível registrado.

## 11. Onde olhar quando algo dá errado

| Sintoma | Primeiro lugar a olhar |
|---|---|
| Overlay "WebGL2 indisponível" | `src/core/renderer.ts` (`hasWebGL2`); ative a aceleração de hardware do navegador |
| Mouse não gira a câmera | estado do lock no HUD; `?nolock=1` para isolar; `src/core/pointer-lock.ts` |
| Jogador atravessa/tremula em um objeto | `tests/physics/collision.test.ts` (reproduza lá); `src/core/physics/collision-resolve.ts` |
| Config editada não muda nada | leu o valor para uma variável local? Sistemas devem ler `world.cfg.*` no uso. A config nova tem `keepLive` + `import.meta.hot.accept()`? |
| Editar uma config recarrega a página inteira | faltou o `import.meta.hot.accept()` literal no módulo (o Vite decide pelo fonte) |
| `DefinitionError` ao abrir | o caminho no erro aponta o campo em `src/data/` |
| Respawn logo depois de nascer | `killPlaneY` do nível ou spawn fora do chão; `src/systems/kill-plane.ts` |
| Draw calls altos com `F6` | esperado +5; se muito mais, `collision.debugHelper()` em `src/world/collision-world.ts` |
| Sombras somem sozinhas | auto-desligamento (`SHADOW_AUTO_OFF`: frame médio > 20 ms por 3 s após 6 s de carência); HUD mostra `AUTO-OFF`; `F7` religa |
| FPS baixo sem GPU | normal em SwiftShader; ver [05-performance.md](05-performance.md) |
| Teste de arquitetura falhou | import de valor entre pastas proibidas; use `import type` ou mova o código |
