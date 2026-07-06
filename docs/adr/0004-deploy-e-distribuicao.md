# ADR 0004 — Deploy, distribuição e linguagens de suporte

- **Status:** Aceito (com pontos deliberadamente adiados)
- **Data:** 2026-07-06
- **Relacionado:** [ADR 0001 — Escolha da engine (Phaser 3 + TS)](0001-escolha-da-engine.md)

## Contexto

O [ADR 0001](0001-escolha-da-engine.md) fixou a **engine e a linguagem principal**: Phaser 3 +
TypeScript, build via Vite. O que ficou em aberto — e este ADR registra — é **como o jogo chega ao
jogador** (deploy/distribuição) e **quais linguagens de apoio** entram fora do runtime do jogo
(testes, tooling). São decisões independentes da engine, por isso um ADR separado.

O entregável da jam é uma **build web jogável no navegador** (ver [plano-7-dias](../plano-7-dias.md)).
Depois da jam, pode fazer sentido distribuir também um executável de desktop. Não queremos travar
essa escolha agora, antes de ter uma build final para medir.

## Decisões

### 1. Alvo primário: web

O jogo é servido como **site estático** (saída do `vite build` → `dist/`). É o alvo que a banca
abre sem instalar nada e o que exercitamos durante toda a jam (`npm run dev`).

### 2. Hospedagem: GCP **ou** KVM própria (a confirmar por custo/operação)

Como é estático, qualquer host serve. Duas opções em avaliação, sem bloquear a jam:

| Opção | Prós | Contras |
|---|---|---|
| **GCP** (Cloud Storage + CDN / Firebase Hosting) | Zero servidor para manter, HTTPS e CDN prontos, escala sozinho | Conta/billing GCP, menos controle |
| **KVM própria** (nginx num VPS que já temos) | Controle total, custo fixo já pago, domínio próprio | Manutenção (TLS, updates, uptime) por nossa conta |

**Decisão:** manter as duas como candidatas; escolher pelo que já estiver provisionado e mais barato
de operar na semana da entrega. Como o artefato é `dist/` estático, **a migração entre elas é
trivial** e não afeta o código.

### 3. Wrapper de desktop: Rust (Tauri) **vs** Electron — **decisão adiada**

Se quisermos um executável (Win/Mac/Linux), duas rotas empacotam a mesma build web:

- **Rust / Tauri** — binário pequeno, baixo consumo de RAM, usa o webview do SO.
- **Electron** — traz o Chromium embutido; binário grande, maior uso de memória, porém máxima
  previsibilidade de rendering.

**Decisão:** **adiar** até existir a **build final**, e então **medir** (tamanho do artefato,
consumo de memória, tempo de inicialização, fidelidade do WebGL do Phaser no webview) antes de
escolher. Não há por que decidir isso durante a jam — o alvo primário é web e o wrapper reaproveita
`dist/` sem mudança de código.

### 4. Linguagens de suporte: Python **como opção** ao lado de Vitest/Jest

- **Runtime do jogo:** exclusivamente **TypeScript** (regra de ouro do ADR 0002 — o core não importa
  Phaser e é 100% testável).
- **Testes:** **Vitest** é o padrão (já configurado, roda o core headless em Node). **Jest** fica
  como alternativa equivalente caso surja necessidade.
- **Python** é admitido para **tooling fora do runtime**: scripts de balanceamento/simulação,
  geração de dados, automações de QA. **Não** entra no bundle do jogo nem vira dependência de
  execução — é ferramenta de apoio do time.

### 5. Tilemap, sprites e inputs

Usar os subsistemas **open-source do próprio Phaser** (tilemap, sprites, input de teclado/ponteiro)
em vez de reinventar. Assets finais virão do artista; enquanto isso, placeholders atrás de um
contrato de *keys* de textura (`src/game/assets.ts`) permitem trocar por PNGs sem tocar na lógica.
Detalhes de pipeline (formato de tilemap, atlas) a alinhar com o time consultando a documentação do
Phaser.

## Consequências

- **Positivas:** deploy simples (estático) e portável entre hosts; a decisão cara (wrapper) fica
  guiada por dados reais, não por palpite; TS continua sendo a única linguagem de runtime.
- **Adiado de propósito:** host definitivo e wrapper de desktop — ambos reaproveitam `dist/` e não
  impactam o código, então esperar reduz risco sem custo.
- **Risco:** o webview de um wrapper pode renderizar WebGL de forma diferente do Chrome; por isso a
  medição pós-build é condição para adotar desktop.
