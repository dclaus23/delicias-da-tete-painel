'use client';

import { Suspense, useMemo } from 'react';
import type { ResultadoMensal, FiltroContexto, DetalheLancamento, GastoDetalhado } from '@/lib/types';
import { faturamentoTotal, variacaoMoM, formatarMoeda, formatarPercentual, anoMesBarra } from '@/lib/calculos';
import BarraFiltros from '@/components/BarraFiltros';
import KpiCard from '@/components/KpiCard';
import GraficoIndicadorMensal from '@/components/GraficoIndicadorMensal';
import TabelaDetalhamento from '@/components/TabelaDetalhamento';
import TabelaGastos from '@/components/TabelaGastos';
import PainelDiasSemanaCaj from '@/components/PainelDiasSemanaCaj';
import TabelaEntregasPorDataCaj from '@/components/TabelaEntregasPorDataCaj';

const NOMES_DIA_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function VisaoGeralClient({
  resultadosMensais,
  meses,
  mesSelecionado,
  contexto,
  detalhamento,
  gastos,
  diasTrabalhados,
}: {
  resultadosMensais: ResultadoMensal[];
  meses: { valor: string; rotulo: string }[];
  mesSelecionado: string;
  contexto: FiltroContexto;
  detalhamento: DetalheLancamento[];
  gastos: GastoDetalhado[];
  diasTrabalhados: number;
}) {
  // mesSelecionado === '' = "Todos os períodos" (Lote 26, 2026-09-08): a
  // Visão geral abre com o agregado de tudo que já foi sincronizado, igual
  // ao Qlik Sense sem filtro nenhum aplicado — só passa a mostrar um mês
  // específico quando o usuário escolhe um no dropdown de Período.
  const todosOsPeriodos = mesSelecionado === '';

  // Soma de todos os meses sincronizados, no mesmo formato de um
  // ResultadoMensal — usado como "atual" no modo "Todos os períodos".
  // Precisa ficar ANTES de qualquer return condicional (ver nota sobre
  // ordem de hooks logo abaixo, em diasTrabalhados).
  const totalAgregado = useMemo(
    () =>
      resultadosMensais.reduce<ResultadoMensal>(
        (acc, r) => ({
          mes: '',
          faturamentoEscola: acc.faturamentoEscola + r.faturamentoEscola,
          faturamentoAvulsos: acc.faturamentoAvulsos + r.faturamentoAvulsos,
          gastos: acc.gastos + r.gastos,
          gastosEscola: acc.gastosEscola + r.gastosEscola,
          gastosAvulsos: acc.gastosAvulsos + r.gastosAvulsos,
        }),
        { mes: '', faturamentoEscola: 0, faturamentoAvulsos: 0, gastos: 0, gastosEscola: 0, gastosAvulsos: 0 }
      ),
    [resultadosMensais]
  );

  const indice = resultadosMensais.findIndex((r) => r.mes === mesSelecionado);
  const atual = todosOsPeriodos ? (resultadosMensais.length > 0 ? totalAgregado : undefined) : resultadosMensais[indice];
  // "Todos os períodos" não tem um "mês anterior" pra comparar — as
  // variações (MoM) simplesmente não aparecem nesse modo, igual ao Qlik
  // Sense sem filtro.
  const anterior = todosOsPeriodos ? undefined : resultadosMensais[indice - 1];
  const anoSelecionado = mesSelecionado.slice(0, 4);

  const faturamentoExibido = useMemo(() => {
    if (!atual) return 0;
    if (contexto === 'ESCOLA') return atual.faturamentoEscola;
    if (contexto === 'AVULSOS') return atual.faturamentoAvulsos;
    return faturamentoTotal(atual);
  }, [atual, contexto]);

  const faturamentoAnteriorExibido = useMemo(() => {
    if (!anterior) return undefined;
    if (contexto === 'ESCOLA') return anterior.faturamentoEscola;
    if (contexto === 'AVULSOS') return anterior.faturamentoAvulsos;
    return faturamentoTotal(anterior);
  }, [anterior, contexto]);

  // Gastos, e por consequência lucro/margem/dízimo/oferta, agora respeitam
  // o filtro de contexto — cada gasto é gravado com o contexto do arquivo
  // de origem (CAJ/BARRA = escola, EXTRA/CASA/SAQUE/CENE = avulsos), então
  // dá pra separar de verdade em vez de só mostrar o total do negócio.
  const gastosExibido = useMemo(() => {
    if (!atual) return 0;
    if (contexto === 'ESCOLA') return atual.gastosEscola;
    if (contexto === 'AVULSOS') return atual.gastosAvulsos;
    return atual.gastos;
  }, [atual, contexto]);

  const gastosAnteriorExibido = useMemo(() => {
    if (!anterior) return undefined;
    if (contexto === 'ESCOLA') return anterior.gastosEscola;
    if (contexto === 'AVULSOS') return anterior.gastosAvulsos;
    return anterior.gastos;
  }, [anterior, contexto]);

  // Dias trabalhados no período: até o Lote 27 era calculado aqui no
  // client, contando DATAS distintas do `detalhamento` completo com
  // entrega de fato (marmita ou lanche > 0) — critério que corrigiu o
  // KPI no Lote 12 (2026-08-30, achado: uma linha sem entrega nenhuma
  // inflava a contagem em 1 dia vs. o Qlik Sense da Tereza). Desde o
  // Lote 28 (2026-09-08) vem pronto do servidor via `buscarDiasTrabalhados`
  // (mesmo critério, só que numa busca bem mais enxuta) — porque em
  // "Todos os períodos" o Detalhamento completo deixou de ser buscado por
  // padrão (ver comentário na seção do Detalhamento, mais abaixo).

  // "Entregas por dia" (por dia da SEMANA) e "Entregas por data" (dia a
  // dia) — painéis ao lado do Detalhamento. Até o Lote 12 vinham de uma
  // consulta separada, só da Escola (CAJ), e por isso sumiam em "Só
  // Avulsos" e nunca refletiam Avulsos/Todos. Desde o Lote 13 são
  // calculados aqui em cima do próprio `detalhamento` (já filtrado por mês
  // + contexto) — mesma fonte de verdade da tabela ao lado, então os
  // números sempre batem e os painéis passam a existir pros três filtros
  // (Escola, Avulsos, Escola + Avulsos). Domingo e sábado entram no cálculo
  // porque pedidos avulsos podem acontecer em qualquer dia da semana (só a
  // escola nunca entrega fim de semana, então esses dias ficam zerados
  // quando o filtro é Só Escola).
  const diasSemanaResumo = useMemo(() => {
    const acumulado = NOMES_DIA_SEMANA.map(() => ({ qtdMarmitas: 0, qtdLanches: 0, valorTotal: 0 }));
    for (const l of detalhamento) {
      if (!l.data) continue;
      // "data" vem como "AAAA-MM-DD" — fixa meio-dia UTC pra não sofrer
      // off-by-one de fuso horário na hora de descobrir o dia da semana.
      const indiceDia = new Date(`${l.data}T12:00:00Z`).getUTCDay();
      const atual = acumulado[indiceDia];
      atual.qtdMarmitas += l.qtdMarmitas;
      atual.qtdLanches += l.qtdLanches;
      atual.valorTotal += l.valorTotal;
    }
    return NOMES_DIA_SEMANA.map((diaSemana, i) => ({ diaSemana, ...acumulado[i] }));
  }, [detalhamento]);

  const entregasPorData = useMemo(() => {
    const acumulado = new Map<string, { qtdMarmitas: number; qtdLanches: number; valorTotal: number }>();
    for (const l of detalhamento) {
      if (!l.data) continue;
      const atual = acumulado.get(l.data) ?? { qtdMarmitas: 0, qtdLanches: 0, valorTotal: 0 };
      atual.qtdMarmitas += l.qtdMarmitas;
      atual.qtdLanches += l.qtdLanches;
      atual.valorTotal += l.valorTotal;
      acumulado.set(l.data, atual);
    }
    return Array.from(acumulado.entries())
      .map(([data, v]) => ({ data, ...v }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [detalhamento]);

  if (!atual) {
    return (
      <div className="flex flex-col gap-6">
        <Suspense fallback={null}>
          <BarraFiltros meses={meses} permitirTodosPeriodos />
        </Suspense>
        <div className="rounded-lg border border-cafe/8 bg-white p-6 text-center text-sm text-tinta/55 shadow-cartao">
          Ainda não há dados sincronizados. Confira se o vigia já rodou pelo menos uma vez.
        </div>
      </div>
    );
  }

  const lucroExibido = faturamentoExibido - gastosExibido;
  const lucroAnteriorExibido =
    faturamentoAnteriorExibido !== undefined && gastosAnteriorExibido !== undefined
      ? faturamentoAnteriorExibido - gastosAnteriorExibido
      : undefined;
  const margemExibida = faturamentoExibido === 0 ? 0 : lucroExibido / faturamentoExibido;
  const dizimoExibido = lucroExibido * 0.1;
  const ofertaExibido = lucroExibido * 0.1;

  const varFaturamento = variacaoMoM(faturamentoExibido, faturamentoAnteriorExibido);
  const varGastos = variacaoMoM(gastosExibido, gastosAnteriorExibido);
  const varLucro = variacaoMoM(lucroExibido, lucroAnteriorExibido);

  // Rótulo do período selecionado (ex.: "ago de 2026", ou "Todos os
  // períodos") — usado no nome do arquivo Excel exportado do Detalhamento.
  const mesRotulo = todosOsPeriodos
    ? 'Todos os períodos'
    : meses.find((m) => m.valor === mesSelecionado)?.rotulo ?? mesSelecionado;

  // Rótulo do contexto pros subtítulos dos painéis "Entregas por dia/data".
  const rotuloContexto = contexto === 'ESCOLA' ? 'Escola' : contexto === 'AVULSOS' ? 'Avulsos' : 'Escola + Avulsos';

  // Gráficos mostram só o ano selecionado (eixo Mês/Ano) quando um período
  // específico está escolhido — mais fácil de ler os números em cada
  // barra. Em "Todos os períodos" mostram a série histórica inteira, igual
  // ao Qlik Sense sem filtro (Lote 26, 2026-09-08).
  const resultadosDoAno = todosOsPeriodos
    ? resultadosMensais
    : resultadosMensais.filter((r) => r.mes.startsWith(anoSelecionado));

  const dadosFaturamento = resultadosDoAno.map((r) => ({
    mes: r.mes,
    valor: contexto === 'ESCOLA' ? r.faturamentoEscola : contexto === 'AVULSOS' ? r.faturamentoAvulsos : faturamentoTotal(r),
  }));
  const dadosGastos = resultadosDoAno.map((r) => ({
    mes: r.mes,
    valor: contexto === 'ESCOLA' ? r.gastosEscola : contexto === 'AVULSOS' ? r.gastosAvulsos : r.gastos,
  }));
  const dadosLucro = resultadosDoAno.map((r) => {
    const fat = contexto === 'ESCOLA' ? r.faturamentoEscola : contexto === 'AVULSOS' ? r.faturamentoAvulsos : faturamentoTotal(r);
    const gas = contexto === 'ESCOLA' ? r.gastosEscola : contexto === 'AVULSOS' ? r.gastosAvulsos : r.gastos;
    return { mes: r.mes, valor: fat - gas };
  });

  // Em "Todos os períodos" o gráfico cruza vários anos, então o rótulo de
  // cada barra passa a incluir o ano em vez de só o mês (nomeMesCurto, o
  // padrão) — do contrário "ago" ficaria ambíguo entre 2025 e 2026, por
  // exemplo. Formato "AAAA/MM" (anoMesBarra), igual ao Qlik Sense — a
  // primeira versão usava "ago de 26", que a Tereza achou confuso (Lote
  // 27, 2026-09-08).
  const formatarRotuloMes = todosOsPeriodos ? anoMesBarra : undefined;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-cafe">Visão geral</h1>
          <p className="text-sm text-tinta/55">Faturamento, gastos e lucro consolidados</p>
        </div>
        <Suspense fallback={null}>
          <BarraFiltros meses={meses} permitirTodosPeriodos />
        </Suspense>
      </header>

      {/* grid-cols-2 base + sm:grid-cols-3 evita que os cards fiquem
         apertados demais em telas de celular estreitas (< 640px) — sem
         esse degrau intermediário, os 7 KPIs ficavam só em 2 colunas até
         a tela virar desktop, e valores mais longos (ex.: "-146,1%")
         empurravam o card e "atropelavam" o vizinho (reportado pela
         Tereza no Lote 27, 2026-09-08). O resto da correção — min-w-0 e
         o tamanho de fonte responsivo — está no próprio KpiCard. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <KpiCard
          rotulo="Faturamento"
          valor={formatarMoeda(faturamentoExibido)}
          variacao={varFaturamento !== null ? formatarPercentual(varFaturamento) : undefined}
          cor="dourado"
        />
        <KpiCard
          rotulo="Gastos"
          valor={formatarMoeda(gastosExibido)}
          variacao={varGastos !== null ? formatarPercentual(varGastos) : undefined}
          cor="terracota"
        />
        <KpiCard
          rotulo="Lucro"
          valor={formatarMoeda(lucroExibido)}
          variacao={varLucro !== null ? formatarPercentual(varLucro) : undefined}
          cor="sucesso"
        />
        <KpiCard rotulo="% de lucro" valor={formatarPercentual(margemExibida)} cor="petroleo" />
        <KpiCard rotulo="Dias trabalhados" valor={String(diasTrabalhados)} cor="petroleo" />
        <KpiCard rotulo="Dízimo (10%)" valor={formatarMoeda(dizimoExibido)} cor="vinho" />
        <KpiCard rotulo="Oferta (10%)" valor={formatarMoeda(ofertaExibido)} cor="vinho" />
      </section>

      <section className="grid grid-cols-1 gap-4">
        <GraficoIndicadorMensal
          titulo="Faturamento"
          dados={dadosFaturamento}
          mesSelecionado={mesSelecionado}
          cor="#E3A63E"
          formatarRotuloMes={formatarRotuloMes}
        />
        <GraficoIndicadorMensal
          titulo="Gastos"
          dados={dadosGastos}
          mesSelecionado={mesSelecionado}
          cor="#B5651D"
          formatarRotuloMes={formatarRotuloMes}
        />
        <GraficoIndicadorMensal
          titulo="Lucro"
          dados={dadosLucro}
          mesSelecionado={mesSelecionado}
          cor="#3C8558"
          formatarRotuloMes={formatarRotuloMes}
        />
      </section>

      {/* Em "Todos os períodos" o Detalhamento/Gastos linha a linha e os
         painéis de entregas por dia/data não são buscados por padrão (ver
         app/visao-geral/page.tsx, Lote 28, 2026-09-08) — seriam milhares
         de linhas de pedido de uma vez só, o que só deixava a página mais
         lenta sem servir pra muita coisa (ninguém lê um extrato de 2 anos
         numa tabela só). Os KPIs e gráficos acima continuam batendo com o
         total agregado normalmente; pra ver os lançamentos, basta
         selecionar um período específico no filtro. */}
      {todosOsPeriodos ? (
        <div className="rounded-lg border border-cafe/8 bg-white p-6 text-center text-sm text-tinta/55 shadow-cartao">
          Selecione um período específico no filtro acima pra ver o detalhamento e os gastos linha a linha.
        </div>
      ) : (
        <>
          {/* items-start é essencial aqui: por padrão o grid estica os dois
             filhos pra mesma altura (align-items: stretch), então o card do
             Detalhamento ficava tão alto quanto a coluna da direita (os dois
             painéis empilhados) mesmo quando a própria tabela era bem mais
             curta — sobrava um espaço em branco enorme dentro do card, embaixo
             da tabela (reportado pela Tereza no Lote 13, 2026-08-30). Com
             items-start cada coluna só cresce até a altura do seu próprio
             conteúdo. */}
          <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TabelaDetalhamento linhas={detalhamento} mesRotulo={mesRotulo} />
            </div>
            <div className="flex flex-col gap-4 lg:col-span-1">
              <PainelDiasSemanaCaj dias={diasSemanaResumo} rotuloContexto={rotuloContexto} />
              <TabelaEntregasPorDataCaj dias={entregasPorData} rotuloContexto={rotuloContexto} />
            </div>
          </section>
          <TabelaGastos gastos={gastos} />
        </>
      )}
    </div>
  );
}
