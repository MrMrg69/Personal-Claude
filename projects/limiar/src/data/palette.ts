/**
 * Paleta de LIMIAR (design §1, §14): crepúsculo permanente. Todas as cores são
 * sRGB em hex numérico (o que `THREE.Color` e `setClearColor` consomem). Este
 * é o único lugar com cores "de marca"; níveis e definições referenciam daqui.
 */
export const PALETTE = {
  // Ambiente
  /** Chão ocre/terracota. */
  ochre: 0xa67c52,
  /** Terracota mais escura (lajes alternadas, base de rampas). */
  terracotta: 0x8e5f3c,
  /** Paredes cinza-quente. */
  warmGray: 0x6b5f5a,
  warmGrayLight: 0x8a7d76,
  warmGrayDark: 0x4e4541,
  /** Céu/névoa lilás-acinzentado — também é o clear color. */
  fog: 0x8d7f9c,
  /** Chão da luz hemisférica. */
  hemiGround: 0x5a4634,
  /** Sol baixo âmbar. */
  sunAmber: 0xffc98a,
  /** Grade de debug (1 m e 10 m). */
  gridMinor: 0x6d5138,
  gridMajor: 0x8f6f4d,

  // Identidade
  /** Tecnologia dos Vigias. */
  wardenCyan: 0x3fd2c7,
  /** A Maré. */
  tideMagenta: 0xc83aa0,

  // Elementos (§14)
  ember: 0xff7a1a,
  resonance: 0x3fd2c7,
  haze: 0xb04ac8,

  // Facções (§14)
  axiomWhiteBlue: 0xd6e6f2,
  rustOrange: 0xb5552a,
  strainPaleGreen: 0x9ccc7a,

  // Raridades (§14)
  rarityCommon: 0xb5b5b5,
  rarityUncommon: 0x4fbf6a,
  rarityRare: 0x4a8fe0,
  rarityLegendary: 0x9b5de5,
  rarityExotic: 0xe8c04a,

  // Props do Campo de Provas (leitura de silhueta a 20–60 m)
  propSand: 0xc9a36b,
  propClay: 0xb8734a,
  propSlate: 0x5f6b73,
  propMoss: 0x7d8a4f,
  propBone: 0xd9cdb5,
  propInk: 0x2f2a33,
} as const;
