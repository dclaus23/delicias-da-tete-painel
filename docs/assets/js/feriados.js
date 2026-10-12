// Calendário de feriados (Lote 52, 2026-10-12) — dias sem entrega na escola.
//
// Calculado no navegador pra qualquer ano: feriados nacionais fixos, os
// móveis (a partir da Páscoa) e os do Rio de Janeiro (estado + município —
// a CAJ fica no Rio). Ponto facultativo que a escola costuma emendar
// (Carnaval, Corpus Christi) entra marcado como tal.
//
// Recesso / dia sem aula específico da escola: acrescente em
// FERIADOS_ESCOLA abaixo no formato 'AAAA-MM-DD': 'Motivo'.
export const FERIADOS_ESCOLA = {
  // '2026-10-16': 'Conselho de classe — sem aula',
};

const FIXOS = [
  ['01-01', 'Confraternização Universal', 'Nacional'],
  ['01-20', 'São Sebastião', 'Municipal (Rio)'],
  ['04-21', 'Tiradentes', 'Nacional'],
  ['04-23', 'São Jorge', 'Estadual (RJ)'],
  ['05-01', 'Dia do Trabalho', 'Nacional'],
  ['09-07', 'Independência do Brasil', 'Nacional'],
  ['10-12', 'Nossa Senhora Aparecida', 'Nacional'],
  ['11-02', 'Finados', 'Nacional'],
  ['11-15', 'Proclamação da República', 'Nacional'],
  ['11-20', 'Consciência Negra', 'Nacional'],
  ['12-25', 'Natal', 'Nacional'],
];

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)
function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

export const iso = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

const _cache = new Map();
// Map 'AAAA-MM-DD' -> { nome, tipo } com todos os feriados do ano.
export function feriadosDoAno(ano) {
  if (_cache.has(ano)) return _cache.get(ano);
  const m = new Map();
  for (const [md, nome, tipo] of FIXOS) m.set(`${ano}-${md}`, { nome, tipo });
  const p = pascoa(ano);
  const rel = (dias) => { const d = new Date(p); d.setDate(d.getDate() + dias); return iso(d); };
  m.set(rel(-48), { nome: 'Carnaval (segunda)', tipo: 'Ponto facultativo' });
  m.set(rel(-47), { nome: 'Carnaval (terça)', tipo: 'Ponto facultativo' });
  m.set(rel(-2), { nome: 'Sexta-feira Santa', tipo: 'Nacional' });
  m.set(rel(60), { nome: 'Corpus Christi', tipo: 'Ponto facultativo' });
  for (const [data, nome] of Object.entries(FERIADOS_ESCOLA)) {
    if (data.startsWith(String(ano))) m.set(data, { nome, tipo: 'Escola' });
  }
  _cache.set(ano, m);
  return m;
}

export function feriadoEm(dataIso) {
  return feriadosDoAno(Number(dataIso.slice(0, 4))).get(dataIso) ?? null;
}

// Próximos feriados em DIA ÚTIL (seg–sex) a partir de hoje — são os que
// tiram uma entrega da escola.
export function proximosFeriadosUteis(dias = 90) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i <= dias; i++) {
    const d = new Date(hoje); d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const f = feriadoEm(iso(d));
    if (f) out.push({ data: iso(d), dow, emDias: i, ...f });
  }
  return out;
}
