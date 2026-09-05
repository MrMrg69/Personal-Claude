/** Estados do jogo e modo de input (design §4.4). */
export type GameState = 'booting' | 'ready' | 'running' | 'paused' | 'error';

/** 'unlocked' = fallback sem pointer lock (iframes, headless/e2e, Safari antigo). */
export type InputMode = 'locked' | 'unlocked';
