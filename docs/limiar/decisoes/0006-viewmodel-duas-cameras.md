# ADR 0006 — Rig de câmera com duas câmeras e camadas (mundo + viewmodel)

## Status

Aceita (M0). Referência: design técnico §5.3 e §6.3. `src/core/layers.ts` existe; `src/core/camera-rig.ts` e `src/core/renderer.ts` são planejados.

## Contexto

Gunplay é o pilar nº 1. Em primeira pessoa, a arma renderizada com a câmera do mundo tem dois problemas clássicos: atravessa paredes (a geometria da arma está à frente do plano `near`, mas dentro da parede) e **estica** em hFOV alto (95° aqui; 110° no máximo). Além disso, recoil rotacional não pode inclinar a cápsula de colisão nem alterar o yaw que a IA e uma rede futura leem.

## Decisão

Hierarquia (planejada em `src/core/camera-rig.ts`):

```
rig.root (Object3D)                       posição = pés interpolados; rotation.y = yaw
└── rig.head (Object3D)                   y = eyeHeight + kicks; rotação 'YXZ':
    │                                     x = pitch + recoil + kick de pouso (+ bob); clamp ±89° DEPOIS da soma
    ├── rig.worldCamera (PerspectiveCamera)      camadas WORLD=0 (+ DEBUG=2); near 0,05; far 300; vfov de hFOV
    └── rig.viewmodelRoot (Object3D)             "ombro" da arma: sway/ADS/sprint pose (M1)
        ├── rig.viewmodelCamera (PerspectiveCamera)  camada VIEWMODEL=1; fov 55° vertical fixo; near 0,01; far 5
        └── rig.weaponSocket (Object3D)          vazio em M0; a arma é filha daqui em M1
```

Passadas por frame (planejadas em `renderFrame` de `src/core/renderer.ts`):

```ts
renderer.autoClear = false;
renderer.shadowMap.needsUpdate = true;   // sombra 1x por frame, só nesta passada
renderer.clear();
renderer.render(scene, rig.worldCamera); // camada 0 (+2 com helpers)
renderer.clearDepth();
renderer.render(scene, rig.viewmodelCamera); // camada 1 (vazia em M0)
```

- `shadowMap.autoUpdate = false`: sem isso a segunda passada renderizaria o shadow map de novo.
- Luzes com `light.layers.enableAll()` para iluminar a arma.
- Corpo só tem yaw; pitch fica na cabeça. Ordem `'YXZ'` (yaw global, pitch local) evita roll induzido.
- Offsets de recoil, kick de pouso e head-bob são **somados por frame e nunca acumulados**: cada contribuição decai sozinha por `Spring` (`src/core/math/spring.ts`) ou damp. É o que faz o recoil "voltar" sem a câmera puxar.
- A segunda passada roda sempre, mesmo vazia, para que o número de performance de M0 seja honesto (custo: 1 `clearDepth` + 1 render vazio).

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Arma na câmera do mundo com `near` menor | Continua atravessando parede e estica em hFOV alto. |
| `PointerLockControls` de `three/addons` | Rotaciona a câmera direto (colide com a hierarquia), sensibilidade fixa `0.002·pointerSpeed` (não em °/contagem), não separa yaw do corpo. |
| `renderOrder` + `depthTest: false` na arma | Some a arma da sombra e a iluminação fica inconsistente; FOV continua o do mundo. |
| Render target separado para a arma | Custa um quad full-screen e composição — vai contra o ADR 0004. |

## Consequências

- Positivas: arma nunca atravessa parede nem estica; FOV da arma (55°) independente do FOV do mundo; recoil, sway, ADS e sprint pose (M1) atuam em `viewmodelRoot` sem tocar a simulação.
- Positivas: M1 só cria a arma como filha de `weaponSocket`; nada do rig muda.
- Negativas: duas `PerspectiveCamera` para manter no resize (vfov recalculado de hFOV); risco de renderizar a sombra 2× se alguém religar `shadowMap.autoUpdate`.

## Gatilho de revisão

Revisitar apenas se a passada extra custar **> 0,5 ms** medidos em iGPU real (improvável: é um `clearDepth` + poucos draw calls) ou se surgir necessidade de a arma projetar sombra no mundo (exigiria um proxy na camada 0).
