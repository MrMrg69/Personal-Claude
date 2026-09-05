import type { InputMode } from '@/game/state';

/**
 * Estados do overlay (design §4.4): 'ready' (clique para jogar, instruções),
 * 'paused', 'cooldown' (relock recusado pelo Chromium; contador), 'contextlost',
 * 'nowebgl2' e 'fatal' (erro de bootstrap). Em modo 'unlocked' mostra a nota
 * do modo sem captura do mouse.
 */
export type OverlayKind = 'ready' | 'paused' | 'cooldown' | 'contextlost' | 'nowebgl2' | 'fatal';

export interface OverlayView {
  kind: OverlayKind;
  mode: InputMode;
  /** Só para 'cooldown'. */
  cooldownMs?: number;
  /** Só para 'fatal'. */
  message?: string;
}

/** Intervalo do contador do cooldown (ms). */
const COUNTDOWN_TICK_MS = 100;

const ERROR_KINDS: ReadonlySet<OverlayKind> = new Set(['contextlost', 'nowebgl2', 'fatal']);

/** Cada grupo tecla+descrição é um .overlay__ctl (nowrap): nada de "mais)" órfão na linha seguinte. */
const CONTROLS_HTML =
  '<span class="overlay__ctl"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> mover</span>' +
  '<span class="overlay__ctl"><kbd>Shift</kbd> correr</span>' +
  '<span class="overlay__ctl"><kbd>Espaço</kbd> pular (segure para subir mais)</span><br>' +
  '<span class="overlay__ctl">mouse olhar</span>' +
  '<span class="overlay__ctl"><kbd>Esc</kbd> pausar</span>' +
  '<span class="overlay__ctl"><kbd>F3</kbd> HUD de debug</span>';

export class Overlay {
  private readonly root: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private readonly hint: HTMLParagraphElement;
  private readonly note: HTMLParagraphElement;
  private countdown: ReturnType<typeof setInterval> | null = null;
  private clickable = true;

  constructor(
    container: HTMLElement,
    private readonly onActivate: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay';
    const card = document.createElement('div');
    card.className = 'overlay__card';
    const title = document.createElement('h1');
    title.className = 'overlay__title';
    title.textContent = 'LIMIAR';
    const tagline = document.createElement('p');
    tagline.className = 'overlay__tagline';
    tagline.textContent = 'a última faixa iluminada';
    this.status = document.createElement('p');
    this.status.className = 'overlay__status';
    this.hint = document.createElement('p');
    this.hint.className = 'overlay__hint';
    this.note = document.createElement('p');
    this.note.className = 'overlay__note';
    card.append(title, tagline, this.status, this.hint, this.note);
    this.root.append(card);
    this.root.addEventListener('click', this.handleClick);
    container.append(this.root);
    this.hide();
  }

  get visible(): boolean {
    return !this.root.hidden;
  }

  show(view: OverlayView): void {
    this.stopCountdown();
    this.root.hidden = false;
    const isError = ERROR_KINDS.has(view.kind);
    this.root.classList.toggle('overlay--error', isError);
    this.status.classList.toggle('overlay__status--error', isError);
    this.clickable = !isError && view.kind !== 'cooldown';
    this.note.textContent =
      view.mode === 'unlocked' && !isError
        ? 'Modo sem captura do mouse: a câmera segue o movimento do mouse sobre a página; Esc pausa.'
        : '';
    this.hint.innerHTML = isError ? '' : CONTROLS_HTML;

    switch (view.kind) {
      case 'ready':
        this.status.textContent = 'Clique para jogar';
        break;
      case 'paused':
        this.status.textContent = 'Pausado — clique para continuar';
        break;
      case 'cooldown':
        this.startCountdown(view.cooldownMs ?? 0);
        break;
      case 'contextlost':
        this.status.textContent = 'Contexto gráfico perdido — recarregue a página.';
        break;
      case 'nowebgl2':
        this.status.textContent = 'Este navegador não suporta WebGL2.';
        this.hint.textContent = 'LIMIAR precisa de WebGL2 (Chrome, Firefox, Edge ou Safari 15+).';
        break;
      case 'fatal':
        this.status.textContent = 'Erro ao iniciar o jogo.';
        this.hint.textContent = view.message ?? '';
        break;
    }
  }

  hide(): void {
    this.stopCountdown();
    this.root.hidden = true;
  }

  dispose(): void {
    this.stopCountdown();
    this.root.removeEventListener('click', this.handleClick);
    this.root.remove();
  }

  private startCountdown(totalMs: number): void {
    const until = performance.now() + totalMs;
    const tick = (): void => {
      const remaining = Math.max(0, until - performance.now());
      if (remaining > 0) {
        this.status.textContent = `Aguarde um instante e clique de novo (${(remaining / 1000).toFixed(1)} s)`;
        return;
      }
      this.stopCountdown();
      this.clickable = true;
      this.status.textContent = 'Clique para continuar';
    };
    tick();
    this.countdown = setInterval(tick, COUNTDOWN_TICK_MS);
  }

  private stopCountdown(): void {
    if (this.countdown !== null) clearInterval(this.countdown);
    this.countdown = null;
  }

  private readonly handleClick = (): void => {
    if (this.clickable) this.onActivate();
  };
}
