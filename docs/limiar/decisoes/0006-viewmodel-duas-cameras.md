# ADR 0006 — Rig de câmera com duas câmeras e camadas (mundo + viewmodel)

## Status

Aceita (M0). Referência: design técnico §5.3 e §6.3. Implementado em `src/core/layers.ts`, `src/core/camera-rig.ts` (classe `CameraRig`), `src/core/renderer.ts` (`Renderer.renderFrame`) e `src/systems/camera-sync.ts`.

## Contexto

Gunplay é o pilar nº 1. Em primeira pessoa, a arma renderizada com a câmera do mundo tem dois problemas clássicos: atravessa paredes (a geometria da arma está à frente do plano `near`, mas dentro da parede) e **estica** em hFOV alto (95° aqui; 110° no máximo). Além disso, recoil rotacional não pode inclinar a cápsula de colisão nem alterar o yaw que a IA e uma rede futura leem.

## Decisão

Hierarquia (`CameraRig`, nomes dos `Object3D` iguais aos campos):

```
rig.root (Object3D)                       posição = pés interpolados; rotation.y = yaw
└── rig.head (Object3D)                   y = eyeHeight + offsets.y; rotação 'YXZ':
    │                                     x = clamp(pitch + offsets.pitch, ±89°) — clamp DEPOIS da soma
    ├── rig.worldCamera (PerspectiveCamera)      camada WORLD=0 (+ DEBUG=2 com F6); near 0,05; far 300; vfov de hFOV
    └── rig.viewmodelRoot (Object3D)             "ombro" da arma: sway/ADS/sprint pose (M1)
        ├── rig.viewmodelCamera (PerspectiveCamera)  camada VIEWMODEL=1; fov 55° vertical fixo; near 0,01; far 5
        └── rig.weaponSocket (Object3D)          vazio em M0; a arma é filha daqui em M1
```

Passadas por frame (`Renderer.renderFrame(scene, rig)`):

```ts
// construtor: gl.autoClear = false; gl.shadowMap.autoUpdate = false; gl.info.autoReset = false
this.gl.info.reset();
this.gl.shadowMap.needsUpdate = true;      // sombra 1x por frame, só nesta passada
this.gl.clear();
this.gl.render(scene, rig.worldCamera);    // camada 0 (+2 com helpers)
this.gl.clearDepth();
this.gl.render(scene, rig.viewmodelCamera); // camada 1 (vazia em M0)
```

- `shadowMap.autoUpdate = false`: sem isso a segunda passada renderizaria o shadow map de novo.
- Luzes com `layers.enableAll()` (`src/world/lighting.ts`) para iluminar a arma.
- Corpo só tem yaw; pitch fica na cabeça. Ordem `'YXZ'` (yaw global, pitch local) evita roll induzido.
- Offsets de recoil, kick de pouso e head-bob (`HeadOffsets`: `pitch`, `yaw`, `roll`, `x`, `y`, `back`) são **somados por frame em `applyPose(yaw, pitch, offsets)` e nunca acumulados**: `camera-feel` decai cada contribuição por `Spring` (`src/core/math/spring.ts`) ou damp. É o que faz o recoil "voltar" sem a câmera puxar.
- `setHfov(hfovDeg, aspect)` recalcula o vfov da câmera do mundo e só o aspect da câmera da arma (ADR 0007).
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
- Negativas: duas `PerspectiveCamera` para manter no resize (o `Renderer` chama `onResize` e o jogo repassa a `setHfov`); risco de renderizar a sombra 2× se alguém religar `shadowMap.autoUpdate`.

## Gatilho de revisão

Revisitar apenas se a passada extra custar **> 0,5 ms** medidos em iGPU real (improvável: é um `clearDepth` + poucos draw calls) ou se surgir necessidade de a arma projetar sombra no mundo (exigiria um proxy na camada 0).
