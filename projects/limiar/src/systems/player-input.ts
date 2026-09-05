import type { System } from './system';

/**
 * Fixed #1 (design §4.2): InputState + look.yaw → player.intent. Só traduz;
 * não move nada. jumpPressed é borda (sobrevive até o passo fixo, ver §4.3).
 */
export function createPlayerInputSystem(): System {
  return {
    name: 'player-input',
    fixedUpdate(world) {
      const { input, player } = world;
      const intent = player.intent;
      input.moveAxis(intent.dir);
      // O corpo segue a cabeça: o yaw lido no início do passo é o do último frame.
      intent.yaw = player.look.yaw;
      intent.sprint = input.isDown('sprint');
      intent.jumpPressed = input.justPressed('jump');
      intent.jumpHeld = input.isDown('jump');
    },
  };
}
