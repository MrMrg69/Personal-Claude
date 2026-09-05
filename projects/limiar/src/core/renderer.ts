import * as THREE from 'three';
import type { CameraRig } from './camera-rig';

/**
 * Configuração de render (design §6). Só o tipo vive em core; valores em
 * data/render-config.ts. Mudanças exigem aplicação explícita: Renderer.applyConfig().
 */
export interface RenderConfig {
  /** DPR máximo (fill-rate é o gargalo de iGPU). */
  pixelRatioCap: number;
  /** Escala interna de render (0,25–1); CSS mantém 100 %. */
  renderScale: number;
  shadows: boolean;
  shadowMapSize: number;
  toneMappingExposure: number;
  /** sRGB hex; igual à cor da névoa (horizonte some sem skybox). */
  clearColor: number;
  /** Densidade de FogExp2 (aplicada pelo world/lighting). */
  fogDensity: number;
  lights: {
    hemiSkyColor: number;
    hemiGroundColor: number;
    hemiIntensity: number;
    sunColor: number;
    sunIntensity: number;
    /** Elevação do sol acima do horizonte (graus). */
    sunElevationDeg: number;
    sunAzimuthDeg: number;
  };
  shadow: {
    /** Lado da câmera ortográfica de sombra (m). */
    frustumSize: number;
    near: number;
    far: number;
    bias: number;
    normalBias: number;
    /** Distância à frente do jogador para onde a sombra é centrada (m). */
    followDistance: number;
    /** Distância da luz ao alvo (m). */
    lightDistance: number;
  };
}

export type ResizeHandler = (cssWidth: number, cssHeight: number, aspect: number) => void;

export function hasWebGL2(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

/**
 * Renderer de duas passadas (design §6.3): mundo (camada 0 [+2]) e depois
 * viewmodel (camada 1) com clearDepth — a arma nunca atravessa parede. A sombra
 * é atualizada uma vez por frame (shadowMap.autoUpdate = false + needsUpdate).
 * O resize é observado no container e aplicado no início do próximo frame.
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  onResize: ResizeHandler | null = null;

  private cssW: number;
  private cssH: number;
  private scale: number;
  private pixelRatioCap: number;
  private pendingResize = true;
  private readonly observer: ResizeObserver | null;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    cfg: RenderConfig,
  ) {
    this.gl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    THREE.ColorManagement.enabled = true;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.NeutralToneMapping;
    this.gl.shadowMap.type = THREE.PCFShadowMap;
    this.gl.shadowMap.autoUpdate = false;
    this.gl.autoClear = false;
    // Duas passadas por frame: info só faz sentido acumulando as duas (reset manual em renderFrame).
    this.gl.info.autoReset = false;

    this.cssW = Math.max(1, container.clientWidth);
    this.cssH = Math.max(1, container.clientHeight);
    this.scale = cfg.renderScale;
    this.pixelRatioCap = cfg.pixelRatioCap;
    this.applyConfig(cfg);

    this.observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            this.cssW = Math.max(1, this.container.clientWidth);
            this.cssH = Math.max(1, this.container.clientHeight);
            this.pendingResize = true;
          });
    this.observer?.observe(container);
  }

  get cssWidth(): number {
    return this.cssW;
  }

  get cssHeight(): number {
    return this.cssH;
  }

  get aspect(): number {
    return this.cssW / this.cssH;
  }

  get renderScale(): number {
    return this.scale;
  }

  setRenderScale(scale: number): void {
    if (scale === this.scale) return;
    this.scale = scale;
    this.pendingResize = true;
  }

  /**
   * Aplica o que depende do renderer (pixel ratio, sombras, exposição, clear
   * color, render scale). Passe `scene` quando ligar/desligar sombras: os
   * materiais precisam recompilar.
   */
  applyConfig(cfg: RenderConfig, scene?: THREE.Scene): void {
    const shadowsChanged = this.gl.shadowMap.enabled !== cfg.shadows;
    this.gl.shadowMap.enabled = cfg.shadows;
    if (shadowsChanged && scene) {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) m.needsUpdate = true;
        }
      });
    }
    this.gl.toneMappingExposure = cfg.toneMappingExposure;
    this.gl.setClearColor(cfg.clearColor);
    if (cfg.pixelRatioCap !== this.pixelRatioCap || cfg.renderScale !== this.scale) {
      this.pixelRatioCap = cfg.pixelRatioCap;
      this.scale = cfg.renderScale;
      this.pendingResize = true;
    }
  }

  renderFrame(scene: THREE.Scene, rig: CameraRig): void {
    if (this.pendingResize) this.applyResize();
    this.gl.info.reset();
    this.gl.shadowMap.needsUpdate = true;
    this.gl.clear();
    this.gl.render(scene, rig.worldCamera);
    this.gl.clearDepth();
    this.gl.render(scene, rig.viewmodelCamera);
  }

  dispose(): void {
    this.observer?.disconnect();
    this.gl.dispose();
  }

  private applyResize(): void {
    this.pendingResize = false;
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    this.gl.setPixelRatio(Math.min(dpr, this.pixelRatioCap));
    // updateStyle=false: o CSS do canvas continua 100 %; só o buffer muda de tamanho.
    this.gl.setSize(Math.round(this.cssW * this.scale), Math.round(this.cssH * this.scale), false);
    this.onResize?.(this.cssW, this.cssH, this.aspect);
  }
}

/** Lança se o canvas não tiver WebGL2 (o chamador mostra o overlay de erro). */
export function createRenderer(canvas: HTMLCanvasElement, container: HTMLElement, cfg: RenderConfig): Renderer {
  if (!hasWebGL2(canvas)) {
    throw new Error('WebGL2 indisponível neste navegador');
  }
  return new Renderer(canvas, container, cfg);
}
