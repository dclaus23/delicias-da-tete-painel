'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { Cobranca } from '@/lib/types';
import { mesDaData } from '@/lib/calculos';
import BarraFiltros from '@/components/BarraFiltros';
import PillFiltro from '@/components/PillFiltro';
import TabelaCobranca from '@/components/TabelaCobranca';

const OPCOES_PERIODO = [
  { valor: 'todos', rotulo: 'Todos os períodos' },
  { valor: 'mes', rotulo: 'Mês selecionado' },
];

// Fila de cobrança inteira já vem carregada do servidor; o filtro de
// mês/ano é aplicado aqui no client, sobre essa mesma lista — assim dá pra
// alternar entre "ver tudo que está pendente" e "ver só o que é desse mês"
// sem precisar de outra ida ao banco.
//
// Padrão é "Mês selecionado" (o mês/ano mais recente carregado), igual às
// outras páginas do painel — evita misturar dívida de antes desse projeto
// existir (sem rastreamento de contato/valor confiável) com o dia a dia.
// "Todos os períodos" continua disponível pra quando quiser ver tudo.
export default function CobrancaClient({
  meses,
  cobrancas,
}: {
  meses: { valor: string; rotulo: string }[];
  cobrancas: Cobranca[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const periodo = searchParams.get('periodo') ?? 'mes';
  const mesSelecionado = searchParams.get('mes') ?? meses[meses.length - 1]?.valor ?? '';

  function atualizarPeriodo(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('periodo', valor);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const cobrancasFiltradas =
    periodo === 'mes' && mesSelecionado
      ? cobrancas.filter((c) => mesDaData(c.data) === mesSelecionado)
      : cobrancas;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-cafe">Cobrança</h1>
          <p className="text-sm text-tinta/55">
            Pedidos avulsos ainda não pagos — mensagem pronta pra cobrar por WhatsApp
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <BarraFiltros meses={meses} mostrarContexto={false} />
          <PillFiltro opcoes={OPCOES_PERIODO} valor={periodo} onChange={atualizarPeriodo} />
        </div>
      </header>
      <TabelaCobranca cobrancas={cobrancasFiltradas} />
    </div>
  );
}
