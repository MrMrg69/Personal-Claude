# ADR 0002 — Timestep fixo 60 Hz com interpolação

## Status

Aceita (M0). Referência: design técnico §4.1–4.3. Implementado em `src/core/time.ts` e `src/core/loop.ts`.

## Contexto

Um shooter precisa de pulo com a mesma altura em qualquer monitor, cooldowns e recoil contáveis em passos, e testes que comparem números exatos. Ao mesmo tempo, a mira não pode ter latência de interpolação. Monitores de 144 Hz têm ~58 % dos frames sem passo fixo — bordas de input (toque de pulo) precisam sobreviver a isso.

## Decisão

- Simulação a **60 Hz fixos**: `FIXED_DT = 1/60`, `MAX_FRAME_DT = 0.1`, `MAX_STEPS_PER_FRAME = 5` (`src/core/time.ts`).
- Render na taxa do monitor via `renderer.setAnimationLoop(t => loop.tick(t))`. `GameLoop.tick(nowMs)` acumula o delta, roda 0..5 `fixedUpdate`, chama `frameUpdate(dt, alpha)` com `alpha = acc / FIXED_DT` e depois `render()`.
- Ao atingir o teto de 5 passos, o resto do acumulador é **descartado** (`stats.droppedSteps++`), nunca "alcançado" — sem espiral da morte.
- Posições renderizadas = `lerp(prevPosition, position, alpha)` (`view-sync`, planejado).
- **Look do mouse é aplicado em `frameUpdate`**, não no passo fixo: a câmera responde na taxa do monitor sem latência. A simulação lê `look.yaw` no início do passo.
- **Bordas de input (`justPressed`) são limpas só em `endFixedStep()`**, nunca por frame.
- `pause()` congela a simulação; o render continua com `alpha = 1`. `resume()` zera acumulador e `lastMs` (aba oculta por 30 s não integra 30 s).
- Sem `THREE.Clock`/`Timer`: o loop controla o relógio e recebe `nowMs` de fora, o que o torna testável em Node.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Timestep variável (`dt` do frame) | Altura de pulo e tunelamento dependem do FPS; testes não conseguem comparar números exatos. |
| Semi-fixo (dt clampado, 1 passo por frame) | Simulação desacelera em quedas de FPS; cooldowns em segundos viram frames. |
| Passo fixo 120 Hz | Dobra o custo de colisão sem ganho perceptível; 60 Hz já dá deslocamento máximo de 0,2 m por passo (< raio 0,4 m). |

## Consequências

- Positivas: determinismo prático (pulo de toque 1,40 m a 60 e a 144 Hz); `tests/core/loop.test.ts` e `tests/physics/integrate.test.ts` (planejados) chamam `fixedUpdate` N vezes e comparam valores.
- Positivas: deslocamento máximo por passo conhecido → sem tunelamento até 24 m/s; acima disso (dash em M3) entram sub-passos de colisão.
- Negativas: precisa de `prevPosition` em todo `Transform` e de interpolação para tudo que se move. Custo aceito.
- Negativas: a velocidade de salto precisa de correção de discretização (`jumpSpeed = √(2·|g|·h) + |g|·dt/2`, ver `jumpSpeedFor` em `src/core/physics/capsule-body.ts`).

## Gatilho de revisão

Revisitar se um profile mostrar `fixedUpdate` acima de **8 ms por passo** em iGPU-alvo (o que forçaria `droppedSteps` frequentes) ou se surgir necessidade de rede/replay determinístico que exija passo menor.
