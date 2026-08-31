'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const CHAVE_STORAGE = 'delicias-sidebar-colapsada';

// Layout de tela cheia com menu lateral recolhível (troca a antiga Topbar +
// container com largura máxima de 1180px). O estado de colapsado/expandido
// é só uma preferência de exibição do navegador de quem está usando —
// salva em localStorage pra lembrar entre visitas, sem precisar de banco.
export default function AppShell({
  ultimaSincronizacao,
  children,
}: {
  ultimaSincronizacao: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    try {
      setColapsado(localStorage.getItem(CHAVE_STORAGE) === '1');
    } catch {
      // localStorage indisponível (ex: navegação privada) — mantém expandido
    }
  }, []);

  function alternar() {
    setColapsado((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_STORAGE, novo ? '1' : '0');
      } catch {
        // ignora — só afeta a preferência salva, não a navegação
      }
      return novo;
    });
  }

  // A tela de login (Lote 14, 2026-08-30) não usa o menu lateral — quem
  // ainda não entrou não deve ver os links do painel nem o status de
  // sincronização, só o formulário de login ocupando a tela toda.
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar usa useSearchParams (pra preservar ?mes=&contexto= ao trocar
          de página), por isso precisa do Suspense — só ao redor dela, pra
          não bloquear o conteúdo principal da página. */}
      <Suspense fallback={<div className="hidden w-60 shrink-0 bg-cafe md:block" />}>
        <Sidebar ultimaSincronizacao={ultimaSincronizacao} colapsado={colapsado} aoAlternar={alternar} />
      </Suspense>
      <main className="min-w-0 flex-1 px-6 py-7 md:px-10">{children}</main>
    </div>
  );
}
