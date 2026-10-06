// Consultas e agregações da página Avulsas (Lote 46, 2026-10-05).
//
// Fonte: tabela `pedidos_avulsos` (vigia lê os arquivos de
// 03.Avulsas\01.Pedidos e Entregas\<ano>\AAAAMM_AVULSAS - Marmitas e Lanches.xlsx).
// O histórico inteiro de avulsos tem só ~1.200 linhas, então buscamos tudo
// UMA vez (colunas enxutas, paginado) e todo o resto — KPIs, rankings,
// gráfico e tabela — é calculado no navegador, sem nova consulta ao trocar
// filtro.
//
// Regras de negócio:
// - Período = mês do NOME DO ARQUIVO (mesmo critério da Visão geral, Lote 5/8),
//   não da data da entrega (o arquivo de setembro tem entregas de outubro).
// - "Tipo" = coluna "Qual Escola / Contexto" da planilha (contexto_id).
// - SAQUE e DEPÓSITO não são venda: são movimentação da conta (saque com
//   valor negativo, devolução/depósito positivo). Ficam FORA do total
//   vendido, dos rankings e do "falta pagar" — têm KPI próprio.
// - Status de pagamento (pedido do David): "Valor pago" vazio = Pendente,
//   preenchido = Pago. Não usamos `status_pedido` do banco porque ele é
//   derivado da "Forma pagamento" (que vem "Pix" por padrão em toda linha
//   nova, mesmo antes de pagar).
import { sb, buscarTodasPaginado } from './supabase-client.js';
import { mesDoArquivo, num } from './utils.js';

export const MOVIMENTACOES = { SAQUE: 'Saques', 'DEPÓSITO': 'Depósitos', DEPOSITO: 'Depósitos' };
export const ehMovimentacao = (tipo) => Object.prototype.hasOwnProperty.call(MOVIMENTACOES, tipo);

export async function buscarPedidosAvulsos() {
  const [linhas, contextos] = await Promise.all([
    buscarTodasPaginado((inicio, fim) =>
      sb.from('pedidos_avulsos')
        .select('id, data, cliente_nome_bruto, descricao_pedido, qtd_marmitas, qtd_lanches, valor_unit_marmita, valor_total, taxa_entrega, valor_pago, data_pagamento, contexto_id, arquivo_origem', { count: 'exact' })
        .order('id', { ascending: true })
        .range(inicio, fim)),
    sb.from('contextos').select('id, nome'),
  ]);
  if (contextos.error) throw contextos.error;
  const nomeCtx = new Map((contextos.data ?? []).map((c) => [c.id, (c.nome || '').toUpperCase()]));

  const pedidos = [];
  for (const l of linhas) {
    const mes = mesDoArquivo(l.arquivo_origem);
    if (!mes) continue;
    const valorTotal = num(l.valor_total);
    const taxa = num(l.taxa_entrega);
    const qtdMarmitas = num(l.qtd_marmitas);
    const qtdLanches = num(l.qtd_lanches);
    // Linhas zeradas (sem valor e sem quantidade) são sobra de template —
    // não são pedido de verdade (ex.: 2 linhas de 2025-05 com tudo zerado).
    if (valorTotal === 0 && taxa === 0 && qtdMarmitas === 0 && qtdLanches === 0) continue;
    pedidos.push({
      id: l.id,
      mes,
      arquivo: l.arquivo_origem,
      data: l.data,
      cliente: (l.cliente_nome_bruto || '').trim() || '(sem nome)',
      pedido: (l.descricao_pedido || '').trim() || '(não informado)',
      tipo: nomeCtx.get(l.contexto_id) || 'SEM TIPO',
      qtdMarmitas,
      qtdLanches,
      valorUnitMarmita: num(l.valor_unit_marmita),
      valorTotal,                       // marmita + lanche (faturamento, sem taxa)
      valorComTaxa: valorTotal + taxa,  // = coluna "Valor Total (marmita + lanche)" da planilha
      valorPago: l.valor_pago == null ? null : num(l.valor_pago),
      dataPagamento: l.data_pagamento,
      pago: l.valor_pago != null,
    });
  }
  return pedidos;
}

// ─── Agregações ─────────────────────────────────────────────────────────────

const ORDEM_TIPOS = ['AVULSAS', 'CAJ', 'BAIRRO', 'EXTRA', 'CASA', 'CENE', 'BARRA'];
export function ordenarTipos(tipos) {
  return tipos.slice().sort((a, b) => {
    const ia = ORDEM_TIPOS.indexOf(a), ib = ORDEM_TIPOS.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, 'pt-BR');
  });
}

export function somaPorTipo(pedidos) {
  const m = new Map();
  for (const p of pedidos) m.set(p.tipo, (m.get(p.tipo) ?? 0) + p.valorTotal);
  return m;
}

// Chave de agrupamento tolerante a maiúscula/acento/espaço sobrando — a
// planilha tem "Filé de Frango grelhado" e "Filé de frango grelhado".
function chave(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function agrupar(pedidos, campo) {
  const m = new Map();
  for (const p of pedidos) {
    const k = chave(p[campo]);
    if (!m.has(k)) m.set(k, { nome: p[campo], qtd: 0, pedidos: 0, valor: 0 });
    const g = m.get(k);
    g.qtd += p.qtdMarmitas;
    g.pedidos += 1;
    g.valor += p.valorTotal;
  }
  return Array.from(m.values());
}

// Clientes que mais pedem quentinha — por quantidade de marmitas.
export function rankClientes(vendas) {
  return agrupar(vendas, 'cliente').sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
}

// Produtos que mais saem — por quantidade de marmitas.
export function rankProdutos(vendas) {
  return agrupar(vendas, 'pedido').sort((a, b) => b.qtd - a.qtd || b.pedidos - a.pedidos);
}

// Dias da semana — quentinhas por dia da semana da ENTREGA.
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export function rankDiasSemana(vendas) {
  const arr = DIAS.map((nome) => ({ nome, qtd: 0, pedidos: 0, valor: 0 }));
  for (const p of vendas) {
    if (!p.data) continue;
    const [a, m, d] = p.data.split('-').map(Number);
    const g = arr[new Date(a, m - 1, d).getDay()];
    g.qtd += p.qtdMarmitas; g.pedidos += 1; g.valor += p.valorTotal;
  }
  return arr.filter((g) => g.pedidos > 0).sort((a, b) => b.qtd - a.qtd || b.valor - a.valor);
}

// Clientes que mais pagam — total pago, e quantos pagamentos isso levou.
// "Pagamento" = cliente + data de pagamento distinta: quem pede vários dias
// e paga tudo numa data só aparece com muitos pedidos por pagamento.
export function rankPagadores(vendas) {
  const m = new Map();
  for (const p of vendas) {
    if (!p.pago) continue;
    const k = chave(p.cliente);
    if (!m.has(k)) m.set(k, { nome: p.cliente, valor: 0, pedidos: 0, datas: new Set(), semData: 0 });
    const g = m.get(k);
    g.valor += p.valorPago;
    g.pedidos += 1;
    if (p.dataPagamento) g.datas.add(p.dataPagamento); else g.semData += 1;
  }
  return Array.from(m.values())
    .map((g) => {
      const pagamentos = g.datas.size + g.semData;
      return { nome: g.nome, valor: g.valor, pedidos: g.pedidos, pagamentos, porPagamento: pagamentos ? g.pedidos / pagamentos : 0 };
    })
    .sort((a, b) => b.valor - a.valor);
}
