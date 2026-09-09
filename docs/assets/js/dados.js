// Consultas ao Supabase pra Visão geral — porta fiel de lib/dados.ts (painel
// Next.js anterior), incluindo a paginação que corrigiu o bug de Junho/2026
// (Lote 27/28) e o critério de contexto/período pelo NOME DO ARQUIVO (Lote 5/8).
import { sb, buscarTodasPaginado } from './supabase-client.js';
import { mesDoArquivo, contextoDoArquivo, anoMesCompacto, anoMesBarra, num } from './utils.js';

const NOMES_COLABORADORES = ['vanessa', 'guacira'];

let _mapaContextoEscolaCache = null;
async function buscarMapaContextoEscolaPorNome() {
  if (_mapaContextoEscolaCache) return _mapaContextoEscolaCache;
  const { data, error } = await sb.from('contextos').select('nome, eh_contrato_escola');
  if (error) throw error;
  _mapaContextoEscolaCache = new Map((data ?? []).map((c) => [c.nome.toUpperCase(), c.eh_contrato_escola]));
  return _mapaContextoEscolaCache;
}

// Agregado mês a mês de TODO o histórico já sincronizado — alimenta os
// gráficos, o dropdown de Período e (somado) os KPIs de "Todos os períodos".
//
// Lote 35 (2026-09-09): junto com o agregado por mês, monta também um
// agregado por ARQUIVO (mesmos dados já buscados, sem nenhuma consulta
// extra) — alimenta o filtro "Arquivo" da Visão geral com a lista completa
// de arquivos de todo o histórico (não só do mês selecionado) e permite os
// indicadores (Faturamento/Gastos/Lucro) refletirem um arquivo específico,
// não só o mês inteiro. Pedido do David depois do Lote 34 (o filtro só
// afetava as tabelas, não os KPIs, e só aparecia com um período escolhido).
export async function buscarResultadosMensais() {
  const [pedidosEscola, pedidosAvulsos, gastos, mapaContextoEscola] = await Promise.all([
    buscarTodasPaginado((inicio, fim) =>
      sb.from('pedidos_escola').select('valor_total, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true }).range(inicio, fim)),
    buscarTodasPaginado((inicio, fim) =>
      sb.from('pedidos_avulsos').select('valor_total, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true }).range(inicio, fim)),
    buscarTodasPaginado((inicio, fim) =>
      sb.from('gastos').select('valor, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true }).range(inicio, fim)),
    buscarMapaContextoEscolaPorNome(),
  ]);

  const porMes = new Map();
  function obterOuCriar(mes) {
    const atual = porMes.get(mes) ?? { escola: 0, avulsos: 0, gastosTotal: 0, gastosEscola: 0, gastosAvulsos: 0 };
    porMes.set(mes, atual);
    return atual;
  }

  const porArquivoMap = new Map();
  function obterArquivo(arquivo, mes) {
    if (!arquivo) return null;
    if (!porArquivoMap.has(arquivo)) porArquivoMap.set(arquivo, { arquivo, mes, faturamento: 0, gastos: 0 });
    return porArquivoMap.get(arquivo);
  }

  for (const l of pedidosEscola) {
    const mes = mesDoArquivo(l.arquivo_origem);
    if (!mes) continue;
    obterOuCriar(mes).escola += num(l.valor_total);
    const a = obterArquivo(l.arquivo_origem, mes);
    if (a) a.faturamento += num(l.valor_total);
  }
  for (const l of pedidosAvulsos) {
    const mes = mesDoArquivo(l.arquivo_origem);
    if (!mes) continue;
    obterOuCriar(mes).avulsos += num(l.valor_total);
    const a = obterArquivo(l.arquivo_origem, mes);
    if (a) a.faturamento += num(l.valor_total);
  }
  for (const l of gastos) {
    const mes = mesDoArquivo(l.arquivo_origem);
    if (!mes) continue;
    const atual = obterOuCriar(mes);
    const valorBruto = num(l.valor);
    atual.gastosTotal += valorBruto;
    const token = contextoDoArquivo(l.arquivo_origem);
    const ehEscola = token ? mapaContextoEscola.get(token) : undefined;
    if (ehEscola === true) atual.gastosEscola += valorBruto;
    else if (ehEscola === false) atual.gastosAvulsos += valorBruto;
    const a = obterArquivo(l.arquivo_origem, mes);
    if (a) a.gastos += valorBruto;
  }

  const resultados = Array.from(porMes.entries())
    .map(([mes, v]) => ({
      mes,
      faturamentoEscola: v.escola,
      faturamentoAvulsos: v.avulsos,
      gastos: v.gastosTotal,
      gastosEscola: v.gastosEscola,
      gastosAvulsos: v.gastosAvulsos,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  const porArquivo = Array.from(porArquivoMap.values()).sort((a, b) => a.arquivo.localeCompare(b.arquivo));

  return { resultados, porArquivo };
}

// "Dias trabalhados" (dias distintos com entrega de verdade) do
// período/contexto — opcionalmente restrito a um arquivo específico (Lote
// 35), pro filtro "Arquivo" também refletir nesse KPI. Um arquivo de Gastos
// nunca bate com nenhuma linha de pedidos, então nesse caso o resultado é
// 0 — correto, um arquivo de Gastos não tem "dias trabalhados" próprios.
export async function buscarDiasTrabalhados(mes, contexto, arquivo = null) {
  const prefixo = mes ? anoMesCompacto(mes) : null;
  const datas = new Set();

  if (contexto !== 'AVULSOS') {
    const linhas = await buscarTodasPaginado((inicio, fim) => {
      let q = sb.from('pedidos_escola').select('data, qtd_marmitas, qtd_lanches, arquivo_origem', { count: 'exact' }).order('id', { ascending: true });
      if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
      return q.range(inicio, fim);
    });
    for (const l of linhas) {
      if (arquivo && l.arquivo_origem !== arquivo) continue;
      if (l.data && ((l.qtd_marmitas ?? 0) > 0 || (l.qtd_lanches ?? 0) > 0)) datas.add(l.data);
    }
  }
  if (contexto !== 'ESCOLA') {
    const linhas = await buscarTodasPaginado((inicio, fim) => {
      let q = sb.from('pedidos_avulsos').select('data, qtd_marmitas, qtd_lanches, arquivo_origem', { count: 'exact' }).order('id', { ascending: true });
      if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
      return q.range(inicio, fim);
    });
    for (const l of linhas) {
      if (arquivo && l.arquivo_origem !== arquivo) continue;
      if (l.data && ((l.qtd_marmitas ?? 0) > 0 || (l.qtd_lanches ?? 0) > 0)) datas.add(l.data);
    }
  }
  return datas.size;
}

// Detalhamento do período — SÓ Escola (Lote 30/31, 2026-09-08/09): esta
// tabela alimenta o Excel que a Tereza manda pro tesoureiro da escola
// conferir e pagar (mesmo fluxo do Lote 10 do painel Next.js antigo), então
// ignora de propósito o filtro "Contexto" da Visão geral — mesmo com
// "Escola + Avulsos" ou "Só Avulsos" selecionado ali em cima, esta tabela
// nunca traz pedido avulso, pra não arriscar um pedido de cliente avulso ir
// parar num documento pensado pra escola.
//
// Colunas replicadas 1:1 do relatório "Detalhamento | Entregas" que a
// Tereza já usa no Qlik Sense (Lote 31) — inclusive o valor unitário de
// marmita/lanche (guardado por linha no Supabase, não recalculado) e a
// separação Valor Total Lanches / Valor Total Marmitas (qtd × unitário; a
// soma dos dois bate com `valor_total`, conferido por SQL). `pedidos_escola`
// não tem coluna de status/valor pago nem data de pagamento (isso só existe
// pra Avulsos) — no relatório original do Qlik "Valor a ser pago" e "Valor
// pago" sempre saem iguais pra Escola e "Data pagamento" sempre em branco,
// então replicamos exatamente esse comportamento aqui em vez de inventar um
// dado que não existe.
//
// Só é chamada com um mês específico selecionado (em "Todos os períodos"
// seria o histórico inteiro de uma vez, o que deixava a Visão geral lenta —
// Lote 28).
export async function buscarDetalhamentoEscola(mes) {
  const prefixo = mes ? anoMesCompacto(mes) : null;
  const linhas = [];

  const dataEscola = await buscarTodasPaginado((inicio, fim) => {
    let q = sb.from('pedidos_escola')
      .select('data, qtd_marmitas, qtd_lanches, valor_unit_marmita, valor_unit_lanche, valor_total, obs, arquivo_origem', { count: 'exact' })
      .order('id', { ascending: true });
    if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
    return q.range(inicio, fim);
  });
  for (const l of dataEscola) {
    const qtdMarmitas = l.qtd_marmitas ?? 0;
    const qtdLanches = l.qtd_lanches ?? 0;
    const valorUnitMarmita = num(l.valor_unit_marmita);
    const valorUnitLanche = num(l.valor_unit_lanche);
    const valorASerPago = num(l.valor_total);
    const mesArquivo = mesDoArquivo(l.arquivo_origem);
    linhas.push({
      anoMes: mesArquivo ? anoMesBarra(mesArquivo) : null,
      data: l.data,
      qtdMarmitas,
      qtdLanches,
      valorUnitLanche,
      valorUnitMarmita,
      valorTotalLanches: qtdLanches * valorUnitLanche,
      valorTotalMarmitas: qtdMarmitas * valorUnitMarmita,
      valorASerPago,
      valorPago: valorASerPago,
      obs: l.obs,
      dataPagamento: null,
      // Lote 34 (2026-09-09): nome do arquivo de origem, pra alimentar o
      // filtro "Arquivo" da Visão geral — o David pediu depois de precisar
      // caçar na mão em qual arquivo estava um valor divergente do Qlik.
      arquivo: l.arquivo_origem ?? null,
    });
  }
  return linhas.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
}

// Gastos do período — mesmo critério (contexto pelo nome do arquivo, sem rateio).
export async function buscarGastosDetalhado(mes, contexto) {
  const prefixo = mes ? anoMesCompacto(mes) : null;
  const [data, mapaContextoEscola] = await Promise.all([
    buscarTodasPaginado((inicio, fim) => {
      let q = sb.from('gastos').select('data, pessoa_local, tipo_pagamento, valor, arquivo_origem', { count: 'exact' }).order('id', { ascending: true });
      if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
      return q.range(inicio, fim);
    }),
    buscarMapaContextoEscolaPorNome(),
  ]);

  const linhas = [];
  for (const l of data) {
    const token = contextoDoArquivo(l.arquivo_origem);
    const ehEscola = token ? mapaContextoEscola.get(token) : undefined;
    if (contexto === 'ESCOLA' && ehEscola !== true) continue;
    if (contexto === 'AVULSOS' && ehEscola !== false) continue;
    const pessoa = (l.pessoa_local ?? '').trim().toLowerCase();
    linhas.push({
      data: l.data,
      pessoaLocal: l.pessoa_local ?? '—',
      tipoPagamento: l.tipo_pagamento ?? '—',
      valor: num(l.valor),
      destaque: NOMES_COLABORADORES.includes(pessoa),
      // Lote 34: idem Detalhamento — nome do arquivo pro filtro "Arquivo".
      arquivo: l.arquivo_origem ?? null,
    });
  }
  return linhas.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
}

export async function buscarUltimaSincronizacao() {
  const { data, error } = await sb.from('sync_log').select('executado_em').order('executado_em', { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  return data?.executado_em ?? null;
}
