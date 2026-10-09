// Página "Cobrança" (Lote 51, 2026-10-08) — facilitar a cobrança dos
// pedidos avulsos em aberto. Regras em dados-cobranca.js.
//
// Quem cobra é a esposa do David, pelo celular: cada cliente tem a mensagem
// pronta e um botão que abre o WhatsApp já com o texto (link wa.me). Antes
// disso, se caiu um Pix do cliente que ainda não teve baixa na planilha, o
// card fica travado em "Conferir Pix" — o David confere/lança primeiro.
import { buscarCobrancas, DIAS_COBRAR, DIAS_AVISO } from './dados-cobranca.js';
import { fmt, fmtData } from './utils.js';

// Chave Pix que vai na mensagem. Deixe vazio ('') pra não mostrar a linha.
const CHAVE_PIX = '';

let _lista = [];
let _filtro = 'TODOS';
let _carregado = false;
let _promessa = null;

const STATUS = {
  CONFERIR: { rotulo: '🔎 Conferir Pix', classe: 'cb-conferir' },
  COBRAR: { rotulo: `🔴 Cobrar (${DIAS_COBRAR}+ dias)`, classe: 'cb-cobrar' },
  EM_BREVE: { rotulo: '🟡 Vence em breve', classe: 'cb-breve' },
  AGUARDANDO: { rotulo: '⚪ Aguardando', classe: 'cb-aguardando' },
};

// Carrega uma vez e reaproveita (o selo de alerta do menu também usa).
function carregar() {
  if (!_promessa) _promessa = buscarCobrancas().then((l) => { _lista = l; return l; });
  return _promessa;
}

// Nº de clientes que pedem ação agora (cobrar ou conferir Pix) — selo no menu.
export async function contarAlertas() {
  const l = await carregar();
  return l.filter((c) => c.status === 'COBRAR' || c.status === 'CONFERIR').length;
}

export async function boot() {
  if (_carregado) return;
  const el = document.getElementById('cb');
  el.innerHTML = `<div style="padding:60px;text-align:center"><div class="spinner"></div></div>`;
  await carregar();
  _carregado = true;
  const sel = document.getElementById('selStatusCB');
  sel.value = _filtro;
  sel.onchange = () => { _filtro = sel.value; render(); };
  render();
}

// ─── "Já cobrei" — lembrado só neste aparelho (localStorage) ────────────────
// É o celular de quem cobra que importa; se o navegador não deixar guardar,
// a página funciona igual, só não lembra.
const CHAVE_LS = 'dt-cobrados';
function lerCobrados() {
  try { return JSON.parse(localStorage.getItem(CHAVE_LS) || '{}'); } catch { return {}; }
}
function marcarCobrado(chave, valor) {
  const m = lerCobrados();
  if (valor) m[chave] = valor; else delete m[chave];
  try { localStorage.setItem(CHAVE_LS, JSON.stringify(m)); } catch { /* sem armazenamento */ }
}
const hojeIso = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD local

// ─── Mensagem ───────────────────────────────────────────────────────────────
function primeiroNome(nome) {
  const p = (nome || '').trim().split(/\s+/)[0] || '';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

function montarMensagem(c) {
  const linhas = c.pedidos.map((p) => {
    const qtd = p.qtdMarmitas > 1 ? ` (${p.qtdMarmitas}x)` : '';
    const prato = p.pedido && p.pedido !== '(não informado)' ? ` — ${p.pedido}${qtd}` : qtd;
    return `• ${fmtData(p.data).slice(0, 5)}${prato} — ${fmt(p.valorComTaxa)}`;
  });
  return [
    `Oi, ${primeiroNome(c.nome)}! Tudo bem? 😊`,
    `Aqui é da Delícias da Tetê. Passando pra lembrar ${c.pedidos.length > 1 ? 'das quentinhas que ficaram' : 'da quentinha que ficou'} em aberto:`,
    '',
    ...linhas,
    '',
    `*Total: ${fmt(c.total)}*`,
    CHAVE_PIX ? `Pode fazer o Pix pra chave: ${CHAVE_PIX}` : null,
    '',
    'Se já pagou, é só me mandar o comprovante que eu dou baixa. Obrigada! 🙏',
  ].filter((l) => l !== null).join('\n');
}

// ─── Render ─────────────────────────────────────────────────────────────────
function render() {
  const el = document.getElementById('cb');
  const cobrados = lerCobrados();
  const por = (s) => _lista.filter((c) => c.status === s);
  const soma = (arr) => arr.reduce((s, c) => s + c.total, 0);
  const conferir = por('CONFERIR');

  const resumo = `
  <div class="kg">
    ${kpi('Para cobrar', por('COBRAR'), 'var(--alerta)', `${DIAS_COBRAR}+ dias sem pagar`)}
    ${kpi('Vence em breve', por('EM_BREVE'), 'var(--dourado)', `${DIAS_AVISO}–${DIAS_COBRAR - 1} dias`)}
    ${kpi('Conferir Pix', conferir, 'var(--petroleo)', 'Pix caiu, falta baixa na planilha')}
    ${kpi('Total em aberto', _lista, 'var(--cafe)', 'tudo que falta pagar')}
  </div>`;

  const aviso = conferir.length ? `
  <div class="cb-aviso">
    <strong>⚠ David, confira antes da cobrança:</strong>
    ${conferir.length} cliente${conferir.length === 1 ? '' : 's'} com Pix recebido que ainda não teve baixa na planilha de Avulsas.
    Se for pagamento desses pedidos, preencha "Valor pago" e "Data pagamento" — o card sai daqui sozinho na próxima sincronização.
  </div>` : '';

  const visiveis = _filtro === 'TODOS' ? _lista
    : _filtro === 'ACAO' ? _lista.filter((c) => c.status === 'COBRAR' || c.status === 'CONFERIR')
    : _lista.filter((c) => c.status === _filtro);

  const cards = visiveis.length
    ? visiveis.map((c) => cardHTML(c, cobrados[c.chave])).join('')
    : `<div class="center-state" style="min-height:200px"><div class="ico">🎉</div><h2>${_lista.length ? 'Nada nesse filtro' : 'Ninguém devendo'}</h2><p>${_lista.length ? 'Troque o filtro ali em cima pra ver os outros clientes.' : 'Todos os pedidos avulsos estão com "Valor pago" preenchido.'}</p></div>`;

  el.innerHTML = `
  <div class="sec"><div class="sec-title">Resumo da cobrança</div>${resumo}</div>
  ${aviso}
  <div class="sec"><div class="sec-title">Clientes em aberto</div><div class="cb-grid">${cards}</div></div>`;

  el.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', async () => {
    const c = _lista.find((x) => x.chave === b.dataset.copiar);
    try { await navigator.clipboard.writeText(montarMensagem(c)); b.textContent = '✓ Copiada'; }
    catch { b.textContent = 'Selecione o texto e copie'; }
    setTimeout(() => { b.textContent = '📋 Copiar mensagem'; }, 2000);
  }));
  el.querySelectorAll('[data-cobrado]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.cobrado;
    marcarCobrado(k, lerCobrados()[k] ? null : hojeIso());
    render();
  }));
}

function kpi(label, arr, acc, sub) {
  const total = arr.reduce((s, c) => s + c.total, 0);
  return `<div class="kpi" style="--acc:${acc}">
    <div class="k-lbl">${label}</div>
    <div class="k-val">${fmt(total)}</div>
    <div class="k-sub">${arr.length} cliente${arr.length === 1 ? '' : 's'} · ${sub}</div>
  </div>`;
}

function cardHTML(c, cobradoEm) {
  const st = STATUS[c.status];
  const msg = montarMensagem(c);
  const link = c.celular ? `https://wa.me/${c.celular}?text=${encodeURIComponent(msg)}` : null;
  const bloqueado = c.status === 'CONFERIR';

  const prazo = c.dias >= DIAS_COBRAR
    ? `${c.dias} dias em aberto`
    : `${c.dias} dia${c.dias === 1 ? '' : 's'} · cobrar a partir de ${fmtData(c.venceEm).slice(0, 5)}`;

  const pixInfo = bloqueado ? `
    <div class="cb-pix">
      <strong>Pix sem baixa: ${fmt(c.pixSemBaixa)}</strong>
      ${c.pixRecentes.map((x) => `<span>${fmtData(x.data).slice(0, 5)} · ${fmt(x.valor)}</span>`).join('')}
      <em>Provavelmente já pagou — o David confere antes de cobrar.</em>
    </div>` : '';

  const botaoZap = bloqueado
    ? `<span class="cb-btn cb-btn-off">⏸ Aguardando conferência</span>`
    : link
      ? `<a class="cb-btn cb-btn-zap" href="${link}" target="_blank" rel="noopener">💬 Abrir WhatsApp</a>`
      : `<span class="cb-btn cb-btn-off" title="Cadastre o celular em BaseDados_Celular.xlsx">📵 Sem telefone</span>`;

  return `
  <div class="cb-card ${st.classe}${cobradoEm ? ' cb-feito' : ''}">
    <div class="cb-hd">
      <div>
        <div class="cb-nome">${c.nome}</div>
        <div class="cb-prazo">${prazo}</div>
      </div>
      <div class="cb-total">${fmt(c.total)}</div>
    </div>
    <span class="cb-status">${st.rotulo}</span>
    ${cobradoEm ? `<span class="cb-status cb-status-feito">✓ Cobrado em ${fmtData(cobradoEm).slice(0, 5)}</span>` : ''}
    <ul class="cb-pedidos">
      ${c.pedidos.map((p) => `<li><span>${fmtData(p.data).slice(0, 5)} · ${p.pedido}${p.qtdMarmitas > 1 ? ` (${p.qtdMarmitas}x)` : ''}</span><b>${fmt(p.valorComTaxa)}</b></li>`).join('')}
    </ul>
    ${pixInfo}
    <details class="cb-msg"${c.status === 'COBRAR' || c.status === 'EM_BREVE' ? ' open' : ''}>
      <summary>Mensagem pronta</summary>
      <pre>${msg.replace(/</g, '&lt;')}</pre>
    </details>
    <div class="cb-acoes">
      ${botaoZap}
      <button type="button" class="cb-btn" data-copiar="${c.chave}">📋 Copiar mensagem</button>
      <button type="button" class="cb-btn" data-cobrado="${c.chave}">${cobradoEm ? '↺ Desmarcar' : '✓ Já cobrei'}</button>
    </div>
  </div>`;
}
