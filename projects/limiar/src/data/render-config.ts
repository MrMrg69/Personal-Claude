import type { RenderConfig } from '@/core/renderer';
import { PALETTE } from './palette';

/**
 * Renderização (design §6.1–6.2). Diferente das outras configs, mudanças aqui
 * exigem aplicação explícita (Renderer.applyConfig / applyLightingConfig); o
 * HMR que dispara isso vive em game/ (accept de dependência), não aqui — data/
 * não conhece o renderer.
 */
export const RENDER: RenderConfig = {
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

/** Escala alternativa de F8 (1,0 ↔ 0,75). */
export const RENDER_SCALE_ALT = 0.75;

/** Auto-desligar sombras (§6.4): média de frame acima disto por `windowSec` segundos. */
export const SHADOW_AUTO_OFF = {
  frameAvgMs: 20,
  windowSec: 3,
  /** s após o início antes de julgar: os primeiros frames incluem compilação de shaders. */
  graceSec: 6,
} as const;
