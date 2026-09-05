# ADR 0003 — Colisão cápsula × `Octree` de `three/addons`

## Status

Aceita (M0). Referência: design técnico §5.2 e §12. Implementado em `src/core/physics/collision-query.ts`, `src/core/physics/collision-resolve.ts`, `src/core/physics/layers.ts` e `src/world/collision-world.ts` (classe `CollisionWorld` sobre o `Octree`).

## Contexto

O mundo de teste tem rampas (20,6°, 40°, 53°), degraus, corredor de 1,2 m e quinas. Precisamos de cápsula × malha arbitrária com raycast para hitscan (M1) e linha de visão da IA (M2), com o menor custo de bundle possível. Rapier (WASM) e `three-mesh-bvh` foram avaliados.

| Opção | Bundle | Rampas / malha arbitrária | Raycast | Veredito |
|---|---|---|---|---|
| AABB manual | 0 | não | manual | Rejeitado: o chão de teste tem rampas. |
| **`Octree` + `Capsule` (three/addons)** | **0** | sim | sim (`rayIntersect`, podado por sub-árvore) | **Escolhido.** Mesma técnica do exemplo oficial `games_fps`. |
| `three-mesh-bvh@0.9.14` | ~40–60 KB gz | sim, melhor em malhas grandes | sim (`raycastFirst`, `shapecast`) | Upgrade com gatilho. |
| Rapier (WASM) | ~400 KB gz + init assíncrono | sim + corpos rígidos | sim | Rejeitado: sem corpos rígidos no roadmap. |

## Decisão

- Colisão do mundo estático por `Octree.fromGraphNode(root)` (`CollisionWorld.rebuildStatic`, build único no carregamento) + `capsuleIntersect` e `rayIntersect` de `three/addons/math/Octree.js`, com `Capsule` de `three/addons/math/Capsule.js`.
- A resolução (`resolveCapsuleCollision` em `src/core/physics/collision-resolve.ts`) é **pura sobre a interface `CollisionQuery`** (`src/core/physics/collision-query.ts`): `capsuleIntersect(c, out)` e `raycast(origin, dir, maxDist, mask, out)`. `CollisionWorld` implementa essa interface sobre o Octree e sobre hitboxes analíticas (`addHitbox`/`removeHitbox`, cápsula por referência). Assim o core é testável com um mundo sintético e a implementação pode ser trocada sem tocar na física.
- Algoritmo por passo: até 5 iterações de push-out com folga de 1 mm; contato com `normal.y ≥ cos 46°` é chão, o resto desliza; **step-up explícito** (0,35 m, só quando estava no chão) e **snap ao chão** (0,40 m, esfera tangente ao plano) ao descer rampas e degraus. Sem "rampa lenta": abaixo do limite é chão, acima é parede.
- `CollisionLayer` (`World`, `Player`, `Enemy`, `Projectile`, `Pickup`) como bitmask, e `RayHit.entity` identifica a hitbox atingida — hitscan de M1 já distingue mundo de inimigo.
- Custo esperado: Octree de poucos milhares de triângulos, ≤ 5 `capsuleIntersect` + 1–2 raycasts → < 0,1 ms por passo.

### Desvio registrado

O design escreve `CollisionLayer` como `const enum`. Com `isolatedModules` + `verbatimModuleSyntax`, `const enum` não é permitido; `src/core/physics/layers.ts` usa objeto `as const` + tipo derivado (`CollisionLayer`/`CollisionMask`). Semântica idêntica.

## Alternativas consideradas

Ver tabela acima. Em resumo: AABB não cobre rampas; `three-mesh-bvh` custa bundle sem necessidade nesta escala; Rapier traz corpos rígidos que o roadmap não usa (inimigos cinemáticos, projéteis como raios/esferas).

## Consequências

- Positivas: 0 KB de dependência extra; raycast e colisão no mesmo objeto; interface estável para IA e armas.
- Negativas: `Octree.capsuleIntersect`/`rayIntersect` **alocam internamente** (arrays de triângulos e objeto de resultado). É o custo aceito de usar o addon oficial sem cópia — e um dos gatilhos de migração abaixo.
- Negativas: `rayIntersect` do Octree é menos eficiente que BVH em malhas grandes; push-out iterativo pode "grudar" em quinas — mitigado por step-up explícito, epsilon e os testes de `tests/physics/collision.test.ts` (corredor, quina, rampas).
- O helper F6 (`CollisionWorld.debugHelper()`) mescla as arestas de todos os nós num único `LineSegments` (1 draw call) — o Campo de Provas tem ~8k nós; um `Box3Helper` por nó seria inutilizável.
- Hitboxes dinâmicas entram só em M2; em M0 `capsuleIntersect` considera apenas `World`.

## Gatilho de revisão

Migrar `CollisionWorld` para `three-mesh-bvh` (`shapecast`/`raycastFirst`) — **mantendo a interface `CollisionQuery`** — quando qualquer um ocorrer:

- malha de colisão com **> 50 000 triângulos**;
- `raycast` acima de **0,3 ms** no profile com 40 inimigos ativos;
- picos de GC atribuíveis à alocação interna do Octree no profile de memória (heap não plano por 5 min, ver `05-performance.md`);
- "grudar em quinas" não resolvido após os testes de colisão e o helper F6.
