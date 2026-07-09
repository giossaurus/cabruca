# Mapa de Implementação — Mecânicas Atualizadas

Fonte: `mecanicas_do_jogo_atualizada.md` × código atual (`src/domain` + `src/game`).
Objetivo: mapear o que **já existe**, o que **diverge** e o que **falta**, e como **encaixar** cada
peça na arquitetura core-adapter (ADR 0002) sem quebrar o que está verde (40 testes).

Legenda: ✅ pronto · 🔧 existe, precisa ajuste · ➕ novo · ❓ decisão de design pendente

---

## 1. Panorama por sistema

| Sistema | Doc atualizado | Código hoje | Status |
|---|---|---|---|
| Nível de Sombra (Moore, 0/1/2+) | igual | `ShadeGrid` | ✅ |
| Maturidade da árvore nativa | **10 dias** | `TREE_MATURITY_DAYS = 2` | 🔧 número |
| Ciclo do cacau (4 estágios, morte 3d sol pleno, +1d mata fechada) | igual + tabela de dias | `Cacao` | 🔧 tempos |
| Indicadores (Bio/Eco/Com, 0–100, começam 50) | igual | `Indicators` | ✅ |
| Faixas de biodiversidade (0–30 / 31–70 / 71–100) com efeitos | pragas, polinizadores, regeneração | — | ➕ |
| Inventário por slots | **9 slots** iniciais | `Inventory`, 10 slots | 🔧 número |
| Uma ação por clique / dormir avança dia | igual | `Farm` (energia) | ✅ ❓ |
| **Moeda de ouro** (custos e vendas) | central | **não existe** | ➕ crítico |
| Loja da Fazenda (barraca, sempre aberta) | comprar mudas / vender | só `Farm.sell` (move indicador) | ➕ |
| Cooperativa local (1×/semana, limite, +preço, +Comunidade) | novo | — | ➕ |
| Processamento (Fresco→Nibs→Chocolate; Mel) | casas com +dias | — | ➕ |
| Estruturas ocupam tile da fazenda | novo | — | ➕ |
| Bananeira (sombra provisória +1, colhe 2×) | novo | — | ➕ |
| Jequitibá (nativa, colhe mudas, +5% produtividade vizinhos) | novo | `plantTree` genérico | 🔧/➕ |
| Poda (−1 sombra, −2 bio, +1 produtividade; estados Normal/Podada/Cortada) | novo | — | ➕ |
| Ferramentas (tesoura, facão, podão) | novo | tools tree/cacao/harvest | 🔧 |
| Eventos (chuva, fauna, polinizadores, pragas, morcegos, queda de folhas) | novo | — | ➕ |
| Mapa inicial com 2–3 nativas maduras | novo | fazenda vazia | ➕ (fácil) |
| Hover: nome popular + científico | novo (UI) | — | ➕ adapter |
| Narrativa "Fazenda Referência" / menu / sinopse | novo | `MenuScene` genérico | 🔧 conteúdo |

---

## 2. Divergências a ajustar (baixo custo, faz no balance/constantes)

1. **Maturidade da nativa 2 → 10 dias.** `TREE_MATURITY_DAYS` em `ShadeGrid.ts`. Idealmente virar
   config em `balance.ts` (hoje é constante do módulo). Impacto: testes de sombra que assumem 2 dias.
2. **Tempos do cacau.** Tabela do doc: Muda(0) → Broto(1–2) → Floração(3, não produz) → Colheita(4).
   São ~4 dias no total, com um estágio de "floração" que **não é colhível**. Hoje `daysPerCacaoStage=2`
   (8 dias) e não há estágio improdutivo explícito. Ajustar `daysPerCacaoStage` e, se quisermos fidelidade,
   revisar os nomes dos estágios (`crescendo` ≈ floração).
3. **Slots do inventário 10 → 9.** `DEFAULT_SLOT_COUNT` / `balance.slotCount`.
4. **Mapa inicial semeado.** `Farm` deve nascer com 2–3 nativas **já maduras** (seed no construtor,
   parametrizável no `balance`). Melhora o onboarding e a narrativa ("cabruca herdada").

---

## 3. Sistemas novos — como encaixar (core primeiro, adapter depois)

Todos os itens abaixo são **regra** → moram em `src/domain` com teste TDD; o Phaser só desenha e chama.

### 3.1 Moeda de ouro (💰) — **fundação, fazer primeiro**
Hoje a "economia" é só um indicador; o doc trata ouro como recurso real (custos 12/18/50, vendas 18/25).
- Adicionar `_gold` ao `Farm` (+ `startGold` no `balance`), com getters no `snapshot()`.
- `plantTree`/`plantCacao`/`plantBanana` passam a **custar ouro** além de energia.
- `sell()` passa a **creditar ouro** (além de mexer no indicador Economia).
- Novo tipo `Price`/tabela de preços em `balance.ts` (custo de compra e valor de venda por item/muda).
- Decisão ❓: manter energia + ouro (dois recursos) ou ouro só? Recomendo **manter os dois** — energia
  limita ações/dia (já existe e funciona), ouro limita expansão.

### 3.2 Cultivos genéricos — **refactor habilitador**
`Cacao` é uma classe específica e `Farm.cacaos` é um `Map` só de cacau. Banana e (colheita de) Jequitibá
pedem generalização.
- Introduzir `CropDef` (dado, em `balance`/`crop`): estágios, dias/estágio, item gerado, valor,
  **regrows?** (cacau/banana produzem de novo), nº de colheitas (banana = 2), sombra provisória gerada.
- `Cacao` vira caso de `Crop` dirigido por `CropDef` (ou `Crop` genérico + defs `CACAO_DEF`, `BANANA_DEF`).
- `Farm.cacaos` vira `Farm.crops: Map<key, Crop>`. Mantém a interface pública de `snapshot()` estável.
- ❓ **Colheita: cacau some ou reproduz?** Doc diz "Produz continuamente" (tabela) mas regra geral de
  plantio diz "após a colheita o tile fica livre". Hoje o código **remove**. Recomendo: cacau/banana
  **regrow** (volta a um estágio produtivo em N dias); só nativa cortada libera o tile. Precisa bater o martelo.

### 3.3 Sombra provisória (Bananeira)
- `ShadeGrid` calcula sombra só de nativas maduras. Estender para somar **fontes provisórias** (banana)
  que dão +1 e têm duração/decaimento. Opção limpa: `shadeLevelAt` soma nativas maduras **+** bananas
  ativas nos vizinhos. Recalcular no `advanceDay`.
- Banana some/perde a sombra após a duração (incentiva migrar para a nativa madura).

### 3.4 Poda + estados da árvore + espécies nativas
- `Tile 'tree'` ganha: `species` (jequitiba, …), `state` (Normal/Podada/Cortada).
- **Podar** (ferramenta podão/tesoura): −1 sombra da árvore, árvore continua; −2 biodiversidade;
  +1 produtividade nos cacaus na zona. ❓ Poda volta com o tempo (regenera sombra em N dias) — opcional.
- **Cortar** (facão): remove a nativa e **perde o bônus de biodiversidade** (Jequitibá dá +15 enquanto viva).
- **Jequitibá** dá `+5%` produtividade aos cacaueiros próximos e pode ser **colhido** (mudas/sementes,
  valor 12 a cada 3 dias) — vira uma fonte periódica no `advanceDay`.

### 3.5 Processamento (nova pasta `src/domain/processing`)
Cadeia `Cacau Fresco → Nibs → Chocolate` + `Mel`. Estruturas ocupam tile e processam com atraso em dias.
- Modelar `ProcessingStructure` (tipo, receita, fila de jobs com `daysLeft`), avançado no `advanceDay`.
- Itens novos no inventário: `nibs`, `chocolate`, `mel_cacau`, `madeira`, `banana`.
- Receitas/tempos: Fresco→Nibs (+2d), 2 Nibs→Chocolate (+5d), Fresco→Mel (+1d).
- ❓ **Conflito de valores:** texto diz Nibs=5/Chocolate=12; tabela diz Nibs=45/Chocolate=90/Mel=30.
  Precisa fechar a tabela de preços única.
- "Biodiversidade alta aumenta a qualidade do cacau" → multiplicador de valor conforme faixa de bio.

### 3.6 Loja + Cooperativa (`src/domain/shop`)
- **Loja da Fazenda:** comprar mudas (débito de ouro), vender itens — sempre disponível.
- **Cooperativa:** abre a cada 7 dias (contar dia no `Farm`), limite de itens/visita, preço melhor,
  **credita Comunidade**. Reaproveita o mesmo local (só muda o layout no adapter).

### 3.7 Faixas de biodiversidade com efeito
- Bio 0–30: mais pragas, menos polinizadores. 31–70: neutro. 71–100: mais fauna, regeneração, polinização.
- Implementar como **modificadores** consultados no `advanceDay`/eventos (probabilidades e bônus).

### 3.8 Eventos (`src/domain/events`)
- Chuva (dispensa rega — só relevante se adicionarmos rega; hoje não há rega), fauna visitante,
  polinizadores, queda de folhas, surto de pragas, morcegos.
- Motor de eventos rodado no `advanceDay`, com probabilidade dependente das faixas de biodiversidade.
- Determinístico para teste: injetar RNG (seed) — **não** usar `Math.random` direto no core.

---

## 4. Adapter (Phaser) — o que acompanha

- **Ferramentas na hotbar:** adicionar podão/tesoura (podar), facão (cortar), banana; item "colher"
  já existe. Hoje: `tree/cacao/harvest`.
- **HUD de ouro** ao lado da energia/indicadores.
- **UI de Loja/Cooperativa** (painel/barraca) e **UI de processamento** (colocar item na casa).
- **Hover nome popular + científico** (tooltip) — puramente adapter, lê de um mapa de metadados.
- **Menu/Narrativa:** sinopse "Fazenda Referência" na `MenuScene`; tela de fim já existe (reaproveitar).
- Sprites: hoje são placeholders gerados em `assets.ts`; novos itens só precisam de novas `TextureKey`.

---

## 5. Ordem sugerida (habilitadores primeiro)

1. **Ajustes de número** (§2) — maturidade 10d, tempos do cacau, 9 slots, mapa semeado. Barato, alto valor.
2. **Ouro** (§3.1) — recurso que dá sentido a custo/venda/loja.
3. **Cultivos genéricos** (§3.2) — desbloqueia banana e colheita de nativa.
4. **Sombra provisória + Bananeira** (§3.3).
5. **Loja + compra de mudas** (§3.6, parte loja).
6. **Processamento** (§3.5).
7. **Poda / estados / Jequitibá** (§3.4).
8. **Cooperativa** (§3.6, parte cooperativa) + **faixas de bio** (§3.7).
9. **Eventos** (§3.8).
10. **Polimento de adapter** (§4): hover, HUDs, narrativa.

---

## 6. Decisões pendentes (bater o martelo antes de codar)

- ❓ **Cacau na colheita:** reproduz continuamente ou libera o tile? (afeta §3.2 e `Farm.harvest`)
- ❓ **Tabela de preços única:** Nibs/Chocolate/Mel — valores do texto vs. tabela divergem.
- ❓ **Energia + ouro** ou só ouro?
- ❓ **Poda regenera** com o tempo? (custo de implementação vs. profundidade)
- ❓ **Saldo/energia iniciais** e **duração da partida** (doc deixou "Saldo inicial:" em branco).
- ❓ Rega existe? Doc cita "Chuva – não precisa regar", mas não há mecânica de rega hoje.
