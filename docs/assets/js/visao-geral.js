import {
  buscarResultadosMensais, buscarDiasTrabalhados, buscarDetalhamentoEscola,
  buscarGastosDetalhado, buscarUltimaSincronizacao, buscarGastosIndicadores, buscarEntregasEscola,
} from './dados.js';
import {
  fmt, fmtPct, num, mkC, killCharts, barOpts, kpiHTML, renderTable,
  nomeMesAno, nomeMesCurto, anoMesBarra, mesAnterior, variacaoMoM, fmtData,
} from './utils.js';
import { feriadoEm, proximosFeriadosUteis, iso } from './feriados.js';

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
    <div class="sec-title">Indicadores de gastos</div>
    <div class="rg rg4" id="gastosInd"><div class="cc" style="grid-column:1/-1;padding:40px"><div class="spinner"></div></div></div>
  </div>

  ${_contexto !== 'AVULSOS' ? `
  <div class="sec">
    <div class="sec-title">Alunos por dia da semana (Escola)</div>
    <div id="alunosSemana"><div class="cc" style="padding:40px"><div class="spinner"></div></div></div>
  </div>
  <div class="sec">
    <div class="sec-title">Calendário de entregas e feriados (Escola)</div>
    <div id="calendarioEsc"><div class="cc" style="padding:40px"><div class="spinner"></div></div></div>
  </div>` : ''}

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

  renderIndicadoresGastos();
  if (_contexto !== 'AVULSOS') renderEscolaSemanaECalendario();

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

// ─── Indicadores de gastos (Lote 48, 2026-10-07) ────────────────────────────
// Pedido do David: tirar os 3 gráficos de barras (Faturamento/Gastos/Lucro
// por mês) e colocar no lugar indicadores de gastos — onde mais gasta
// (Fornecedor / Pessoa), dia da semana que mais gasta, categoria mais usada
// (nº de lançamentos) e categoria que mais consome (R$). Respeitam Período,
// Contexto e Arquivo, igual aos KPIs.
const _topGastos = { onde: 5, catUso: 5, catValor: 5 };
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
let _gastosInd = [];

function chaveTxt(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function agruparGastos(linhas, campo) {
  const m = new Map();
  for (const l of linhas) {
    const k = chaveTxt(l[campo]);
    if (!m.has(k)) m.set(k, { nome: l[campo], valor: 0, compras: new Set() });
    const g = m.get(k); g.valor += l.valor; g.compras.add(l.compra);
  }
  // qtd = nº de COMPRAS distintas (Lote 49), não de linhas da planilha —
  // a mesma nota lançada pela metade em ESCOLA e AVULSAS conta 1 vez.
  return Array.from(m.values()).map((g) => ({ nome: g.nome, valor: g.valor, qtd: g.compras.size }));
}

async function renderIndicadoresGastos() {
  const alvo = document.getElementById('gastosInd');
  if (!alvo) return;
  try {
    const todas = await buscarGastosIndicadores(_mesSelecionado, _contexto);
    _gastosInd = _arquivo ? todas.filter((l) => l.arquivo === _arquivo) : todas;
  } catch (e) {
    console.error(e);
    alvo.innerHTML = `<div class="cc" style="grid-column:1/-1"><p class="rk-vazio">Não consegui carregar os gastos.</p></div>`;
    return;
  }
  const linhas = _gastosInd.filter((l) => l.valor > 0);
  const total = linhas.reduce((s, l) => s + l.valor, 0);

  const dias = DIAS_SEMANA.map((nome) => ({ nome, valor: 0, compras: new Set() }));
  for (const l of linhas) {
    if (!l.data) continue;
    const [a, m, d] = l.data.split('-').map(Number);
    const g = dias[new Date(a, m - 1, d).getDay()];
    g.valor += l.valor; g.compras.add(l.compra);
  }
  dias.forEach((g) => { g.qtd = g.compras.size; });

  const listas = {
    onde: agruparGastos(linhas, 'fornecedor').sort((a, b) => b.valor - a.valor),
    semana: dias.filter((d) => d.qtd).sort((a, b) => b.valor - a.valor),
    catUso: agruparGastos(linhas, 'categoria').sort((a, b) => b.qtd - a.qtd || b.valor - a.valor),
    catValor: agruparGastos(linhas, 'categoria').sort((a, b) => b.valor - a.valor),
  };
  const cards = [
    ['onde', '🛒 Onde mais gasta', 'valor'],
    ['semana', '📅 Dia da semana que mais gasta', 'valor'],
    ['catUso', '🏷️ Categoria mais usada', 'qtd'],
    ['catValor', '💸 Categoria que mais consome', 'valor'],
  ];
  alvo.innerHTML = cards.map(([id, titulo]) => `
    <div class="cc rk">
      <div class="rk-hd">
        <h3>${titulo}</h3>
        ${id !== 'semana' ? `<div class="chips" data-rank="${id}">${[5, 10, 15].map((n) =>
          `<button type="button" class="chip${_topGastos[id] === n ? ' on' : ''}" data-n="${n}">Top ${n}</button>`).join('')}</div>` : ''}
      </div>
      <div id="gi-${id}"></div>
    </div>`).join('');

  const desenhar = (id, medida) => {
    const el = document.getElementById(`gi-${id}`);
    const arr = id === 'semana' ? listas.semana : listas[id].slice(0, _topGastos[id]);
    if (!arr.length) { el.innerHTML = `<p class="rk-vazio">Sem gastos no período</p>`; return; }
    const max = Math.max(...arr.map((r) => r[medida]), 1);
    el.innerHTML = `<ol class="rk-list">${arr.map((r, i) => {
      const pct = total ? (r.valor / total) * 100 : 0;
      const valorTxt = medida === 'qtd' ? `${r.qtd} compra${r.qtd === 1 ? '' : 's'}` : fmt(r.valor);
      const det = medida === 'qtd'
        ? `${fmt(r.valor)} · ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do gasto`
        : `${r.qtd} compra${r.qtd === 1 ? '' : 's'} · ${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do gasto`;
      return `<li>
        <span class="rk-pos">${i + 1}</span>
        <div class="rk-body">
          <div class="rk-top"><span class="rk-nome" title="${r.nome}">${r.nome}</span><span class="rk-val">${valorTxt}</span></div>
          <div class="rk-bar"><span style="width:${Math.max(2, (r[medida] / max) * 100)}%;background:var(--terracota)"></span></div>
          <div class="rk-det">${det}</div>
        </div>
      </li>`;
    }).join('')}</ol>`;
  };
  cards.forEach(([id, , medida]) => desenhar(id, medida));

  alvo.querySelectorAll('.chips').forEach((grp) => {
    grp.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      const id = grp.dataset.rank;
      _topGastos[id] = Number(b.dataset.n);
      grp.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
      desenhar(id, cards.find((c) => c[0] === id)[2]);
    });
  });
}

// ─── Alunos por dia da semana + calendário (Lote 52/53) ─────────────────────
// Pedido do David: a quantidade de quentinhas de ALUNOS num dia = nº de
// alunos almoçando na escola naquele dia. Sai direto das entregas (período
// pelo NOME do arquivo, critério de sempre). Linhas de professores
// ("professor" na OBS -> tipo_lancamento PROFESSORES) ficam à parte.
//
// Lote 53 (2026-10-12): trocada a MÉDIA do mês pelo número INTEIRO atual —
// a média escondia o que interessa ("14,8 alunos" não existe; o que
// aconteceu foi "a segunda caiu de 15 pra 14 em 05/10"). Agora cada dia da
// semana mostra a quantidade da última entrega lançada até hoje naquele
// dia, comparada com a última do mês anterior, e embaixo um registro
// automático das mudanças (data, de → para, OBS da linha). A aba
// DiasAlmoco da planilha deixou de ser referência.
const DIAS_UTEIS = [1, 2, 3, 4, 5];
const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const NOME_DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const OBS_PADRAO_PROF = /marmita para os professores/i;
let _entregasEsc = [];
let _calMes = null;      // 'AAAA-MM' mostrado no calendário
let _calDiaSel = null;   // 'AAAA-MM-DD' clicado

const dowDe = (dataIso) => { const [a, m, d] = dataIso.split('-').map(Number); return new Date(a, m - 1, d).getDay(); };
const fmtN = (v) => (Number.isInteger(v) ? String(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const hojeIsoLocal = () => new Date().toLocaleDateString('sv-SE');

// Soma por DATA: alunos, professores e OBS (sem a OBS padrão dos professores).
function porData(linhas) {
  const m = new Map();
  for (const l of linhas) {
    if (!m.has(l.data)) m.set(l.data, { data: l.data, alunos: 0, prof: 0, obs: new Set() });
    const d = m.get(l.data);
    if (l.professores) d.prof += l.marmitas; else d.alunos += l.marmitas;
    if (l.obs && !OBS_PADRAO_PROF.test(l.obs)) d.obs.add(l.obs);
  }
  return [...m.values()].filter((d) => d.alunos || d.prof).sort((a, b) => a.data.localeCompare(b.data));
}

// Quantidade ATUAL por dia da semana: a última entrega lançada até hoje
// (se o arquivo só tiver datas futuras — entregas já lançadas pra frente —
// usa a primeira delas).
function resumoSemana(linhas) {
  const dias = porData(linhas);
  const hoje = hojeIsoLocal();
  const out = {};
  for (const dow of DIAS_UTEIS) {
    const doDia = dias.filter((d) => dowDe(d.data) === dow);
    const passados = doDia.filter((d) => d.data <= hoje);
    const ref = passados.length ? passados[passados.length - 1] : doDia[0];
    out[dow] = { dias: doDia.length, alunos: ref ? ref.alunos : null, prof: ref ? ref.prof : null, data: ref ? ref.data : null };
  }
  out.total = DIAS_UTEIS.reduce((s, d) => s + (out[d].alunos ?? 0), 0);
  return out;
}

// Registro de mudanças: cada entrega do período cuja quantidade de alunos é
// diferente da entrega anterior do MESMO dia da semana (a anterior pode ser
// de outro arquivo — pega a virada de um mês pro outro também).
function mudancasNoPeriodo(linhasPeriodo) {
  const todas = porData(_entregasEsc);
  const datasPeriodo = new Set(linhasPeriodo.map((l) => l.data));
  const out = [];
  for (const dow of DIAS_UTEIS) {
    const seq = todas.filter((d) => dowDe(d.data) === dow && d.alunos > 0);
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1], b = seq[i];
      if (datasPeriodo.has(b.data) && a.alunos !== b.alunos) {
        out.push({ data: b.data, dow, de: a.alunos, para: b.alunos, anterior: a.data, obs: [...b.obs].join(' · ') });
      }
    }
  }
  return out.sort((x, y) => x.data.localeCompare(y.data));
}

async function renderEscolaSemanaECalendario() {
  const alvoSem = document.getElementById('alunosSemana');
  const alvoCal = document.getElementById('calendarioEsc');
  try {
    _entregasEsc = await buscarEntregasEscola();
  } catch (e) {
    console.error(e);
    if (alvoSem) alvoSem.innerHTML = `<div class="cc"><p class="rk-vazio">Não consegui carregar as entregas da escola.</p></div>`;
    if (alvoCal) alvoCal.innerHTML = '';
    return;
  }
  if (!document.getElementById('alunosSemana')) return; // página re-renderizou no meio
  renderAlunosSemana();
  const mesesComEntrega = [...new Set(_entregasEsc.map((l) => l.mes))].sort();
  _calMes = _mesSelecionado || new Date().toLocaleDateString('sv-SE').slice(0, 7);
  if (!_mesSelecionado && !mesesComEntrega.length) _calMes = new Date().toLocaleDateString('sv-SE').slice(0, 7);
  _calDiaSel = null;
  renderCalendario();
}

function renderAlunosSemana() {
  const alvo = document.getElementById('alunosSemana');
  const meses = [...new Set(_entregasEsc.map((l) => l.mes))].sort();
  if (!meses.length) { alvo.innerHTML = `<div class="cc"><p class="rk-vazio">Sem entregas da escola.</p></div>`; return; }
  // Mês analisado: o do filtro Período (ou o mais recente em "Todos os períodos").
  const mes = _mesSelecionado && meses.includes(_mesSelecionado) ? _mesSelecionado : (_mesSelecionado ? null : meses[meses.length - 1]);
  if (!mes) { alvo.innerHTML = `<div class="cc"><p class="rk-vazio">Sem entregas da escola em ${nomeMesAno(_mesSelecionado)}.</p></div>`; return; }
  const doArquivo = _arquivo && _entregasEsc.some((l) => l.arquivo === _arquivo);
  const linhasPeriodo = _entregasEsc.filter((l) => (doArquivo ? l.arquivo === _arquivo : l.mes === mes));
  const atual = resumoSemana(linhasPeriodo);
  const mesAnt = mesAnterior(mes);
  const temAnt = meses.includes(mesAnt);
  const ant = temAnt ? resumoSemana(_entregasEsc.filter((l) => l.mes === mesAnt)) : null;

  const variacao = (a, b) => {
    if (a == null || b == null) return '';
    const d = a - b;
    if (d === 0) return `<div class="al-var al-igual">= igual a ${nomeMesCurto(mesAnt)} (${b})</div>`;
    return `<div class="al-var ${d > 0 ? 'al-up' : 'al-down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} vs. ${nomeMesCurto(mesAnt)} (${b})</div>`;
  };

  const cards = DIAS_UTEIS.map((dow) => {
    const a = atual[dow], b = ant ? ant[dow] : null;
    const desde = a.data ? `em ${fmtData(a.data).slice(0, 5)}` : 'sem entrega';
    return `<div class="kpi al-card" style="--acc:var(--petroleo)">
      <div class="k-lbl">${NOME_DIA[dow]}</div>
      <div class="k-val">${a.alunos == null ? '—' : a.alunos} <span class="al-un">alunos</span></div>
      ${variacao(a.alunos, b ? b.alunos : null)}
      <div class="k-sub">${desde}${a.prof ? ` · +${a.prof} prof.` : ''}</div>
    </div>`;
  }).join('');
  const total = `<div class="kpi al-card" style="--acc:var(--cafe)">
      <div class="k-lbl">Total na semana</div>
      <div class="k-val">${atual.total} <span class="al-un">almoços</span></div>
      ${variacao(atual.total, ant ? ant.total : null)}
      <div class="k-sub">soma de seg a sex</div>
    </div>`;

  const mud = mudancasNoPeriodo(linhasPeriodo);
  const registro = `
    <div class="cc al-mud">
      <h3>Mudanças no período <span class="h3-sub">(alunos por dia, comparado com o mesmo dia da semana anterior)</span></h3>
      ${mud.length ? `<ul>${mud.map((m) => `
        <li class="${m.para > m.de ? 'al-up' : 'al-down'}">
          <b>${fmtData(m.data).slice(0, 5)} (${NOME_DIA_CURTO[m.dow].toLowerCase()})</b>
          <span>${m.de} → ${m.para} alunos ${m.para > m.de ? '▲' : '▼'} ${Math.abs(m.para - m.de)}</span>
          ${m.obs ? `<em>OBS: ${m.obs}</em>` : ''}
        </li>`).join('')}</ul>` : '<p class="rk-vazio">Nenhuma mudança de quantidade no período — mesmos alunos em todas as semanas.</p>'}
    </div>`;

  // Evolução: total de almoços/semana (quantidade atual) em cada mês do ano.
  const ano = mes.slice(0, 4);
  const serie = meses.filter((m) => m.startsWith(ano)).map((m) => ({ m, t: resumoSemana(_entregasEsc.filter((l) => l.mes === m)).total }));

  alvo.innerHTML = `
    <p class="al-nota">${doArquivo ? `Arquivo <b>${_arquivo}</b>` : `<b>${nomeMesAno(mes)}</b>`} — quantos alunos almoçam em cada dia da semana (última entrega lançada até hoje), comparado com o fim do mês anterior.${temAnt ? '' : ' Sem mês anterior pra comparar.'}</p>
    <div class="kg al-grid">${cards}${total}</div>
    ${registro}
    <div class="cc" style="margin-top:14px"><h3>Almoços por semana — evolução ${ano}</h3><div class="ch"><canvas id="chAlunos"></canvas></div></div>`;

  mkC('chAlunos', {
    type: 'bar',
    data: { labels: serie.map((x) => nomeMesCurto(x.m)), datasets: [{ data: serie.map((x) => x.t), backgroundColor: serie.map((x) => (x.m === mes ? '#2C6E7F' : '#9DC0C9')), borderRadius: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => nomeMesAno(serie[c[0].dataIndex].m), label: (c) => ` ${c.raw} almoços/semana` } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: '#EFE6D8' } }, x: { ticks: { font: { size: 10 } }, grid: { display: false } } },
    },
  });
}

function renderCalendario() {
  const alvo = document.getElementById('calendarioEsc');
  if (!alvo) return;
  const [ano, mes] = _calMes.split('-').map(Number);
  const hojeIso = new Date().toLocaleDateString('sv-SE');

  // entregas do mês do calendário (pela DATA, qualquer arquivo)
  const porDia = new Map();
  for (const l of _entregasEsc) {
    if (!l.data.startsWith(_calMes)) continue;
    if (!porDia.has(l.data)) porDia.set(l.data, { alunos: 0, prof: 0, lanches: 0, valor: 0, arquivos: new Set() });
    const d = porDia.get(l.data);
    if (l.professores) d.prof += l.marmitas; else d.alunos += l.marmitas;
    d.lanches += l.lanches; d.valor += l.valor; d.arquivos.add(l.arquivo);
  }

  const primeiro = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const celulas = [];
  for (let i = 0; i < primeiro.getDay(); i++) celulas.push('<div class="cal-cel cal-vazio"></div>');
  let feriadosUteis = 0, diasEntrega = 0;
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const data = `${_calMes}-${String(dia).padStart(2, '0')}`;
    const dow = new Date(ano, mes - 1, dia).getDay();
    const fer = feriadoEm(data);
    const ent = porDia.get(data);
    const fds = dow === 0 || dow === 6;
    if (fer && !fds) feriadosUteis++;
    if (ent) diasEntrega++;
    const cls = ['cal-cel'];
    if (fds) cls.push('cal-fds');
    if (fer) cls.push('cal-feriado');
    if (ent) cls.push('cal-entrega');
    if (fer && ent) cls.push('cal-conflito');
    if (data === hojeIso) cls.push('cal-hoje');
    if (data > hojeIso && ent) cls.push('cal-previsto');
    if (data === _calDiaSel) cls.push('cal-sel');
    const conteudo = fer
      ? `<span class="cal-tag cal-tag-fer" title="${fer.nome}">${fer.nome}</span>${ent ? '<span class="cal-tag cal-tag-alerta">⚠ entrega lançada</span>' : (fds ? '' : '<span class="cal-sem">sem entrega</span>')}`
      : ent ? `<span class="cal-qtd">🍱 ${ent.alunos + ent.prof}</span>` : '';
    celulas.push(`<button type="button" class="${cls.join(' ')}" data-dia="${data}"><span class="cal-num">${dia}</span>${conteudo}</button>`);
  }

  const proximos = proximosFeriadosUteis(60);
  const avisos = proximos.length ? `<div class="cal-avisos">${proximos.map((f) => `
      <div class="cal-aviso${f.emDias <= 7 ? ' cal-aviso-perto' : ''}">📅 <b>${fmtData(f.data).slice(0, 5)} (${NOME_DIA[f.dow].toLowerCase()})</b> — ${f.nome}: <b>não teremos entrega</b>${f.emDias === 0 ? ' · hoje' : f.emDias === 1 ? ' · amanhã' : ` · em ${f.emDias} dias`}</div>`).join('')}</div>` : '';

  alvo.innerHTML = `
    ${avisos}
    <div class="cc cal-card">
      <div class="cal-hd">
        <button type="button" class="cal-nav" data-nav="-1" aria-label="Mês anterior">◀</button>
        <div class="cal-titulo">${nomeMesAno(_calMes)}<span>${diasEntrega} dia${diasEntrega === 1 ? '' : 's'} com entrega · ${feriadosUteis} feriado${feriadosUteis === 1 ? '' : 's'} em dia útil</span></div>
        <button type="button" class="cal-nav" data-nav="1" aria-label="Próximo mês">▶</button>
      </div>
      <div class="cal-grid">
        ${NOME_DIA_CURTO.map((d) => `<div class="cal-dow">${d}</div>`).join('')}
        ${celulas.join('')}
      </div>
      <div class="cal-legenda">
        <span><i class="lg lg-ent"></i>com entrega (nº de quentinhas)</span>
        <span><i class="lg lg-prev"></i>prevista (lançada pra frente)</span>
        <span><i class="lg lg-fer"></i>feriado — sem entrega</span>
        <span><i class="lg lg-hoje"></i>hoje</span>
      </div>
      <div id="calDetalhe" class="cal-detalhe">${detalheDia(_calDiaSel, porDia)}</div>
    </div>`;

  alvo.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    const d = new Date(ano, mes - 1 + Number(b.dataset.nav), 1);
    _calMes = iso(d).slice(0, 7);
    _calDiaSel = null;
    renderCalendario();
  }));
  alvo.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => {
    _calDiaSel = _calDiaSel === b.dataset.dia ? null : b.dataset.dia;
    renderCalendario();
  }));
}

function detalheDia(data, porDia) {
  if (!data) return '<span class="cal-dica">Toque num dia pra ver o detalhe.</span>';
  const dow = dowDe(data);
  const fer = feriadoEm(data);
  const ent = porDia.get(data);
  const hojeIso = new Date().toLocaleDateString('sv-SE');
  const titulo = `<b>${NOME_DIA[dow]}, ${fmtData(data)}</b>`;
  const partes = [titulo];
  if (fer) partes.push(`<div class="cal-det-fer">🎌 ${fer.nome} <small>(${fer.tipo})</small> — ${ent ? '<b>atenção: tem entrega lançada nesse feriado, confira a planilha</b>' : 'não teremos entrega'}</div>`);
  if (ent) {
    partes.push(`<div>${data > hojeIso ? '🗓️ Entrega prevista' : '🍱 Entrega'}: <b>${ent.alunos} aluno${ent.alunos === 1 ? '' : 's'}</b>${ent.prof ? ` + ${ent.prof} professor${ent.prof === 1 ? '' : 'es'}` : ''}${ent.lanches ? ` · ${ent.lanches} lanche${ent.lanches === 1 ? '' : 's'}` : ''} · ${fmt(ent.valor)}</div>`);
    partes.push(`<div class="cal-det-arq">${[...ent.arquivos].join(', ')}</div>`);
  } else if (!fer) {
    partes.push(`<div>${dow === 0 || dow === 6 ? 'Fim de semana.' : 'Nenhuma entrega lançada nesse dia.'}</div>`);
  }
  return partes.join('');
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
