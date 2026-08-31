# Dashboard — Delícias da Tereza

Painel de gestão (visão geral + pedidos avulsos). Roda hoje com **dados
fictícios plausíveis** (baseados em números reais das suas planilhas) pra
você já ter algo pra mostrar pra Tereza, sem depender do Supabase/ETL
prontos ainda.

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

## Estrutura

- `lib/types.ts` — os formatos de dado que o dashboard espera. Pensados
  pra bater exatamente com as views que criamos em
  `../supabase/migrations/0001_init.sql` (`vw_resultado_mensal`, etc.),
  assim trocar mock por dado real não muda nada na UI.
- `lib/mockData.ts` — os dados fictícios. **É o único arquivo que muda**
  quando ligarmos no Supabase de verdade — vira uma chamada
  `supabase.from('vw_resultado_mensal').select()` no lugar do array fixo.
- `lib/calculos.ts` — fórmulas (lucro, dízimo, oferta, variação mês a
  mês) — já são as fórmulas reais, não é mock.
- `components/` — peças de UI reutilizadas nas duas páginas.
- `app/visao-geral` e `app/avulsas` — as duas páginas que você descreveu.

## Próximo passo (quando o Supabase estiver liberado)

Trocar `lib/mockData.ts` por `lib/dataSource.ts` com funções `async` que
chamam o Supabase (client já está como dependência no `package.json`), e
marcar as páginas como Server Components ou usar `useEffect`/SWR pra
buscar os dados. A UI não muda.
