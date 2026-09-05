// Constantes do relógio de simulação (ver design §4.1–4.2).

/** Passo fixo da simulação: 60 Hz. */
export const FIXED_DT = 1 / 60;

/**
 * Teto do delta de um frame. Uma aba que ficou 30 s oculta não integra 30 s
 * de simulação; o loop também zera o acumulador em resume() — este clamp é a
 * segunda rede de segurança.
 */
export const MAX_FRAME_DT = 0.1;

/** Máximo de passos fixos por frame antes de descartar tempo (não tenta "alcançar"). */
export const MAX_STEPS_PER_FRAME = 5;
