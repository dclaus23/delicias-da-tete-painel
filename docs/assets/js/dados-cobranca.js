// Dados da página Cobrança (Lote 51, 2026-10-08).
//
// Duas fontes dizem se um cliente pagou:
//  1. Planilha de pedidos Avulsos — "Valor pago" vazio = pendente (mesma
//     regra da página Avulsas, Lote 46).
//  2. Lançamentos Pix (extrato PicPay, 03.Avulsas\03.Pagamentos) — o que de
//     fato caiu na conta.
// Quem lança as duas é o David. Se caiu um Pix do cliente DEPOIS do pedido
// pendente e ele ainda não deu baixa na planilha, o cliente provavelmente já
// pagou — a página segura a cobrança e avisa o David pra conferir antes.
import { sb, buscarTodasPaginado } from './supabase-client.js';
import { num } from './utils.js';
import { buscarPedidosAvulsos, ehMovimentacao } from './dados-avulsas.js';

export const DIAS_COBRAR = 7;      // regra: 1 semana sem pagar -> cobrar
export const DIAS_AVISO = 5;       // a partir de 5 dias: "vence em breve"
const TOLERANCIA_PIX_DIAS = 3;     // Pix até 3 dias antes do pedido ainda conta (pagamento adiantado)

// Nome comparável: sem acento, minúsculo, sem espaço duplicado.
export function chaveNome(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// "(21) 98821-1872" / "21988211872" / "5521988211872" -> "5521988211872"
function normalizaCelular(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return '55' + d;
  return d;
}

function diasEntre(dataIso, hoje) {
  const [a, m, d] = dataIso.split('-').map(Number);
  return Math.floor((hoje - new Date(a, m - 1, d)) / 86400000);
}

function somarDias(dataIso, n) {
  const [a, m, d] = dataIso.split('-').map(Number);
  const dt = new Date(a, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export async function buscarCobrancas() {
  const [pedidos, pix, contatos] = await Promise.all([
    buscarPedidosAvulsos(),
    buscarTodasPaginado((inicio, fim) =>
      sb.from('lancamentos_pix').select('data_pix, nome_pagador, valor', { count: 'exact' })
        .order('id', { ascending: true }).range(inicio, fim)),
    sb.from('contatos').select('nome, celular'),
  ]);
  if (contatos.error) throw contatos.error;

  const fones = new Map();
  for (const c of contatos.data ?? []) {
    const cel = normalizaCelular(c.celular);
    if (cel) fones.set(chaveNome(c.nome), cel);
  }

  const pixPorCliente = new Map();
  for (const l of pix) {
    if (!l.data_pix || num(l.valor) <= 0) continue;
    const k = chaveNome(l.nome_pagador);
    if (!pixPorCliente.has(k)) pixPorCliente.set(k, []);
    pixPorCliente.get(k).push({ data: l.data_pix, valor: num(l.valor) });
  }

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const porCliente = new Map();
  for (const p of pedidos) {
    if (p.pago || ehMovimentacao(p.tipo) || !p.data || p.valorComTaxa <= 0) continue;
    const k = chaveNome(p.cliente);
    if (!porCliente.has(k)) porCliente.set(k, { chave: k, nome: p.cliente, pedidos: [] });
    porCliente.get(k).pedidos.push(p);
  }

  const lista = [];
  for (const c of porCliente.values()) {
    c.pedidos.sort((a, b) => a.data.localeCompare(b.data));
    const maisAntigo = c.pedidos[0].data;
    const total = c.pedidos.reduce((s, p) => s + p.valorComTaxa, 0);
    const dias = diasEntre(maisAntigo, hoje);

    // Pix "sem baixa": Pix do cliente a partir do pedido pendente mais antigo
    // (com 3 dias de folga pra pagamento adiantado) que passa do que já foi
    // dado baixa na planilha nesse mesmo intervalo.
    const desde = somarDias(maisAntigo, -TOLERANCIA_PIX_DIAS);
    const pixRecentes = (pixPorCliente.get(c.chave) ?? []).filter((x) => x.data >= desde);
    const pixTotal = pixRecentes.reduce((s, x) => s + x.valor, 0);
    const baixado = pedidos
      .filter((p) => p.pago && chaveNome(p.cliente) === c.chave && !ehMovimentacao(p.tipo) && (p.dataPagamento ?? '') >= desde)
      .reduce((s, p) => s + (p.valorPago ?? 0), 0);
    const pixSemBaixa = Math.round((pixTotal - baixado) * 100) / 100;

    let status;
    if (pixSemBaixa > 0.009) status = 'CONFERIR';
    else if (dias >= DIAS_COBRAR) status = 'COBRAR';
    else if (dias >= DIAS_AVISO) status = 'EM_BREVE';
    else status = 'AGUARDANDO';

    lista.push({
      ...c,
      total,
      dias,
      maisAntigo,
      venceEm: somarDias(maisAntigo, DIAS_COBRAR),
      celular: fones.get(c.chave) ?? null,
      pixSemBaixa: pixSemBaixa > 0.009 ? pixSemBaixa : 0,
      pixRecentes,
      status,
    });
  }

  const ordem = { CONFERIR: 0, COBRAR: 1, EM_BREVE: 2, AGUARDANDO: 3 };
  return lista.sort((a, b) => ordem[a.status] - ordem[b.status] || b.dias - a.dias || b.total - a.total);
}
