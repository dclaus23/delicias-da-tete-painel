'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

const ITENS = [
  { href: '/visao-geral', rotulo: 'Visão geral', icone: '📊' },
  { href: '/avulsas', rotulo: 'Pedidos avulsos', icone: '🧾' },
  { href: '/cobranca', rotulo: 'Cobrança', icone: '💬' },
];

function formatarTempoRelativo(iso: string | null) {
  if (!iso) return 'Ainda não sincronizado';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Sincronizado agora mesmo';
  if (diffMin < 60) return `Sincronizado há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Sincronizado há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `Sincronizado há ${diffD} d`;
}

// Menu lateral fixo (substitui a antiga Topbar horizontal), inspirado em
// dashboards como o do GitHub: logo + nome no topo, navegação no meio,
// status de sincronização embaixo, e um botão pra recolher (ícones só) e
// deixar mais espaço horizontal pro conteúdo — ver AppShell.tsx pro estado
// de colapsado/expandido, que fica salvo no navegador entre visitas.
// Desde o Lote 14 (2026-08-30) também tem o botão "Sair" (logout do
// Supabase Auth), já que o painel passou a exigir login antes de publicar
// no Vercel.
export default function Sidebar({
  ultimaSincronizacao,
  colapsado,
  aoAlternar,
}: {
  ultimaSincronizacao: string | null;
  colapsado: boolean;
  aoAlternar: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();

  async function sair() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col bg-cafe text-white transition-[width] duration-200 ${
        colapsado ? 'w-[68px]' : 'w-60'
      }`}
    >
      <div className="flex items-center gap-2.5 px-4 py-4">
        <Image
          src="/logo.jpg"
          alt="Delícias da Tetê"
          width={34}
          height={34}
          className="shrink-0 rounded-full"
        />
        {!colapsado && (
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold leading-tight">Delícias da Tetê</p>
            <p className="truncate text-[10px] uppercase tracking-wide text-white/55">Painel de gestão</p>
          </div>
        )}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-1 px-2.5">
        {ITENS.map((item) => {
          const ativo = pathname === item.href;
          // preserva ?mes=&contexto= ao trocar de página
          const href = query ? `${item.href}?${query}` : item.href;
          return (
            <Link
              key={item.href}
              href={href}
              title={colapsado ? item.rotulo : undefined}
              className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                ativo ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              } ${colapsado ? 'justify-center' : ''}`}
            >
              <span className="shrink-0 text-base leading-none">{item.icone}</span>
              {!colapsado && <span className="truncate">{item.rotulo}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2 border-t border-white/10 px-2.5 py-3">
        <div
          className={`flex items-center gap-1.5 text-[11px] text-white/55 ${
            colapsado ? 'justify-center' : 'px-1.5'
          }`}
          title={colapsado ? formatarTempoRelativo(ultimaSincronizacao) : undefined}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sucesso" />
          {!colapsado && <span className="truncate">{formatarTempoRelativo(ultimaSincronizacao)}</span>}
        </div>
        <button
          onClick={sair}
          title={colapsado ? 'Sair' : undefined}
          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white/90 ${
            colapsado ? 'justify-center' : ''
          }`}
        >
          <span className="shrink-0 text-base leading-none">🚪</span>
          {!colapsado && <span className="truncate">Sair</span>}
        </button>
        <button
          onClick={aoAlternar}
          className="flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium text-white/60 transition hover:bg-white/5 hover:text-white/90"
          title={colapsado ? 'Expandir menu' : 'Recolher menu'}
        >
          <span className="leading-none">{colapsado ? '»' : '«'}</span>
          {!colapsado && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  );
}
