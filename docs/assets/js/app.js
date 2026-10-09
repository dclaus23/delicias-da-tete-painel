import { sb } from './supabase-client.js';
import { boot as bootVisaoGeral } from './visao-geral.js';
import { boot as bootAvulsas } from './avulsas.js';
import { boot as bootCobranca, contarAlertas } from './cobranca.js';
import { buscarUltimaSincronizacao } from './dados.js';

async function boot() {
  setDot('spin', 'Verificando sessão...');
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showLogin(); return; }
  await afterLogin();
}

function showLogin() {
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('loginModal').style.display = 'flex';
}

async function afterLogin() {
  document.getElementById('loginModal').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  buscarUltimaSincronizacao().then((quando) => {
    const badge = document.getElementById('syncBadge');
    if (badge && quando) {
      const d = new Date(quando);
      badge.textContent = `última sincronização: ${d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    }
  });
  // Selo no menu "Cobrança" com quantos clientes pedem ação (cobrar ou
  // conferir Pix) — aparece em qualquer página, pra ninguém esquecer (Lote 51).
  contarAlertas().then((n) => {
    const b = document.getElementById('badgeCobranca');
    if (b && n > 0) { b.textContent = n; b.hidden = false; }
  }).catch((e) => console.warn('contagem de cobranças', e));
  await abrirPagina(paginaDaUrl());
}

// ─── Navegação entre páginas (Lote 46) ──────────────────────────────────────
// Cada página carrega seus dados só na primeira vez que é aberta. A página
// atual fica no "#" da URL (ex.: .../#avulsas), então um F5 volta pra ela.
const PAGINAS = {
  'visao-geral': { conteudo: 'vg', filtros: 'pbarVG', boot: bootVisaoGeral },
  avulsas: { conteudo: 'av', filtros: 'pbarAV', boot: bootAvulsas },
  cobranca: { conteudo: 'cb', filtros: 'pbarCB', boot: bootCobranca },
};
const _iniciadas = new Set();

function paginaDaUrl() {
  const h = location.hash.replace('#', '');
  return PAGINAS[h] ? h : 'visao-geral';
}

async function abrirPagina(id) {
  for (const [pid, p] of Object.entries(PAGINAS)) {
    const ativa = pid === id;
    document.getElementById(p.conteudo).style.display = ativa ? '' : 'none';
    document.getElementById(p.filtros).style.display = ativa ? '' : 'none';
  }
  document.querySelectorAll('.pg[data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === id));
  if (location.hash.replace('#', '') !== id) history.replaceState(null, '', '#' + id);
  if (_iniciadas.has(id)) return;
  setDot('spin', 'Carregando...');
  try {
    await PAGINAS[id].boot();
    _iniciadas.add(id);
    setDot('ok', 'Atualizado');
  } catch (err) {
    setDot('err', 'Erro ao carregar — veja o console');
    console.error(err);
  }
}

document.querySelectorAll('.pg[data-page]').forEach((b) => {
  b.addEventListener('click', () => abrirPagina(b.dataset.page));
});

document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  btn.textContent = 'Entrando...'; btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    document.getElementById('loginError').textContent = error.message === 'Invalid login credentials'
      ? 'Email ou senha incorretos.' : error.message;
    document.getElementById('loginError').style.display = 'block';
    btn.textContent = 'Entrar'; btn.disabled = false;
  } else {
    document.getElementById('loginError').style.display = 'none';
    btn.textContent = 'Entrar'; btn.disabled = false;
    await afterLogin();
  }
});

document.getElementById('btnSair')?.addEventListener('click', async () => {
  await sb.auth.signOut();
  location.reload();
});

function setDot(s, t) {
  const d = document.getElementById('statusDot');
  if (!d) return;
  d.className = 'dot' + (s === 'spin' ? ' spin' : s === 'err' ? ' err' : '');
  document.getElementById('statusTxt').textContent = t;
}

boot();
