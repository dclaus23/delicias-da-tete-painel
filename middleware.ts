import { type NextRequest } from 'next/server';
import { atualizarSessao } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return atualizarSessao(request);
}

// Roda em tudo, MENOS arquivos estáticos internos do Next e a logo — não
// tem sentido "proteger" esses arquivos, e passar o middleware neles à toa
// só deixa a navegação mais lenta.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.jpg).*)'],
};
