'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ABAS = [
  { href: '/visao-geral', rotulo: 'Visão geral' },
  { href: '/avulsas', rotulo: 'Pedidos avulsos' },
  { href: '/cobranca', rotulo: 'Cobrança' },
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

export default function Topbar({ ultimaSincronizacao }: { ultimaSincronizacao: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return (
    <header className="bg-cafe text-white">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-3 md:px-10">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpg"
            alt="Delícias da Tetê"
            width={38}
            height={38}
            className="rounded-full"
          />
          <div>
            <p className="text-[15px] font-bold leading-tight">Delícias da Tetê</p>
            <p className="text-[11px] uppercase tracking-wide text-white/55">Painel de gestão</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-sucesso" />
          {formatarTempoRelativo(ultimaSincronizacao)}
        </div>
      </div>

      <nav className="mx-auto flex max-w-[1180px] gap-1 px-6 md:px-10">
        {ABAS.map((aba) => {
          const ativo = pathname === aba.href;
          // preserva ?mes=&contexto= ao trocar de página (a página de
          // Cobrança ignora esses parâmetros, mas não custa mantê-los)
          const href = query ? `${aba.href}?${query}` : aba.href;
          return (
            <Link
              key={aba.href}
              href={href}
              className={`border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition ${
                ativo
                  ? 'border-dourado text-white'
                  : 'border-transparent text-white/60 hover:text-white/85'
              }`}
            >
              {aba.rotulo}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
