import type * as THREE from 'three';

/** Ações lógicas (design §4.3). A tabela code → Action vive em data/input-bindings.ts. */
export const ACTIONS = [
  'forward',
  'back',
  'left',
  'right',
  'jump',
  'sprint',
  'crouch',
  'fire',
  'aim',
  'reload',
  'melee',
  'grenade',
  'classAbility',
  'super',
  'interact',
  'swapWeapon',
  'debugHud',
  'debugPanel',
  'debugHelpers',
  'debugShadows',
  'debugRenderScale',
  'debugKick',
  'debugRespawn',
  'debugTeleport',
  'pause',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Chave = KeyboardEvent.code ('KeyW', 'Space', 'F3'…), 'Mouse0'/'Mouse1'/'Mouse2'
 * para botões do mouse e 'Wheel' para a roda (pulso: pressed+released no mesmo passo).
 */
export type InputBindings = Readonly<Record<string, Action>>;

const MOUSE_CODE_PREFIX = 'Mouse';
const WHEEL_CODE = 'Wheel';

const EDITABLE_TAGS: ReadonlySet<string> = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Alvo de teclado que edita texto (campo de formulário ou contentEditable): o jogo não pode roubar as teclas. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const tag = (target as { tagName?: string }).tagName;
  if (tag !== undefined && EDITABLE_TAGS.has(tag)) return true;
  return (target as { isContentEditable?: boolean }).isContentEditable === true;
}

/** Teclas com modificador (Ctrl+F/S/R/P, Alt+Tab…) são atalhos do navegador/SO. */
function hasModifier(e: KeyboardEvent): boolean {
  return e.ctrlKey || e.metaKey || e.altKey;
}

/**
 * Estado de input amostrado por passo fixo (design §4.3).
 *
 * - Bordas (justPressed/justReleased) são limpas SÓ em endFixedStep(): a 144 Hz
 *   metade dos frames não tem passo fixo e um toque de pulo precisa sobreviver.
 * - Mouse acumula movementX/Y (contagens) até consumeMouseDelta().
 * - inject() é o modo sintético (e2e/bots): ações ficam "seguradas" até o
 *   próximo inject()/reset(), somadas ao teclado físico.
 * - Os handlers DOM só traduzem eventos para onKeyCode/onMouseButton/… — esses
 *   métodos são a API testável em Node.
 */
export class InputState {
  private readonly index = new Map<Action, number>();
  private readonly held: Uint8Array;
  private readonly synthetic: Uint8Array;
  private readonly pressed: Uint8Array;
  private readonly released: Uint8Array;
  private mouseDx = 0;
  private mouseDy = 0;
  private target: HTMLElement | null = null;

  constructor(private readonly bindings: InputBindings) {
    ACTIONS.forEach((a, i) => this.index.set(a, i));
    this.held = new Uint8Array(ACTIONS.length);
    this.synthetic = new Uint8Array(ACTIONS.length);
    this.pressed = new Uint8Array(ACTIONS.length);
    this.released = new Uint8Array(ACTIONS.length);
  }

  isDown(a: Action): boolean {
    const i = this.idx(a);
    return this.held[i] === 1 || this.synthetic[i] === 1;
  }

  justPressed(a: Action): boolean {
    return this.pressed[this.idx(a)] === 1;
  }

  justReleased(a: Action): boolean {
    return this.released[this.idx(a)] === 1;
  }

  /** (x = direita, y = frente), normalizado se |v| > 1. */
  moveAxis(out: THREE.Vector2): THREE.Vector2 {
    out.x = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
    out.y = (this.isDown('forward') ? 1 : 0) - (this.isDown('back') ? 1 : 0);
    const len = Math.hypot(out.x, out.y);
    if (len > 1) out.divideScalar(len);
    return out;
  }

  /** Contagens acumuladas desde a última chamada; zera. */
  consumeMouseDelta(out: THREE.Vector2): THREE.Vector2 {
    out.set(this.mouseDx, this.mouseDy);
    this.mouseDx = 0;
    this.mouseDy = 0;
    return out;
  }

  /** Limpa as bordas. Chamado pelo loop ao fim de cada passo fixo. */
  endFixedStep(): void {
    this.pressed.fill(0);
    this.released.fill(0);
  }

  /** Solta tudo (pausa, perda de foco). Não gera bordas de released. */
  reset(): void {
    this.held.fill(0);
    this.synthetic.fill(0);
    this.pressed.fill(0);
    this.released.fill(0);
    this.mouseDx = 0;
    this.mouseDy = 0;
  }

  /**
   * Modo sintético: `partial[a] === true` segura a ação até o próximo inject/reset;
   * ausente/false solta. Gera bordas como um teclado real.
   */
  inject(partial: Partial<Record<Action, boolean>>, mouseDelta?: [number, number]): void {
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i] as Action;
      const want = partial[a] === true ? 1 : 0;
      if (want === this.synthetic[i]) continue;
      this.synthetic[i] = want;
      if (want === 1) {
        if (this.held[i] === 0) this.pressed[i] = 1;
      } else if (this.held[i] === 0) {
        this.released[i] = 1;
      }
    }
    if (mouseDelta) {
      this.mouseDx += mouseDelta[0];
      this.mouseDy += mouseDelta[1];
    }
  }

  // ---- Entradas cruas (chamadas pelos handlers DOM; testáveis sem DOM) ----

  /** @returns true se o código está mapeado (o chamador faz preventDefault). */
  onKeyCode(code: string, down: boolean): boolean {
    const a = this.bindings[code];
    if (!a) return false;
    this.setPhysical(this.idx(a), down);
    return true;
  }

  onMouseButton(button: number, down: boolean): boolean {
    return this.onKeyCode(MOUSE_CODE_PREFIX + button, down);
  }

  onMouseMove(dx: number, dy: number): void {
    this.mouseDx += dx;
    this.mouseDy += dy;
  }

  /** Roda do mouse: pulso (pressed e released no mesmo passo), sem estado de "segurado". */
  onWheel(): boolean {
    const a = this.bindings[WHEEL_CODE];
    if (!a) return false;
    const i = this.idx(a);
    this.pressed[i] = 1;
    this.released[i] = 1;
    return true;
  }

  // ---- DOM ----

  attach(target: HTMLElement): void {
    this.detach();
    this.target = target;
    const doc = target.ownerDocument;
    const win = doc.defaultView;
    // Teclado no window: funciona sem foco no canvas. mousemove/mouseup no documento:
    // no modo sem lock o mouse pode soltar o botão fora do canvas.
    win?.addEventListener('keydown', this.handleKeyDown);
    win?.addEventListener('keyup', this.handleKeyUp);
    win?.addEventListener('blur', this.handleBlur);
    doc.addEventListener('mousemove', this.handleMouseMove);
    doc.addEventListener('mouseup', this.handleMouseUp);
    target.addEventListener('mousedown', this.handleMouseDown);
    target.addEventListener('contextmenu', this.handleContextMenu);
    target.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  detach(): void {
    const target = this.target;
    if (!target) return;
    const doc = target.ownerDocument;
    const win = doc.defaultView;
    win?.removeEventListener('keydown', this.handleKeyDown);
    win?.removeEventListener('keyup', this.handleKeyUp);
    win?.removeEventListener('blur', this.handleBlur);
    doc.removeEventListener('mousemove', this.handleMouseMove);
    doc.removeEventListener('mouseup', this.handleMouseUp);
    target.removeEventListener('mousedown', this.handleMouseDown);
    target.removeEventListener('contextmenu', this.handleContextMenu);
    target.removeEventListener('wheel', this.handleWheel);
    this.target = null;
    this.reset();
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    // preventDefault só em códigos mapeados (espaço não rola a página, F3 não abre busca).
    if (!this.bindings[e.code]) return;
    // Dois motivos para deixar passar: (1) com modificador é atalho do navegador
    // (Ctrl+F/S/R/P) e (2) num alvo editável (o painel F4 usa <input>) W/E/setas
    // são digitação — nem preventDefault nem onKeyCode.
    if (hasModifier(e) || isEditableTarget(e.target)) return;
    e.preventDefault();
    if (e.repeat) return;
    this.onKeyCode(e.code, true);
  };

  private readonly handleKeyUp = (e: KeyboardEvent): void => {
    // Solta SEMPRE (o Ctrl pode ter entrado depois do keydown: senão a tecla ficava presa);
    // preventDefault só quando o keydown correspondente também o teria feito.
    const mapped = this.onKeyCode(e.code, false);
    if (mapped && !(hasModifier(e) || isEditableTarget(e.target))) e.preventDefault();
  };

  /** Perder o foco perde o keyup: solta tudo para não "andar sozinho" ao voltar. */
  private readonly handleBlur = (): void => {
    this.reset();
  };

  private readonly handleMouseMove = (e: MouseEvent): void => {
    this.onMouseMove(e.movementX, e.movementY);
  };

  private readonly handleMouseDown = (e: MouseEvent): void => {
    if (this.onMouseButton(e.button, true)) e.preventDefault();
  };

  private readonly handleMouseUp = (e: MouseEvent): void => {
    this.onMouseButton(e.button, false);
  };

  private readonly handleContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    if (this.onWheel()) e.preventDefault();
  };

  private idx(a: Action): number {
    const i = this.index.get(a);
    if (i === undefined) throw new Error(`InputState: ação desconhecida "${a}"`);
    return i;
  }

  private setPhysical(i: number, down: boolean): void {
    const was = this.held[i] === 1;
    if (down === was) return;
    this.held[i] = down ? 1 : 0;
    // Com a ação também segurada sinteticamente, o nível não muda: sem borda.
    if (this.synthetic[i] === 1) return;
    if (down) this.pressed[i] = 1;
    else this.released[i] = 1;
  }
}
