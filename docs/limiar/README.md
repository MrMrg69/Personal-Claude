# LIMIAR — Documentação

**LIMIAR** é um protótipo de looter-shooter em primeira pessoa que roda 100 % no navegador (Three.js + TypeScript + Vite). A inspiração declarada é a estrutura de sistemas e a sensação de jogo de Destiny 1/2; nomes, mundo, facções e identidade visual (low-poly, sombreamento plano, cor por vértice, crepúsculo permanente) são originais. O código vive em [`projects/limiar/`](../../projects/limiar/); esta pasta guarda a visão, o design técnico, a arquitetura como está no código, o roadmap, as notas de performance, o guia de desenvolvimento e as decisões de arquitetura.

> *Um planeta-fronteira na órbita de uma estrela que apaga. Uma Maré de silêncio avança pela superfície e desfaz tudo o que toca. Os Vigias seguram a última faixa iluminada — o Limiar — com armas recuperadas de três eras de guerra, sob um crepúsculo que nunca termina.*

## Estado atual: M0 — esqueleto

Renderização, controlador em primeira pessoa (WASD, sprint, pulo com "hold", step-up, rampas, kick de pouso), mundo de teste ("Campo de Provas"), HUD de debug, painel de tuning com HMR de configuração, testes unitários (11 suítes, 140 testes) e smoke test e2e em Chromium headless. **Sem armas, inimigos ou loot** — os contratos e slots para eles já existem no código e estão descritos no design técnico (§11). Próximo passo: M1 — gunplay ([roadmap](04-roadmap.md)).

## Índice

| Doc | O que é | Leia quando |
|---|---|---|
| [01 — Visão e design do jogo](01-visao-e-design.md) | GDD: identidade, pilares, loop de jogo, o Vigia, classes, facções, elementos | quiser entender o *quê* e o *porquê* do jogo |
| [02 — Design técnico](02-design-tecnico.md) | **Fonte da verdade**: arquitetura, contratos TS, valores numéricos, árvore de arquivos (§10), roadmap (§13), léxico (§14) | for escrever ou revisar código |
| [03 — Arquitetura](03-arquitetura.md) | Como o design virou código em M0: arquivos, assinaturas reais, valores de `src/data`, divergências registradas | for ler o código pela primeira vez ou conferir um desvio |
| [04 — Roadmap](04-roadmap.md) | Milestones M0…M5, critérios de pronto, rastreabilidade com o MVP | for planejar ou fechar uma entrega |
| [05 — Performance](05-performance.md) | Alvo, orçamento de draw calls, como ler o HUD, checklist de medição em iGPU real | for medir ou otimizar |
| [06 — Guia de desenvolvimento](06-guia-de-desenvolvimento.md) | Instalação, scripts, controles, flags de URL, debug, testes, convenções, tuning, como estender o Campo de Provas | for começar a trabalhar no projeto |
| [decisoes/](decisoes/README.md) | ADRs 0001–0007: sem ECS genérico, timestep fixo 60 Hz, Octree, sem pós-processamento, dados em TS sem zod, duas câmeras, hFOV | quiser saber por que algo é como é |

Convenções que valem em todos os documentos: PT-BR, frases curtas, nomes de arquivos e funções citados devem existir em `projects/limiar/src/` ou estar marcados como *planejado*.

## Como rodar

```sh
cd projects/limiar
npm install
npm run dev          # http://127.0.0.1:5173 — clique no overlay; WASD, Shift, Espaço, mouse; F3 HUD, F4 painel
npm run check        # typecheck + testes unitários + build + smoke test e2e
npm run build && npm run preview   # build de produção em http://127.0.0.1:4173
```

Sem pointer lock (iframe, headless) acrescente `?nolock=1`; `?debug=1` expõe `window.__limiar` fora do dev. Detalhes no [guia de desenvolvimento](06-guia-de-desenvolvimento.md).
