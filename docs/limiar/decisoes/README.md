# Decisões de arquitetura (ADRs) — LIMIAR

Registro curto das decisões técnicas que moldam o esqueleto (M0) e das quais o roadmap depende sem reescrita. Cada ADR segue o mesmo formato: **Status, Contexto, Decisão, Alternativas consideradas, Consequências, Gatilho de revisão**.

Fonte da verdade para os números e contratos: [`../02-design-tecnico.md`](../02-design-tecnico.md). Os ADRs explicam o *porquê*; o design técnico descreve o *como*; o código em `projects/limiar/src/` é o que existe de fato.

## Índice

| # | Decisão | Seção do design | Onde está no código | Status |
|---|---|---|---|---|
| [0001](0001-sem-ecs-generico.md) | Sem ECS genérico: entidades tipadas por `kind` + sistemas ordenados + eventos | §3.1 | `core/entity.ts`, `core/events.ts`, `game/systems-list.ts` | Aceita |
| [0002](0002-fixed-timestep-60hz.md) | Timestep fixo 60 Hz com interpolação; look aplicado no frame | §4.1 | `core/time.ts`, `core/loop.ts`, `systems/view-sync.ts` | Aceita |
| [0003](0003-octree-three-addons.md) | Colisão cápsula × `Octree` de `three/addons` (gatilho para `three-mesh-bvh`) | §5.2 | `core/physics/*`, `world/collision-world.ts` | Aceita |
| [0004](0004-sem-pos-processamento.md) | Sem pós-processamento no MVP | §6.1 | `core/renderer.ts`, `world/lighting.ts` | Aceita |
| [0005](0005-dados-em-ts-sem-zod.md) | Dados em módulos TS `satisfies` + `validateDefs()`; sem zod | §3.5 | `data/index.ts`, `tests/data/definitions.test.ts` | Aceita |
| [0006](0006-viewmodel-duas-cameras.md) | Rig de câmera com duas câmeras/camadas (mundo + viewmodel) | §5.3, §6.3 | `core/camera-rig.ts`, `core/renderer.ts` | Aceita |
| [0007](0007-hfov-e-sensibilidade-por-contagem.md) | hFOV como fonte da verdade; sensibilidade em °/contagem | §5.4 | `data/camera-config.ts`, `systems/player-look.ts` | Aceita |

## Convenções

- Numeração sequencial de quatro dígitos; um arquivo por decisão; nunca renumerar.
- Uma decisão superada não é apagada: muda o Status para **Substituída por NNNN** e ganha um link.
- Todo ADR termina com um **gatilho de revisão** objetivo (número medido, não opinião). Sem gatilho atingido, a decisão não se discute de novo.
- Nomes de arquivos e funções citados devem existir em `projects/limiar/src/` ou estar marcados como *planejado* (nome do design técnico ainda não implementado).
- Desvios do design técnico ficam numa subseção **Desvio registrado** dentro do ADR (ex.: ADR 0003, `const enum`).

## Como adicionar um ADR

1. Copie o formato de qualquer ADR existente.
2. Preencha os seis blocos em PT-BR, com frases curtas.
3. Adicione a linha na tabela acima.
4. Se a decisão mudar um contrato de `core/`, atualize também o design técnico.
