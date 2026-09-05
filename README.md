# Personal

Monorepo de projetos pessoais. Cada projeto tem o código em `projects/<nome>/` e a documentação em `docs/<nome>/`.

## Projetos

| Projeto | Descrição | Código | Documentação |
|---|---|---|---|
| **LIMIAR** | Protótipo de looter-shooter em primeira pessoa (Three.js + TypeScript + Vite), inspirado na estrutura de sistemas de Destiny 1/2, com identidade própria. | [`projects/limiar/`](projects/limiar/) | [`docs/limiar/`](docs/limiar/) |

## Estrutura

```
Personal/
├── docs/            # documentação, um subdiretório por projeto
│   └── limiar/
└── projects/        # código, um subdiretório por projeto (cada um com seu package.json)
    └── limiar/
```

Cada projeto é autocontido: entre na pasta do projeto e siga o `README.md` dele para instalar e rodar.
