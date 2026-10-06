// Página "Avulsas" (Lote 46, 2026-10-05) — pedidos avulsos (arquivos de
// 03.Avulsas). Regras de negócio comentadas em dados-avulsas.js.
import {
  buscarPedidosAvulsos, buscarPixPorMes, ehMovimentacao, MOVIMENTACOES, ordenarTipos, somaPorTipo,
  rankClientes, rankProdutos, rankDiasSemana, rankPagadores,
} from './dados-avulsas.js';
import {
  fmt, mkC, barOpts, kpiHTML, nomeMesAno, nomeMesCurto, anoMesBarra,
  mesAnterior, variacaoMoM, fmtData,
} from './utils.js';

let _todos = [];           // todos os pedidos avulsos (histórico inteiro)
let _meses = [];           // meses disponíveis, crescente
let _mes = '';             // '' = Todos os períodos
let _tipo = 'TODOS';
let _status = 'TODOS';     // filtro da tabela: TODOS | PENDENTE | PAGO
let _sortCol = 'data';
let _sortDir = 'desc';
const _topN = { clientes: 5, produtos: 5, pagadores: 5 };
let _carregado = false;
let _pixPorMes = new Map(); // total dos Lançamentos Pix por mês (conferência do Total conta)

// Cores por tipo (KPI) — mesma paleta da marca, ordem fixa por tipo, pra
// AVULSAS ser sempre dourado, CAJ sempre petróleo etc. (cor segue o tipo,
// nunca a posição).
const COR_TIPO = {
  AVULSAS: 'var(--dourado)', CAJ: 'var(--petroleo)', BAIRRO: 'var(--sucesso)',
  EXTRA: 'var(--terracota)', CASA: 'var(--cafe)', CENE: 'var(--vinho)', BARRA: 'var(--t2)',
};
const ROTULO_TIPO = { AVULSAS: 'Avulsas', CAJ: 'CAJ', BAIRRO: 'Bairro', EXTRA: 'Extra', CASA: 'Casa', CENE: 'CENE', BARRA: 'Barra' };
const rotulo = (t) => ROTULO_TIPO[t] || (t.charAt(0) + t.slice(1).toLowerCase());

export async function boot() {
  if (_carregado) return;
  const el = document.getElementById('av');
  el.innerHTML = `<div style="padding:60px;text-align:center"><div class="spinner"></div></div>`;
  const [pedidos, pix] = await Promise.all([
    buscarPedidosAvulsos(),
    buscarPixPorMes().catch((e) => { console.warn('Lançamentos Pix indisponíveis', e); return new Map(); }),
  ]);
  _todos = pedidos;
  _pixPorMes = pix;
  _meses = Array.from(new Set(_todos.map((p) => p.mes))).sort();
  if (!_todos.length) {
    el.innerHTML = `<div class="center-state"><div class="ico">📂</div><h2>Nenhum pedido avulso sincronizado ainda</h2></div>`;
    return;
  }
  _mes = _meses[_meses.length - 1]; // abre no mês mais recente
  _carregado = true;
  buildFiltros();
  render();
}

function buildFiltros() {
  const selP = document.getElementById('selPeriodoAV');
  selP.innerHTML = ['<option value="">Todos os períodos</option>']
    .concat(_meses.slice().reverse().map((m) => `<option value="${m}">${nomeMesAno(m)}</option>`)).join('');
  selP.value = _mes;
  selP.onchange = () => { _mes = selP.value; buildTipos(); render(); };
  buildTipos();
}

function buildTipos() {
  const selT = document.getElementById('selTipoAV');
  const base = _mes ? _todos.filter((p) => p.mes === _mes) : _todos;
  const tipos = ordenarTipos(Array.from(new Set(base.map((p) => p.tipo))));
  if (_tipo !== 'TODOS' && !tipos.includes(_tipo)) tipos.push(_tipo);
  selT.innerHTML = ['<option value="TODOS">Todos os tipos</option>']
    .concat(tipos.map((t) => `<option value="${t}">${rotulo(t)}${ehMovimentacao(t) ? ' (movimentação)' : ''}</option>`)).join('');
  selT.value = _tipo;
  selT.onchange = () => { _tipo = selT.value; render(); };
}

const doTipo = (p) => _tipo === 'TODOS' || p.tipo === _tipo;
const doMes = (mes) => (p) => !mes || p.mes === mes;

function render() {
  const el = document.getElementById('av');
  const doPeriodo = _todos.filter(doMes(_mes)).filter(doTipo);
  const vendas = doPeriodo.filter((p) => !ehMovimentacao(p.tipo));
  const anteriorMes = _mes ? mesAnterior(_mes) : null;
  const doAnterior = anteriorMes && _meses.includes(anteriorMes)
    ? _todos.filter(doMes(anteriorMes)).filter(doTipo) : null;

  el.innerHTML = `
  <div class="sec">
    <div class="sec-title">Resumo — ${_mes ? nomeMesAno(_mes) : 'Todos os períodos'}${_tipo !== 'TODOS' ? ' · ' + rotulo(_tipo) : ''}</div>
    <div class="kg">${kpisHTML(doPeriodo, doAnterior)}</div>
  </div>

  <div class="sec">
    <div class="sec-title">Clientes, produtos e semana</div>
    <div class="rg">
      ${rankCardHTML('clientes', '🙋 Clientes que mais pedem', 'quentinhas')}
      ${rankCardHTML('produtos', '🍱 Produtos que mais saem', 'quentinhas')}
      ${rankCardHTML('semana', '📅 Dia da semana que mais sai', 'quentinhas')}
      ${rankCardHTML('pagadores', '💰 Clientes que mais pagam', 'pago')}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Total vendido por mês</div>
    <div class="cc"><h3>Avulsos — total vendido${_tipo !== 'TODOS' ? ' · ' + rotulo(_tipo) : ''} <span class="h3-sub">(sem saques/depósitos)</span></h3>
      <div class="ch ch-lg"><canvas id="chAV"></canvas></div></div>
  </div>

  <div class="sec">
    <div class="sec-title">Pedidos do período</div>
    <div class="tcard">
      <div class="tbar">
        <h3>Pedidos <span class="h3-sub" id="avQtdLinhas"></span></h3>
        <select class="pfsel" id="selStatusAV">
          <option value="TODOS">Todos os status</option>
          <option value="PENDENTE">Só pendentes</option>
          <option value="PAGO">Só pagos</option>
        </select>
      </div>
      <div class="tw"><table><thead id="thAV"></thead><tbody id="tbAV"></tbody></table></div>
    </div>
  </div>`;

  renderRankings(vendas);
  renderGrafico();
  const selS = document.getElementById('selStatusAV');
  selS.value = _status;
  selS.onchange = () => { _status = selS.value; renderTabela(doPeriodo); };
  renderTabela(doPeriodo);
}

// ─── KPIs ───────────────────────────────────────────────────────────────────
function kpisHTML(atual, anterior) {
  const somaA = somaPorTipo(atual);
  const somaB = anterior ? somaPorTipo(anterior) : new Map();
  const comp = (a, b, inverted = false) => (anterior ? { variacao: variacaoMoM(a, b ?? 0), inverted } : null);

  const tiposVenda = ordenarTipos(Array.from(new Set([...somaA.keys(), ...somaB.keys()])).filter((t) => !ehMovimentacao(t)));
  const cards = [];

  // 1) Um KPI por tipo (Qual Escola / Contexto)
  for (const t of tiposVenda) {
    const v = somaA.get(t) ?? 0;
    const qtd = atual.filter((p) => p.tipo === t).reduce((s, p) => s + p.qtdMarmitas, 0);
    cards.push(kpiHTML({
      label: rotulo(t), valor: fmt(v), acc: COR_TIPO[t] || 'var(--t2)',
      comp: comp(v, somaB.get(t)),
      sub: `${qtd} quentinha${qtd === 1 ? '' : 's'}`,
    }));
  }

  // 2) Saques (valor líquido do tipo SAQUE — negativo = saiu da conta).
  // Comparação pelo tamanho do saque (valor absoluto): sacar mais = vermelho.
  const saqueA = somaA.get('SAQUE') ?? 0;
  const saqueB = somaB.get('SAQUE') ?? 0;
  const depA = (somaA.get('DEPÓSITO') ?? 0) + (somaA.get('DEPOSITO') ?? 0);
  const depB = (somaB.get('DEPÓSITO') ?? 0) + (somaB.get('DEPOSITO') ?? 0);
  const mostraMov = _tipo === 'TODOS' || ehMovimentacao(_tipo);

  if (mostraMov) {
    cards.push(kpiHTML({
      label: 'Saques da conta', valor: fmt(saqueA), acc: 'var(--vinho)',
      comp: anterior ? { variacao: variacaoMoM(Math.abs(saqueA), Math.abs(saqueB)), inverted: true } : null,
      sub: 'negativo = saiu da conta',
    }));
    // Depósito é esporádico — só aparece no mês em que aconteceu.
    if (depA) {
      cards.push(kpiHTML({ label: 'Depósitos', valor: fmt(depA), acc: 'var(--vinho)', comp: comp(depA, depB) }));
    }
  }

  // 3) Falta pagar (Valor pago vazio) — período selecionado + em aberto em todos os meses
  const pend = atual.filter((p) => !p.pago && !ehMovimentacao(p.tipo));
  const pendVal = pend.reduce((s, p) => s + p.valorComTaxa, 0);
  const pendGeral = _todos.filter(doTipo).filter((p) => !p.pago && !ehMovimentacao(p.tipo));
  const pendGeralVal = pendGeral.reduce((s, p) => s + p.valorComTaxa, 0);
  cards.push(kpiHTML({
    label: 'Falta pagar', valor: fmt(pendVal), acc: 'var(--alerta)',
    sub: `${pend.length} pedido${pend.length === 1 ? '' : 's'} pendente${pend.length === 1 ? '' : 's'}` +
      (_mes && pendGeralVal !== pendVal ? ` · em todos os meses: ${fmt(pendGeralVal)}` : ''),
  }));

  // 4) Total conta (Lote 47, pedido do David) — por último. É o que de fato
  // entrou/saiu da conta PicPay: soma do "Valor pago" de todas as linhas,
  // INCLUINDO saques/depósitos. Pedido pendente (Valor pago vazio) não entra.
  // Tem que bater com o total do arquivo de Lançamentos Pix do mês
  // (03.Avulsas\03.Pagamentos) — a conferência aparece embaixo do valor.
  const pagoA = atual.reduce((s, p) => s + (p.valorPago ?? 0), 0);
  const pagoB = anterior ? anterior.reduce((s, p) => s + (p.valorPago ?? 0), 0) : 0;
  const recebidoA = atual.filter((p) => !ehMovimentacao(p.tipo)).reduce((s, p) => s + (p.valorPago ?? 0), 0);
  const movPagoA = pagoA - recebidoA;
  const partes = [];
  if (mostraMov && movPagoA) partes.push(`recebido ${fmt(recebidoA)} · saques ${fmt(movPagoA)}`);
  if (_tipo === 'TODOS') {
    const mesesConf = _mes ? [_mes] : _meses;
    const temPix = mesesConf.some((m) => _pixPorMes.has(m));
    if (temPix) {
      const pix = mesesConf.reduce((s, m) => s + (_pixPorMes.get(m) ?? 0), 0);
      const bate = Math.abs(pix - pagoA) < 0.01;
      partes.push(bate
        ? `<span class="conf-ok">✓ bate com os Lançamentos Pix</span>`
        : `<span class="conf-dif">⚠ Lançamentos Pix: ${fmt(pix)} (diferença ${fmt(pagoA - pix)})</span>`);
    }
  }
  cards.push(kpiHTML({
    label: 'Total conta', valor: fmt(pagoA), acc: 'var(--sucesso)',
    comp: comp(pagoA, pagoB),
    sub: partes.join('<br>') || null,
  }));

  return cards.join('');
}

// ─── Rankings ───────────────────────────────────────────────────────────────
function rankCardHTML(id, titulo) {
  const comTop = id !== 'semana';
  return `
  <div class="cc rk">
    <div class="rk-hd">
      <h3>${titulo}</h3>
      ${comTop ? `<div class="chips" data-rank="${id}">
        ${[5, 10, 15].map((n) => `<button type="button" class="chip${_topN[id] === n ? ' on' : ''}" data-n="${n}">Top ${n}</button>`).join('')}
      </div>` : ''}
    </div>
    <div id="rk-${id}"></div>
  </div>`;
}

function renderRankings(vendas) {
  const listas = {
    clientes: rankClientes(vendas),
    produtos: rankProdutos(vendas),
    semana: rankDiasSemana(vendas),
    pagadores: rankPagadores(vendas),
  };
  const desenhar = (id) => {
    const el = document.getElementById(`rk-${id}`);
    const arr = id === 'semana' ? listas.semana : listas[id].slice(0, _topN[id]);
    if (!arr.length) { el.innerHTML = `<p class="rk-vazio">Sem pedidos no período</p>`; return; }
    const isPag = id === 'pagadores';
    const max = Math.max(...arr.map((r) => (isPag ? r.valor : r.qtd)), 1);
    el.innerHTML = `<ol class="rk-list">${arr.map((r, i) => {
      const v = isPag ? r.valor : r.qtd;
      const det = isPag
        ? `${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'} em ${r.pagamentos} pagamento${r.pagamentos === 1 ? '' : 's'}`
          + (r.porPagamento >= 2 ? ` <span class="tag">paga ~${Math.round(r.porPagamento)} de uma vez</span>` : '')
        : `${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'} · ${fmt(r.valor)}`;
      return `<li>
        <span class="rk-pos">${i + 1}</span>
        <div class="rk-body">
          <div class="rk-top"><span class="rk-nome" title="${r.nome}">${r.nome}</span><span class="rk-val">${isPag ? fmt(v) : v}</span></div>
          <div class="rk-bar"><span style="width:${Math.max(2, (v / max) * 100)}%"></span></div>
          <div class="rk-det">${det}</div>
        </div>
      </li>`;
    }).join('')}</ol>`;
  };
  Object.keys(listas).forEach(desenhar);

  document.querySelectorAll('#av .chips').forEach((grp) => {
    grp.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      const id = grp.dataset.rank;
      _topN[id] = Number(b.dataset.n);
      grp.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
      desenhar(id);
    });
  });
}

// ─── Gráfico Mês/Ano ──────────────────────────────────────────────────────
function renderGrafico() {
  const meses = _mes ? _meses.filter((m) => m.startsWith(_mes.slice(0, 4))) : _meses;
  const porMes = new Map(meses.map((m) => [m, new Map()]));
  for (const p of _todos) {
    if (!porMes.has(p.mes) || ehMovimentacao(p.tipo) || !doTipo(p)) continue;
    const t = porMes.get(p.mes);
    t.set(p.tipo, (t.get(p.tipo) ?? 0) + p.valorTotal);
  }
  const totais = meses.map((m) => Array.from(porMes.get(m).values()).reduce((s, v) => s + v, 0));
  const labels = meses.map((m) => (_mes ? nomeMesCurto(m) : anoMesBarra(m)));
  const cores = meses.map((m) => (m === _mes ? '#B5651D' : '#E3A63E'));

  mkC('chAV', {
    type: 'bar',
    data: { labels, datasets: [{ data: totais.map((v) => Math.round(v * 100) / 100), backgroundColor: cores, borderRadius: 6 }] },
    options: barOpts({
      plugins: {
        tooltip: {
          callbacks: {
            title: (c) => nomeMesAno(meses[c[0].dataIndex]),
            label: (c) => ' Total: ' + fmt(c.raw),
            // detalhamento por tipo no tooltip — em texto, sem empilhar cor
            afterLabel: (c) => {
              const t = porMes.get(meses[c.dataIndex]);
              if (_tipo !== 'TODOS' || t.size < 2) return '';
              return ordenarTipos(Array.from(t.keys())).map((k) => `  ${rotulo(k)}: ${fmt(t.get(k))}`);
            },
          },
        },
      },
    }),
  });
}

// ─── Tabela ────────────────────────────────────────────────────────────────
const COLS = [
  ['data', 'Data entrega', 'data'],
  ['qtdMarmitas', 'Qtd. marmitas', 'centro'],
  ['valorUnitMarmita', 'Valor unit. (marmita)', 'moeda'],
  ['valorComTaxa', 'Valor Total (marmita + lanche)', 'moeda'],
  ['valorPago', 'Valor pago', 'moeda'],
  ['dataPagamento', 'Data pagamento', 'data'],
  ['cliente', 'Quem pediu?', 'texto'],
  ['pedido', 'Qual o pedido?', 'texto'],
  ['tipo', 'Tipo', 'tipo'],
  ['status', 'Status pagamento', 'status'],
];
const NUM = new Set(['qtdMarmitas', 'valorUnitMarmita', 'valorComTaxa', 'valorPago']);

function renderTabela(doPeriodo) {
  let rows = doPeriodo.map((p) => ({ ...p, status: ehMovimentacao(p.tipo) ? 'MOV' : (p.pago ? 'PAGO' : 'PENDENTE') }));
  if (_status === 'PENDENTE') rows = rows.filter((r) => r.status === 'PENDENTE');
  if (_status === 'PAGO') rows = rows.filter((r) => r.status === 'PAGO');

  const dir = _sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[_sortCol], bv = b[_sortCol];
    if (NUM.has(_sortCol)) return ((av ?? -Infinity) - (bv ?? -Infinity)) * dir;
    return String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR') * dir;
  });

  document.getElementById('avQtdLinhas').textContent = `(${rows.length})`;
  const th = document.getElementById('thAV');
  th.innerHTML = '<tr>' + COLS.map(([k, l, f]) => {
    const on = k === _sortCol;
    return `<th class="th-sort${on ? ' active' : ''}${f === 'moeda' ? ' tr' : ''}" data-col="${k}">${l}${on ? (_sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`;
  }).join('') + '</tr>';
  th.querySelectorAll('th').forEach((h) => h.addEventListener('click', () => {
    const c = h.dataset.col;
    if (_sortCol === c) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
    else { _sortCol = c; _sortDir = NUM.has(c) || c.startsWith('data') ? 'desc' : 'asc'; }
    renderTabela(doPeriodo);
  }));

  const tb = document.getElementById('tbAV');
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="${COLS.length}" style="padding:24px;text-align:center;color:var(--t3)">Nenhum pedido</td></tr>`;
    return;
  }
  const vendas = rows.filter((r) => r.status !== 'MOV');
  const tot = {
    qtd: vendas.reduce((s, r) => s + r.qtdMarmitas, 0),
    total: vendas.reduce((s, r) => s + r.valorComTaxa, 0),
    pago: vendas.reduce((s, r) => s + (r.valorPago ?? 0), 0),
  };
  const cel = (r, k, f) => {
    const v = r[k];
    if (f === 'data') return `<td>${fmtData(v)}</td>`;
    if (f === 'centro') return `<td class="tc">${v || '-'}</td>`;
    if (f === 'moeda') return `<td class="tr${k === 'valorComTaxa' ? ' bold' : ''}">${v == null ? '-' : fmt(v)}</td>`;
    if (f === 'tipo') return `<td><span class="tipo-tag">${rotulo(v)}</span></td>`;
    if (f === 'status') {
      if (v === 'MOV') return `<td><span class="st st-mov">Movimentação</span></td>`;
      return `<td><span class="st ${v === 'PAGO' ? 'st-ok' : 'st-pend'}">${v === 'PAGO' ? '✓ Pago' : '⏳ Pendente'}</span></td>`;
    }
    const s = String(v ?? '');
    return `<td title="${s.replace(/"/g, '&quot;')}">${s.length > 40 ? s.slice(0, 40) + '…' : s}</td>`;
  };
  tb.innerHTML =
    `<tr class="row-total"><td class="bold">Totais <span class="h3-sub">(sem saques)</span></td><td class="tc bold">${tot.qtd}</td><td></td>` +
    `<td class="tr bold">${fmt(tot.total)}</td><td class="tr bold">${fmt(tot.pago)}</td><td colspan="5"></td></tr>` +
    rows.map((r) => `<tr${r.status === 'PENDENTE' ? ' class="row-pend"' : ''}>${COLS.map(([k, , f]) => cel(r, k, f)).join('')}</tr>`).join('');
}
