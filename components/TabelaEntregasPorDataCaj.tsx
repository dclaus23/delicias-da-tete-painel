import type { EntregaDiaCaj } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';

const DIAS_SEMANA_CURTO = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function formatarDataComDia(data: string) {
  // Fixa meio-dia UTC pra não sofrer off-by-one de fuso horário.
  const d = new Date(`${data}T12:00:00Z`);
  const diaSemana = DIAS_SEMANA_CURTO[d.getUTCDay()];
  return `${diaSemana}, ${d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
}

// Complementa o painel "Entregas por dia" (que soma por dia da SEMANA,
// juntando todas as segundas, todas as terças...) com o detalhe dia a dia
// por DATA — pra Tereza ver, por exemplo, quanto saiu especificamente na
// última segunda-feira, não a soma de todas as segundas do mês. Até o
// Lote 12 só mostrava a Escola (CAJ); desde o Lote 13 reflete o filtro
// Escola/Avulsos/Todos escolhido — `rotuloContexto` é só o texto do
// subtítulo ("Escola", "Avulsos" ou "Escola + Avulsos").
export default function TabelaEntregasPorDataCaj({
  dias,
  rotuloContexto,
}: {
  dias: EntregaDiaCaj[];
  rotuloContexto: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <h3 className="mb-1 text-[15px] font-bold text-cafe">Entregas por data — {rotuloContexto}</h3>
      <p className="mb-3 text-xs text-tinta/45">Dia a dia do período selecionado, sem agrupar por dia da semana</p>

      {dias.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-tinta/45">
          Nenhuma entrega nesse período.
        </p>
      ) : (
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-cafe/10 text-[11px] uppercase tracking-wide text-tinta/40">
                <th className="pb-2 text-left font-semibold">Dia</th>
                <th className="pb-2 text-right font-semibold">Marmitas</th>
                <th className="pb-2 text-right font-semibold">Lanches</th>
                <th className="pb-2 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {dias.map((d) => (
                <tr key={d.data} className="border-b border-cafe/5 last:border-0">
                  <td className="py-2 text-tinta/70">{formatarDataComDia(d.data)}</td>
                  <td className="py-2 text-right">{d.qtdMarmitas || '—'}</td>
                  <td className="py-2 text-right">{d.qtdLanches || '—'}</td>
                  <td className="py-2 text-right font-semibold text-dourado">{formatarMoeda(d.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
