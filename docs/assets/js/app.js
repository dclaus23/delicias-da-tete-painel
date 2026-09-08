import { sb } from './supabase-client.js';
import { boot as bootVisaoGeral } from './visao-geral.js';

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
  setDot('spin', 'Carregando...');
  try {
    await bootVisaoGeral();
    setDot('ok', 'Atualizado');
  } catch (err) {
    setDot('err', 'Erro ao carregar — veja o console');
    console.error(err);
  }
}

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
