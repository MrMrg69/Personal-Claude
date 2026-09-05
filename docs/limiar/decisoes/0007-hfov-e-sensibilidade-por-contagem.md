# ADR 0007 — hFOV como fonte da verdade e sensibilidade em °/contagem

## Status

Aceita (M0). Referência: design técnico §5.4. Valores em `src/data/camera-config.ts` (`CAMERA`) e `src/data/settings-defaults.ts`; conversão em `hfovToVfov`/`CameraRig.setHfov` (`src/core/camera-rig.ts`); look em `src/systems/player-look.ts`; FOV dinâmico em `src/systems/camera-feel.ts`.

## Contexto

`PerspectiveCamera.fov` do three é **vertical**. Se o jogador configura "FOV 95" e o valor é vertical, em ultrawide (21:9) a imagem "zooma" em relação a 16:9 e a sensação de velocidade muda. Já a sensibilidade: `PointerLockControls` usa um fator arbitrário (`0.002·pointerSpeed`), impossível de comparar com a convenção do gênero (CS/Source: °/contagem × multiplicador) e dependente de DPI de forma opaca. Recoil somado ao pitch sem clamp posterior pode "virar" a câmera.

## Decisão

| Parâmetro | Valor | Detalhe |
|---|---|---|
| `CAMERA.hfovDeg` | **95°** (padrão) | `vfov = 2·atan(tan(hfov/2) / aspect)` (`hfovToVfov`), recalculado no resize (16:9 → 63,1°). Ultrawide não zooma. |
| `settings.hfovDeg` | 80–110 (`SETTINGS_RANGES`), persistido | A escolha do jogador; `CAMERA.hfovDeg` é só o padrão. |
| `sprintFovAddDeg` / `fovDampLambda` | +6° h / 10 | FOV dinâmico por `locomotion` (damp exponencial ≈ 0,15 s). |
| `landFovKickDeg` / `landFovKickTime` | −3° / 0,1 s | Kick de FOV no pouso. |
| `viewmodelFovDeg` | 55° vertical fixo | Arma não estica (ADR 0006). |
| `sensitivityDegPerCount` | **0,022** | `yaw −= dx · 0,022 · mult · DEG2RAD`; `pitch −= dy · 0,022 · mult · DEG2RAD`. |
| `settings.sensitivityMultiplier` | **1,5** padrão (0,1–5,0), persistido | ≈ 27,8 cm por 360° a 1000 DPI. |
| `adsMultiplier` | 0,8 | Usado em M1. |
| `pitchClampDeg` | ±89° | Aplicado em `player-look` no look bruto e **de novo em `CameraRig.applyPose` depois** de somar recoil e kicks. |
| Suavização / aceleração de mouse | **nenhuma** | `requestPointerLock({ unadjustedMovement: true })` em `src/core/pointer-lock.ts` desliga a aceleração do SO. |

- O look é aplicado em `frameUpdate` (taxa do monitor), não no passo fixo (ADR 0002). `yaw` é normalizado com `MathUtils.euclideanModulo(yaw, 2π)`.
- `InputState.consumeMouseDelta(out)` (`src/core/input.ts`) devolve as contagens acumuladas desde a última chamada, então a sensibilidade independe do FPS. Fora de `running` ou em modo de tuning o delta é consumido e descartado.
- No resize, `setHfov` recalcula o `fov` da câmera do mundo a partir do hFOV e chama `updateProjectionMatrix()` nas duas câmeras.
- O HUD mostra `hfov <settings>→<efetivo> (vfov …)` — o efetivo inclui o FOV dinâmico.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| vFOV como fonte (padrão do three) | Ultrawide zooma; "FOV 95" não significa o mesmo que em outros shooters. |
| Sensibilidade em "rad por pixel" | Não comparável; muda com DPI de forma opaca. |
| Suavização de mouse | Mata o feel; vai contra o pilar nº 1. |
| Clamp de pitch antes de somar recoil | Recoil perto de ±89° viraria a câmera. |

## Consequências

- Positivas: configurações comparáveis com outros jogos (o jogador pode trazer sua sensibilidade); ultrawide e 4:3 veem o mesmo campo horizontal; recoil nunca vira a câmera.
- Positivas: o e2e (`e2e/smoke.mjs`) já usa a convenção: injeta `dx = −90 / sensDegPerCount` contagens e confere um giro de ~90°. Um teste unitário de `player-look` com a mesma afirmação é planejado.
- Negativas: `hfov` precisa ser convertido a cada resize e para as duas câmeras; quem ler `camera.fov` direto vê o vertical.

## Gatilho de revisão

Revisitar se surgir suporte a gamepad (sensibilidade em °/s com curva de resposta, não em contagens) ou se um teste com usuários mostrar que o padrão 1,5 × 0,022 fica fora da faixa de conforto de 20–40 cm/360°.
