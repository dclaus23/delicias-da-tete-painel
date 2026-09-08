import {
  buscarResultadosMensais,
  buscarDetalhamento,
  buscarGastosDetalhado,
  buscarDiasTrabalhados,
} from '@/lib/dados';
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
  const todosOsPeriodos = mesSelecionado === '';

  // Em "Todos os períodos" as tabelas de Detalhamento/Gastos (e os painéis
  // de entregas por dia/data, que dependem do Detalhamento) deixam de ser
  // buscadas por padrão — são o histórico INTEIRO de pedidos/gastos, e
  // carregar + renderizar milhares de linhas de uma vez era a maior causa
  // da Visão geral demorar pra responder nesse modo (reportado pela
  // Tereza no Lote 28, 2026-09-08). O KPI "Dias trabalhados" continua
  // certo mesmo assim: passou a vir de `buscarDiasTrabalhados`, uma busca
  // bem mais enxuta (só 3 colunas) que não depende do Detalhamento
  // completo.
  const [detalhamento, gastos, diasTrabalhados] = await Promise.all([
    todosOsPeriodos ? Promise.resolve([]) : buscarDetalhamento(mesSelecionado, contexto),
    todosOsPeriodos ? Promise.resolve([]) : buscarGastosDetalhado(mesSelecionado, contexto),
    buscarDiasTrabalhados(mesSelecionado, contexto),
  ]);

  return (
    <VisaoGeralClient
      resultadosMensais={resultadosMensais}
      meses={meses}
      mesSelecionado={mesSelecionado}
      contexto={contexto}
      detalhamento={detalhamento}
      gastos={gastos}
      diasTrabalhados={diasTrabalhados}
    />
  );
}
