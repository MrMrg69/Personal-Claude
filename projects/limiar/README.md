# LIMIAR

> *Um planeta-fronteira na órbita de uma estrela que apaga. Uma Maré de silêncio avança pela superfície e desfaz tudo o que toca. Os Vigias seguram a última faixa iluminada — o Limiar — com armas recuperadas de três eras de guerra, sob um crepúsculo que nunca termina.*

Protótipo de **looter-shooter em primeira pessoa** inspirado na sensação de jogo de Destiny 1/2, com identidade própria: low-poly, flat shading, cor por vértice, crepúsculo permanente. Three.js + TypeScript + Vite, 100 % no navegador.

**Estado atual: M0 — esqueleto.** Renderização, controlador em primeira pessoa (WASD, sprint, pulo com "hold", step-up, rampas, kick de pouso), mundo de teste ("Campo de Provas"), HUD de debug, painel de tuning e smoke test e2e. Sem armas, inimigos ou loot ainda — os contratos para eles já existem (ver `docs/limiar/02-design-tecnico.md`, §11).

## Como rodar

Requisitos: Node ≥ 22.12.

```sh
npm install
npm run dev        # http://127.0.0.1:5173 — HMR, HUD de debug ligado, painel F4 disponível
npm run build      # dist/ (three em chunk próprio)
npm run preview    # serve dist/ em http://127.0.0.1:4173
```

Verificação completa (typecheck + testes unitários + build + e2e):

```sh
npm run check
```

## Controles

| Tecla | Ação |
|---|---|
| `W A S D` / `↑` | mover |
| `Shift esq.` | correr (só empurrando para a frente) |
| `Espaço` | pular — segure para subir mais (≈ 1,4 m no toque, ≈ 2,2 m segurando) |
| mouse | olhar (0,022 °/contagem × multiplicador 1,5; sem suavização) |
| `Esc` | sair do pointer lock = pausa; no modo sem lock, pausa direto |

Clique no overlay para começar (o jogo pede pointer lock). Se o navegador recusar (iframe, Safari antigo) o jogo cai para o **modo sem captura do mouse**: a câmera segue o movimento do mouse sobre a página.

## Atalhos de debug

| Tecla | Faz |
|---|---|
| `F3` | HUD de debug (FPS, frame time, draw calls, posição, estado do corpo, look, lock…) — persiste em `settings` |
| `F4` | painel de tuning (lil-gui; **só em `npm run dev`**): movement / camera / feel / render / settings; "Copiar JSON"; kick de recoil. Abre o **modo de tuning**: mouse livre, simulação rodando; `F4` ou clique no canvas volta |
| `F6` | helpers: grade 1 m/10 m, eixos, nós do Octree, cápsula do jogador (camada DEBUG) |
| `F7` | sombras liga/desliga (persiste) |
| `F8` | render scale 1,0 ↔ 0,75 (persiste) |
| `F9` | kick sintético de recoil (afinar a mola antes de existir arma) |
| `P` | respawn no spawn (`?debug=1` ou dev) |
| `T` | teleporte ao topo da torre — queda de 6 m (`?debug=1` ou dev) |

## Flags de URL

| Flag | Efeito |
|---|---|
| `?nolock=1` | modo sem pointer lock (iframes, e2e) |
| `?shadows=0` / `1` | sombras iniciais (sobrepõe as configurações salvas) |
| `?scale=0.75` | render scale inicial (0,25–1) |
| `?hud=1` / `0` | HUD de debug inicial |
| `?debug=1` | atalhos `P`/`T` e `window.__limiar` fora do dev |
| `?seed=123` | seed do RNG (`__limiar.world.rng`) |

`window.__limiar` (dev ou `?debug=1`) expõe `{ world, loop, renderer, stats, input.inject(), respawn(), state, ready }` — é por aí que o e2e anda e olha sem pointer lock.

## Estrutura

```
src/
  main.ts          bootstrap: checa WebGL2, cria Game, overlay de erro fatal
  core/            plataforma (não conhece o jogo): loop 60 Hz fixo + interpolação, input por
                   KeyboardEvent.code com bordas por passo, pointer lock com fallback, renderer de
                   2 passadas (mundo + viewmodel), rig de câmera (hFOV), EventBus, EntityStore,
                   DebugStats, SaveStore, flags de URL, math (spring, random, rayCapsule),
                   physics (cápsula genérica: integrate + resolve com step-up e snap)
  data/            só dados/tipos: paleta, elementos, facções, configs (movement/camera/feel/render,
                   com HMR), settings, input bindings, níveis (level-def + test-ground)
  world/           Three.js do mundo: level-builder (4 meshes por quadrante, cor por vértice),
                   collision-world (Octree + hitboxes + raycast com máscara), lighting (sombra com
                   snap de texel), materials
  entities/        player, static-world (dados puros + fábricas)
  systems/         lista ordenada: player-input → character-physics → kill-plane → locomotion-state
                   (fixed) · player-look → camera-feel → view-sync → camera-sync → debug-stats (frame)
  game/            Game (estados, pausa, atalhos, HMR), World, GameEvents, systems-list, debug-api
  ui/              DOM puro: overlay, HUD de debug, painel de tuning, styles.css
tests/             vitest (Node, sem WebGL): loop, input, events, spring, random, storage,
                   integrate, collision (Octree real), definitions, architecture
e2e/smoke.mjs      Chromium headless (SwiftShader) via playwright-core
```

Regras de dependência entre pastas são verificadas por `tests/architecture.test.ts`.

## Testes

```sh
npm test            # vitest: 10 suítes
npm run test:e2e    # build (se não houver dist/) → vite preview → Chromium headless
```

O e2e usa `/opt/pw-browsers/chromium` (ou `CHROMIUM_PATH`, ou o Chromium que o `playwright-core` conhecer). Sem Chromium ele **pula** com instrução de instalação (`npx playwright@1.63.0 install chromium`). Artefatos em `e2e/artifacts/` (`smoke.png`, `smoke.json`). Em SwiftShader o FPS não é representativo: o e2e valida funcionamento (zero erros, andou, pousou, ≤ 30 draw calls), não performance.

## Documentação

Visão, design técnico (arquitetura, contratos, valores, léxico), roadmap e notas de performance em [`../../docs/limiar/`](../../docs/limiar/).
