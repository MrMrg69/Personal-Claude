import './ui/styles.css';
import { hasWebGL2 } from '@/core/renderer';
import { Game } from '@/game/game';
import { Overlay } from '@/ui/overlay';

/**
 * Bootstrap (design §10.1): checa WebGL2, cria o Game em #app e trata erro
 * fatal com overlay. Sem WebGL2 o loop nunca é criado (§4.4).
 */
function requireElement<T extends Element>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) throw new Error(`index.html: elemento #${id} ausente ou de tipo errado`);
  return el;
}

function boot(): void {
  const container = requireElement('app', HTMLDivElement);
  const canvas = requireElement('game', HTMLCanvasElement);
  const ui = requireElement('ui', HTMLDivElement);

  if (!hasWebGL2(canvas)) {
    new Overlay(ui, () => undefined).show({ kind: 'nowebgl2', mode: 'unlocked' });
    return;
  }

  try {
    new Game({ container, canvas, ui });
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    new Overlay(ui, () => undefined).show({ kind: 'fatal', mode: 'unlocked', message });
  }
}

boot();
