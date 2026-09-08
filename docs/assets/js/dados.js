// Consultas ao Supabase pra Visão geral — porta fiel de lib/dados.ts (painel
// Next.js anterior), incluindo a paginação que corrigiu o bug de Junho/2026
// (Lote 27/28) e o critério de contexto/período pelo NOME DO ARQUIVO (Lote 5/8).
import { sb, buscarTodasPaginado } from './supabase-client.js';
import { mesDoArquivo, contextoDoArquivo, anoMesCompacto, num } from './utils.js';

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

  for (const l of pedidosEscola) {
    const mes = mesDoArquivo(l.arquivo_origem);
    if (!mes) continue;
    obterOuCriar(mes).escola += num(l.valor_total);
  }
  for (const l of pedidosAvulsos) {
    const mes = mesDoArquivo(l.arquivo_origem);
    if (!mes) continue;
    obterOuCriar(mes).avulsos += num(l.valor_total);
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
  }

  return Array.from(porMes.entries())
    .map(([mes, v]) => ({
      mes,
      faturamentoEscola: v.escola,
      faturamentoAvulsos: v.avulsos,
      gastos: v.gastosTotal,
      gastosEscola: v.gastosEscola,
      gastosAvulsos: v.gastosAvulsos,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

// "Dias trabalhados" (dias distintos com entrega de verdade) do período/contexto.
export async function buscarDiasTrabalhados(mes, contexto) {
  const prefixo = mes ? anoMesCompacto(mes) : null;
  const datas = new Set();

  if (contexto !== 'AVULSOS') {
    const linhas = await buscarTodasPaginado((inicio, fim) => {
      let q = sb.from('pedidos_escola').select('data, qtd_marmitas, qtd_lanches', { count: 'exact' }).order('id', { ascending: true });
      if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
      return q.range(inicio, fim);
    });
    for (const l of linhas) if (l.data && ((l.qtd_marmitas ?? 0) > 0 || (l.qtd_lanches ?? 0) > 0)) datas.add(l.data);
  }
  if (contexto !== 'ESCOLA') {
    const linhas = await buscarTodasPaginado((inicio, fim) => {
      let q = sb.from('pedidos_avulsos').select('data, qtd_marmitas, qtd_lanches', { count: 'exact' }).order('id', { ascending: true });
      if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
      return q.range(inicio, fim);
    });
    for (const l of linhas) if (l.data && ((l.qtd_marmitas ?? 0) > 0 || (l.qtd_lanches ?? 0) > 0)) datas.add(l.data);
  }
  return datas.size;
}

// Detalhamento do período — SÓ Escola (Lote 30, 2026-09-08): esta tabela
// alimenta o Excel que a Tereza manda pro tesoureiro da escola conferir e
// pagar (mesmo fluxo do Lote 10 do painel Next.js antigo), então ignora de
// propósito o filtro "Contexto" da Visão geral — mesmo com "Escola +
// Avulsos" ou "Só Avulsos" selecionado ali em cima, esta tabela nunca traz
// pedido avulso, pra não arriscar um pedido de cliente avulso ir parar num
// documento pensado pra escola.
//
// Só é chamada com um mês específico selecionado (em "Todos os períodos"
// seria o histórico inteiro de uma vez, o que deixava a Visão geral lenta —
// Lote 28).
export async function buscarDetalhamentoEscola(mes) {
  const prefixo = mes ? anoMesCompacto(mes) : null;
  const linhas = [];

  const dataEscola = await buscarTodasPaginado((inicio, fim) => {
    let q = sb.from('pedidos_escola')
      .select('data, tipo_lancamento, qtd_marmitas, qtd_lanches, valor_total, obs, arquivo_origem', { count: 'exact' })
      .order('id', { ascending: true });
    if (prefixo) q = q.ilike('arquivo_origem', `${prefixo}_%`);
    return q.range(inicio, fim);
  });
  for (const l of dataEscola) {
    linhas.push({
      data: l.data,
      origem: `Escola (${contextoDoArquivo(l.arquivo_origem) ?? '—'})`,
      quem: l.tipo_lancamento === 'PROFESSORES' ? 'Professores' : 'Alunos',
      qtdMarmitas: l.qtd_marmitas ?? 0,
      qtdLanches: l.qtd_lanches ?? 0,
      valorTotal: num(l.valor_total),
      obs: l.obs,
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
    });
  }
  return linhas.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
}

export async function buscarUltimaSincronizacao() {
  const { data, error } = await sb.from('sync_log').select('executado_em').order('executado_em', { ascending: false }).limit(1).maybeSingle();
  if (error) return null;
  return data?.executado_em ?? null;
}
