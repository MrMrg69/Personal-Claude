import type { RenderConfig } from '@/core/renderer';
import { keepLive } from './hot-config';
import { PALETTE } from './palette';

/** Copia sem trocar as referências aninhadas (lights/shadow; o painel lil-gui liga nelas). */
export function assignRenderConfig(live: RenderConfig, fresh: RenderConfig): void {
  const { lights, shadow, ...scalars } = fresh;
  Object.assign(live, scalars);
  Object.assign(live.lights, lights);
  Object.assign(live.shadow, shadow);
}

/**
 * Renderização (design §6.1–6.2). Diferente das outras configs, mudanças aqui
 * exigem aplicação explícita (Renderer.applyConfig / applyLightingConfig):
 * game/ ouve onConfigHotUpdate('render') e reaplica — data/ não conhece o
 * renderer. Sombras e render scale são escolha do usuário (settings) e o game
 * as restaura por cima do arquivo.
 */
const DEFAULTS: RenderConfig = {
  pixelRatioCap: 1.5,
  renderScale: 1,
  shadows: true,
  shadowMapSize: 2048,
  toneMappingExposure: 1.0,
  clearColor: PALETTE.fog,
  fogDensity: 0.01,
  lights: {
    hemiSkyColor: PALETTE.fog,
    hemiGroundColor: PALETTE.hemiGround,
    hemiIntensity: 1.0,
    sunColor: PALETTE.sunAmber,
    sunIntensity: 2.2,
    sunElevationDeg: 22,
    sunAzimuthDeg: 35,
  },
  shadow: {
    frustumSize: 60,
    near: 1,
    far: 150,
    bias: -0.0005,
    normalBias: 0.02,
    followDistance: 8,
    lightDistance: 80,
  },
};

export const RENDER: RenderConfig = keepLive(import.meta.hot, 'render', DEFAULTS, assignRenderConfig);

if (import.meta.hot) import.meta.hot.accept();

/** Escala alternativa de F8 (1,0 ↔ 0,75). */
export const RENDER_SCALE_ALT = 0.75;

/** Auto-desligar sombras (§6.4): média de frame acima disto por `windowSec` segundos. */
export const SHADOW_AUTO_OFF = {
  frameAvgMs: 20,
  windowSec: 3,
  /** s após o início antes de julgar: os primeiros frames incluem compilação de shaders. */
  graceSec: 6,
} as const;
