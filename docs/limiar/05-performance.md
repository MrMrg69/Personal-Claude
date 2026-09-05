# LIMIAR — Performance

> Orçamento de draw calls, plano de medição, sombras adaptativas, leitura do HUD de debug e checklist de medição manual em iGPU real. Fonte: design técnico §6.4–6.6 e §8.1 e o código em `projects/limiar/src/`. Meta do master prompt: **60 fps estáveis antes de polimento visual**.

## 1. Alvo

| Item | Valor |
|---|---|
| Hardware de referência | Intel UHD 620 (iGPU), 1080p, DPR 1 |
| Frame time p95 | **< 16,6 ms** com sombras ligadas |
| Draw calls (M0, Campo de Provas) | medido: **4** sem sombra, **8** com sombra; orçamento **≤ 16**; gate do e2e **≤ 30** |
| Draw calls (MVP, mapa de patrulha) | ≤ 150 |
| Triângulos por frame (MVP) | ≤ 300k |
| Texturas | nenhuma (`tex 0` no HUD, sempre) |
| Bundle | `three` (~150–170 KB gz, chunk próprio) + jogo < 250 KB gz |
| Alocação no hot path | zero (`Vector3` scratch por módulo, parâmetros `out`); heap plano por 5 min |

Regra geral: fill-rate é o gargalo em iGPU. Por isso `pixelRatioCap = 1,5`, render scale (F8 alterna 1,0 ↔ 0,75; `?scale=`), sombras desligáveis (F7, `?shadows=0`) e nenhum pós-processamento ([ADR 0004](decisoes/0004-sem-pos-processamento.md)). Valores em `src/data/render-config.ts`.

## 2. Orçamento de draw calls (§6.5)

Contagem por frame, **incluindo** a passada de sombra (cada mesh com `castShadow` conta uma vez a mais).

| Categoria | M0 | MVP | Como |
|---|---|---|---|
| Mundo estático | 4 (+4 sombra) | ≤ 12 | `mergeGeometries` com cor por vértice, **um material**, mesclado **por quadrante** em `src/world/level-builder.ts` (4 chunks mantêm o frustum culling). |
| Props repetidos | 0 | ≤ 10 | `InstancedMesh` quando um prop repetir > 20× (M5). |
| Inimigos | 0 | ≤ 40 | Low-poly rígido, partes como children; materiais compartilhados. |
| Projéteis / efeitos | 0 | ≤ 6 | `InstancedMesh` por tipo. |
| Viewmodel | 0 (passada vazia) | 2–3 | Camada 1, câmera própria ([ADR 0006](decisoes/0006-viewmodel-duas-cameras.md)). |
| Helpers de debug | 0–2 | 0–3 | Só com F6: Octree mesclado em 1 `LineSegments` + wireframe da cápsula. |
| HUD | **0** | **0** | 100 % DOM (`src/ui/debug-hud.ts`). |
| **Total** | **≤ 16** | **≤ 150** | `renderer.info.render.calls`; e2e falha acima de 30. |

Como o número é lido: `gl.info.autoReset = false`; `Renderer.renderFrame` chama `info.reset()` no início, roda as duas passadas, e o sistema `debug-stats` (último da lista de frame) lê `info.render.calls` **do frame anterior**. A passada de sombra roda uma única vez por frame (`shadowMap.autoUpdate = false` + `needsUpdate = true` antes da passada de mundo).

Quando o orçamento estoura, nesta ordem:

1. Conferir se algum material novo quebrou a mescla (um material por mundo estático; `prog` no HUD sobe).
2. Conferir `castShadow` em objetos que não precisam (chão só `receiveShadow`).
3. Repetições > 20× viram `InstancedMesh`.
4. Só então pensar em LOD ou culling manual.

## 3. Plano de medição (§6.6)

- `performance.mark/measure` em três trechos, feitos em `src/game/game.ts` via `DebugStats.mark/measure`: `sim` (passos fixos), `frame` (sistemas de frame) e `render` (duas passadas). **Só em `npm run dev`** (`new DebugStats({ marks: import.meta.env.DEV })`); no build de produção as marcas não existem.
- HUD de debug (F3) com FPS, frame time médio e máximo de 1 s, média de 3 s, `renderer.info`.
- `window.__limiar.stats` (DEV ou `?debug=1`) expõe os mesmos números para o e2e e para o console (`__limiar.stats.snapshot()`).
- SwiftShader (CI, `e2e/smoke.mjs`) valida **funcionamento** e draw calls, não performance. FPS medido nele não entra em nenhum relatório (seção 8).
- Performance real é medida **manualmente** com o checklist da seção 6 e registrada na seção 7.

## 4. Sombras adaptativas (§6.4)

Sombras custam ~1–1,5 ms em iGPU. Configuração (`RENDER.shadow` em `src/data/render-config.ts`): `PCFShadowMap` (duro), mapa 2048², câmera ortográfica 60 × 60 m, `bias −0,0005`, `normalBias 0,02`, câmera de sombra seguindo um ponto 8 m à frente do jogador com **snap à grade de texels** (60/2048 = 0,0293 m, `updateShadowFollow` em `src/world/lighting.ts`) para eliminar shimmer ao andar.

Auto-desligar, implementado em `src/systems/debug-stats-system.ts` com os limiares de `SHADOW_AUTO_OFF`:

| Condição | Ação |
|---|---|
| Menos de **6 s** desde o início (`graceSec`) | Nada: os primeiros frames incluem compilação de shaders. |
| Estado ≠ `running` ou sombras já desligadas | Nada. |
| Média de frame nos últimos **3 s > 20 ms** (`frameAvgMs`, `windowSec`) | `cfg.render.shadows = false` **uma única vez**; emite `config:changed { path: 'render.shadows' }` (o jogo aplica no renderer e nas luzes) e `render:shadowsChanged { enabled: false, auto: true }`; o HUD mostra `sombras AUTO-OFF (F7 religa)`. **Não** altera `settings.shadows` (escolha do usuário). |
| Usuário aperta F7 | Alterna manualmente; `settings.shadows` persiste a escolha. Não volta a desligar sozinho na mesma sessão. |
| `?shadows=0` na URL | Inicia sem sombras (usado no e2e). |

A heurística é por **medição**, não por detecção de hardware: `WebGLCapabilities` não sabe se a GPU é fraca.

## 5. Como ler o HUD de debug (F3, §8.1)

`<pre>` no canto superior esquerdo (`src/ui/debug-hud.ts`). Ligado por padrão em DEV; persistido em `settings.debugHud`; `?hud=1` força. Formato real (uma linha por item; valores ilustrativos):

```
LIMIAR dev | FPS  60  frame 16.4 ms (avg) / 22.1 (max 1s) / 16.6 (avg 3s) | sim 1 passo/frame  drop 0
draw 8  tris 2.3k  geom 9  tex 0  prog 3 | dpr 1.00  scale 1.00  1920x1080 | sombras ON
pos 0.00 0.00 12.00 | vel 0.00 0.00 0.00 | h 0.0 m/s | IDLE   grounded (n.y 1.00)  coyote 0.00  ar 0.00 s
look yaw 0.0°  pitch -3.2° | hfov 95→95 (vfov 63.1) | sens 1.5
lock LOCKED  loop RUNNING  estado running | ents 2 | defs: 3 elementos, 3 facções, 1 nível | seed 1
F3 hud  F4 painel  F6 helpers  F7 sombras  F8 escala  F9 kick  (P respawn  T torre)
```

| Campo | Significado | O que observar |
|---|---|---|
| `FPS` | Frames por segundo (janela de 1 s) | 60 estável no monitor de 60 Hz. |
| `frame … (avg) / (max 1s) / (avg 3s)` | Frame time médio e pior caso do último segundo; média de 3 s | **avg < 16,6 ms**; picos isolados de max são GC ou sombra; picos frequentes são problema. `avg 3s > 20` dispara o auto-off de sombras. |
| `sim N passo/frame` | Passos fixos executados no frame (`loop.stats.stepsLastFrame`) | 1 a 60 Hz; 0 ou 1 a 144 Hz; 2+ constante indica frame lento. |
| `drop` | Frames em que o teto de 5 passos foi atingido e tempo foi descartado (`loop.stats.droppedSteps`) | Deve ficar em 0 em jogo normal; sobe só ao voltar de aba oculta. |
| `draw` | `renderer.info.render.calls` (inclui sombra) | 4 sem sombra / 8 com sombra no Campo de Provas; ≤ 16 em M0. |
| `tris` | `renderer.info.render.triangles` (inclui sombra) | ~1,1k sem sombra no Campo de Provas (≈ 2× com sombra). |
| `geom / tex / prog` | `info.memory.geometries`, `info.memory.textures`, `info.programs.length` | `tex 0` sempre; `prog` cresce só com material novo. |
| `dpr / scale / WxH` | Pixel ratio efetivo (cap 1,5), render scale, tamanho CSS do container | Reduzir `scale` para 0,75 (F8) é o primeiro remédio de fill-rate. |
| `sombras ON/OFF/AUTO-OFF (F7 religa)` | Estado do shadow map | `AUTO-OFF` = heurística disparou. |
| `pos / vel / h` | Posição dos pés (m), velocidade (m/s), velocidade horizontal | 6,0 andando, 8,5 correndo. |
| `IDLE/WALK/SPRINT/AIR grounded (n.y)` | `locomotion` e normal do chão | `n.y ≥ 0,695` = chão caminhável (46°). |
| `coyote / ar` | Tempo desde o último chão e tempo no ar | Coyote válido até 0,10 s. |
| `look / hfov a→b (vfov) / sens` | Yaw/pitch; hFOV escolhido → efetivo (FOV dinâmico); vFOV resultante; multiplicador | 95 → 101 correndo. |
| `lock / loop / estado` | Modo de input (`LOCKED`, `NOLOCK`…), estado do loop, estado do jogo | `NOLOCK` = `?nolock=1`. |
| `ents / defs / seed` | Entidades vivas, definições carregadas, seed do RNG | `seed` reproduz uma sessão (`?seed=`). |

Fontes: `renderer.info`, `loop.stats` (`src/core/loop.ts`), `world.player`. Em DEV ou `?debug=1`: `window.__limiar = { world, loop, renderer, stats, input: { inject }, respawn(), state, ready }` (`src/game/debug-api.ts`).

## 6. Checklist de medição manual em iGPU real

Pré-requisitos: máquina com iGPU (ideal: Intel UHD 620 ou equivalente), Chromium/Chrome atualizado, notebook **na tomada** e sem outros apps de GPU abertos (navegador com vídeo, Discord com aceleração, etc.).

### 6.1 Preparação

```bash
cd projects/limiar
npm ci
npm run build
npm run preview        # http://127.0.0.1:4173
```

- [ ] Medir sempre o **build de produção** (`preview`), nunca `npm run dev` (HMR e source maps distorcem). Exceção: a etapa 6.3b, que precisa das marcas `sim/frame/render` e só existe em dev.
- [ ] Abrir `chrome://gpu` e confirmar "Hardware accelerated" em WebGL2 e que a GPU listada é a iGPU (não SwiftShader, não dGPU).
- [ ] Janela em 1920 × 1080, zoom do navegador 100 % (DPR 1). Em telas HiDPI o cap de 1,5 já se aplica; anotar o `dpr` do HUD.
- [ ] Abrir `http://127.0.0.1:4173/?debug=1&seed=1`, clicar no overlay para travar o mouse e ligar o HUD (F3).
- [ ] Esperar 10 s antes de anotar qualquer número (compilação de shaders + `graceSec`).

### 6.2 Cenários (anotar `avg`, `max 1s` e `draw` do HUD em cada um)

- [ ] **Parado no spawn**, olhando para −Z (alvos e muretas em tela), sombras ON, scale 1,0 — 30 s.
- [ ] **Andando em círculo** pela área central (caixotes, pilares, muro), sombras ON — 60 s.
- [ ] **Correndo e pulando** rampas e escada, sombras ON — 60 s. Observar shimmer de sombra (deve ser nulo pelo snap).
- [ ] **Topo da torre** (tecla T, só com `?debug=1`) olhando para o centro do mapa — máximo de geometria em tela — 30 s.
- [ ] Repetir o cenário "andando em círculo" com **sombras OFF** (F7) — 60 s.
- [ ] Repetir com **scale 0,75** (F8), sombras ON — 60 s.
- [ ] Helpers F6 ligados uma vez para confirmar que `draw` sobe no máximo +2 e volta ao desligar.

### 6.3 Frame time p95 (DevTools)

- [ ] DevTools → Performance → gravar 20 s do cenário "andando em círculo" (sombras ON, scale 1,0) no `preview`.
- [ ] Na faixa "Frames", ler a distribuição; anotar p95 (ou o pior frame não isolado). Alvo: **< 16,6 ms**.
- [ ] **6.3b (só em `npm run dev`, `http://127.0.0.1:5173/?seed=1`):** repetir a gravação e conferir as medidas `sim`, `frame`, `render` na faixa "Timings" — `render` deve dominar; `sim` < 1 ms. Não usar os números absolutos desta gravação como p95.

### 6.4 Memória (heap plano)

- [ ] DevTools → Memory → "Allocation instrumentation on timeline", gravar 5 min andando/pulando.
- [ ] Heap deve oscilar em serra pequena e voltar ao mesmo piso (GC menor). Piso subindo = alocação em hot path — localizar pelo stack e trocar por scratch/`out`. Alocações vindas de `Octree.capsuleIntersect` são conhecidas ([ADR 0003](decisoes/0003-octree-three-addons.md)).
- [ ] No HUD, `max 1s` sem picos periódicos > 30 ms (picos periódicos = GC maior).

### 6.5 Critérios de aprovação (M0)

- [ ] `avg` < 16,6 ms e p95 < 16,6 ms com sombras ON, scale 1,0, 1080p, DPR 1.
- [ ] `draw` ≤ 16 com sombras ON e helpers OFF (esperado: 8).
- [ ] `drop` = 0 durante toda a sessão.
- [ ] Heap plano por 5 min.
- [ ] Sombras **não** desligaram sozinhas (se desligaram, a iGPU está abaixo do alvo: registrar e medir também com scale 0,75).

Se algum critério falhar, aplicar nesta ordem e remedir: scale 0,75 → sombras OFF → conferir mescla/material único → conferir alocação por frame.

## 7. Registro de medições

Preencher uma linha por sessão de medição. Sem iGPU disponível, registrar explicitamente (o critério de pronto de M0 aceita essa anotação junto do número em SwiftShader).

| Data | Hardware (GPU / CPU) | Resolução / DPR / scale | Sombras | avg (ms) | max 1 s (ms) | p95 (ms) | draw | tris | Observações |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-05 | SwiftShader (CPU, 4 vCPU, sem GPU) | headless / 1 / 1,0 | OFF (`?shadows=0`) | 47,7 | — | — | 4 | 1128 | `e2e/artifacts/smoke.json`; **não representa hardware real** (seção 8). |
| — | — | — | — | — | — | — | — | — | Nenhuma medição em iGPU real registrada ainda. |

## 8. SwiftShader só valida funcionamento

O e2e (`e2e/smoke.mjs`, `npm run test:e2e`) roda em Chromium headless com `--use-angle=swiftshader` — renderização por **software na CPU**, em ambiente de 4 CPUs sem GPU. Nele:

- FPS e frame time **não representam** nenhum hardware real (última execução: ~21 fps, 47,7 ms por frame); o gate é apenas `fps > 5` (detecta loop quebrado).
- O que é validado: zero erros de console/página/rede, `state === 'running'`, WebGL2 ativo, o jogador andou ≥ 4 m para −Z, virou ~90° por `input.inject` de mouse e andou ≥ 1,5 m para −X, terminou `grounded`, `drawCalls ≤ 30`.
- Sombras entram desligadas (`?shadows=0`) e o input é sintético (`?nolock=1` + `window.__limiar.input.inject`), porque pointer lock não existe em headless.
- Artefatos em `e2e/artifacts/` (`smoke-ready.png`, `smoke-walk.png`, `smoke-hud.png`, `smoke.png`, `smoke.json`) servem para inspeção visual e para conferir draw calls, nunca para comparar performance entre commits.
- Sem Chromium disponível (`CHROMIUM_PATH`, `/opt/pw-browsers/chromium` ou `playwright-core`), o smoke test **pula** com mensagem explicando como instalar (`npx playwright@1.63.0 install chromium`).

Qualquer afirmação de "60 fps" só vale com uma linha preenchida na seção 7 em iGPU real.
