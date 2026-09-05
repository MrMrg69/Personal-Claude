# ADR 0004 — Sem pós-processamento no MVP

## Status

Aceita (M0). Referência: design técnico §6.1, §6.5 e §12. Implementado em `src/core/renderer.ts` (classe `Renderer`), `src/world/lighting.ts` e `src/world/materials.ts`.

## Contexto

Alvo de performance: **60 fps estáveis numa iGPU** (Intel UHD 620, 1080p, DPR 1, sombras ligadas), com frame time p95 < 16,6 ms. Nessa classe de hardware o gargalo é fill-rate. Cada passe full-screen (bloom, FXAA, vinheta, color grading) custa 1–2 ms e o `EffectComposer` desativa o MSAA nativo do canvas, exigindo um passe extra de AA. O master prompt prioriza "60 fps estáveis antes de polimento visual".

## Decisão

- **Nenhum pós-processamento no MVP.** Sem `EffectComposer`, sem `postprocessing`, sem render targets intermediários.
- O visual vem do próprio pipeline: `MeshLambertMaterial` flat com cor por vértice, 1 hemisférica + 1 direcional, `PCFShadowMap` 2048² com snap de texel (`updateShadowFollow`), `NeutralToneMapping` (preserva matiz das cores de raridade), `FogExp2` na cor do `clearColor` e sem skybox.
- Antialiasing pelo MSAA do canvas (`antialias: true`, `stencil: false`).
- Feedback de combate (hitmarker, flash de dano, indicador de direção) será **DOM/CSS**, com 0 draw calls — como já é o HUD de debug (`src/ui/debug-hud.ts`).
- Fill-rate controlado por `pixelRatioCap = 1,5` e render scale (F8 alterna 1,0 ↔ `RENDER_SCALE_ALT = 0,75`; `?scale=`), ambos em `src/data/render-config.ts`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| `EffectComposer` com bloom + FXAA | 2–4 ms em iGPU e perda do MSAA; incompatível com a meta de 60 fps. |
| Biblioteca `postprocessing` (pmndrs) | Dependência extra (~30 KB gz) para efeitos que o estilo flat não precisa. |
| Bloom só para elementos (Brasa/Ressonância/Névoa) | Emissivo em material + cor saturada dá a leitura sem passe extra. |

## Consequências

- Positivas: pipeline de 2 passadas simples (mundo + viewmodel, ADR 0006); número de draw calls honesto e fácil de medir (`renderer.info` com `autoReset = false` e reset manual em `renderFrame`); MSAA barato para arestas duras do low-poly.
- Negativas: sem bloom real, sem motion blur, sem SSAO. O estilo "papel dobrado" foi escolhido justamente para não depender disso.
- Se um efeito de tela for necessário (dano crítico, Ápice), a primeira opção é CSS sobre o canvas; a segunda, um quad na camada `VIEWMODEL` com material próprio (1 draw call, sem render target).

## Gatilho de revisão

Considerar pós-processamento (M8, "polimento") apenas se, no mapa do MVP, o frame time p95 medido em iGPU real ficar **abaixo de 12 ms** com sombras ligadas — ou seja, com pelo menos 4 ms de folga no orçamento — e a medição for registrada em [`../05-performance.md`](../05-performance.md).
