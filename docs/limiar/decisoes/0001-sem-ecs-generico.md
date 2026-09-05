# ADR 0001 — Sem ECS genérico

## Status

Aceita (M0). Referência: design técnico §3.1 e §3.2.

## Contexto

O master prompt pede "estrutura modular (ECS ou sistema de módulos claro)". A escala prevista do MVP é pequena:

| Categoria | Pico previsto no MVP |
|---|---|
| Jogador | 1 |
| Inimigos | ≤ 40 |
| Projéteis e efeitos | ≤ 100 |
| Drops de loot | ≤ 30 |

São centenas de entidades, não milhares. Em Three.js o gargalo real é draw call e fill-rate na GPU, não o loop de atualização em JS. Um ECS próprio com queries incrementais seria o componente de maior risco de bug sutil do projeto; um ECS de terceiros (bitecs, miniplex) é uma dependência para ~200 linhas de código.

## Decisão

Arquitetura híbrida "módulos + entidades tipadas + sistemas ordenados + eventos":

- **Entidades** são interfaces TS de dados puros (sem métodos) com discriminador `kind`. Cada `kind` tem uma fábrica `createX()` em `entities/`. Vivem num `EntityStore` (`src/core/entity.ts`) que mantém uma lista estável por `kind` e um mapa por id.
- **Composição transversal** por interfaces (`Damageable`, `HasCapsuleBody`) e type guards em `entities/index.ts` — nunca por herança.
- **Sistemas** são objetos `{ name, init?, fixedUpdate?, frameUpdate?, dispose? }` registrados numa lista ordenada única em `src/game/systems-list.ts` (planejado). Sistemas não guardam estado de entidades; só caches próprios.
- **`EventBus` tipado** (`src/core/events.ts`) com `emit` síncrono e `queue`/`flush` ao fim de cada passo fixo. O loop chama `events.flush()` e depois `entities.flushRemovals()`.
- **Three.js é detalhe de renderização.** A simulação lê e escreve `transform`; só `view-sync`/`camera-sync` tocam `Object3D`. Testes de movimento rodam em Node sem WebGL.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| ECS de terceiros (bitecs, miniplex) | Dependência e vocabulário novo para resolver um problema que o jogo não tem. |
| ECS próprio com queries | Maior risco de bug sutil (queries incrementais, arquétipos) sem ganho medível nesta escala. |
| Classes gordas com `update()` | A ordem input → movimento → colisão → armas → IA → câmera precisa ser explícita e testável; `update()` por objeto esconde a ordem. |

## Consequências

- Positivas: cada `kind` novo é um arquivo em `entities/`, um sistema em `systems/`, uma linha em `systems-list.ts` e uma alternativa a mais em `AnyEntity`. Contratos de `core/` não mudam (design §11).
- Positivas: `queue`/`flush` evita o bug "morte durante iteração" (loot criado enquanto a lista de inimigos é percorrida).
- Negativas: sem queries por combinação de componentes; iterar "toda entidade com `body`" usa `ofKind` + type guard. Aceitável para ≤ 200 entidades.
- Regras de dependência entre pastas (§3.2) são verificadas por `tests/architecture.test.ts` (planejado) para o esqueleto não degradar.

## Gatilho de revisão

Revisitar somente se houver **> 2 000 entidades ativas** simultâneas ou se um profile mostrar o loop JS de entidades acima de **2 ms por passo fixo** em iGPU-alvo. Até lá, "fazer o ECS logo" é risco listado em §12 e não uma tarefa.
