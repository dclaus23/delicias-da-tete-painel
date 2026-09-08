import { supabaseServer } from './supabaseServer';
import { mesAnterior } from './calculos';
import { encontrarCelular, montarMensagemCobranca, montarLinkWhatsApp } from './whatsapp';
import type {
  ResultadoMensal,
  ClienteResumo,
  PratoComparativo,
  Pendencia,
  Cobranca,
  FiltroContexto,
  DetalheLancamento,
  GastoDetalhado,
  ResumoAvulsosMes,
} from './types';

// Nomes exatos como aparecem na coluna "Pessoa/lugar" da aba Gastos —
// usado só pra destacar visualmente pagamento a colaboradoras na tabela de
// gastos da Visão geral (confirmado com a Tereza em 2026-08-30).
const NOMES_COLABORADORES = ['Vanessa', 'Guacira'];

// O Supabase/PostgREST limita cada resposta a no máximo 1000 linhas por
// padrão, mesmo sem VOCÊ ter pedido limite nenhum — silenciosamente, sem
// erro. pedidos_escola já passou de 1000 linhas em 2026-09, então um
// select sem filtro de arquivo_origem (como o dos gráficos/KPIs da Visão
// geral, que somam TODO o histórico) vinha voltando cortado bem nas linhas
// mais recentes. Foi ISSO que causou o Faturamento errado de Junho/2026
// reportado pela Tereza (Lote 27, 2026-09-08) — confirmado direto no
// banco.
//
// `construir(inicio, fim)` deve pedir `{ count: 'exact' }` no `.select()`
// pra esse helper saber o total de linhas já na primeira página (sem isso,
// ele cai pra buscar página por página até a última vir incompleta — mais
// lento). Com o total em mãos, todas as páginas seguintes são buscadas
// em PARALELO (Promise.all), não uma de cada vez — isso corta bastante o
// tempo de resposta em tabelas grandes (Lote 28, 2026-09-08: a busca
// sequencial de página em página foi identificada como parte do motivo da
// Visão geral demorar pra responder em "Todos os períodos").
async function buscarTodasPaginado(
  construir: (
    inicio: number,
    fim: number
  ) => PromiseLike<{ data: any[] | null; error: any; count?: number | null }>
): Promise<any[]> {
  const TAMANHO_PAGINA = 1000;
  const { data: primeira, error: erroPrimeira, count } = await construir(0, TAMANHO_PAGINA - 1);
  if (erroPrimeira) throw erroPrimeira;
  const linhasPrimeira = primeira ?? [];

  // Sem `count` (não deveria acontecer, já que todo call-site pede
  // `{ count: 'exact' }`) ou página não cheia: não tem mais o que buscar.
  if (!count || linhasPrimeira.length < TAMANHO_PAGINA) {
    return linhasPrimeira;
  }

  const totalPaginas = Math.ceil(count / TAMANHO_PAGINA);
  if (totalPaginas <= 1) return linhasPrimeira;

  const paginasRestantes = await Promise.all(
    Array.from({ length: totalPaginas - 1 }, (_, i) => {
      const pagina = i + 1;
      const inicio = pagina * TAMANHO_PAGINA;
      return construir(inicio, inicio + TAMANHO_PAGINA - 1);
    })
  );

  const todas = linhasPrimeira.slice();
  for (const { data, error } of paginasRestantes) {
    if (error) throw error;
    todas.push(...(data ?? []));
  }
  return todas;
}

// Converte "2026-03-01" (date do Postgres) -> "2026-03" (formato usado no front)
function paraMesIso(data: string) {
  return data.slice(0, 7);
}

function diasEntre(dataIso: string) {
  const hoje = new Date();
  const data = new Date(dataIso);
  return Math.max(0, Math.floor((hoje.getTime() - data.getTime()) / 86400000));
}

// [inicio, fim) de um mês "2026-08" -> { inicio: "2026-08-01", fim: "2026-09-01" }
function limitesDoMes(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const inicio = `${mesIso}-01`;
  const fim = new Date(ano, mes, 1).toISOString().slice(0, 10);
  return { inicio, fim };
}

type RelacaoContexto = { nome: string } | { nome: string }[] | null;

function nomeContexto(contextos: RelacaoContexto) {
  if (!contextos) return '—';
  if (Array.isArray(contextos)) return contextos[0]?.nome ?? '—';
  return contextos.nome ?? '—';
}

// Extrai "AAAA-MM" do nome do arquivo de origem (padrão
// "AAAAMM_CONTEXTO - Marmitas e Lanches.xlsx", ex.: "202608_CAJ - ...").
// Preferido sobre a coluna `data` de cada linha pra agrupar por mês na
// Visão geral — o período do arquivo é a referência real da Tereza, e uma
// semana de entregas pode ter datas que cruzam pro mês seguinte/anterior.
function mesDoArquivo(arquivoOrigem: string | null | undefined): string | null {
  if (!arquivoOrigem) return null;
  const m = arquivoOrigem.match(/^(\d{4})(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// Extrai o token de contexto do nome do arquivo (ex.: "202608_CAJ - ..." -> "CAJ")
function contextoDoArquivo(arquivoOrigem: string | null | undefined): string | null {
  if (!arquivoOrigem) return null;
  const m = arquivoOrigem.match(/^\d{6}_([A-Za-zÀ-ÿ]+)/);
  return m ? m[1].toUpperCase() : null;
}

// "2026-08" -> "202608", pra casar com o prefixo do arquivo_origem
function anoMesCompacto(mesIso: string) {
  return mesIso.replace('-', '');
}

// "2026-08" -> "2026/08", mesmo formato da coluna "Ano/Mês (Lançamentos)"
// da planilha da Tereza.
function anoMesComBarra(mesIso: string) {
  return mesIso.replace('-', '/');
}

// nome do contexto (token igual ao extraído do nome do arquivo, ex.: "CAJ")
// -> true (escola, CAJ/BARRA) | false (avulsos, EXTRA/CASA/...).
//
// Usado só pros Gastos: assim como faturamento e Detalhamento, o contexto de
// cada gasto vem do NOME DO ARQUIVO de origem (mesmo critério do Lote 5),
// não das colunas `contexto_id`/`compartilhado`/`percentual_rateio` da
// tabela `gastos` — essas colunas ficaram desatualizadas em relação ao
// jeito real como a Tereza organiza os arquivos (confirmado por ela em
// 2026-08-30: um gasto pertence inteiro ao contexto do arquivo onde foi
// lançado, sem rateio percentual entre Escola e Avulsos).
async function buscarMapaContextoEscolaPorNome(): Promise<Map<string, boolean>> {
  const { data, error } = await supabaseServer.from('contextos').select('nome, eh_contrato_escola');
  if (error) throw error;
  return new Map((data ?? []).map((c) => [(c.nome as string).toUpperCase(), c.eh_contrato_escola as boolean]));
}

export async function buscarResultadosMensais(): Promise<ResultadoMensal[]> {
  // Não usa mais as views vw_faturamento_mensal/vw_gastos_mensal (que
  // agrupam por date_trunc da coluna `data`) — os gráficos e KPIs da Visão
  // geral agora agrupam pelo mês/ano do NOME DO ARQUIVO de origem.
  //
  // Paginado (ver buscarTodasPaginado acima) — essas três consultas somam
  // TODO o histórico, sem filtro nenhum, e pedidos_escola/gastos já passam
  // de 1000 linhas.
  const [pedidosEscola, pedidosAvulsos, gastos, mapaContextoEscola] = await Promise.all([
    buscarTodasPaginado((inicio, fim) =>
      supabaseServer
        .from('pedidos_escola')
        .select('valor_total, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true })
        .range(inicio, fim)
    ),
    buscarTodasPaginado((inicio, fim) =>
      supabaseServer
        .from('pedidos_avulsos')
        .select('valor_total, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true })
        .range(inicio, fim)
    ),
    buscarTodasPaginado((inicio, fim) =>
      supabaseServer
        .from('gastos')
        .select('valor, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true })
        .range(inicio, fim)
    ),
    buscarMapaContextoEscolaPorNome(),
  ]);

  const porMes = new Map<
    string,
    { escola: number; avulsos: number; gastosTotal: number; gastosEscola: number; gastosAvulsos: number }
  >();

  function obterOuCriar(mes: string) {
    const atual = porMes.get(mes) ?? { escola: 0, avulsos: 0, gastosTotal: 0, gastosEscola: 0, gastosAvulsos: 0 };
    porMes.set(mes, atual);
    return atual;
  }

  for (const linha of pedidosEscola) {
    const mes = mesDoArquivo(linha.arquivo_origem as string);
    if (!mes) continue;
    obterOuCriar(mes).escola += Number(linha.valor_total) || 0;
  }
  for (const linha of pedidosAvulsos) {
    const mes = mesDoArquivo(linha.arquivo_origem as string);
    if (!mes) continue;
    obterOuCriar(mes).avulsos += Number(linha.valor_total) || 0;
  }
  for (const linha of gastos) {
    const mes = mesDoArquivo(linha.arquivo_origem as string);
    if (!mes) continue;
    const atual = obterOuCriar(mes);
    const valorBruto = Number(linha.valor) || 0;
    // O total geral sempre soma o valor cheio de cada gasto. Pra separar em
    // Escola/Avulsos, o contexto vem do nome do arquivo (igual faturamento e
    // Detalhamento) — o gasto conta inteiro pro lado do arquivo onde foi
    // lançado, sem rateio percentual.
    atual.gastosTotal += valorBruto;
    const token = contextoDoArquivo(linha.arquivo_origem as string);
    const ehEscola = token ? mapaContextoEscola.get(token) : undefined;
    if (ehEscola === true) atual.gastosEscola += valorBruto;
    else if (ehEscola === false) atual.gastosAvulsos += valorBruto;
    // contexto desconhecido/não reconhecido: entra só no total geral, já que
    // não dá pra saber de qual lado é.
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

type LinhaPedidoAvulso = {
  cliente_nome_bruto: string | null;
  valor_total: number;
  descricao_pedido: string | null;
  data: string;
  contextos: RelacaoContexto;
};

// Clientes do mês selecionado (pedidos/valor/prato favorito são só desse
// mês), mas "recorrente" considera o histórico inteiro do cliente — por
// isso a busca sempre traz todos os pedidos, não só os do mês.
//
// Só entram aqui linhas com "Quem pediu?" preenchido — linhas sem nome não
// têm como virar uma linha de cliente. Pra não sumir com essas vendas nos
// KPIs de topo, use buscarResumoAvulsosMes() em paralelo (soma TODAS as
// linhas do mês, com ou sem nome).
export async function buscarClientesResumo(mes: string): Promise<ClienteResumo[]> {
  // Paginado (ver buscarTodasPaginado) — pedidos_avulsos está perto de 1000
  // linhas e essa busca não tem filtro de mês (precisa do histórico
  // inteiro pra calcular "recorrente").
  const data = await buscarTodasPaginado((inicio, fim) =>
    supabaseServer
      .from('pedidos_avulsos')
      .select('cliente_nome_bruto, valor_total, descricao_pedido, data, contextos(nome)', { count: 'exact' })
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, fim)
  );

  type Acumulado = {
    contexto: string;
    pratos: Map<string, number>;
    mesesTodos: Set<string>;
    pedidosMes: number;
    valorTotalMes: number;
  };
  const porCliente = new Map<string, Acumulado>();

  for (const linha of data as LinhaPedidoAvulso[]) {
    const nome = linha.cliente_nome_bruto?.trim();
    if (!nome || !linha.data) continue;
    const mesLinha = paraMesIso(linha.data);

    const atual = porCliente.get(nome) ?? {
      contexto: nomeContexto(linha.contextos),
      pratos: new Map<string, number>(),
      mesesTodos: new Set<string>(),
      pedidosMes: 0,
      valorTotalMes: 0,
    };
    atual.mesesTodos.add(mesLinha);

    if (mesLinha === mes) {
      atual.pedidosMes += 1;
      atual.valorTotalMes += Number(linha.valor_total) || 0;
      atual.contexto = nomeContexto(linha.contextos);
      if (linha.descricao_pedido) {
        const chave = linha.descricao_pedido.trim();
        atual.pratos.set(chave, (atual.pratos.get(chave) ?? 0) + 1);
      }
    }
    porCliente.set(nome, atual);
  }

  return Array.from(porCliente.entries())
    .filter(([, v]) => v.pedidosMes > 0)
    .map(([nome, v]) => {
      let pratoFavorito = '—';
      let maiorContagem = 0;
      for (const [prato, contagem] of v.pratos) {
        if (contagem > maiorContagem) {
          pratoFavorito = prato;
          maiorContagem = contagem;
        }
      }
      return {
        nome,
        contexto: v.contexto,
        pedidos: v.pedidosMes,
        valorTotal: v.valorTotalMes,
        pratoFavorito,
        // Aproximação: considera "recorrente" quem já pediu em mais de um
        // mês diferente (não necessariamente o mês imediatamente anterior).
        // Revisar esse critério com a Tereza se ela quiser algo mais específico.
        recorrente: v.mesesTodos.size > 1,
      };
    })
    .sort((a, b) => b.valorTotal - a.valorTotal);
}

// Totais do mês (pedidos + valor) considerando TODAS as linhas de
// pedidos_avulsos, com ou sem "Quem pediu?" preenchido. Existe porque
// buscarClientesResumo só enxerga linhas com nome — sem isso, uma venda
// sem nome preenchido some dos KPIs de topo da página.
export async function buscarResumoAvulsosMes(mes: string): Promise<ResumoAvulsosMes> {
  if (!mes) return { totalPedidos: 0, valorTotal: 0 };
  const { inicio, fim } = limitesDoMes(mes);
  const { data, error } = await supabaseServer
    .from('pedidos_avulsos')
    .select('valor_total')
    .gte('data', inicio)
    .lt('data', fim);
  if (error) throw error;

  const linhas = data ?? [];
  return {
    totalPedidos: linhas.length,
    valorTotal: linhas.reduce((s, l) => s + (Number(l.valor_total) || 0), 0),
  };
}

// Top 5 pratos do mês selecionado, com a quantidade do mesmo prato no mês
// calendário anterior (0 se não apareceu).
export async function buscarPratosComparativo(mes: string): Promise<PratoComparativo[]> {
  // Paginado (ver buscarTodasPaginado) — mesma razão de buscarClientesResumo.
  const data = await buscarTodasPaginado((inicio, fim) =>
    supabaseServer
      .from('pedidos_avulsos')
      .select('descricao_pedido, data', { count: 'exact' })
      .order('id', { ascending: true })
      .range(inicio, fim)
  );

  const mesAnt = mesAnterior(mes);
  const contagemMes = new Map<string, number>();
  const contagemAnterior = new Map<string, number>();

  for (const linha of data) {
    const prato = linha.descricao_pedido?.trim();
    if (!prato || !linha.data) continue;
    const mesLinha = paraMesIso(linha.data);
    if (mesLinha === mes) contagemMes.set(prato, (contagemMes.get(prato) ?? 0) + 1);
    else if (mesLinha === mesAnt) contagemAnterior.set(prato, (contagemAnterior.get(prato) ?? 0) + 1);
  }

  return Array.from(contagemMes.entries())
    .map(([prato, quantidade]) => ({
      prato,
      quantidade,
      quantidadeAnterior: contagemAnterior.get(prato) ?? 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 5);
}

// Pendências de conciliação DO MÊS selecionado — quem pediu e não pagou, e
// quem pagou (Pix) e não tem pedido correspondente, numa única lista com
// as duas datas (a que não se aplica à linha fica null).
export async function buscarPendencias(mes: string): Promise<Pendencia[]> {
  if (!mes) return [];
  const { inicio, fim } = limitesDoMes(mes);

  const [{ data: pendentes, error: erroPendentes }, { data: semPedido, error: erroSemPedido }] =
    await Promise.all([
      supabaseServer
        .from('pedidos_avulsos')
        .select('data, cliente_nome_bruto, valor_total')
        .eq('status_pedido', 'PENDENTE')
        .gte('data', inicio)
        .lt('data', fim),
      supabaseServer
        .from('lancamentos_pix')
        .select('data_pix, nome_pagador, valor')
        .eq('status_conciliacao', 'NAO_CONCILIADO')
        .gte('data_pix', inicio)
        .lt('data_pix', fim),
    ]);
  if (erroPendentes) throw erroPendentes;
  if (erroSemPedido) throw erroSemPedido;

  const listaPendentes: Pendencia[] = (pendentes ?? []).map((linha) => ({
    tipo: 'PEDIDO_SEM_PAGAMENTO',
    dataPedido: linha.data,
    dataPix: null,
    nome: linha.cliente_nome_bruto ?? '—',
    valor: Number(linha.valor_total) || 0,
    diasEmAberto: diasEntre(linha.data),
  }));

  const listaSemPedido: Pendencia[] = (semPedido ?? []).map((linha) => ({
    tipo: 'PAGAMENTO_SEM_PEDIDO',
    dataPedido: null,
    dataPix: linha.data_pix,
    nome: linha.nome_pagador,
    valor: Number(linha.valor) || 0,
    diasEmAberto: diasEntre(linha.data_pix),
  }));

  return [...listaPendentes, ...listaSemPedido].sort((a, b) => b.diasEmAberto - a.diasEmAberto);
}

// "Dias trabalhados" (dias distintos com entrega de verdade — marmita ou
// lanche > 0) pro período/contexto selecionado. Antes era calculado no
// client a partir do `detalhamento` completo; virou uma busca própria,
// bem mais enxuta (só 3 colunas, sem montar as ~15 colunas do
// Detalhamento nem ordenar/agrupar o resto), porque em "Todos os
// períodos" (Lote 26) o Detalhamento deixou de ser buscado por padrão —
// ver buscarDetalhamento (Lote 28, 2026-09-08).
export async function buscarDiasTrabalhados(mes: string, contexto: FiltroContexto): Promise<number> {
  const prefixoArquivo = mes ? anoMesCompacto(mes) : null;
  const datas = new Set<string>();

  if (contexto !== 'AVULSOS') {
    const dataEscola = await buscarTodasPaginado((inicio, fim) => {
      let query = supabaseServer
        .from('pedidos_escola')
        .select('data, qtd_marmitas, qtd_lanches', { count: 'exact' })
        .order('id', { ascending: true });
      if (prefixoArquivo) query = query.ilike('arquivo_origem', `${prefixoArquivo}_%`);
      return query.range(inicio, fim);
    });
    for (const l of dataEscola) {
      if (l.data && ((l.qtd_marmitas ?? 0) > 0 || (l.qtd_lanches ?? 0) > 0)) datas.add(l.data);
    }
  }

  if (contexto !== 'ESCOLA') {
    const dataAvulsos = await buscarTodasPaginado((inicio, fim) => {
      let query = supabaseServer
        .from('pedidos_avulsos')
        .select('data, qtd_marmitas, qtd_lanches', { count: 'exact' })
        .order('id', { ascending: true });
      if (prefixoArquivo) query = query.ilike('arquivo_origem', `${prefixoArquivo}_%`);
      return query.range(inicio, fim);
    });
    for (const l of dataAvulsos) {
      if (l.data && ((l.qtd_marmitas ?? 0) > 0 || (l.qtd_lanches ?? 0) > 0)) datas.add(l.data);
    }
  }

  return datas.size;
}

// Detalhamento do período pra Visão geral — junta pedidos_escola e
// pedidos_avulsos num formato comum, respeitando o filtro de contexto
// (Escola + Avulsos / Só Escola / Só Avulsos).
//
// A origem exibida em cada linha vem do NOME DO ARQUIVO (arquivo_origem),
// não da coluna `data` nem do join com `contextos` — é o arquivo que diz
// "isso é de agosto/2026, contexto CAJ", mesmo que alguma linha tenha uma
// data de outro mês.
//
// `mes === ''` significa "Todos os períodos" — chamado só quando o
// próprio usuário decide ver o detalhamento linha a linha mesmo sem
// filtro de período (ver app/visao-geral/page.tsx, Lote 28: por padrão,
// em "Todos os períodos" essa busca nem roda — não faz sentido carregar e
// renderizar milhares de linhas de pedido de uma vez só, e era a maior
// causa da Visão geral demorar pra responder nesse modo).
export async function buscarDetalhamento(
  mes: string,
  contexto: FiltroContexto
): Promise<DetalheLancamento[]> {
  const prefixoArquivo = mes ? anoMesCompacto(mes) : null;
  const linhas: DetalheLancamento[] = [];

  if (contexto !== 'AVULSOS') {
    const dataEscola = await buscarTodasPaginado((inicio, fim) => {
      let query = supabaseServer
        .from('pedidos_escola')
        .select(
          'data, tipo_lancamento, qtd_marmitas, qtd_lanches, valor_unit_marmita, valor_unit_lanche, valor_total, obs, arquivo_origem',
          { count: 'exact' }
        )
        .order('id', { ascending: true });
      if (prefixoArquivo) query = query.ilike('arquivo_origem', `${prefixoArquivo}_%`);
      return query.range(inicio, fim);
    });
    for (const l of dataEscola) {
      const qtdMarmitas = l.qtd_marmitas ?? 0;
      const qtdLanches = l.qtd_lanches ?? 0;
      const valorUnitMarmita = Number(l.valor_unit_marmita) || 0;
      const valorUnitLanche = Number(l.valor_unit_lanche) || 0;
      linhas.push({
        anoMes: anoMesComBarra(mesDoArquivo(l.arquivo_origem) ?? ''),
        data: l.data,
        origem: `Escola (${contextoDoArquivo(l.arquivo_origem) ?? '—'})`,
        quem: null,
        descricao: l.tipo_lancamento === 'PROFESSORES' ? 'Professores' : 'Alunos',
        qtdMarmitas,
        qtdLanches,
        valorUnitMarmita,
        valorUnitLanche,
        valorTotalMarmitas: qtdMarmitas * valorUnitMarmita,
        valorTotalLanches: qtdLanches * valorUnitLanche,
        valorTotal: Number(l.valor_total) || 0,
        valorPago: null,
        dataPagamento: null,
        obs: l.obs,
      });
    }
  }

  if (contexto !== 'ESCOLA') {
    const dataAvulsos = await buscarTodasPaginado((inicio, fim) => {
      let query = supabaseServer
        .from('pedidos_avulsos')
        .select(
          'data, cliente_nome_bruto, descricao_pedido, qtd_marmitas, qtd_lanches, valor_unit_marmita, valor_unit_lanche, valor_total, valor_pago, data_pagamento, obs, arquivo_origem',
          { count: 'exact' }
        )
        .order('id', { ascending: true });
      if (prefixoArquivo) query = query.ilike('arquivo_origem', `${prefixoArquivo}_%`);
      return query.range(inicio, fim);
    });
    for (const l of dataAvulsos) {
      const qtdMarmitas = l.qtd_marmitas ?? 0;
      const qtdLanches = l.qtd_lanches ?? 0;
      const valorUnitMarmita = Number(l.valor_unit_marmita) || 0;
      const valorUnitLanche = Number(l.valor_unit_lanche) || 0;
      linhas.push({
        anoMes: anoMesComBarra(mesDoArquivo(l.arquivo_origem) ?? ''),
        data: l.data,
        origem: `Avulso (${contextoDoArquivo(l.arquivo_origem) ?? '—'})`,
        quem: l.cliente_nome_bruto,
        descricao: l.descricao_pedido || '—',
        qtdMarmitas,
        qtdLanches,
        valorUnitMarmita,
        valorUnitLanche,
        valorTotalMarmitas: qtdMarmitas * valorUnitMarmita,
        valorTotalLanches: qtdLanches * valorUnitLanche,
        valorTotal: Number(l.valor_total) || 0,
        valorPago: l.valor_pago != null ? Number(l.valor_pago) : null,
        dataPagamento: l.data_pagamento,
        obs: l.obs,
      });
    }
  }

  return linhas.sort((a, b) => b.data.localeCompare(a.data));
}

// Gastos do período (aba "Gastos") — destaque=true quando a linha é
// pagamento a uma das colaboradoras.
//
// Respeita o filtro Escola/Avulsos/Todos igual ao resto da página: o
// contexto de cada gasto vem do NOME DO ARQUIVO onde foi lançado (mesmo
// critério de faturamento e Detalhamento), e o gasto entra INTEIRO no lado
// correspondente — sem rateio percentual. "Só Escola" mostra só os gastos
// de arquivos de contexto escola (CAJ/BARRA); "Só Avulsos", só os de
// contexto avulso (EXTRA/CASA/SAQUE/CENE); "Todos" mostra tudo.
//
// `mes === ''` = "Todos os períodos" — mesma observação de
// buscarDetalhamento acima: não é chamada por padrão nesse modo.
export async function buscarGastosDetalhado(mes: string, contexto: FiltroContexto): Promise<GastoDetalhado[]> {
  const prefixoArquivo = mes ? anoMesCompacto(mes) : null;
  const [data, mapaContextoEscola] = await Promise.all([
    buscarTodasPaginado((inicio, fim) => {
      let query = supabaseServer
        .from('gastos')
        .select('data, pessoa_local, tipo_pagamento, valor, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true });
      if (prefixoArquivo) query = query.ilike('arquivo_origem', `${prefixoArquivo}_%`);
      return query.range(inicio, fim);
    }),
    buscarMapaContextoEscolaPorNome(),
  ]);

  const nomesColaboradoras = NOMES_COLABORADORES.map((n) => n.trim().toLowerCase());
  const linhas: GastoDetalhado[] = [];

  for (const l of data) {
    const token = contextoDoArquivo(l.arquivo_origem as string);
    const ehEscola = token ? mapaContextoEscola.get(token) : undefined;

    if (contexto === 'ESCOLA' && ehEscola !== true) continue;
    if (contexto === 'AVULSOS' && ehEscola !== false) continue;
    // contexto === 'TODOS': mostra tudo, sem excluir nada

    const pessoa = (l.pessoa_local ?? '').trim().toLowerCase();
    linhas.push({
      data: l.data,
      pessoaLocal: l.pessoa_local ?? '—',
      tipoPagamento: l.tipo_pagamento,
      valor: Number(l.valor) || 0,
      destaque: nomesColaboradoras.includes(pessoa),
    });
  }

  return linhas.sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
}

export async function buscarUltimaSincronizacao(): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from('sync_log')
    .select('executado_em')
    .order('executado_em', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.executado_em ?? null;
}

// Fila de cobrança: TODOS os pedidos avulsos pendentes (o filtro de
// mês/ano é aplicado no client, sobre essa mesma lista — uma dívida antiga
// não pode sumir só porque tem um filtro de mês selecionado por padrão).
export async function buscarCobrancas(): Promise<Cobranca[]> {
  // Paginado (ver buscarTodasPaginado) — filtrado por PENDENTE, então hoje
  // é uma lista pequena, mas sem paginação ela também ficaria sujeita ao
  // mesmo corte silencioso de 1000 linhas se crescer.
  const pendentes = await buscarTodasPaginado((inicio, fim) =>
    supabaseServer
      .from('pedidos_avulsos')
      .select('data, cliente_nome_bruto, valor_total, descricao_pedido', { count: 'exact' })
      .eq('status_pedido', 'PENDENTE')
      .order('data', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, fim)
  );

  // A tabela `contatos` só existe depois da migração 0002 — se ainda não
  // rodou, degrada com elegância (mostra a mensagem, sem link de WhatsApp)
  // em vez de quebrar a página inteira.
  let contatos: { nome: string; celular: string }[] = [];
  try {
    const { data, error } = await supabaseServer.from('contatos').select('nome, celular');
    if (error) throw error;
    contatos = data ?? [];
  } catch {
    contatos = [];
  }

  return pendentes
    .filter((linha) => linha.cliente_nome_bruto)
    .map((linha) => {
      const nome = linha.cliente_nome_bruto as string;
      const valor = Number(linha.valor_total) || 0;
      const mensagem = montarMensagemCobranca(nome, linha.data, valor, linha.descricao_pedido);
      const celular = encontrarCelular(nome, contatos);
      return {
        nome,
        data: linha.data,
        valor,
        descricaoPedido: linha.descricao_pedido,
        diasEmAberto: diasEntre(linha.data),
        mensagem,
        linkWhatsApp: celular ? montarLinkWhatsApp(celular, mensagem) : null,
      };
    })
    .sort((a, b) => b.diasEmAberto - a.diasEmAberto);
}
