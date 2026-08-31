import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidos em .env.local'
  );
}

// service_role key: acesso total, ignora RLS. Só é importada aqui, em código
// que roda no servidor (Server Components / Route Handlers) — como a
// variável não tem o prefixo NEXT_PUBLIC_, o Next.js nunca a inclui no
// bundle enviado ao navegador.
//
// O painel só LÊ dados (quem escreve é o vigia) — mantenha este arquivo
// (e lib/dados.ts) limitados a `.select()`. Quando a autenticação de
// usuário entrar (item 4), o acesso ao painel passa a exigir login, mas a
// forma de buscar dado aqui não muda.
export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
