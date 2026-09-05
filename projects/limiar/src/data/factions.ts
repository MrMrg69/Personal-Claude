import { PALETTE } from './palette';

/** Facção inimiga (design §2, §14). Unidades e IA concretas entram em M2/M7/M9. */
export interface FactionDef {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  /** Silhueta e comportamento — guia para modelagem low-poly e IA. */
  readonly description: string;
  /** Nomes das unidades previstas (ids em M2+). */
  readonly units: readonly string[];
}

export const FACTIONS = {
  axiom: {
    id: 'axiom',
    name: 'Axioma',
    color: PALETTE.axiomWhiteBlue,
    description:
      'Robótica: prismas e arestas retas, luz branca-azulada. IA de formação — avança em linhas e recua em sincronia.',
    units: ['Lema', 'Corolário', 'Postulado'],
  },
  rust: {
    id: 'rust',
    name: 'Ferrugem',
    color: PALETTE.rustOrange,
    description:
      'Corsários da Ferrugem: silhuetas assimétricas, placas enferrujadas e laranja. IA oportunista — cobertura, flanco e saque.',
    units: ['Atirador', 'Saqueador'],
  },
  strain: {
    id: 'strain',
    name: 'Cepa',
    color: PALETTE.strainPaleGreen,
    description:
      'Orgânica-fanática: curvas, esporos, verde-pálido e roxo. IA de enxame — muitos corpos fracos que não recuam.',
    units: ['Esporo', 'Portador'],
  },
} as const satisfies Readonly<Record<string, FactionDef>>;

export type FactionId = keyof typeof FACTIONS;
