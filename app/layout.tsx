import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import AppShell from '@/components/AppShell';
import { buscarUltimaSincronizacao } from '@/lib/dados';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Delícias da Tetê — Painel',
  description: 'Painel de gestão de pedidos e faturamento',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ultimaSincronizacao = await buscarUltimaSincronizacao();

  return (
    <html lang="pt-BR" className={jakarta.variable}>
      <body className="min-h-screen bg-creme font-sans text-tinta">
        {/* Menu lateral recolhível ocupando a tela toda, sem largura máxima
            no conteúdo — ver components/AppShell.tsx e Sidebar.tsx. */}
        <AppShell ultimaSincronizacao={ultimaSincronizacao}>{children}</AppShell>
      </body>
    </html>
  );
}
