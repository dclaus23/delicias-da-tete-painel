import {
  buscarResultadosMensais, buscarDiasTrabalhados, buscarDetalhamentoEscola,
  buscarGastosDetalhado, buscarUltimaSincronizacao,
} from './dados.js';
import {
  fmt, fmtPct, num, mkC, killCharts, barOpts, kpiHTML, renderTable,
  nomeMesAno, nomeMesCurto, anoMesBarra, mesAnterior, variacaoMoM, fmtData,
} from './utils.js';

let _resultados = [];
let _porArquivo = [];        // Lote 35: [{ arquivo, mes, faturamento, gastos }, ...] de TODO o histórico
let _porArquivoMap = new Map();
let _mesSelecionado = '';   // '' = Todos os períodos
let _contexto = 'TODOS';
let _arquivo = '';          // '' = Todos os arquivos (Lote 34/35)
let _sortCol = null;
let _sortDir = 'asc';
let _detalhamentoTodos = []; // Detalhamento do período, sem filtrar por arquivo
let _gastosTodos = [];       // Gastos do período, sem filtrar por arquivo
let _detalhamentoAtual = []; // após aplicar o filtro de Arquivo — o que a tabela/Excel usam
let _gastosAtual = [];

// valores de um ResultadoMensal já reduzidos pro contexto selecionado
function reduzirContexto(r, contexto) {
  const faturamento =
    contexto === 'ESCOLA' ? r.faturamentoEscola :
    contexto === 'AVULSOS' ? r.faturamentoAvulsos :
    r.faturamentoEscola + r.faturamentoAvulsos;
  const gastos =
    contexto === 'ESCOLA' ? r.gastosEscola :
    contexto === 'AVULSOS' ? r.gastosAvulsos :
    r.gastos;
  return { faturamento, gastos };
}

function calcularKpis(faturamento, gastos, diasTrabalhados) {
  const lucro = faturamento - gastos;
  const margem = faturamento === 0 ? 0 : lucro / faturamento;
  const dizimo = lucro * 0.1;
  const oferta = lucro * 0.1;
  return { faturamento, gastos, lucro, margem, dizimo, oferta, diasTrabalhados };
}

export async function boot() {
  const el = document.getElementById('vg');
  el.innerHTML = `<div style="padding:60px;text-align:center"><div class="spinner"></div></div>`;

  const r = await buscarResultadosMensais();
  _resultados = r.resultados;
  _porArquivo = r.porArquivo;
  _porArquivoMap = new Map(_porArquivo.map((a) => [a.arquivo, a]));

  if (!_resultados.length) {
    el.innerHTML = `
      <div class="center-state">
        <div class="ico">📂</div>
        <h2>Nenhum dado sincronizado ainda</h2>
        <p>Assim que o vigia sincronizar o primeiro arquivo, os dados aparecem aqui.</p>
      </div>`;
    return;
  }

  buildPeriodoSelect();
  buildContextoSelect();
  await render();

  buscarUltimaSincronizacao().then((quando) => {
    const badge = document.getElementById('syncBadge');
    if (badge && quando) {
      const d = new Date(quando);
      badge.textContent = `última sincronização: ${d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    }
  });
}

function buildPeriodoSelect() {
  const sel = document.getElementById('selPeriodo');
  const opts = ['<option value="">Todos os períodos</option>']
    .concat(_resultados.slice().reverse().map((r) => `<option value="${r.mes}">${nomeMesAno(r.mes)}</option>`));
  sel.innerHTML = opts.join('');
  sel.value = _mesSelecionado;
  sel.onchange = async () => {
    _mesSelecionado = sel.value;
    // Se o arquivo selecionado não pertence ao novo período, limpa — senão
    // mantém (ex: usuário volta pro período do arquivo que já tinha escolhido).
    if (_arquivo) {
      const info = _porArquivoMap.get(_arquivo);
      if (!info || info.mes !== _mesSelecionado) _arquivo = '';
    }
    killCharts();
    await render();
  };
}

function buildContextoSelect() {
  const sel = document.getElementById('selContexto');
  sel.value = _contexto;
  sel.onchange = async () => {
    _contexto = sel.value;
    killCharts();
    await render();
  };
}

// Filtro "Arquivo" (Lote 34, ajustado no Lote 35) — o David pediu depois de
// precisar caçar na mão em qual arquivo estava um valor divergente do Qlik.
// Fica sempre visível (Lote 35: antes só aparecia com um período já
// escolhido) — com um período selecionado, lista só os arquivos daquele mês
// (o caso comum: 1, às vezes mais de um, ex. arquivo principal +
// "Prestadores"); em "Todos os períodos", lista TODO o histórico, permitindo
// pular direto pra um arquivo sem precisar escolher o período primeiro —
// escolher um arquivo ali muda o Período sozinho pro mês dele.
function buildArquivoSelect() {
  const lbl = document.getElementById('lblArquivo');
  const sel = document.getElementById('selArquivo');
  const candidatos = _mesSelecionado
    ? _porArquivo.filter((a) => a.mes === _mesSelecionado)
    : _porArquivo;

  if (!candidatos.length) {
    lbl.style.display = 'none';
    sel.style.display = 'none';
    sel.innerHTML = '';
    return;
  }

  lbl.style.display = '';
  sel.style.display = '';
  sel.innerHTML = ['<option value="">Todos os arquivos</option>']
    .concat(candidatos.map((a) => `<option value="${a.arquivo}">${a.arquivo}</option>`))
    .join('');
  sel.value = _arquivo;
  sel.onchange = async () => {
    _arquivo = sel.value;
    const info = _arquivo ? _porArquivoMap.get(_arquivo) : null;
    if (info && info.mes !== _mesSelecionado) {
      // Escolheu um arquivo de outro período (ex: veio de "Todos os
      // períodos") -> pula pro período dele, refaz tudo.
      _mesSelecionado = info.mes;
      const selPeriodo = document.getElementById('selPeriodo');
      if (selPeriodo) selPeriodo.value = _mesSelecionado;
      killCharts();
    }
    await render();
  };
}

function aplicarFiltroArquivo() {
  _detalhamentoAtual = _arquivo ? _detalhamentoTodos.filter((r) => r.arquivo === _arquivo) : _detalhamentoTodos;
  _gastosAtual = _arquivo ? _gastosTodos.filter((r) => r.arquivo === _arquivo) : _gastosTodos;
}

async function render() {
  const el = document.getElementById('vg');
  const todosOsPeriodos = _mesSelecionado === '';

  buildArquivoSelect();

  // KPIs + gráfico: com um Arquivo escolhido, mostra só a contribuição
  // daquele arquivo (Lote 35 — ponto principal do pedido do David: ver a
  // origem de um valor direto nos indicadores, não só nas tabelas);
  // "Todos os períodos" soma tudo; um mês específico compara com o mês
  // calendário anterior (igual ao painel anterior).
  let faturamento, gastos, diasTrabalhados, comp = null, tituloResumo;
  if (_arquivo) {
    const info = _porArquivoMap.get(_arquivo) || { faturamento: 0, gastos: 0 };
    faturamento = info.faturamento; gastos = info.gastos;
    // Sem comparação com o mês anterior aqui — não faz sentido comparar um
    // arquivo específico com o mês inteiro anterior.
    tituloResumo = `${nomeMesAno(_mesSelecionado)} — ${_arquivo}`;
  } else if (todosOsPeriodos) {
    let f = 0, g = 0;
    for (const r of _resultados) {
      const red = reduzirContexto(r, _contexto);
      f += red.faturamento; g += red.gastos;
    }
    faturamento = f; gastos = g;
    tituloResumo = 'Todos os períodos';
  } else {
    const atual = _resultados.find((r) => r.mes === _mesSelecionado);
    const redAtual = atual ? reduzirContexto(atual, _contexto) : { faturamento: 0, gastos: 0 };
    faturamento = redAtual.faturamento; gastos = redAtual.gastos;

    const anteriorMes = mesAnterior(_mesSelecionado);
    const anterior = _resultados.find((r) => r.mes === anteriorMes);
    if (anterior) {
      const redAnterior = reduzirContexto(anterior, _contexto);
      const lucroAtual = redAtual.faturamento - redAtual.gastos;
      const lucroAnterior = redAnterior.faturamento - redAnterior.gastos;
      comp = {
        faturamento: variacaoMoM(redAtual.faturamento, redAnterior.faturamento),
        gastos: variacaoMoM(redAtual.gastos, redAnterior.gastos),
        lucro: variacaoMoM(lucroAtual, lucroAnterior),
      };
    }
    tituloResumo = nomeMesAno(_mesSelecionado);
  }

  el.innerHTML = `<div style="padding:60px;text-align:center"><div class="spinner"></div></div>`;
  diasTrabalhados = await buscarDiasTrabalhados(_mesSelecionado, _contexto, _arquivo || null);

  const kpis = calcularKpis(faturamento, gastos, diasTrabalhados);

  el.innerHTML = `
  <div class="sec">
    <div class="sec-title">Resumo — ${tituloResumo}</div>
    <div class="kg">
      ${kpiHTML({ label: 'Faturamento', valor: fmt(kpis.faturamento), acc: 'var(--dourado)', comp: comp ? { variacao: comp.faturamento } : null })}
      ${kpiHTML({ label: 'Gastos', valor: fmt(kpis.gastos), acc: 'var(--terracota)', comp: comp ? { variacao: comp.gastos, inverted: true } : null })}
      ${kpiHTML({ label: 'Lucro', valor: fmt(kpis.lucro), acc: 'var(--sucesso)', comp: comp ? { variacao: comp.lucro } : null })}
      ${kpiHTML({ label: '% Lucro', valor: fmtPct(kpis.margem), acc: 'var(--petroleo)' })}
      ${kpiHTML({ label: 'Dias trabalhados', valor: String(kpis.diasTrabalhados), acc: 'var(--cafe)' })}
      ${kpiHTML({ label: 'Dízimo', valor: fmt(kpis.dizimo), acc: 'var(--vinho)' })}
      ${kpiHTML({ label: 'Oferta', valor: fmt(kpis.oferta), acc: 'var(--vinho)' })}
    </div>
  </div>

  <div class="sec">
    <div class="sec-title">Faturamento, gastos e lucro por mês</div>
    <div class="cg3">
      <div class="cc"><h3>Faturamento</h3><div class="ch"><canvas id="chFat"></canvas></div></div>
      <div class="cc"><h3>Gastos</h3><div class="ch"><canvas id="chGas"></canvas></div></div>
      <div class="cc"><h3>Lucro</h3><div class="ch"><canvas id="chLuc"></canvas></div></div>
    </div>
  </div>

  ${todosOsPeriodos ? `
  <div class="sec">
    <div class="sec-title">Lançamentos</div>
    <div class="center-state" style="min-height:160px">
      <div class="ico">🔎</div>
      <p>Em "Todos os períodos" não carregamos o histórico linha a linha (são milhares de pedidos) — era isso que deixava a página lenta. Escolha um período específico ali em cima pra ver o Detalhamento e os Gastos do mês.</p>
    </div>
  </div>` : `
  <div class="sec">
    <div class="sec-title">Detalhamento do período</div>
    <div class="tcard">
      <div class="tbar">
        <h3>Pedidos <span style="font-size:10px;font-weight:500;color:var(--t3)">(Escola)</span></h3>
        <button class="btn-export" id="btnExportarDet" type="button">⬇ Baixar Excel</button>
      </div>
      <div class="tw"><table><thead id="thDet"></thead><tbody id="tbDet"></tbody></table></div>
    </div>
  </div>
  <div class="sec">
    <div class="sec-title">Gastos do período</div>
    <div class="tcard">
      <div class="tbar"><h3>Gastos</h3></div>
      <div class="tw"><table><thead id="thGas"></thead><tbody id="tbGas"></tbody></table></div>
    </div>
  </div>`}
  `;

  renderGraficos(todosOsPeriodos);

  if (!todosOsPeriodos) {
    const [det, gas] = await Promise.all([
      buscarDetalhamentoEscola(_mesSelecionado),
      buscarGastosDetalhado(_mesSelecionado, _contexto),
    ]);
    _detalhamentoTodos = det;
    _gastosTodos = gas;
    aplicarFiltroArquivo();
    renderTabelaDetalhamento();
    renderTabelaGastos();
  }
}

function renderGraficos(todosOsPeriodos) {
  let serie = _resultados;
  if (!todosOsPeriodos) {
    const ano = _mesSelecionado.slice(0, 4);
    serie = _resultados.filter((r) => r.mes.startsWith(ano));
  }
  const labels = serie.map((r) => (todosOsPeriodos ? anoMesBarra(r.mes) : nomeMesCurto(r.mes)));
  const fats = serie.map((r) => Math.round(reduzirContexto(r, _contexto).faturamento));
  const gass = serie.map((r) => Math.round(reduzirContexto(r, _contexto).gastos));
  const lucs = serie.map((r, i) => fats[i] - gass[i]);

  mkC('chFat', { type: 'bar', data: { labels, datasets: [{ data: fats, backgroundColor: '#E3A63E', borderRadius: 6 }] }, options: barOpts() });
  mkC('chGas', { type: 'bar', data: { labels, datasets: [{ data: gass, backgroundColor: '#B5651D', borderRadius: 6 }] }, options: barOpts() });
  mkC('chLuc', { type: 'bar', data: { labels, datasets: [{ data: lucs, backgroundColor: '#3C8558', borderRadius: 6 }] }, options: barOpts() });
}

// Colunas replicadas 1:1 do relatório "Detalhamento | Entregas" que a
// Tereza já usa no Qlik Sense (mesma ordem, mesmos rótulos) — Lote 31.
const LABELS_DET = {
  anoMes: 'Ano/Mês', data: 'Data entrega',
  qtdMarmitas: 'Qtd. Marmitas', qtdLanches: 'Qtd. Lanches',
  valorUnitLanche: 'Lanches (unit.)', valorUnitMarmita: 'Marmitas (unit.)',
  valorTotalLanches: 'Valor Total Lanches', valorTotalMarmitas: 'Valor Total Marmitas',
  valorASerPago: 'Valor a ser pago', valorPago: 'Valor pago',
  obs: 'OBS', dataPagamento: 'Data pagamento',
};
const COLS_DET = [
  'anoMes', 'data', 'qtdMarmitas', 'qtdLanches',
  'valorUnitLanche', 'valorUnitMarmita', 'valorTotalLanches', 'valorTotalMarmitas',
  'valorASerPago', 'valorPago', 'obs', 'dataPagamento',
];
const COLS_DET_MOEDA = ['valorUnitLanche', 'valorUnitMarmita', 'valorTotalLanches', 'valorTotalMarmitas', 'valorASerPago', 'valorPago'];
const COLS_DET_NUM = new Set(['qtdMarmitas', 'qtdLanches', ...COLS_DET_MOEDA]);

function totaisDetalhamento() {
  const t = {};
  for (const c of COLS_DET_MOEDA) t[c] = _detalhamentoAtual.reduce((s, r) => s + num(r[c]), 0);
  return t;
}

function renderTabelaDetalhamento() {
  let rows = _detalhamentoAtual.slice();
  if (_sortCol) {
    const dir = _sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (COLS_DET_NUM.has(_sortCol)) return (num(av) - num(bv)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR') * dir;
    });
  }
  const formatCol = { data: 'data', dataPagamento: 'data', qtdMarmitas: 'centro', qtdLanches: 'centro', obs: 'obs' };
  for (const c of COLS_DET_MOEDA) formatCol[c] = 'moeda';

  renderTable('thDet', 'tbDet', COLS_DET, LABELS_DET, rows, {
    sortable: true, sortCol: _sortCol, sortDir: _sortDir,
    formatCol,
    onSort: (col) => {
      if (_sortCol === col) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      else { _sortCol = col; _sortDir = 'asc'; }
      renderTabelaDetalhamento();
    },
  });

  // Linha de Totais (Lote 30/31) — igual ao "Totais" do relatório do Qlik
  // Sense da Tereza: primeira linha da tabela, soma de TODO o período (não
  // só das linhas visíveis após ordenar). Réplica fiel do relatório
  // original: Qtd. Marmitas/Qtd. Lanches, OBS e Data pagamento ficam em
  // branco na linha de Totais (é assim que sai no Qlik), só as colunas de
  // valor somam.
  const tbody = document.getElementById('tbDet');
  if (tbody && _detalhamentoAtual.length) {
    const t = totaisDetalhamento();
    const totalRow = document.createElement('tr');
    totalRow.className = 'row-total';
    totalRow.innerHTML =
      `<td class="bold">Totais</td><td></td><td></td><td></td>` +
      COLS_DET_MOEDA.map((c) => `<td class="tr bold">${fmt(t[c])}</td>`).join('') +
      `<td></td><td></td>`;
    tbody.insertBefore(totalRow, tbody.firstChild);
  }

  document.getElementById('btnExportarDet')?.addEventListener('click', exportarDetalhamentoExcel);
}

// Excel do Detalhamento (Lote 30/31) — pra Tereza mandar pro tesoureiro da
// escola conferir e pagar (mesmo fluxo que já existia no painel Next.js
// antigo, Lote 10), com as mesmas colunas e ordem do relatório do Qlik
// Sense. Só entram pedidos de ESCOLA (buscarDetalhamentoEscola já garante
// isso) e a linha de Totais vai junto, igual à tabela na tela.
//
// Usa ExcelJS (não SheetJS/xlsx) porque precisamos colorir a célula de OBS
// quando preenchida — a versão gratuita do SheetJS não aplica estilo de
// célula (cor de fundo), só o ExcelJS faz isso no navegador sem backend.
const COR_CABECALHO = 'FFEAD9BE';   // --brd (bege) — mesma paleta do site
const COR_TOTAL = 'FFFBF6EA';       // --surf
const COR_OBS_DESTAQUE = 'FFFFF176'; // amarelo, igual ao Qlik

async function exportarDetalhamentoExcel() {
  if (typeof ExcelJS === 'undefined') {
    alert('Não consegui carregar a biblioteca de Excel — verifique sua internet e tente de novo.');
    return;
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Detalhamento');

  ws.columns = [
    { header: 'Ano/Mês', key: 'anoMes', width: 11 },
    { header: 'Data entrega', key: 'data', width: 13 },
    { header: 'Qtd. Marmitas', key: 'qtdMarmitas', width: 13 },
    { header: 'Qtd. Lanches', key: 'qtdLanches', width: 12 },
    { header: 'Lanches (unit.)', key: 'valorUnitLanche', width: 13 },
    { header: 'Marmitas (unit.)', key: 'valorUnitMarmita', width: 14 },
    { header: 'Valor Total Lanches', key: 'valorTotalLanches', width: 16 },
    { header: 'Valor Total Marmitas', key: 'valorTotalMarmitas', width: 17 },
    { header: 'Valor a ser pago', key: 'valorASerPago', width: 14 },
    { header: 'Valor pago', key: 'valorPago', width: 13 },
    { header: 'OBS', key: 'obs', width: 32 },
    { header: 'Data pagamento', key: 'dataPagamento', width: 14 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_CABECALHO } };
  headerRow.alignment = { vertical: 'middle' };

  const t = totaisDetalhamento();
  const linhaTotais = ws.addRow({ anoMes: 'Totais', ...t });
  linhaTotais.font = { bold: true };
  linhaTotais.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_TOTAL } };

  for (const r of _detalhamentoAtual) {
    const linha = ws.addRow({
      anoMes: r.anoMes || '-',
      data: fmtData(r.data),
      qtdMarmitas: r.qtdMarmitas || '-',
      qtdLanches: r.qtdLanches || '-',
      valorUnitLanche: r.valorUnitLanche,
      valorUnitMarmita: r.valorUnitMarmita,
      valorTotalLanches: r.valorTotalLanches,
      valorTotalMarmitas: r.valorTotalMarmitas,
      valorASerPago: r.valorASerPago,
      valorPago: r.valorPago,
      obs: r.obs || '-',
      dataPagamento: fmtData(r.dataPagamento),
    });
    if (r.obs) {
      linha.getCell('obs').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COR_OBS_DESTAQUE } };
    }
  }

  for (const key of COLS_DET_MOEDA) {
    ws.getColumn(key).numFmt = '"R$" #,##0.00';
    ws.getColumn(key).alignment = { horizontal: 'right' };
  }
  ws.getColumn('qtdMarmitas').alignment = { horizontal: 'center' };
  ws.getColumn('qtdLanches').alignment = { horizontal: 'center' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const rotuloPeriodo = _mesSelecionado ? nomeMesAno(_mesSelecionado) : 'Todos os periodos';
  a.href = url;
  a.download = `Detalhamento Escola - ${rotuloPeriodo}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const LABELS_GAS = { data: 'Data', pessoaLocal: 'Pessoa/local', tipoPagamento: 'Pagamento', valor: 'Valor' };
const COLS_GAS = ['data', 'pessoaLocal', 'tipoPagamento', 'valor'];

function renderTabelaGastos() {
  renderTable('thGas', 'tbGas', COLS_GAS, LABELS_GAS, _gastosAtual, {
    formatCol: { valor: 'moeda' },
  });
}
