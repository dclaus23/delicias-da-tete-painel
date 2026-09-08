// ─── Formatação ────────────────────────────────────────────────────────────
export const num = (v) => (v == null || isNaN(+v) ? 0 : +v);

export const fmt = (v) =>
  v == null || isNaN(+v)
    ? '—'
    // espaço fixo ( ) entre "R$" e o número — sem isso, break-word (CSS,
    // usado pra não estourar o card no celular) às vezes quebra bem ali,
    // deixando "R$" sozinho numa linha e o valor na outra.
    : (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(' ', ' ');

export const fmtK = (v) =>
  Math.abs(+v) >= 1000 ? `R$${(+v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : fmt(v);

export const fmtPct = (v) => `${(+v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// "2026-08" -> "Agosto 2026" (opção do dropdown de Período)
export function nomeMesAno(mesIso) {
  const [ano, mes] = mesIso.split('-').map(Number);
  return `${MESES[mes - 1]} ${ano}`;
}

// "2026-08" -> "ago" (rótulo curto pros gráficos quando um ano só está em tela)
export function nomeMesCurto(mesIso) {
  const [, mes] = mesIso.split('-').map(Number);
  return MESES_CURTO[mes - 1] || '';
}

// "2026-08" -> "2026/08" (rótulo dos gráficos em "Todos os períodos", igual ao Qlik Sense)
export function anoMesBarra(mesIso) {
  return mesIso.replace('-', '/');
}

// "2026-08" -> "2026-07" (mês calendário anterior, cruzando o ano corretamente)
export function mesAnterior(mesIso) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const data = new Date(ano, mes - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// variação percentual mês a mês (null quando não há mês anterior pra comparar)
export function variacaoMoM(atual, anterior) {
  if (anterior === undefined || anterior === null || anterior === 0) return null;
  return (atual - anterior) / anterior;
}

// ─── Regras de negócio herdadas do painel anterior (lib/dados.ts / calculos.ts) ─
// Mesmo critério desde o Lote 5: o período/contexto de cada linha vem do NOME
// DO ARQUIVO de origem ("AAAAMM_CONTEXTO - ..."), não da coluna `data` — uma
// semana de entrega pode ter datas cruzando pro mês seguinte, e o arquivo é a
// referência real de período/contexto que a Tereza usa.
export function mesDoArquivo(arquivoOrigem) {
  if (!arquivoOrigem) return null;
  const m = arquivoOrigem.match(/^(\d{4})(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}

export function contextoDoArquivo(arquivoOrigem) {
  if (!arquivoOrigem) return null;
  const m = arquivoOrigem.match(/^\d{6}_([A-Za-zÀ-ÿ]+)/);
  return m ? m[1].toUpperCase() : null;
}

export function anoMesCompacto(mesIso) {
  return mesIso.replace('-', '');
}

export function limitesDoMes(mesIso) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const inicio = `${mesIso}-01`;
  const fim = new Date(ano, mes, 1).toISOString().slice(0, 10);
  return { inicio, fim };
}

export function paraMesIso(dataIso) {
  return dataIso.slice(0, 7);
}

// ─── Gráficos (Chart.js) ───────────────────────────────────────────────────
let _charts = {};

export function mkC(id, cfg) {
  if (_charts[id]) { try { _charts[id].destroy(); } catch (e) {} }
  const el = document.getElementById(id);
  if (!el) return;
  _charts[id] = new Chart(el, cfg);
  return _charts[id];
}

export function killCharts() {
  Object.values(_charts).forEach((c) => { try { c.destroy(); } catch (e) {} });
  _charts = {};
}

export function barOpts(opts = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => ' ' + fmt(c.raw) } },
      ...opts.plugins,
    },
    scales: {
      y: { ticks: { callback: (v) => fmtK(v), font: { size: 10 } }, grid: { color: '#EFE6D8' } },
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      ...opts.scales,
    },
  };
}

// ─── Card de KPI ────────────────────────────────────────────────────────────
export function kpiHTML({ label, valor, acc = 'var(--dourado)', sub, comp }) {
  return `
  <div class="kpi" style="--acc:${acc}">
    <div class="k-lbl">${label}</div>
    <div class="k-val">${valor}</div>
    ${comp ? compHTML(comp) : ''}
    ${sub ? `<div class="k-sub">${sub}</div>` : ''}
  </div>`;
}

function compHTML(comp) {
  if (comp.variacao == null) return '';
  const isPos = comp.inverted ? comp.variacao <= 0 : comp.variacao >= 0;
  return `<div class="k-comp ${isPos ? 'up' : 'down'}">
    ${comp.variacao > 0 ? '▲' : '▼'} ${fmtPct(Math.abs(comp.variacao))} vs. mês anterior
  </div>`;
}

// ─── Tabela genérica (ordenável, com wrapper de rolagem horizontal) ────────
export function renderTable(thId, tbId, cols, labels, rows, opts = {}) {
  const { sortable = false, sortCol = null, sortDir = 'asc', onSort = null, formatCol = {}, maxRows = 500 } = opts;

  const theadEl = document.getElementById(thId);
  theadEl.innerHTML = '<tr>' + cols.map((c) => {
    const label = labels[c] || c;
    if (!sortable) return `<th>${label}</th>`;
    const active = c === sortCol;
    const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="th-sort${active ? ' active' : ''}" data-col="${c}">${label}${arrow}</th>`;
  }).join('') + '</tr>';

  if (sortable && onSort) {
    theadEl.querySelectorAll('th.th-sort').forEach((th) => {
      th.addEventListener('click', () => onSort(th.dataset.col));
    });
  }

  const tbodyEl = document.getElementById(tbId);
  if (!rows.length) {
    tbodyEl.innerHTML = `<tr><td colspan="${cols.length}" style="padding:24px;text-align:center;color:var(--t3)">Nenhum registro</td></tr>`;
    return;
  }

  const shown = rows.slice(0, maxRows);
  tbodyEl.innerHTML = shown.map((r) => '<tr>' + cols.map((col) => {
    const v = r[col];
    const f = formatCol[col];
    if (f === 'moeda') return `<td class="tr bold">${fmt(v)}</td>`;
    if (f === 'centro') return `<td class="tc">${v ?? '—'}</td>`;
    const s = v != null ? String(v) : '—';
    return `<td>${s.length > 60 ? s.slice(0, 60) + '…' : s}</td>`;
  }).join('') + '</tr>').join('');

  if (rows.length > maxRows) {
    tbodyEl.innerHTML += `<tr><td colspan="${cols.length}" style="padding:10px;text-align:center;color:var(--t3);font-size:11px">
      mostrando ${maxRows} de ${rows.length} linhas — refine o período pra ver o resto
    </td></tr>`;
  }
}
