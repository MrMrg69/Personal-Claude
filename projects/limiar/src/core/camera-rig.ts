import * as THREE from 'three';
import { Layer } from './layers';
import { clamp, rad } from './math';

export interface CameraRigOptions {
  eyeHeight: number;
  hfovDeg: number;
  aspect: number;
  near: number;
  far: number;
  /** FOV vertical fixo da câmera da arma (não estica em hFOV alto). */
  viewmodelFovDeg: number;
  viewmodelNear: number;
  viewmodelFar: number;
  pitchClampDeg: number;
}

/** Contribuições aditivas somadas por frame (molas/damp decaem sozinhas; nunca acumulam). */
export interface HeadOffsets {
  /** rad; recoil + kick de pouso + bob. */
  pitch: number;
  /** rad; recoil lateral (local). */
  yaw: number;
  /** rad; bob. */
  roll: number;
  /** m; bob lateral. */
  x: number;
  /** m; kick de pouso + bob. */
  y: number;
  /** m; recuo para trás (posBack do kick). */
  back: number;
}

export function createHeadOffsets(): HeadOffsets {
  return { pitch: 0, yaw: 0, roll: 0, x: 0, y: 0, back: 0 };
}

/** vfov (graus) a partir do hFOV: PerspectiveCamera.fov é vertical. */
export function hfovToVfov(hfovDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan(rad(hfovDeg) / 2) / aspect) * THREE.MathUtils.RAD2DEG;
}

/**
 * Rig de câmera (design §5.3):
 *
 *   root (yaw) → head (pitch + offsets) → worldCamera
 *                                       → viewmodelRoot → viewmodelCamera (camada VIEWMODEL)
 *                                                       → weaponSocket
 *
 * Corpo só tem yaw; pitch fica na cabeça (recoil não inclina a cápsula).
 * Ordem 'YXZ' = yaw global, depois pitch local — sem roll induzido.
 */
export class CameraRig {
  readonly root = new THREE.Object3D();
  readonly head = new THREE.Object3D();
  readonly worldCamera: THREE.PerspectiveCamera;
  readonly viewmodelRoot = new THREE.Object3D();
  readonly viewmodelCamera: THREE.PerspectiveCamera;
  readonly weaponSocket = new THREE.Object3D();

  eyeHeight: number;
  pitchClampRad: number;
  /** hFOV aplicado por último (graus); o resize reaplica com o aspect novo. */
  hfovDeg: number;

  constructor(opts: CameraRigOptions) {
    this.eyeHeight = opts.eyeHeight;
    this.pitchClampRad = rad(opts.pitchClampDeg);
    this.hfovDeg = opts.hfovDeg;

    this.root.name = 'rig.root';
    this.head.name = 'rig.head';
    this.head.rotation.order = 'YXZ';
    this.head.position.y = opts.eyeHeight;

    this.worldCamera = new THREE.PerspectiveCamera(hfovToVfov(opts.hfovDeg, opts.aspect), opts.aspect, opts.near, opts.far);
    this.worldCamera.name = 'rig.worldCamera';
    this.worldCamera.layers.set(Layer.WORLD);

    this.viewmodelCamera = new THREE.PerspectiveCamera(opts.viewmodelFovDeg, opts.aspect, opts.viewmodelNear, opts.viewmodelFar);
    this.viewmodelCamera.name = 'rig.viewmodelCamera';
    this.viewmodelCamera.layers.set(Layer.VIEWMODEL);

    this.viewmodelRoot.name = 'rig.viewmodelRoot';
    this.weaponSocket.name = 'rig.weaponSocket';

    this.root.add(this.head);
    this.head.add(this.worldCamera, this.viewmodelRoot);
    this.viewmodelRoot.add(this.viewmodelCamera, this.weaponSocket);
  }

  /** hFOV é a fonte da verdade: recalculado no resize para as duas câmeras. */
  setHfov(hfovDeg: number, aspect: number): void {
    this.hfovDeg = hfovDeg;
    this.worldCamera.fov = hfovToVfov(hfovDeg, aspect);
    this.worldCamera.aspect = aspect;
    this.worldCamera.updateProjectionMatrix();
    // A câmera da arma mantém o vfov fixo; só o aspect acompanha.
    this.viewmodelCamera.aspect = aspect;
    this.viewmodelCamera.updateProjectionMatrix();
  }

  /** Liga/desliga a camada DEBUG na câmera do mundo (F6). */
  setDebugLayerVisible(visible: boolean): void {
    if (visible) this.worldCamera.layers.enable(Layer.DEBUG);
    else this.worldCamera.layers.disable(Layer.DEBUG);
  }

  /**
   * Aplica yaw ao corpo e pitch + offsets à cabeça. O clamp de pitch é feito
   * DEPOIS da soma: recoil/kicks nunca viram a câmera além de ±pitchClamp.
   */
  applyPose(yaw: number, pitch: number, offsets: HeadOffsets): void {
    this.root.rotation.y = yaw;
    this.head.rotation.x = clamp(pitch + offsets.pitch, -this.pitchClampRad, this.pitchClampRad);
    this.head.rotation.y = offsets.yaw;
    this.head.rotation.z = offsets.roll;
    this.head.position.x = offsets.x;
    this.head.position.y = this.eyeHeight + offsets.y;
    // "Para trás" no espaço local da cabeça é +Z (a câmera olha para −Z).
    this.head.position.z = offsets.back;
  }
}
