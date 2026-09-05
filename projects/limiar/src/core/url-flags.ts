/**
 * Flags de URL (design §3.6): ?nolock=1 ?shadows=0 ?debug=1 ?scale=0.75 ?seed=123 ?hud=1.
 * `null` = não informado (o jogo usa as configurações persistidas).
 */
export interface UrlFlags {
  /** Modo sem pointer lock (e2e, iframes). */
  nolock: boolean;
  shadows: boolean | null;
  debug: boolean;
  /** Render scale inicial (0.25–1). */
  scale: number | null;
  seed: number | null;
  hud: boolean | null;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 1;

function parseBool(v: string | null): boolean | null {
  if (v === null) return null;
  if (v === '' || v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

export function parseUrlFlags(search: string): UrlFlags {
  const p = new URLSearchParams(search);
  const scaleRaw = p.get('scale');
  const scaleNum = scaleRaw === null ? Number.NaN : Number.parseFloat(scaleRaw);
  const seedRaw = p.get('seed');
  const seedNum = seedRaw === null ? Number.NaN : Number.parseInt(seedRaw, 10);
  return {
    nolock: parseBool(p.get('nolock')) === true,
    shadows: parseBool(p.get('shadows')),
    debug: parseBool(p.get('debug')) === true,
    scale: Number.isFinite(scaleNum) ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleNum)) : null,
    seed: Number.isFinite(seedNum) ? seedNum : null,
    hud: parseBool(p.get('hud')),
  };
}

/** Lê as flags da URL atual (ou tudo vazio fora do navegador). */
export function readUrlFlags(): UrlFlags {
  const search = typeof location === 'undefined' ? '' : location.search;
  return parseUrlFlags(search);
}
