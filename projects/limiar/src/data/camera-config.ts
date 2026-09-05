import { keepLive } from './hot-config';

/** Look, FOV e sensibilidade (design §5.4). Só dados; o rig fica em core/camera-rig.ts. */
export interface CameraConfig {
  /** FOV horizontal padrão (graus). É a fonte da verdade; vfov deriva do aspect. */
  hfovDeg: number;
  /** FOV dinâmico ao correr (graus horizontais somados). */
  sprintFovAddDeg: number;
  /** Lambda do damp exponencial do FOV (10 ≈ 0,15 s). */
  fovDampLambda: number;
  /** Kick de FOV no pouso: −N graus por `landFovKickTime` s. */
  landFovKickDeg: number;
  landFovKickTime: number;
  /** FOV vertical fixo da câmera da arma (graus). */
  viewmodelFovDeg: number;
  /** Graus por contagem do mouse (convenção CS/Source); multiplicado por settings.sensitivityMultiplier. */
  sensitivityDegPerCount: number;
  /** Multiplicador de sensibilidade ao mirar (usado em M1). */
  adsMultiplier: number;
  /** Clamp de pitch (graus), aplicado DEPOIS de somar recoil/kicks. */
  pitchClampDeg: number;
  near: number;
  /** Casado com a névoa. */
  far: number;
  viewmodelNear: number;
  viewmodelFar: number;
}

/** Objeto MUTÁVEL (HMR/painel); keepLive mantém a referência entre edições. */
export const CAMERA: CameraConfig = keepLive(import.meta.hot, 'camera', {
  hfovDeg: 95,
  sprintFovAddDeg: 6,
  fovDampLambda: 10,
  landFovKickDeg: 3,
  landFovKickTime: 0.1,
  viewmodelFovDeg: 55,
  sensitivityDegPerCount: 0.022,
  adsMultiplier: 0.8,
  pitchClampDeg: 89,
  near: 0.05,
  far: 300,
  viewmodelNear: 0.01,
  viewmodelFar: 5,
});

if (import.meta.hot) import.meta.hot.accept();
