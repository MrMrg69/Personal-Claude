/**
 * Parâmetros do controlador de cápsula (design §5.1). Só o tipo vive em core;
 * os valores ficam em data/movement-config.ts (mutáveis por HMR/painel — os
 * sistemas leem os campos no momento do uso, nunca copiam em init).
 */
export interface MovementConfig {
  /** m. Base arredondada ajuda em quinas; 0,4 > deslocamento máximo por passo. */
  capsuleRadius: number;
  /** m. Altura total dos pés ao topo. */
  capsuleHeight: number;
  /** m. */
  eyeHeight: number;
  /** m/s. */
  walkSpeed: number;
  /** m/s. Só com sprint segurado e dir.y > 0,5. */
  sprintSpeed: number;
  /** m/s². */
  groundAccel: number;
  /** m/s². Sem input no chão. */
  groundDecel: number;
  /** m/s². */
  airAccel: number;
  /** m/s. Controle aéreo não ganha velocidade acima disto. */
  airMaxSpeed: number;
  /** m/s². Negativo. */
  gravity: number;
  /** m. Altura de um toque no pulo. */
  jumpHeight: number;
  /** Fator da gravidade enquanto o pulo é segurado (0–1). */
  jumpHoldGravityScale: number;
  /** s. Segurar o pulo só reduz a gravidade depois deste tempo: um toque humano solta a tecla em ≤ ~80 ms. */
  jumpHoldDeadTime: number;
  /** s. Tempo máximo (depois da zona morta) em que segurar reduz a gravidade. */
  jumpHoldMaxTime: number;
  /** m/s. Negativo (clamp). */
  maxFallSpeed: number;
  /** s. */
  coyoteTime: number;
  /** s. */
  jumpBufferTime: number;
  /** graus. Abaixo: chão; acima: parede (escorrega). */
  slopeLimitDeg: number;
  /** m. Degrau máximo subido sem pulo (só quando grounded). */
  stepHeight: number;
  /**
   * m. Distância de snap ao chão ao descer rampas/degraus. Precisa cobrir a
   * queda por passo no limite de rampa em sprint (≈ 0,15 m) somada à altura de
   * um degrau descido (stepHeight), sem chegar a 1 m (sair de um caixote continua
   * sendo queda). O snap coloca a esfera de baixo TANGENTE ao plano do chão.
   */
  groundSnapDistance: number;
}
