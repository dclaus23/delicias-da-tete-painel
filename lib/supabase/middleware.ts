import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Roda a cada requisição (chamado pelo middleware.ts na raiz do projeto).
// Confere se existe uma sessão válida do Supabase Auth nos cookies; se não
// existir, manda pra /login. Se já estiver logada e tentar abrir /login,
// manda direto pra /visao-geral. É o "portão" que protege o painel inteiro
// — sem isso, criar usuários no Supabase não impede ninguém de acessar,
// porque as páginas continuariam abertas pra qualquer um com o link
// (Lote 14, 2026-08-30, a pedido da Tereza antes de publicar no Vercel).
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaDefinir) {
          cookiesParaDefinir.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesParaDefinir.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const naTelaDeLogin = request.nextUrl.pathname.startsWith('/login');

  if (!user && !naTelaDeLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && naTelaDeLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/visao-geral';
    return NextResponse.redirect(url);
  }

  return response;
}
