# ADR 0005 — Dados em módulos TS `satisfies`, sem zod

## Status

Aceita (M0). Referência: design técnico §3.5 e §9. Implementado em `src/data/` (`index.ts`, `elements.ts`, `factions.ts`, `levels/`, `*-config.ts`, `settings-defaults.ts`) e `tests/data/definitions.test.ts`.

## Contexto

O master prompt exige "sistema de dados orientado a configuração": armas, inimigos, itens definidos em arquivos de dados, não hardcoded. As propostas divergiram entre JSON validado por zod em runtime e módulos TS tipados. Orçamento de bundle: `three` (~150–170 KB gz) + jogo < 250 KB gz; zod custaria ~13 KB gz para validar dados que já nascem tipados no editor.

## Decisão

- **Formato: módulos TS.** `export const DEFS = { elements, factions, levels } as const satisfies DefRegistry;` — tipagem no editor, tree-shaking, zero parse em runtime, referências por `import`. Em M1+ entram `weapons`, `enemies`, `items`, `lootTables`, `classes`, `abilities`.
- **Ids são `keyof typeof X`** (`ElementId`, `FactionId`): id errado é erro de compilação.
- **Validação em DEV:** `validateDefs(DEFS)` roda em `src/game/game.ts` dentro de `if (import.meta.env.DEV)`. Checa ids únicos por família, referências cruzadas (`faction.color` hex válido; em M1 `weapon.element ∈ elements`, `enemy.lootTable ∈ lootTables`) e regras numéricas. Lança `DefinitionError` com caminho legível, ex.: `'levels.test-ground.killPlaneY: deve ser negativo'`.
- **A mesma função roda em `tests/data/definitions.test.ts`:** dado quebrado falha no `npm test` antes de chegar ao navegador.
- **Configs de feel são objetos mutáveis com HMR:** `MOVEMENT`, `CAMERA`, `FEEL` e `RENDER` são exportados por `keepLive(import.meta.hot, chave, valores, assign?)` (`src/data/hot-config.ts`): o objeto vivo fica em `import.meta.hot.data`, a versão nova copia os valores por cima (`Object.assign`, por sub-objeto em `feel`/`render`) e reexporta a **mesma referência**; cada módulo mantém `import.meta.hot.accept()` literal. Sistemas leem `world.cfg.movement.walkSpeed` **no momento do uso**.
- **`RENDER` é a exceção na aplicação:** mudanças de render exigem `Renderer.applyConfig(cfg, scene)` + `applyLightingConfig(...)`. `keepLive` avisa os ouvintes de `onConfigHotUpdate`; `Game.handleConfigHotUpdate` (`src/game/game.ts`) preserva `shadows`/`renderScale` do usuário (`settings`) e emite `config:changed`, que reaplica renderer e luzes — `data/` não conhece o renderer.
- Regra de dependência: `src/data/` não importa `three` como valor nem outras pastas — só `import type` de `core/` (verificado por `tests/architecture.test.ts`).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| JSON + zod em runtime | ~13 KB gz e parse a cada carregamento para validar o que o compilador já garante; erros só aparecem no navegador. |
| JSON + tipos gerados (`json-schema-to-ts`) | Toolchain extra; perde `import` direto e tree-shaking. |
| YAML/TOML | Parser extra; nenhum ganho para quem edita no editor com autocomplete. |

## Consequências

- Positivas: custo zero de runtime e bundle; erro de id é erro de compilação; balanceamento em < 100 ms via HMR e painel lil-gui (F4, carregado sob demanda em `src/ui/tuning-panel.ts`) sem recarregar a página.
- Positivas: `definitions.test.ts` cresce a cada família nova (M1: `weapon.element`; M2: `enemy.lootTable`; M4: `item.perks`).
- Negativas: dados não podem vir de fora do bundle (modding, editor externo) sem uma etapa de validação na fronteira.
- Negativas: `keepLive`/`Object.assign` em HMR exige disciplina — nunca copiar configs para variáveis locais em `init`, nunca trocar a referência dos objetos de config.

## Gatilho de revisão

Se dados passarem a ser carregados de **JSON externo** (modding, editor de níveis, conteúdo baixado), adotar `valibot` **apenas na fronteira de carregamento** (schema derivado dos tipos existentes), mantendo os módulos TS internos como estão. Decisão adiada até existir esse requisito.
