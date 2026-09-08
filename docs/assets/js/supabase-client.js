// ─── Configuração Supabase ────────────────────────────────────────────────────
// Mesmo projeto que o painel Next.js já usava (Delicia da Tete, sa-east-1).
// A chave abaixo é a "publishable" (pública por natureza) — a proteção real
// é RLS + Supabase Auth exigindo um usuário autenticado, exatamente como o
// painel anterior já fazia (Lote 14). Sem login, nenhuma linha das tabelas
// volta — confirmado nas policies "leitura autenticada" de pedidos_escola,
// pedidos_avulsos, gastos e contextos.
export const SUPABASE_URL = 'https://orghwjkrolzoxwrklztg.supabase.co';
export const SUPABASE_ANON = 'sb_publishable_hKy26uWs_4HDXjuBVw5lQw_VgkKpHrk';

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Paginação (limite de 1000 linhas por resposta do PostgREST) ──────────────
// O Supabase corta cada resposta em 1000 linhas por padrão, sem erro nenhum —
// foi isso que causou o Faturamento errado de Junho/2026 no painel antigo
// (uma busca sem paginação simplesmente perdia linhas de tabelas grandes).
// `construir(inicio, fim)` deve pedir `{ count: 'exact' }` no `.select()` pra
// esse helper já saber o total de linhas na primeira página; as páginas
// seguintes são buscadas todas em paralelo (Promise.all), não uma de cada vez.
export async function buscarTodasPaginado(construir) {
  const TAMANHO_PAGINA = 1000;
  const { data: primeira, error: erroPrimeira, count } = await construir(0, TAMANHO_PAGINA - 1);
  if (erroPrimeira) throw erroPrimeira;
  const linhasPrimeira = primeira ?? [];

  if (!count || linhasPrimeira.length < TAMANHO_PAGINA) {
    return linhasPrimeira;
  }

  const totalPaginas = Math.ceil(count / TAMANHO_PAGINA);
  if (totalPaginas <= 1) return linhasPrimeira;

  const paginasRestantes = await Promise.all(
    Array.from({ length: totalPaginas - 1 }, (_, i) => {
      const pagina = i + 1;
      const inicio = pagina * TAMANHO_PAGINA;
      return construir(inicio, inicio + TAMANHO_PAGINA - 1);
    })
  );

  const todas = linhasPrimeira.slice();
  for (const { data, error } of paginasRestantes) {
    if (error) throw error;
    todas.push(...(data ?? []));
  }
  return todas;
}
