import { PALETTE } from './palette';

/** Afinidade elemental (design §2, §14). Interações com escudos entram em M2. */
export interface ElementDef {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly description: string;
}

export const ELEMENTS = {
  ember: {
    id: 'ember',
    name: 'Brasa',
    color: PALETTE.ember,
    description: 'Queima contínua: dano ao longo do tempo que se espalha em contato.',
  },
  resonance: {
    id: 'resonance',
    name: 'Ressonância',
    color: PALETTE.resonance,
    description: 'Cadeia e atordoamento: salta entre alvos próximos e interrompe ações.',
  },
  haze: {
    id: 'haze',
    name: 'Névoa',
    color: PALETTE.haze,
    description: 'Enfraquecimento: alvos tocados sofrem mais dano e drenam devagar.',
  },
} as const satisfies Readonly<Record<string, ElementDef>>;

export type ElementId = keyof typeof ELEMENTS;
