# Referências - Game Jam "Aqui é BR" (Cabruca)

Pacote de referência para a fase de desenvolvimento (05–11/07/2026). Time: dev Sr. fullstack (TS) + QA Jr.

## Índice

- **[Plano dos 7 dias](plano-7-dias.md)** — roadmap de trás para frente, com divisão Sr./QA.
- **[Modelo de domínio](dominio.md)** — entidades, regras e estado atual do core (contrato vivo).
- **[Arquitetura](arquitetura.md)** — padrão core-adapter, estrutura de pastas, estratégia de testes.
- **ADRs** (decisões registradas):
  - [0001 — Escolha da engine (Phaser 3 + TS)](adr/0001-escolha-da-engine.md)
  - [0002 — Arquitetura core-adapter](adr/0002-arquitetura-core-adapter.md)
  - [0003 — Modelo dos indicadores](adr/0003-modelo-de-indicadores.md)
  - [0004 — Deploy, distribuição e linguagens de suporte](adr/0004-deploy-e-distribuicao.md)

## TL;DR das decisões

- **Engine:** Phaser 3 + TypeScript. Sem engine pesada; máximo reuso da stack; deploy web.
- **Arquitetura:** domínio puro em `src/domain` (sem Phaser, testável) + adapter Phaser em `src/game`.
- **Testes:** TDD no core (Vitest), QA exploratória na camada visual.
- **Deploy:** build web estática (GCP ou KVM própria, a confirmar); wrapper de desktop (Rust/Electron) adiado para medição pós-build — ver [ADR 0004](adr/0004-deploy-e-distribuicao.md).
- **Core pronto e verde:** Sombra, Cacaueiro, Inventário, Indicadores + orquestrador **Farm** (loop de turno) — **40 testes passando**.
- **Vertical slice jogável:** plantar → sombra → dormir → colher → vender → 3 indicadores → tela de fim, rodando no navegador (`npm run dev`).

## Comandos

```bash
npm install
npm test           # core (Vitest)
npm run test:watch # TDD
npm run dev        # jogo no navegador
```

## Controles (demo cozy)

O jogador **anda** pela fazenda e age no **tile onde pisa**.

| Ação | Tecla |
|---|---|
| Mover | **WASD** / **setas** (segure para andar) |
| Usar ferramenta (no tile atual) | **E** ou **Espaço** |
| Trocar ferramenta | **1** Nativa · **2** Cacau · **3** Colher (ou clicar na hotbar) |
| Dormir (avança o dia) | **Z** (ou botão) |
| Vender cacau | **V** (ou botão) |
| Pausar | **ESC** |
| Reiniciar (na tela de fim) | **R** |

> Fluxo de telas: **Menu** (temporário) → **Fazenda** → **Pause** (ESC). Colisão só com árvores
> nativas **maduras** (cacau e mudas são "pisáveis", para plantar/colher onde se pisa).
