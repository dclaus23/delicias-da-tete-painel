import {
  buscarResultadosMensais, buscarDiasTrabalhados, buscarDetalhamento,
  buscarGastosDetalhado, buscarUltimaSincronizacao,
} from './dados.js';
import {
  fmt, fmtPct, num, mkC, killCharts, barOpts, kpiHTML, renderTable,
  nomeMesAno, nomeMesCurto, anoMesBarra, mesAnterior, variacaoMoM,
} from './utils.js';

let _resultados = [];
let _mesSelecionado = '';   // '' = Todos os períodos
let _contexto = 'TODOS';
let _sortCol = null;
let _sortDir = 'asc';
let _detalhamentoAtual = [];
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

  _resultados = await buscarResultadosMensais();

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

async function render() {
  const el = document.getElementById('vg');
  const todosOsPeriodos = _mesSelecionado === '';

  // KPIs + gráfico: "Todos os períodos" soma tudo; um mês específico compara
  // com o mês calendário anterior (igual ao painel anterior).
  let faturamento, gastos, diasTrabalhados, comp = null, tituloResumo;
  if (todosOsPeriodos) {
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
  diasTrabalhados = await buscarDiasTrabalhados(_mesSelecionado, _contexto);

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
      <div class="tbar"><h3>Pedidos</h3></div>
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
      buscarDetalhamento(_mesSelecionado, _contexto),
      buscarGastosDetalhado(_mesSelecionado, _contexto),
    ]);
    _detalhamentoAtual = det;
    _gastosAtual = gas;
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

const LABELS_DET = { data: 'Data', origem: 'Origem', quem: 'Quem', qtdMarmitas: 'Marmitas', qtdLanches: 'Lanches', valorTotal: 'Valor', obs: 'Obs.' };
const COLS_DET = ['data', 'origem', 'quem', 'qtdMarmitas', 'qtdLanches', 'valorTotal', 'obs'];

function renderTabelaDetalhamento() {
  let rows = _detalhamentoAtual.slice();
  if (_sortCol) {
    const dir = _sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[_sortCol], bv = b[_sortCol];
      if (_sortCol === 'valorTotal' || _sortCol === 'qtdMarmitas' || _sortCol === 'qtdLanches') return (num(av) - num(bv)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR') * dir;
    });
  }
  renderTable('thDet', 'tbDet', COLS_DET, LABELS_DET, rows, {
    sortable: true, sortCol: _sortCol, sortDir: _sortDir,
    formatCol: { valorTotal: 'moeda', qtdMarmitas: 'centro', qtdLanches: 'centro' },
    onSort: (col) => {
      if (_sortCol === col) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
      else { _sortCol = col; _sortDir = 'asc'; }
      renderTabelaDetalhamento();
    },
  });
}

const LABELS_GAS = { data: 'Data', pessoaLocal: 'Pessoa/local', tipoPagamento: 'Pagamento', valor: 'Valor' };
const COLS_GAS = ['data', 'pessoaLocal', 'tipoPagamento', 'valor'];

function renderTabelaGastos() {
  renderTable('thGas', 'tbGas', COLS_GAS, LABELS_GAS, _gastosAtual, {
    formatCol: { valor: 'moeda' },
  });
}
