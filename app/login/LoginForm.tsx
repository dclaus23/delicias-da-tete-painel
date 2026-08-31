'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      setErro('E-mail ou senha incorretos.');
      setEnviando(false);
      return;
    }

    router.replace('/visao-geral');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-creme px-4">
      <form
        onSubmit={aoEnviar}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-cafe/8 bg-white p-8 shadow-cartao"
      >
        <div className="flex flex-col items-center gap-2 pb-2">
          <Image src="/logo.jpg" alt="Delícias da Tetê" width={56} height={56} className="rounded-full" />
          <div className="text-center">
            <p className="text-[17px] font-bold text-cafe">Delícias da Tetê</p>
            <p className="text-xs text-tinta/55">Painel de gestão</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-tinta/70">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-cafe/15 px-3 py-2 text-sm text-tinta outline-none focus:border-dourado"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="senha" className="text-xs font-semibold text-tinta/70">
            Senha
          </label>
          <input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="rounded-md border border-cafe/15 px-3 py-2 text-sm text-tinta outline-none focus:border-dourado"
          />
        </div>

        {erro && <p className="text-xs font-medium text-alerta">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="mt-1 rounded-md bg-cafe py-2.5 text-sm font-semibold text-white transition hover:bg-cafe/90 disabled:opacity-60"
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
