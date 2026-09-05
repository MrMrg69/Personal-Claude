import * as THREE from 'three';
import { rad } from '@/core/math';
import type { RenderConfig } from '@/core/renderer';

/** Luzes da cena (design §6.1): duas luzes = custo nulo. */
export interface Lighting {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  /** Unitário, do alvo para o sol (recalculado em applyLightingConfig). */
  sunDir: THREE.Vector3;
  /** Rotação do espaço da luz (só rotação; a direção é constante, então o snap é consistente). */
  lightBasis: THREE.Matrix4;
  lightBasisInverse: THREE.Matrix4;
}

const ORIGIN = new THREE.Vector3(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);
const scratchTarget = new THREE.Vector3();

/** Direção unitária do sol a partir de elevação/azimute (azimute 0 = +Z, 90 = +X). */
function sunDirection(cfg: RenderConfig, out: THREE.Vector3): THREE.Vector3 {
  const el = rad(cfg.lights.sunElevationDeg);
  const az = rad(cfg.lights.sunAzimuthDeg);
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
}

/** Cria hemisférica + sol com sombra e a névoa; adiciona tudo à cena. */
export function createLighting(scene: THREE.Scene, cfg: RenderConfig): Lighting {
  const hemi = new THREE.HemisphereLight(cfg.lights.hemiSkyColor, cfg.lights.hemiGroundColor, cfg.lights.hemiIntensity);
  hemi.name = 'hemi';
  const sun = new THREE.DirectionalLight(cfg.lights.sunColor, cfg.lights.sunIntensity);
  sun.name = 'sun';
  sun.castShadow = true;
  // Luzes iluminam também a camada da arma (viewmodel).
  hemi.layers.enableAll();
  sun.layers.enableAll();
  scene.add(hemi, sun, sun.target);

  const lighting: Lighting = {
    hemi,
    sun,
    sunDir: new THREE.Vector3(),
    lightBasis: new THREE.Matrix4(),
    lightBasisInverse: new THREE.Matrix4(),
  };
  applyLightingConfig(lighting, scene, cfg);
  return lighting;
}

/** Reaplica cores, intensidades, névoa e parâmetros de sombra (painel/HMR). */
export function applyLightingConfig(l: Lighting, scene: THREE.Scene, cfg: RenderConfig): void {
  l.hemi.color.setHex(cfg.lights.hemiSkyColor);
  l.hemi.groundColor.setHex(cfg.lights.hemiGroundColor);
  l.hemi.intensity = cfg.lights.hemiIntensity;
  l.sun.color.setHex(cfg.lights.sunColor);
  l.sun.intensity = cfg.lights.sunIntensity;

  const shadow = l.sun.shadow;
  const half = cfg.shadow.frustumSize / 2;
  const cam = shadow.camera;
  cam.left = -half;
  cam.right = half;
  cam.top = half;
  cam.bottom = -half;
  cam.near = cfg.shadow.near;
  cam.far = cfg.shadow.far;
  cam.updateProjectionMatrix();
  shadow.bias = cfg.shadow.bias;
  shadow.normalBias = cfg.shadow.normalBias;
  if (shadow.mapSize.x !== cfg.shadowMapSize) {
    shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
    // O mapa já alocado tem o tamanho antigo; descartá-lo força realocação no próximo frame.
    shadow.map?.dispose();
    shadow.map = null;
  }

  sunDirection(cfg, l.sunDir);
  l.lightBasis.lookAt(l.sunDir, ORIGIN, UP);
  l.lightBasisInverse.copy(l.lightBasis).transpose();
  // Posição inicial: sombra centrada na origem até o camera-sync assumir.
  updateShadowFollow(l, ORIGIN, ORIGIN, cfg);

  if (scene.fog instanceof THREE.FogExp2) {
    scene.fog.color.setHex(cfg.clearColor);
    scene.fog.density = cfg.fogDensity;
  } else {
    scene.fog = new THREE.FogExp2(cfg.clearColor, cfg.fogDensity);
  }
}

/**
 * Faz a câmera de sombra seguir o jogador (design §6.2): alvo = pos + forward ·
 * followDistance, arredondado à grade de texels no espaço da luz para eliminar
 * o shimmer ao andar. `forward` é a direção horizontal do olhar. Sem alocação.
 */
export function updateShadowFollow(l: Lighting, playerPos: THREE.Vector3, forward: THREE.Vector3, cfg: RenderConfig): void {
  const texel = cfg.shadow.frustumSize / cfg.shadowMapSize;
  scratchTarget.copy(playerPos).addScaledVector(forward, cfg.shadow.followDistance);
  scratchTarget.applyMatrix4(l.lightBasisInverse);
  scratchTarget.x = Math.round(scratchTarget.x / texel) * texel;
  scratchTarget.y = Math.round(scratchTarget.y / texel) * texel;
  scratchTarget.applyMatrix4(l.lightBasis);

  l.sun.target.position.copy(scratchTarget);
  l.sun.position.copy(scratchTarget).addScaledVector(l.sunDir, cfg.shadow.lightDistance);
  l.sun.target.updateMatrixWorld();
}
