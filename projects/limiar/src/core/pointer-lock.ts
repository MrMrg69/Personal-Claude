/**
 * Pointer lock com fallback (design §4.4).
 *
 * - request() tenta `{ unadjustedMovement: true }` (desliga aceleração do SO);
 *   NotSupportedError → tenta sem opções; Firefox devolve undefined e o
 *   resultado chega por pointerlockchange/pointerlockerror.
 * - `forceUnlocked` (?nolock=1) ou falha definitiva → modo 'unlocked': o jogo
 *   gira a câmera por movementX/Y sem lock e Escape pausa.
 * - Chromium recusa relock por ~1 s depois de Esc: a primeira falha vira
 *   'cooldown' (overlay pede para clicar de novo); a segunda seguida cai para
 *   'unlocked', porque aí o lock provavelmente não é possível (iframe, política).
 */
export type PointerLockMode = 'locked' | 'unlocked';
export type LockRequestResult = 'locked' | 'unlocked' | 'cooldown';

export interface PointerLockCallbacks {
  /** Lock ganho/perdido (perda em modo 'locked' é o gatilho de pausa do jogo). */
  onChange(locked: boolean, mode: PointerLockMode): void;
  /** Falha de lock; `cooldownMs` > 0 = pedir para tentar de novo depois. */
  onError(cooldownMs: number): void;
}

export interface PointerLockOptions {
  forceUnlocked: boolean;
  /** ms de espera sugerida após pointerlockerror. */
  cooldownMs: number;
  /** Falhas consecutivas antes de cair para 'unlocked'. */
  failuresBeforeFallback: number;
}

export const DEFAULT_POINTER_LOCK_OPTIONS: PointerLockOptions = {
  forceUnlocked: false,
  cooldownMs: 1200,
  failuresBeforeFallback: 2,
};

const NOT_SUPPORTED_ERROR = 'NotSupportedError';

export class PointerLockController {
  private currentMode: PointerLockMode = 'locked';
  private isLocked = false;
  private cooldownUntil = 0;
  private consecutiveFailures = 0;
  private pending: ((r: LockRequestResult) => void) | null = null;
  /** O pointerlockerror do 1º pedido (unadjustedMovement) ainda chega depois do 2º: não é falha. */
  private ignoreNextError = false;
  private readonly doc: Document;
  private readonly supported: boolean;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cb: PointerLockCallbacks,
    private readonly opts: PointerLockOptions = DEFAULT_POINTER_LOCK_OPTIONS,
  ) {
    this.doc = canvas.ownerDocument;
    this.supported = typeof canvas.requestPointerLock === 'function' && 'pointerLockElement' in this.doc;
    if (opts.forceUnlocked || !this.supported) this.currentMode = 'unlocked';
    this.doc.addEventListener('pointerlockchange', this.handleChange);
    this.doc.addEventListener('pointerlockerror', this.handleError);
  }

  get mode(): PointerLockMode {
    return this.currentMode;
  }

  get locked(): boolean {
    return this.isLocked;
  }

  cooldownRemainingMs(): number {
    return Math.max(0, this.cooldownUntil - performance.now());
  }

  /** Resolve quando o lock é obtido, quando cai para 'unlocked' ou quando está em cooldown. */
  request(): Promise<LockRequestResult> {
    if (this.currentMode === 'unlocked') return Promise.resolve('unlocked');
    if (this.isLocked) return Promise.resolve('locked');
    if (this.cooldownRemainingMs() > 0) return Promise.resolve('cooldown');
    if (this.pending) return Promise.resolve('cooldown');

    return new Promise<LockRequestResult>((resolve) => {
      this.pending = resolve;
      this.tryRequest(true);
    });
  }

  exit(): void {
    if (this.isLocked && typeof this.doc.exitPointerLock === 'function') this.doc.exitPointerLock();
  }

  dispose(): void {
    this.doc.removeEventListener('pointerlockchange', this.handleChange);
    this.doc.removeEventListener('pointerlockerror', this.handleError);
    this.settle('unlocked');
  }

  private tryRequest(withOptions: boolean): void {
    let result: unknown;
    try {
      result = withOptions ? this.canvas.requestPointerLock({ unadjustedMovement: true }) : this.canvas.requestPointerLock();
    } catch {
      this.fail();
      return;
    }
    if (result instanceof Promise) {
      result.catch((err: unknown) => {
        if (withOptions && err instanceof DOMException && err.name === NOT_SUPPORTED_ERROR) {
          // O evento pointerlockerror do 1º pedido ainda vai chegar (obsoleto): ignorar uma vez.
          this.ignoreNextError = true;
          this.tryRequest(false);
        } else {
          this.fail();
        }
      });
    }
    // Sem Promise (Firefox): o desfecho chega por pointerlockchange/pointerlockerror.
  }

  private fail(): void {
    // A Promise rejeitada e o evento pointerlockerror podem ambos chegar: conta uma vez.
    if (!this.pending) return;
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.opts.failuresBeforeFallback) {
      this.enterUnlocked();
      return;
    }
    this.cooldownUntil = performance.now() + this.opts.cooldownMs;
    this.settle('cooldown');
    this.cb.onError(this.opts.cooldownMs);
  }

  private enterUnlocked(): void {
    this.currentMode = 'unlocked';
    this.isLocked = false;
    this.settle('unlocked');
    this.cb.onChange(false, 'unlocked');
  }

  private settle(r: LockRequestResult): void {
    this.ignoreNextError = false;
    const resolve = this.pending;
    this.pending = null;
    if (resolve) resolve(r);
  }

  private readonly handleChange = (): void => {
    const locked = this.doc.pointerLockElement === this.canvas;
    if (locked === this.isLocked) return;
    this.isLocked = locked;
    if (locked) {
      this.consecutiveFailures = 0;
      this.ignoreNextError = false;
      this.settle('locked');
    }
    this.cb.onChange(locked, this.currentMode);
  };

  private readonly handleError = (): void => {
    if (this.ignoreNextError) {
      this.ignoreNextError = false;
      return;
    }
    this.fail();
  };
}
