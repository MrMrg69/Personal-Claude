# ADR 0005 — Dados em módulos TS `satisfies`, sem zod

## Status

Aceita (M0). Referência: design técnico §3.5 e §9. Arquivos de `src/data/` são planejados (ainda não existem no código).

## Contexto

O master prompt exige "sistema de dados orientado a configuração": armas, inimigos, itens definidos em arquivos de dados, não hardcoded. As propostas divergiram entre JSON validado por zod em runtime e módulos TS tipados. Orçamento de bundle: `three` (~150–170 KB gz) + jogo < 250 KB gz; zod custaria ~13 KB gz para validar dados que já nascem tipados no editor.

## Decisão

- **Formato: módulos TS.** `export const AUTO_RIFLE_BASIC = { ... } satisfies WeaponDef;` — tipagem no editor, tree-shaking, zero parse em runtime, referências por `import`.
- **Registro:** `src/data/index.ts` exporta `DEFS = { elements, factions, levels, /* M1+: weapons, enemies, items, lootTables, classes, abilities */ }`. Ids são `keyof typeof X`: id errado é erro de compilação.
- **Validação em DEV:** `validateDefs(DEFS)` roda em `game.ts` dentro de `if (import.meta.env.DEV)`. Checa ids únicos por família, referências cruzadas (`faction.color` hex válido; em M1 `weapon.element ∈ elements`, `enemy.lootTable ∈ lootTables`) e regras numéricas (`magazine ≤ reserve`). Lança `DefinitionError('weapons.auto-rifle-basic.magazine: ...')`.
- **A mesma função roda em `tests/data/definitions.test.ts`:** dado quebrado falha no `npm test` antes de chegar ao navegador.
- **Configs de feel são mutáveis com HMR:** `MOVEMENT`, `CAMERA`, `FEEL`, `RENDER` usam `import.meta.hot.accept` + `Object.assign` no objeto existente (nunca trocam a referência). Sistemas leem `world.cfg.movement.walkSpeed` **no momento do uso**. `render-config` é a exceção: mudanças de render exigem `applyRenderConfig(renderer, cfg)`, chamada em `game/` (o callback de HMR de dependência fica em `game/`, porque `data/` não pode importar `core/` como valor).
- Regra de dependência: `src/data/` não importa `three` como valor nem outras pastas — só `import type` de `core/`.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| JSON + zod em runtime | ~13 KB gz e parse a cada carregamento para validar o que o compilador já garante; erros só aparecem no navegador. |
| JSON + tipos gerados (`json-schema-to-ts`) | Toolchain extra; perde `import` direto e tree-shaking. |
| YAML/TOML | Parser extra; nenhum ganho para quem edita no editor com autocomplete. |

## Consequências

- Positivas: custo zero de runtime e bundle; erro de id é erro de compilação; balanceamento em < 100 ms via HMR e painel lil-gui (F4) sem recarregar a página.
- Positivas: `definitions.test.ts` cresce a cada família nova (M1: `weapon.element`; M2: `enemy.lootTable`; M4: `item.perks`).
- Negativas: dados não podem vir de fora do bundle (modding, editor externo) sem uma etapa de validação na fronteira.
- Negativas: `Object.assign` em HMR exige disciplina — nunca copiar configs para variáveis locais em `init`.

## Gatilho de revisão

Se dados passarem a ser carregados de **JSON externo** (modding, editor de níveis, conteúdo baixado), adotar `valibot` **apenas na fronteira de carregamento** (schema derivado dos tipos existentes), mantendo os módulos TS internos como estão. Decisão adiada até existir esse requisito.
