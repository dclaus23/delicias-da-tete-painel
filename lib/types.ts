export type Contexto = 'ESCOLA' | 'AVULSOS';

export interface ResultadoMensal {
  mes: string; // "2026-03"
  faturamentoEscola: number;
  faturamentoAvulsos: number;
  gastos: number; // total do mês (todos os gastos, classificados ou não)
  gastosEscola: number; // gastos de arquivos de contexto escola (CAJ/BARRA)
  gastosAvulsos: number; // gastos de arquivos de contexto avulso (EXTRA/CASA/SAQUE/CENE)
  // faturamentoTotal, lucro, margemLucro, dizimo e oferta são derivados —
  // ver lib/calculos.ts.
}

export interface ClienteResumo {
  nome: string;
  contexto: string; // CAJ, BARRA, EXTRA, CASA, SAQUE...
  pedidos: number;
  valorTotal: number;
  pratoFavorito: string;
  recorrente: boolean; // já pediu em mais de um mês diferente (all-time)
}

// Top pratos do mês selecionado, comparado com o mesmo prato no mês anterior.
export interface PratoComparativo {
  prato: string;
  quantidade: number;
  quantidadeAnterior: number;
}

export type TipoPendencia = 'PEDIDO_SEM_PAGAMENTO' | 'PAGAMENTO_SEM_PEDIDO';

export interface Pendencia {
  tipo: TipoPendencia;
  dataPedido: string | null; // YYYY-MM-DD, só existe em PEDIDO_SEM_PAGAMENTO
  dataPix: string | null; // YYYY-MM-DD, só existe em PAGAMENTO_SEM_PEDIDO
  nome: string;
  valor: number;
  diasEmAberto: number;
}

// Item da fila de cobrança (pedido avulso pendente + contato + mensagem pronta)
export interface Cobranca {
  nome: string;
  data: string;
  valor: number;
  descricaoPedido: string | null;
  diasEmAberto: number;
  mensagem: string;
  linkWhatsApp: string | null; // null quando não achamos o celular do cliente
}

export type FiltroContexto = 'TODOS' | 'ESCOLA' | 'AVULSOS';

// Linha de detalhamento da Visão geral — mistura pedidos_escola e
// pedidos_avulsos do mês num formato comum pra exibir numa única tabela,
// no mesmo detalhe de colunas da planilha da Tereza (Ano/Mês, valores
// unitários e totais separados por marmita/lanche, valor pago x a pagar).
export interface DetalheLancamento {
  anoMes: string; // "2026/08" — extraído do nome do arquivo de origem
  data: string;
  origem: string; // "Escola (CAJ)" | "Avulso (EXTRA)" etc.
  quem: string | null; // cliente_nome_bruto — só existe em pedidos avulsos
  descricao: string; // "Qual o pedido?" (avulsos) ou Alunos/Professores (escola)
  qtdMarmitas: number;
  qtdLanches: number;
  valorUnitMarmita: number;
  valorUnitLanche: number;
  valorTotalMarmitas: number; // qtdMarmitas * valorUnitMarmita
  valorTotalLanches: number; // qtdLanches * valorUnitLanche
  valorTotal: number; // valor a pagar (marmitas + lanches [+ taxa, nos avulsos])
  valorPago: number | null; // só existe em pedidos avulsos
  dataPagamento: string | null; // só existe em pedidos avulsos
  obs: string | null;
}

// Entregas do período (já filtradas por mês + contexto Escola/Avulsos/Todos,
// igual ao Detalhamento), somadas por dia da semana — painel ao lado da
// tabela de Detalhamento na Visão geral. `diaSemana` já vem como rótulo
// pronto pra exibir ("Domingo".."Sábado"), calculado no client a partir do
// mesmo `detalhamento` que alimenta a tabela — deixou de ser exclusivo da
// Escola (CAJ) no Lote 13, quando passou a refletir também Avulsos e
// Escola + Avulsos (o nome do tipo ficou com "Caj" por herança do Lote 6,
// mas hoje serve os três contextos).
export interface ResumoDiaSemanaCaj {
  diaSemana: string;
  qtdMarmitas: number;
  qtdLanches: number;
  valorTotal: number;
}

// Mesmas entregas do período, somadas por DATA (não por dia da semana) —
// complementa ResumoDiaSemanaCaj: mostra dia a dia, ex. quanto saiu
// especificamente na última segunda-feira, não a soma de todas as segundas
// do mês. Também deixou de ser exclusivo da Escola (CAJ) no Lote 13.
export interface EntregaDiaCaj {
  data: string;
  qtdMarmitas: number;
  qtdLanches: number;
  valorTotal: number;
}

// Linha da aba "Gastos" — destaque=true quando é pagamento a colaborador.
// O contexto (Escola/Avulsos) já foi resolvido no servidor a partir do nome
// do arquivo de origem do gasto antes de filtrar essa lista — `valor` é
// sempre o valor cheio do lançamento, sem rateio.
export interface GastoDetalhado {
  data: string | null;
  pessoaLocal: string;
  tipoPagamento: string | null;
  valor: number;
  destaque: boolean;
}

// Totais do mês pra pedidos avulsos, calculados sobre TODAS as linhas
// (mesmo as sem "Quem pediu?" preenchido) — usado nos KPIs da página de
// avulsos pra não subestimar vendas de linhas sem cliente identificado.
export interface ResumoAvulsosMes {
  totalPedidos: number;
  valorTotal: number;
}
