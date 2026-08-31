import {
  buscarResultadosMensais,
  buscarClientesResumo,
  buscarPratosComparativo,
  buscarPendencias,
  buscarResumoAvulsosMes,
} from '@/lib/dados';
import { nomeMes } from '@/lib/calculos';
import AvulsasClient from './AvulsasClient';

export const revalidate = 0;

// Página só de pedidos avulsos — não usa o filtro de contexto (Escola/
// Avulsos/Todos) porque toda a tabela pedidos_avulsos já é só avulsos.
export default async function AvulsasPage({
  searchParams,
}: {
  searchParams: { mes?: string };
}) {
  const resultadosMensais = await buscarResultadosMensais();
  const meses = resultadosMensais.map((r) => ({ valor: r.mes, rotulo: nomeMes(r.mes) }));

  const mesSelecionado = searchParams.mes ?? meses[meses.length - 1]?.valor ?? '';

  const [clientesResumo, pratosComparativo, pendencias, resumoMes] = await Promise.all([
    buscarClientesResumo(mesSelecionado),
    buscarPratosComparativo(mesSelecionado),
    buscarPendencias(mesSelecionado),
    buscarResumoAvulsosMes(mesSelecionado),
  ]);

  return (
    <AvulsasClient
      meses={meses}
      mesSelecionado={mesSelecionado}
      resultadosMensais={resultadosMensais}
      clientesResumo={clientesResumo}
      pratosComparativo={pratosComparativo}
      pendencias={pendencias}
      resumoMes={resumoMes}
    />
  );
}
