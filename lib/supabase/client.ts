'use client';

import { createBrowserClient } from '@supabase/ssr';

// Cliente Supabase pro NAVEGADOR — usado só na tela de login (entrar/sair).
// Usa a chave "anon" (pública, protegida por Row Level Security do próprio
// Supabase Auth), diferente da service_role key em lib/supabaseServer.ts
// (que só roda no servidor e nunca deve chegar ao navegador).
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
