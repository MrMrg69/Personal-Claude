/**
 * HMR de configuração (design §3.5): mantém a MESMA referência do objeto de
 * config entre atualizações e avisa quem precisa reaplicar (game/).
 *
 * Por que não `import.meta.hot.accept((mod) => Object.assign(CFG, mod.CFG))`
 * dentro de cada módulo de config, como o design esboça: o Vite descarta os
 * callbacks de accept do módulo antigo quando a versão nova se registra. A 1ª
 * edição funciona (o callback da v1 copia sobre o objeto que o jogo segura),
 * mas na 2ª o callback é o da v2 e copia sobre o objeto da v2 — órfão. O jogo
 * fica preso no valor da 1ª edição (verificado com vite dev + Chromium).
 *
 * A solução é `import.meta.hot.data`, que persiste entre versões: a versão
 * nova encontra ali o objeto vivo, copia os valores novos sobre ele e o
 * reexporta. O módulo de config continua precisando conter literalmente
 * `import.meta.hot.accept()` — o servidor do Vite decide "auto-aceita" lendo
 * o fonte de cada módulo; sem isso propaga para os importadores e recarrega a
 * página (é o que acontecia com render-config).
 */

/** Cópia rasa: serve para configs sem objetos aninhados. */
export function assignFlat<T extends object>(live: T, fresh: T): void {
  Object.assign(live, fresh);
}

type Listener = (key: string) => void;

/** Vive neste módulo (nunca é recarregado a quente): sobrevive às versões das configs. */
const listeners = new Set<Listener>();

/**
 * Devolve o objeto vivo de `key`: `fresh` na primeira carga; nas seguintes, o
 * objeto anterior com os valores de `fresh` copiados por `assign` (que deve
 * preservar referências aninhadas se algo as segura — o painel lil-gui, por
 * exemplo). Fora do dev (`hot` undefined) devolve `fresh` sem custo.
 */
export function keepLive<T extends object>(hot: ImportMeta['hot'], key: string, fresh: T, assign: (live: T, fresh: T) => void = assignFlat): T {
  if (!hot) return fresh;
  const store = hot.data as Record<string, unknown>;
  const previous = store[key];
  if (previous === undefined) {
    store[key] = fresh;
    return fresh;
  }
  const live = previous as T;
  assign(live, fresh);
  for (const fn of listeners) fn(key);
  return live;
}

/** Avisado depois que uma config foi substituída a quente (`key` = 'movement', 'render'…). */
export function onConfigHotUpdate(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
