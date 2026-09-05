import type { Migration } from '@/core/storage';
import { CAMERA } from './camera-config';
import { RENDER } from './render-config';

/** Preferências persistidas do usuário (design §3.6, §8). */
export interface Settings {
  /** Multiplica sensitivityDegPerCount. */
  sensitivityMultiplier: number;
  /** hFOV escolhido; CAMERA.hfovDeg é só o padrão. */
  hfovDeg: number;
  shadows: boolean;
  renderScale: number;
  debugHud: boolean;
}

export const SETTINGS_SAVE_KEY = 'limiar.settings';
export const SETTINGS_SAVE_VERSION = 1;
/** migrations[v-1] converte v → v+1; vazio em v1. */
export const SETTINGS_MIGRATIONS: readonly Migration[] = [];

/** Faixas aceitas pelo painel/HUD (inclusive). */
export const SETTINGS_RANGES = {
  sensitivityMultiplier: { min: 0.1, max: 5 },
  hfovDeg: { min: 80, max: 110 },
  renderScale: { min: 0.25, max: 1 },
} as const;

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  sensitivityMultiplier: 1.5,
  hfovDeg: CAMERA.hfovDeg,
  shadows: RENDER.shadows,
  renderScale: RENDER.renderScale,
  // HUD de debug ligado por padrão em DEV (design §8.1).
  debugHud: import.meta.env.DEV,
};

function inRange(v: unknown, r: { min: number; max: number }): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max;
}

/** Validador do SaveStore: payload corrompido/fora da faixa → descartado (volta ao padrão). */
export function isSettings(p: unknown): p is Settings {
  if (typeof p !== 'object' || p === null) return false;
  const s = p as Record<string, unknown>;
  return (
    inRange(s['sensitivityMultiplier'], SETTINGS_RANGES.sensitivityMultiplier) &&
    inRange(s['hfovDeg'], SETTINGS_RANGES.hfovDeg) &&
    inRange(s['renderScale'], SETTINGS_RANGES.renderScale) &&
    typeof s['shadows'] === 'boolean' &&
    typeof s['debugHud'] === 'boolean'
  );
}
