# Plano da Jam — 05 a 11 de julho de 2026

Planejado **de trás para frente**, a partir do entregável. Time: **Sr.** (dev fullstack TS) e **QA** (Jr. com base em dev).

## Entregável final (dia 11, sáb)

Uma **build web jogável** que demonstra o loop e o diferencial:
1. Plantar nativas e cacau numa grade.
2. Sombra afetando o cacau (morre no sol, cresce no ideal).
3. Dormir avança o dia; colher; inventário enche.
4. Vender move a Economia; os **três indicadores** se movem e há um estado de vitória/derrota por equilíbrio.
5. Rodar no navegador, sem instalar nada, + os `docs/` (ADRs, domínio) para a banca.

## Regra de escopo (MoSCoW)

- **Must:** grade+sombra, cacau (crescer/morrer/colher), dormir/dia, inventário, indicadores, vender, tela de fim.
- **Should:** cadeia de processamento (fresco→nibs→chocolate), loja de compra, energia.
- **Could:** polinização, poda, feiras, turistas, save.
- **Won't (nesta jam):** multiplayer, áudio elaborado, expansão de mapa.

## Cronograma (backwards)

| Dia | Data | Foco | Sr. (dev) | QA (Jr.) |
|---|---|---|---|---|
| **D-final** | 11 sáb | Congelar & apresentar | Bugfix crítico, build de deploy, roteiro da demo | Smoke test final, checklist de aceite, gravar demo |
| **D-1** | 10 sex | **Feature freeze** + polimento | Fechar tela de fim, feedback visual de sombra/indicadores | QA exploratória por feature, lista de bugs priorizada |
| **D-2** | 09 qui | Economia & fim de jogo | Loja (comprar/vender), condição vitória/derrota via `Indicators` | TDD dos deltas de indicadores, testes de venda |
| **D-3** | 08 qua | Integração do loop | Ligar UI ao core: dormir → crescer → colher → inventário | QA do loop completo, casos de borda do inventário |
| **D-4** | 07 ter | Adapter Phaser | Render da grade/sprites, input de plantio, "dormir" | Testes do `Cacao` (morte/lentidão), checklist visual |
| **D-5** | 06 seg | Core + design travado | Orquestrador de turno (dia), integrar `ShadeGrid`+`Cacao` | Preencher lacunas do doc (slots, preços), casos de teste |
| **D-6** | 05 dom (hoje) | **Fundação** ✅ | Esqueleto, ADRs, core (sombra/cacau/inventário/indicadores) + 28 testes | Ler `docs/`, revisar regras, preparar plano de teste |

## Divisão de trabalho

**Sr. (fullstack):** arquitetura, orquestrador de turno, adapter Phaser, integração, decisões de balanceamento. Dono do fluxo core→adapter.

**QA (Jr.):** dono do **core testado** — ótimo para crescer: escrever/ampliar testes de `ShadeGrid`, `Cacao`, `Inventory`, `Indicators` (regras claras, feedback imediato do Vitest). Além disso, QA exploratória da build e checklist de aceite. Pareamento no D-2/D-3 para os deltas de indicadores.

## Rituais leves (SDD sem burocracia)

- **Daily de 10 min** (manhã): o que trava, o que entra no dia.
- **1 ADR por decisão irreversível** — curto, no formato de `docs/adr/`.
- **`docs/dominio.md` é o contrato**: mudou regra → muda o doc e o teste juntos.
- **Verde antes de dormir**: `npm test` passando ao fim de cada dia.

## Riscos & mitigação

- *Escopo explode* → MoSCoW acima; corte "Could" sem dó.
- *Integração core↔Phaser atrasa* → começar o adapter no D-4 com o core já pronto.
- *Balanceamento consome tempo* → constantes centralizadas + script headless para simular dias.
- *Bus factor (2 pessoas)* → core testado documenta o comportamento; QA domina as regras.
