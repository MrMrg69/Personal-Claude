# LIMIAR — Performance

> Orçamento de draw calls, plano de medição, sombras adaptativas, leitura do HUD de debug e checklist de medição manual em iGPU real. Fonte: design técnico §6.4–6.6 e §8.1. Meta do master prompt: **60 fps estáveis antes de polimento visual**.

## 1. Alvo

| Item | Valor |
|---|---|
| Hardware de referência | Intel UHD 620 (iGPU), 1080p, DPR 1 |
| Frame time p95 | **< 16,6 ms** com sombras ligadas |
| Draw calls (M0, com sombras) | **≤ 16** no HUD; gate do e2e **≤ 30** |
| Draw calls (MVP, mapa de patrulha) | ≤ 150 |
| Triângulos por frame (MVP) | ≤ 300k |
| Texturas | nenhuma |
| Bundle | `three` (~150–170 KB gz) + jogo < 250 KB gz |
| Alocação no hot path | zero (`Vector3` scratch por módulo, `out` params); heap plano por 5 min |

Regra geral: fill-rate é o gargalo em iGPU. Por isso `pixelRatioCap = 1,5`, render scale (F8 / `?scale=`), sombras desligáveis e nenhum pós-processamento (ADR 0004).

## 2. Orçamento de draw calls (§6.5)

Contagem por frame, **incluindo** a passada de sombra (cada mesh com `castShadow` conta uma vez a mais).

| Categoria | M0 | MVP | Como |
|---|---|---|---|
| Mundo estático | 4 (+4 sombra) | ≤ 12 | `mergeGeometries` com cor por vértice, **um material**, mesclado **por quadrante** (4 chunks mantêm o frustum culling). |
| Props repetidos | 0 | ≤ 10 | `InstancedMesh` quando um prop repetir > 20× (M5). |
| Inimigos | 0 | ≤ 40 | Low-poly rígido, partes como children; materiais compartilhados. |
| Projéteis / efeitos | 0 | ≤ 6 | `InstancedMesh` por tipo. |
| Viewmodel | 0 (passada vazia) | 2–3 | Camada 1, câmera própria (ADR 0006). |
| Helpers de debug | 0–3 | 0–3 | Só com F6. |
| HUD | **0** | **0** | 100 % DOM. |
| **Total** | **≤ 16** | **≤ 150** | `renderer.info.render.calls`; e2e falha acima de 30. |

Como o número é lido: `renderer.info.render.calls` é acumulado durante o frame e lido pelo sistema `debug-stats` no frame seguinte. A passada de sombra roda uma única vez por frame (`shadowMap.autoUpdate = false` + `needsUpdate = true` antes da passada de mundo).

Quando o orçamento estoura, nesta ordem:

1. Conferir se algum material novo quebrou a mescla (um material por mundo estático).
2. Conferir `castShadow` em objetos que não precisam (chão só `receiveShadow`).
3. Repetições > 20× viram `InstancedMesh`.
4. Só então pensar em LOD ou culling manual.

## 3. Plano de medição (§6.6)

- `performance.mark/measure` em três trechos: `sim` (passos fixos), `frame` (sistemas de frame) e `render` (duas passadas). Visíveis na aba Performance do DevTools.
- HUD de debug (F3) com FPS, frame time médio e máximo de 1 s, média de 3 s, `renderer.info`.
- `window.__limiar.stats` (DEV ou `?debug=1`) expõe os mesmos números para o e2e e para o console.
- SwiftShader (CI, `e2e/smoke.mjs`) valida **funcionamento** e draw calls, não performance. FPS medido nele não entra em nenhum relatório.
- Performance real é medida **manualmente** com o checklist da seção 6 e registrada na seção 7.

## 4. Sombras adaptativas (§6.4)

Sombras custam ~1–1,5 ms em iGPU. Configuração: `PCFShadowMap` (duro), mapa 2048², câmera ortográfica 60 × 60 m, `bias −0,0005`, `normalBias 0,02`, câmera de sombra seguindo o jogador com **snap à grade de texels** (60/2048 = 0,0293 m) para eliminar shimmer ao andar.

Auto-desligar (planejado em `systems/debug-stats-system.ts`):

| Condição | Ação |
|---|---|
| Média de frame nos últimos **3 s > 20 ms** | `shadowMap.enabled = false` **uma única vez**; evento `render:shadowsChanged { enabled: false, auto: true }`; aviso no HUD: "sombras desligadas automaticamente — F7 religa". |
| Usuário aperta F7 | Alterna manualmente; `settings.shadows` persiste a escolha. Não volta a desligar sozinho na mesma sessão. |
| `?shadows=0` na URL | Inicia sem sombras (usado no e2e). |

A heurística é por **medição**, não por detecção de hardware: `WebGLCapabilities` não sabe se a GPU é fraca.

## 5. Como ler o HUD de debug (F3, §8.1)

`<pre>` no canto superior esquerdo, atualizado 4×/s. Ligado por padrão em DEV; persistido em `settings.debugHud`; `?hud=1` força.

```
LIMIAR dev | FPS 60  frame 16.4 ms (avg) / 22.1 (max 1s) | sim 1 passo/frame  drop 0
draw 11  tris 4.2k  geom 9  tex 0  prog 3 | dpr 1.5  scale 1.00  1920x1080 | sombras ON
pos  0.00  0.00  12.00 | vel  0.00  0.00  0.00 | h 0.0 m/s | WALK  grounded (n.y 1.00)  coyote 0.00  ar 0.00 s
look yaw 0.0°  pitch −3.2° | hfov 95→95 (vfov 63.1) | sens 1.5
lock LOCKED  loop RUNNING | ents 2 | defs: 3 elementos, 3 facções, 1 nível | seed 1725000000
F3 hud  F4 painel  F6 helpers  F7 sombras  F8 escala  F9 kick  (P respawn  T torre)
```

| Campo | Significado | O que observar |
|---|---|---|
| `FPS` | Frames por segundo (janela de 1 s) | 60 estável no monitor de 60 Hz. |
| `frame … (avg) / (max 1s)` | Frame time médio e pior caso do último segundo | **avg < 16,6 ms**; picos isolados de max são GC ou sombra; picos frequentes são problema. |
| `sim N passo/frame` | Passos fixos executados no frame | 1 a 60 Hz; 0 ou 1 a 144 Hz; 2+ constante indica frame lento. |
| `drop` | Frames em que o teto de 5 passos foi atingido e tempo foi descartado (`loop.stats.droppedSteps`) | Deve ficar em 0 em jogo normal; sobe só ao voltar de aba oculta. |
| `draw` | `renderer.info.render.calls` (inclui sombra) | ≤ 16 em M0 com sombras. |
| `tris` | `renderer.info.render.triangles` | ~4–5k no mundo de teste. |
| `geom / tex / prog` | `info.memory.geometries`, `info.memory.textures`, `info.programs.length` | `tex 0` sempre; `prog` cresce só com material novo. |
| `dpr / scale / WxH` | Pixel ratio efetivo, render scale, tamanho do buffer | Reduzir `scale` para 0,75 (F8) é o primeiro remédio de fill-rate. |
| `sombras ON/OFF/AUTO-OFF` | Estado do shadow map | `AUTO-OFF` = heurística disparou. |
| `pos / vel / h` | Posição dos pés (m), velocidade (m/s), velocidade horizontal | 6,0 andando, 8,5 correndo. |
| `WALK/IDLE/SPRINT/AIR grounded (n.y)` | `locomotion` e normal do chão | `n.y ≥ 0,695` = chão caminhável (46°). |
| `coyote / ar` | `timeSinceGrounded` e tempo no ar | Coyote válido até 0,10 s. |
| `look / hfov a→b (vfov) / sens` | Yaw/pitch, hFOV configurado → efetivo (FOV dinâmico), vFOV resultante, multiplicador | 95 → 101 correndo. |
| `lock / loop / ents / defs / seed` | Modo de input, estado do loop, entidades vivas, definições carregadas, seed do RNG | `seed` reproduz uma sessão (`?seed=`). |

Fontes: `renderer.info`, `loop.stats` (`src/core/loop.ts`), `world.player`. Em DEV ou `?debug=1`: `window.__limiar = { world, loop, renderer, stats, input: { inject }, respawn(), ready }`.

## 6. Checklist de medição manual em iGPU real

Pré-requisitos: máquina com iGPU (ideal: Intel UHD 620 ou equivalente), Chromium/Chrome atualizado, notebook **na tomada** e sem outros apps de GPU abertos (navegador com vídeo, Discord com aceleração, etc.).

### 6.1 Preparação

```bash
cd /home/user/Personal/projects/limiar
npm ci
npm run build
npm run preview        # http://127.0.0.1:4173
```

- [ ] Medir sempre o **build de produção** (`preview`), nunca `npm run dev` (HMR e source maps distorcem).
- [ ] Abrir `chrome://gpu` e confirmar "Hardware accelerated" em WebGL2 e que a GPU listada é a iGPU (não SwiftShader, não dGPU).
- [ ] Janela em 1920 × 1080, zoom do navegador 100 % (DPR 1). Em telas HiDPI o cap de 1,5 já se aplica; anotar o `dpr` do HUD.
- [ ] Abrir `http://127.0.0.1:4173/?debug=1&seed=1` e ligar o HUD (F3).

### 6.2 Cenários (anotar avg, max 1 s e draw do HUD em cada um)

- [ ] **Parado no spawn**, olhando para −Z (alvos e muretas em tela), sombras ON, scale 1,0 — 30 s.
- [ ] **Andando em círculo** pela área central (caixotes, pilares, muro), sombras ON — 60 s.
- [ ] **Correndo e pulando** rampas e escada, sombras ON — 60 s. Observar shimmer de sombra (deve ser nulo pelo snap).
- [ ] **Topo da torre** (tecla T) olhando para o centro do mapa — máximo de geometria em tela — 30 s.
- [ ] Repetir o cenário "andando em círculo" com **sombras OFF** (F7) — 60 s.
- [ ] Repetir com **scale 0,75** (F8), sombras ON — 60 s.
- [ ] Helpers F6 ligados uma vez para confirmar que `draw` sobe no máximo +3 e volta ao desligar.

### 6.3 Frame time p95 (DevTools)

- [ ] DevTools → Performance → gravar 20 s do cenário "andando em círculo" (sombras ON, scale 1,0).
- [ ] Na faixa "Frames", ler a distribuição; anotar p95 (ou o pior frame não isolado). Alvo: **< 16,6 ms**.
- [ ] Conferir as medidas `sim`, `frame`, `render` na faixa "Timings" — `render` deve dominar; `sim` < 1 ms.

### 6.4 Memória (heap plano)

- [ ] DevTools → Memory → "Allocation instrumentation on timeline", gravar 5 min andando/pulando.
- [ ] Heap deve oscilar em serra pequena e voltar ao mesmo piso (GC menor). Piso subindo = alocação em hot path — localizar pelo stack e trocar por scratch/`out`.
- [ ] No HUD, `max 1s` sem picos periódicos > 30 ms (picos periódicos = GC maior).

### 6.5 Critérios de aprovação (M0)

- [ ] avg < 16,6 ms e p95 < 16,6 ms com sombras ON, scale 1,0, 1080p, DPR 1.
- [ ] `draw` ≤ 16 com sombras ON e helpers OFF.
- [ ] `drop` = 0 durante toda a sessão.
- [ ] Heap plano por 5 min.
- [ ] Sombras **não** desligaram sozinhas (se desligaram, a iGPU está abaixo do alvo: registrar e medir também com scale 0,75).

Se algum critério falhar, aplicar nesta ordem e remedir: scale 0,75 → sombras OFF → conferir mescla/material único → conferir alocação por frame.

## 7. Registro de medições

Preencher uma linha por sessão de medição. Sem iGPU disponível, registrar explicitamente (o critério de pronto de M0 aceita essa anotação junto do número em SwiftShader).

| Data | Hardware (GPU / CPU) | Resolução / DPR / scale | Sombras | avg (ms) | max 1 s (ms) | p95 (ms) | draw | tris | Observações |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | Nenhuma medição em iGPU real registrada ainda. |

## 8. SwiftShader só valida funcionamento

O e2e (`e2e/smoke.mjs`, planejado) roda em Chromium headless com `--use-angle=swiftshader` — renderização por **software na CPU**, em ambiente de 4 CPUs sem GPU. Nele:

- FPS e frame time **não representam** nenhum hardware real; o gate é apenas `fps > 5` (detecta loop quebrado).
- O que é validado: zero erros de console, `state === 'running'`, WebGL2 ativo, o jogador andou (`position.z < 8`), `grounded === true`, `drawCalls ≤ 30`.
- Sombras entram desligadas (`?shadows=0`) para não disparar a heurística de auto-desligar durante o teste.
- Artefatos em `e2e/artifacts/smoke.png` e `smoke.json` servem para inspeção visual e para conferir draw calls, nunca para comparar performance entre commits.

Qualquer afirmação de "60 fps" só vale com uma linha preenchida na seção 7.
