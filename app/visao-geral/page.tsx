import { buscarResultadosMensais, buscarDetalhamento, buscarGastosDetalhado } from '@/lib/dados';
import { nomeMes } from '@/lib/calculos';
import type { FiltroContexto } from '@/lib/types';
import VisaoGeralClient from './VisaoGeralClient';

// Busca sempre fresco — o vigia sincroniza em segundo plano, então cachear
// esta página faria o painel mostrar dado desatualizado.
export const revalidate = 0;

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: { mes?: string; contexto?: string };
}) {
  const resultadosMensais = await buscarResultadosMensais();
  const meses = resultadosMensais.map((r) => ({ valor: r.mes, rotulo: nomeMes(r.mes) }));

  // Sem ?mes= na URL = "Todos os períodos" (Lote 26, 2026-09-08): a Visão
  // geral abre com o agregado de tudo que já foi sincronizado, igual ao
  // Qlik Sense sem filtro nenhum aplicado, e só passa a detalhar um mês
  // específico quando o usuário escolhe um no dropdown de Período. Antes
  // disso, a ausência de ?mes= caía por padrão no mês mais recente.
  const mesSelecionado = searchParams.mes ?? '';
  const contexto = (searchParams.contexto as FiltroContexto) ?? 'TODOS';

  // "Entregas por dia" e "Entregas por data" (painéis ao lado do
  // Detalhamento) deixaram de ter sua própria consulta ao banco no Lote 13
  // — são calculados no client a partir do próprio `detalhamento` abaixo,
  // que já respeita mês + contexto, então não tem mais risco de os dois
  // números divergirem.
  const [detalhamento, gastos] = await Promise.all([
    buscarDetalhamento(mesSelecionado, contexto),
    buscarGastosDetalhado(mesSelecionado, contexto),
  ]);

  return (
    <VisaoGeralClient
      resultadosMensais={resultadosMensais}
      meses={meses}
      mesSelecionado={mesSelecionado}
      contexto={contexto}
      detalhamento={detalhamento}
      gastos={gastos}
    />
  );
}
