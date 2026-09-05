# LIMIAR — Visão e design do jogo (GDD)

> Documento de design de jogo (GDD) do **LIMIAR**, protótipo de looter-shooter em primeira pessoa para navegador (Three.js + TypeScript + Vite). Inspiração declarada: a **estrutura de sistemas e a sensação de jogo** de Destiny 1 e 2. Nomes, mundo, facções e identidade visual são originais.
>
> Fontes: o master prompt do projeto e o [design técnico](./02-design-tecnico.md) (fonte da verdade para arquitetura, contratos e números). Onde este documento cita arquivos ou funções de M0, os nomes são os do código real em `projects/limiar/` (ver [03 — Arquitetura](./03-arquitetura.md)); o que é de M1 em diante usa os nomes **planejados** no design técnico (§10) e está marcado como tal.
>
> Estado: **M0 (esqueleto)**. Armas, inimigos, habilidades e loot descritos aqui são especificação para M1–M5 e além — não estão implementados.

---

## 1. Visão

### 1.1 Em uma frase

Um looter-shooter em primeira pessoa, pequeno e responsivo, que roda 100 % no navegador e captura o núcleo do gênero: **atirar tem de ser bom antes de qualquer outra coisa**.

### 1.2 Frase de identidade

> *Um planeta-fronteira na órbita de uma estrela que apaga. Uma Maré de silêncio avança pela superfície e desfaz tudo o que toca. Os Vigias seguram a última faixa iluminada — o Limiar — com armas recuperadas de três eras de guerra, sob um crepúsculo que nunca termina.*

### 1.3 O que o nome quer dizer

**Limiar** é a fronteira entre o que ainda vive e o que já foi engolido. É também a última faixa de superfície onde a luz da estrela ainda chega. O jogador defende essa faixa. Nunca a amplia. Só a segura.

### 1.4 Premissas de produto

| Premissa | Consequência |
|---|---|
| Roda no navegador, sem backend no MVP | Salvamento em `localStorage` (`SaveStore` versionado). |
| Um desenvolvedor, escopo pequeno | Uma classe, duas armas, um mapa e uma facção no MVP. |
| Feel de tiro é prioridade máxima | M1 (gunplay) vem antes de inimigos, habilidades e loot. |
| 60 fps em GPU integrada | Low-poly flat, sem texturas, sem pós-processamento, HUD em DOM. |
| Dados orientados a configuração | Armas, inimigos, itens e classes em módulos TS tipados (`data/`), nunca *hardcoded*. |

---

## 2. Identidade visual

### 2.1 Crepúsculo permanente

O planeta tem rotação travada. A estrela está sempre baixa no horizonte, sempre âmbar, sempre morrendo. Não existe dia nem noite: existe **um único crepúsculo** que nunca termina. Isso dá ao jogo uma luz direcional fixa, sombras longas e uma névoa lilás que esconde o horizonte.

Essa escolha estética é também a estratégia de performance: uma luz hemisférica + uma direcional, sem céu geométrico, sem HDRI.

### 2.2 Low-poly com sombreamento plano

- Geometria de baixa contagem de polígonos com **flat shading** (faces visíveis, "papel dobrado").
- **Sem texturas.** Toda cor é cor por vértice.
- Silhuetas grandes e legíveis a 20–60 m. Um inimigo tem de ser identificável pela forma antes de ser identificável pela cor.
- Sem PBR, sem HDRI, sem pós-processamento no MVP. Hitmarker e flash de dano são DOM/CSS.
- Tone mapping neutro (`NeutralToneMapping`) para **preservar matiz**: as cores de raridade e dos elementos precisam ser lidas de longe sem lavar.

### 2.3 Paleta

| Uso | Cor | Hex (`src/data/palette.ts`, `PALETTE`) |
|---|---|---|
| Chão | ocre / terracota | `#a67c52` |
| Paredes e estruturas | cinza-quente | `#6b5f5a` |
| Céu, névoa e cor de fundo | lilás-acinzentado | `#8d7f9c` |
| Sol | âmbar baixo | `#ffc98a` |
| Tecnologia dos Vigias | ciano-esverdeado | `#3fd2c7` |
| A Maré | magenta | `#c83aa0` |
| Brasa (elemento) | laranja | `#ff7a1a` |
| Ressonância (elemento) | ciano | `#3fd2c7` |
| Névoa (elemento) | roxo-magenta | `#b04ac8` |
| Raridade Comum | cinza | `#b5b5b5` |
| Raridade Incomum | verde | `#4fbf6a` |
| Raridade Rara | azul | `#4a8fe0` |
| Raridade Lendária | roxo | `#9b5de5` |
| Raridade Exótica | dourado | `#e8c04a` |

Regra de leitura: **ciano é aliado, magenta é a Maré, laranja enferrujado é a Ferrugem, branco-azulado é o Axioma, verde-pálido/roxo é a Cepa.** Nenhuma facção usa ciano.

---

## 3. Os nove pilares de design

Reescritos do master prompt com os nomes do Léxico (§16).

| # | Pilar | O que significa no LIMIAR |
|---|---|---|
| 1 | **Feel de tiro (gunplay) é prioridade máxima** | Recoil por padrão com mola de recuperação, hitmarker, som e impacto visual, mira sem suavização nem aceleração. Trabalhado e testado (M1) antes de qualquer outro sistema. |
| 2 | **Três classes de Vigia com identidade de combate distinta** | **Baluarte** (tanque, melee e barreiras), **Rastreador** (mobilidade, Investida, dano crítico), **Tecelão/Tecelã** (área, cura/suporte, granadas fortes). |
| 3 | **Habilidades com cooldown, não munição infinita** | Granada, Golpe (melee especial), habilidade de classe e o **Ápice** (definitiva de carga lenta e alto impacto). |
| 4 | **Três elementos que interagem com escudos** | **Brasa** (queima contínua), **Ressonância** (atordoamento em cadeia), **Névoa** (enfraquecimento). |
| 5 | **Três slots de arma** | **Ferro** (sem elemento), **Afim** (com elemento), **Pesado** (alto dano, munição rara). Tipos variados: auto rifle, scout, shotgun, sniper, lançador. |
| 6 | **Loot com raridade e rolagem de perks** | Comum / Incomum / Raro / Lendário / Exótico. Stats e perks parcialmente aleatórios ao dropar, com RNG seedável. |
| 7 | **Lume (nível de poder)** | Combina o equipamento do Vigia e escala dano e dificuldade. Mostrado no HUD como "Lume 240". |
| 8 | **Loop de gameplay** | Patrulha em zona aberta pequena → matar inimigos e cumprir objetivos → evento público opcional → chefe de missão → loot → repetir com Lume maior. |
| 9 | **Três facções com IA e silhueta distintas** | **Axioma** (robótica, geométrica), **Ferrugem** (pirata-tecnológica, assimétrica), **Cepa** (orgânica, fanática). |

---

## 4. Loop de gameplay

### 4.1 Loop macro (uma sessão)

```
Patrulha (Crista da Patrulha)
  → matar inimigos, cumprir objetivos simples (matar N, ativar ponto)
  → evento público opcional (pós-MVP)
  → chefe de missão (inimigo com mais vida e padrão de ataque)
  → loot (raridade visível pela cor)
  → equipar melhor → Lume sobe
  → repetir com inimigos mais fortes
```

### 4.2 Loop micro (um encontro)

1. Detectar a silhueta a 20–60 m.
2. Escolher arma pelo alcance: auto rifle (Ferro) a média distância, shotgun (Afim) de perto.
3. Combinar elemento com o escudo do inimigo, se houver.
4. Usar cobertura de peito (muretas de 1,1 m) e cobertura em pé (pilares).
5. Gastar habilidades quando o cooldown permitir; guardar o Ápice para o chefe ou para uma emergência.
6. Recuar para regenerar vida e escudo após alguns segundos sem tomar dano.
7. Coletar o drop.

### 4.3 Lista de verificação — o loop está "fechado" quando

- [ ] O jogador consegue morrer e voltar sem recarregar a página.
- [ ] Um drop Lendário muda uma decisão de equipamento.
- [ ] Subir o Lume torna um encontro antes difícil em fácil.
- [ ] Um chefe exige usar cobertura e o Ápice.

---

## 5. O Vigia (jogador)

### 5.1 Vida, escudo e regeneração

Planejado para M2 (`systems/regen.ts`, `systems/damage.ts`):

- **Escudo** absorve dano primeiro. **Vida** só cai com o escudo zerado.
- Sem dano por **X segundos** (valor em dados; ponto de partida ≈ 3 s), escudo e depois vida regeneram. Igual ao ritmo clássico do gênero: recuar, respirar, voltar.
- Escudo do Vigia pode ter elemento (afeta a interação em §7).
- Morte → respawn no último ponto seguro (mesmo mecanismo do kill plane já previsto em M0).

### 5.2 Movimento (M0, valores em `data/movement-config.ts`)

| Parâmetro | Valor |
|---|---|
| Andar | 6,0 m/s |
| Sprint (Shift, só para a frente) | 8,5 m/s |
| Pulo de toque | 1,40 m |
| Pulo segurando | ≈ 2,1 m (sem pulo duplo — isso é habilidade de classe) |
| Gravidade | −24 m/s² (descida "snappy") |
| Degrau sem pulo | 0,35 m |
| Cápsula | 0,40 m de raio × 1,80 m; olho a 1,62 m |
| hFOV | 95° (80–110 nas configurações) |
| Sensibilidade | 0,022°/contagem × multiplicador (padrão 1,5) |

Modelo "velocidade desejada + aceleração", sem fricção estilo Source/Quake. Sem head-bob por padrão (acessibilidade). Crouch entra em M1; slide é pós-MVP.

---

## 6. Classes

Cada classe tem **quatro habilidades**: Granada, Golpe (melee especial), habilidade de classe e o **Ápice**. Cooldowns contam em passos fixos (60 Hz). O Ápice não tem cooldown: acumula **carga** por dano causado e abates.

### 6.1 Rastreador (`ranger`) — classe do MVP

**Identidade de combate:** mobilidade e dano crítico. O Rastreador não aguenta pancada: ele não está lá quando a pancada chega. Recompensa mira na cabeça e reposicionamento constante.

| Atributo | Valor (planejado em `data/classes/ranger.ts`, M3) |
|---|---|
| Multiplicador de movimento | 1,08 (≈ 6,5 m/s andando; 9,2 m/s no sprint) |
| Multiplicador de crítico | acima da base (valor a afinar no painel) |
| Elemento de classe | Brasa |

| Habilidade | Tecla | Efeito | Cooldown (ponto de partida) |
|---|---|---|---|
| **Granada** (Brasa) | Q | Explosão em área que deixa **queima contínua** por alguns segundos. | ≈ 45 s |
| **Golpe** | F | Melee rápido de alto dano; abate com Golpe devolve parte do cooldown da Investida. | ≈ 20 s |
| **Investida** (habilidade de classe, `dash`) | E | Impulso horizontal na direção do movimento por N passos fixos. Sobe a plataforma de 2,6 m do Campo de Provas combinada com o pulo. Recarrega parte da munição da arma ativa (o "recuo tático" do gênero). | ≈ 15 s |
| **Ápice** | X | Por 8 s, rajada de tiros de alto dano (arma-de-luz, precisão total, crítico garantido). | por carga |

**Sensação alvo:** o Rastreador "dança": Investida para sair do fogo, tiro na cabeça, Golpe no que sobrou. A Investida é um impulso em `body.velocity`, não um teleporte: deslocamento por passo fica abaixo do raio da cápsula (≤ 24 m/s) ou usa sub-passos de colisão.

**Lista de verificação (M3):**

- [ ] Quatro habilidades com cooldown no HUD.
- [ ] Carga do Ápice sobe com dano e abates; barra no HUD.
- [ ] Investida + pulo alcança a plataforma de 2,6 m.
- [ ] Nenhuma habilidade atravessa parede (colisão de cápsula mantida durante a Investida).

### 6.2 Baluarte (`bulwark`) — esboço, **pós-MVP (M6)**

**Identidade de combate:** tanque. Segura a linha, empurra para a frente, protege o time. Melee pesado e barreiras.

| Habilidade | Esboço |
|---|---|
| Granada (Ressonância) | Granada de pulso que atordoa em cadeia no ponto de impacto. |
| Golpe | Soco de ombro que empurra e derruba inimigos leves; mais lento e mais forte que o do Rastreador. |
| Habilidade de classe: **Muralha** | Barreira de energia ciano que bloqueia projéteis por alguns segundos. Recarrega o escudo de quem fica atrás. |
| Ápice: **Aríete** | Corrida invulnerável de alto dano corpo a corpo por alguns segundos. |

### 6.3 Tecelão / Tecelã (`weaver`) — esboço, **pós-MVP (M6)**

**Identidade de combate:** controle de área e suporte. Granadas fortes, cura, dano em área.

| Habilidade | Esboço |
|---|---|
| Granada (Névoa) | Nuvem que **enfraquece** (inimigos recebem mais dano) e drena lentamente. |
| Golpe | Toque à distância curta que aplica o elemento da classe. |
| Habilidade de classe: **Trama** | Zona no chão que cura o Vigia e aliados enquanto estão dentro. |
| Ápice: **Descoser** | Rajada de projéteis de Névoa em leque, alto dano em área. |

> Nomes das habilidades do Baluarte e do Tecelão são **provisórios** até M6. Só o Rastreador tem nomes fixados no Léxico.

---

## 7. Elementos e escudos

Três elementos, um por cor. Definidos em `data/elements.ts` já em M0 (cor e descrição); interação de dano em M2 (`systems/damage.ts`).

| Elemento | Id | Cor | Efeito de status | Classe que o usa |
|---|---|---|---|---|
| **Brasa** | `ember` | laranja `#ff7a1a` | **Queima contínua**: dano por segundo por alguns segundos após o acerto. | Rastreador |
| **Ressonância** | `resonance` | ciano `#3fd2c7` | **Atordoamento em cadeia**: salta para inimigos próximos e paralisa por um instante. | Baluarte |
| **Névoa** | `haze` | roxo-magenta `#b04ac8` | **Enfraquecimento**: o alvo recebe dano aumentado por alguns segundos. | Tecelão/Tecelã |

### 7.1 Interação com escudos (regra planejada)

Inimigos podem ter **escudo elemental** (cor visível na silhueta).

| Situação | Resultado |
|---|---|
| Elemento do ataque **igual** ao do escudo | Dano bônus ao escudo; ao quebrar, o escudo **explode** com o efeito de status do elemento em área. |
| Elemento diferente | Dano normal ao escudo. |
| Ataque sem elemento (Ferro) | Dano normal ao escudo; dano bônus à **vida** exposta (o papel do slot Ferro). |
| Alvo sem escudo | Aplica o efeito de status normalmente. |

Os multiplicadores exatos ficam em `data/elements.ts` (tabela `elemento × escudo`) e são afinados no painel. Só a Brasa é obrigatória no MVP; Ressonância e Névoa completos entram em M6.

**Lista de verificação:**

- [ ] Cada elemento tem cor, descrição e efeito de status em dados.
- [ ] Um escudo quebrado com o elemento certo é visível e audível.
- [ ] Ferro tem razão de existir (bônus contra vida exposta).

---

## 8. Armas

### 8.1 Slots

| Slot | Id | Regra | Munição |
|---|---|---|---|
| **Ferro** | `iron` | Sem elemento. Dano consistente; bônus contra vida exposta. | abundante |
| **Afim** | `attuned` | Sempre com elemento. Quebra escudos. | média |
| **Pesado** | `heavy` | Alto dano por tiro. Sniper, lançador. | rara (pós-MVP, M8) |

Troca de arma pela roda do mouse (`swapWeapon`). Recarga em `R`.

### 8.2 Tipos de arma

| Tipo | Slot típico | Papel | Milestone |
|---|---|---|---|
| Auto rifle | Ferro | Média distância, cadência alta, recoil vertical previsível. | **M1 (MVP)** |
| Shotgun | Afim | Curta distância, N pellets determinísticos por seed. | **M1 (MVP)** |
| Scout rifle | Ferro / Afim | Longa distância, tiro a tiro, crítico. | pós-MVP |
| Sniper | Pesado | Um tiro, um abate na cabeça. | M8 |
| Lançador | Pesado | Área, chefe. | M8 |

### 8.3 O que define uma arma (`WeaponDef`, planejado para M1)

`id`, `slot`, `archetype`, `element` (ou nenhum), `rpm`, `damage`, `critMultiplier`, `magazine`, `reserve`, `reloadTime`, `spread` (quadril / mira / sprint), `recoilPattern` (lista de kicks de pitch/yaw), `recovery`, `range`, `pellets` (shotgun).

### 8.4 Feel de tiro — o que "bom" quer dizer

- Recoil segue o `recoilPattern` e **volta ao zero em < 0,4 s sem overshoot** (mola com recuperação de 18°/s).
- O clamp de pitch é aplicado **depois** do recoil: a arma nunca vira a câmera.
- Dispersão depende do estado de locomoção (parado < andando < sprint) e da mira (ADS).
- Hitmarker em DOM no mesmo frame do acerto (`hit:confirmed`, emitido de forma síncrona).
- Cadência exata em passos fixos: 600 rpm são 10 tiros por segundo, sempre.
- Som de tiro, impacto e recarga com latência mínima (buffers pré-decodificados).
- Viewmodel em câmera própria (FOV 55° fixo): a arma não estica em FOV alto nem atravessa paredes.

---

## 9. Loot, raridades e perks

Planejado para M4 (`systems/loot.ts`, `systems/pickup.ts`, `data/items/`, `data/loot-tables/`).

### 9.1 Raridades

| Raridade | Id | Cor | Perks (proposta) | Frequência (proposta) |
|---|---|---|---|---|
| Comum | `common` | cinza `#b5b5b5` | 0 | muito alta |
| Incomum | `uncommon` | verde `#4fbf6a` | 1 | alta |
| Raro | `rare` | azul `#4a8fe0` | 1 + stats melhores | média |
| Lendário | `legendary` | roxo `#9b5de5` | 2 rolados | baixa; garantido em chefe |
| Exótico | `exotic` | dourado `#e8c04a` | 2 rolados + 1 intrínseco fixo | muito baixa; 1 por slot equipado |

O drop no chão é uma entidade `LootEntity` com a cor da raridade emissiva, visível a 30 m.

### 9.2 Rolagem

- Cada abate consulta a **tabela de loot** do inimigo (`enemy.lootTable`).
- `rollItem(def, rarityTable, rng)` é função pura, com o `Random` seedável do mundo: **a mesma seed produz o mesmo loot**, e isso é testado.
- Stats rolam dentro de faixas por raridade (dano, cadência, recarga, alcance, estabilidade).
- Perks rolam de um pool por tipo de arma.

### 9.3 Perks (`PerkDef`)

Um perk é um gancho com efeito: `onHit`, `onKill`, `onReload` ou `passive`. Exemplos planejados:

| Perk (nome provisório) | Gancho | Efeito |
|---|---|---|
| Fôlego | `onKill` | Recarrega parte do pente ao abater. |
| Pulso Firme | `passive` | Menos recoil. |
| Rescaldo | `onHit` | Acertos de Brasa duram mais. |
| Mão Leve | `onReload` | Recarga mais rápida com o pente vazio. |

### 9.4 Inventário

DOM simples: equipar por slot (Ferro / Afim / Pesado), ver stats e perks, comparar com o equipado. Persistido pelo `SaveStore` com migrations.

---

## 10. Lume (nível de poder)

- Cada item tem um valor de **Lume**.
- O Lume do Vigia é a **média** dos slots equipados (`powerLevel(loadout)`, função pura, M4).
- O dano aplica **um único multiplicador**: `Lume do atacante / Lume do defensor`.
- Inimigos e áreas têm Lume próprio. Diferença grande para baixo torna o encontro punitivo; para cima, trivial.
- Loot cai com Lume um pouco acima do atual (progressão contínua, sem saltos).
- HUD mostra "Vigia · Lume 240".

**Lista de verificação:**

- [ ] Subir 10 de Lume é perceptível contra o mesmo inimigo.
- [ ] Nenhum inimigo é impossível por Lume dentro do mapa do MVP.

---

## 11. Facções inimigas

Definidas em `data/factions.ts` já em M0 (id, cor, descrição de silhueta). Unidades e IA entram por milestone.

### 11.1 Ferrugem (`rust`) — **MVP (M2)**

**Quem são:** os Corsários da Ferrugem. Saqueadores que vivem do que a Maré ainda não engoliu. Tecnologia remendada, assimétrica, sempre com uma peça a mais de um lado.

**Silhueta:** assimetria. Um ombro maior que o outro, um braço mecânico, antenas tortas. Laranja enferrujado com detalhes de metal escuro. Legível a 40 m pelo desequilíbrio da forma.

**IA:** máquina de estados `patrulha → detecção → ataque → cobertura`. Usa os `coverPoints` do mapa e linha de visão por raycast. Recua quando o escudo cai; volta quando regenera.

| Unidade | Id | Papel | Comportamento |
|---|---|---|---|
| **Atirador da Ferrugem** | `rust-gunner` | à distância | Mantém 15–25 m, atira em rajadas, procura cobertura ao tomar dano. |
| **Saqueador da Ferrugem** | `rust-raider` | corpo a corpo | Avança em zigue-zague, ataca de perto, recua se sozinho. |

Pós-MVP: chefe da Ferrugem com escudo de Brasa e padrão de ataque em fases.

### 11.2 Axioma (`axiom`) — **pós-MVP (M7)**

**Quem são:** uma inteligência geométrica que trata o planeta como um teorema a provar. Não saqueia: **converte**. Onde o Axioma passa, o terreno vira prisma.

**Silhueta:** prismas e arestas retas. Luz branca-azulada nas juntas. Simetria perfeita — o oposto da Ferrugem.

**IA:** formação. Unidades se movem em grade, mantêm distância exata, não usam cobertura (ficam paradas e atiram). Teleporte curto quando a linha de visão é perdida.

| Unidade | Id | Papel |
|---|---|---|
| **Lema** | `axiom-lemma` | básica, à distância, em grupo |
| **Corolário** | `axiom-corollary` | apoio; escudo de Ressonância nos aliados próximos |
| **Postulado** | `axiom-postulate` | pesada; lenta, tanque, ataque em área |

### 11.3 Cepa (`strain`) — **pós-MVP (M9)**

**Quem são:** vida que se adaptou à Maré. Fanáticos orgânicos que adoram o silêncio. Multiplicam-se em cavernas e sob ruínas.

**Silhueta:** curvas, sem arestas. Esporos flutuantes. Verde-pálido com roxo — a única facção que compartilha matiz com a Maré.

**IA:** enxame. Muitas unidades fracas em corrida direta; unidades de longo alcance ficam atrás e lançam esporos em arco. Sem cobertura, sem recuo.

| Unidade | Id | Papel |
|---|---|---|
| **Rebento** | `strain-sprout` | enxame, corpo a corpo, frágil |
| **Portador** | `strain-bearer` | à distância, esporos em arco |
| **Coro** | `strain-choir` | suporte; fortalece Rebentos próximos |

> Nomes das unidades do Axioma (Lema, Corolário, Postulado) estão fixados no Léxico. Os da Cepa são **provisórios** até M9.

### 11.4 Lista de verificação (facção "pronta")

- [ ] Silhueta reconhecível em wireframe cinza, sem cor.
- [ ] Cor própria que não colide com aliados nem com outra facção.
- [ ] IA com pelo menos um comportamento que nenhuma outra facção tem.
- [ ] Uma unidade à distância e uma corpo a corpo, no mínimo.

---

## 12. A Maré

A **Maré de silêncio** é o antagonista ambiental. Não é uma facção: não tem unidades, não pode ser morta. É uma frente magenta que avança pela superfície e desfaz o que toca — som, luz, forma.

**Papel no jogo:**

- Explica o cenário: a estrela apaga, a Maré sobe, o Limiar encolhe.
- Explica as facções: a Ferrugem saqueia antes que a Maré chegue; o Axioma converte para resistir; a Cepa adora.
- **Mecânica (pós-MVP):** borda do mapa. Entrar na Maré desliga a regeneração e drena o escudo; ficar tempo demais mata. Substitui a "parede invisível" por uma razão diegética.
- **Visual:** névoa magenta densa, sem som, geometria que perde arestas conforme se aproxima.

No MVP a Maré aparece só na cor da névoa distante e no texto de identidade.

---

## 13. Mundo

### 13.1 Campo de Provas (`test-ground`) — M0

Mundo de teste, definido como **dado** (`data/levels/test-ground.ts`) e construído por `world/level-builder.ts`. Não é o mapa do jogo: é a bancada de feel. Contém régua de 1/2/3 m, poste de 1,80 m, rampas de 20,6°/40°/53°, escada de degraus, plataformas de 1,2/1,8/2,6 m, torre de 6 m, corredor de 1,2 m, muretas de cobertura e cinco alvos cilíndricos de 10 a 60 m.

### 13.2 Crista da Patrulha (`patrol-ridge`) — M5

Primeiro mapa jogável. Zona aberta pequena (≈ 120 × 120 m) com terreno, cobertura, pontos de spawn de inimigos, pontos de cobertura para a IA e objetivos. Mesmo formato `LevelDef` do Campo de Provas: **tudo que funciona na bancada funciona no mapa**.

---

## 14. HUD

100 % DOM (zero draw calls). Sempre legível, nunca no meio da tela.

| Elemento | Onde | Milestone |
|---|---|---|
| Vida e escudo | inferior esquerdo | M2 |
| Munição (pente / reserva) e arma ativa | inferior direito | M1 |
| Cooldowns de Granada, Golpe, Investida e carga do Ápice | inferior centro | M3 |
| Hitmarker, números de dano, flash de dano | centro / bordas | M1–M2 |
| Minimapa 2D (canvas) | superior direito | M5 |
| Lume | superior esquerdo, junto ao nome da classe | M4 |
| HUD de debug (F3) | superior esquerdo, monoespaçado | M0 |

---

## 15. Escopo: MVP × futuro

### 15.1 Checklist do MVP (§3 do master prompt) e onde cada item entra

| Item do MVP | Milestone | Estado |
|---|---|---|
| 1 classe jogável completa (Rastreador: Investida + Granada + Golpe + Ápice) | M3 | [ ] |
| 1 arma primária (auto rifle, Ferro) e 1 especial (shotgun, Afim) com recoil, som e hitmarker | M1 | [ ] |
| 1 mapa pequeno de patrulha com terreno, cobertura e spawns (Crista da Patrulha) | M5 | [ ] |
| 1 inimigo à distância (Atirador da Ferrugem) + 1 corpo a corpo (Saqueador da Ferrugem), IA patrulha → detecção → ataque → cobertura | M2 | [ ] |
| Vida/escudo do Vigia com regeneração após X s sem dano | M2 | [ ] |
| Drop de loot ao abater, cor de raridade, stats aleatórios | M4 | [ ] |
| Inventário simples (equipar, ver stats) | M4 | [ ] |
| HUD: vida, escudo, munição, cooldowns, minimapa | M1–M5 | [ ] |
| Esqueleto: render, câmera FPS (WASD + mouse), mundo de teste | **M0 (esta entrega)** | [x] |

### 15.2 Tabela de escopo

| Área | MVP (M0–M5) | Futuro (M6+) | Fora do escopo |
|---|---|---|---|
| Classes | Rastreador | Baluarte, Tecelão/Tecelã | — |
| Elementos | Brasa completo; Ressonância e Névoa só em dados | Ressonância e Névoa completos, interação total com escudos | — |
| Armas | auto rifle (Ferro), shotgun (Afim) | scout, sniper e lançador (Pesado) | — |
| Facções | Ferrugem (2 unidades + chefe) | Axioma (M7), Cepa (M9) | sistema de facções sociais |
| Mapas | Campo de Provas, Crista da Patrulha | mais mapas | raides |
| Loop | patrulha → objetivos → chefe → loot → Lume | evento público, a Maré como borda | multiplayer, PvP |
| Loot | raridades, stats e perks rolados, inventário | mais perks, Exóticos com efeito único | crafting, economia |
| Companheiro | — | Eco (M9) | — |
| Narrativa | frase de identidade, nomes | — | cutscenes |
| Movimento | andar, sprint, pulo com hold, step-up, crouch (M1), Investida (M3) | slide | — |
| Visual | low-poly flat, sombras duras, névoa | pós-processamento só se sobrar GPU | PBR, texturas |

---

## 16. Léxico completo

Nomes em jogo, ids em código e o equivalente em Destiny **apenas como referência interna de design** (nunca exibido no jogo, nunca usado como nome de entidade em código).

| Categoria | Nome (PT-BR) | Id | ≈ Destiny (referência) | Cor / nota |
|---|---|---|---|---|
| Jogo | **Limiar** | `limiar` | — | a última faixa iluminada |
| Jogador | **Vigia** (pl. Vigias) | `warden` | Guardian | HUD: "Vigia, Lume 240" |
| Classe tanque | **Baluarte** | `bulwark` | Titan | melee pesado, barreiras (M6) |
| Classe mobilidade | **Rastreador** | `ranger` | Hunter | Investida, crítico (M3, classe do MVP) |
| Classe área/suporte | **Tecelão / Tecelã** | `weaver` | Warlock | área, cura, granadas (M6) |
| Super | **Ápice** | `apex` | Super | carga lenta, alto impacto |
| Habilidade de classe (Rastreador) | **Investida** | `dash` | Dodge | impulso em `velocity` |
| Melee especial | **Golpe** | `melee` | Melee | |
| Granada | **Granada** | `grenade` | Grenade | elemento da classe |
| Facção robótica | **Axioma** (unidades Lema, Corolário, Postulado) | `axiom` | Vex | prismas, luz branca-azulada (M7) |
| Facção pirata-tecnológica | **Ferrugem** (Corsários da Ferrugem) | `rust` | Fallen | assimetria, laranja enferrujado (M2) |
| Inimigo à distância (MVP) | **Atirador da Ferrugem** | `rust-gunner` | Dreg/Vandal (papel) | |
| Inimigo corpo a corpo (MVP) | **Saqueador da Ferrugem** | `rust-raider` | — | |
| Facção orgânica-fanática | **Cepa** | `strain` | Hive | curvas, esporos, verde-pálido/roxo (M9) |
| Elemento queima | **Brasa** | `ember` | Solar | `#ff7a1a` |
| Elemento cadeia/atordoamento | **Ressonância** | `resonance` | Arc | `#3fd2c7` |
| Elemento enfraquecimento | **Névoa** | `haze` | Void | `#b04ac8` |
| Slot 1 (sem elemento) | **Ferro** | `iron` | Kinetic | |
| Slot 2 (com elemento) | **Afim** | `attuned` | Energy | |
| Slot 3 | **Pesado** | `heavy` | Power/Heavy | |
| Raridades | **Comum / Incomum / Raro / Lendário / Exótico** | `common/uncommon/rare/legendary/exotic` | mesmos termos (padrão do gênero) | cinza `#b5b5b5` / verde `#4fbf6a` / azul `#4a8fe0` / roxo `#9b5de5` / dourado `#e8c04a` |
| Unidade de poder | **Lume** | `lume` | Light / Power Level | "Lume 240" |
| Companheiro/IA | **Eco** | `echo` | Ghost | reservado (M9) |
| Antagonista ambiental | **a Maré** (de silêncio) | `tide` | Darkness (papel) | magenta `#c83aa0` |
| Cor dos Vigias | ciano-esverdeado | `warden-cyan` | — | `#3fd2c7` |
| Mundo de teste | **Campo de Provas** | `test-ground` | — | (M0) |
| Mapa do MVP | **Crista da Patrulha** | `patrol-ridge` | patrol zone | (M5) |

### 16.1 Nomes proibidos

Nunca usar como nome de entidade, classe, facção, arquivo ou texto de jogo: Guardian/Guardião, Titan/Titã, Hunter/Caçador, Warlock/Arcanista, Vanguarda, Vex, Fallen, Hive, Cabal, Ghost, Traveler, Light/Darkness (como entidades). Também evitados por colisão com nomes da franquia: Véspera, Errante, Fenda, Eclipse, Faísca, Deriva.

---

## Como rodar (M0)

```bash
cd projects/limiar
npm install
npm run dev        # http://127.0.0.1:5173
npm run check      # typecheck + vitest + build + e2e
```

Controles em M0: `WASD` mover, mouse olhar, `Shift` sprint, `Espaço` pular (segurar = mais alto), `F3` HUD de debug, `F4` painel de tuning (DEV), `F6` helpers, `F7` sombras, `F8` escala de render, `F9` kick de recoil sintético.
