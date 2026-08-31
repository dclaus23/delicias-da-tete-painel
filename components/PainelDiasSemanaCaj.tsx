import type { ResumoDiaSemanaCaj } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';

// Painel ao lado do Detalhamento, somado por dia da semana: quantas
// marmitas/lanches e quanto foi entregue em valor, em cada dia, ao longo do
// mês selecionado. Até o Lote 12 só mostrava a Escola (CAJ); desde o
// Lote 13 os dias já vêm prontos (calculados no client a partir do mesmo
// `detalhamento` da tabela ao lado) e o painel reflete o filtro
// Escola/Avulsos/Todos escolhido — `rotuloContexto` é só o texto do
// subtítulo ("Escola", "Avulsos" ou "Escola + Avulsos").
export default function PainelDiasSemanaCaj({
  dias,
  rotuloContexto,
}: {
  dias: ResumoDiaSemanaCaj[];
  rotuloContexto: string;
}) {
  const semMovimento = dias.every((d) => d.qtdMarmitas === 0 && d.qtdLanches === 0 && d.valorTotal === 0);

  return (
    <div className="flex h-full flex-col rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <h3 className="mb-1 text-[15px] font-bold text-cafe">Entregas por dia — {rotuloContexto}</h3>
      <p className="mb-3 text-xs text-tinta/45">Somado por dia da semana, no período selecionado</p>

      {semMovimento ? (
        <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-tinta/45">
          Nenhuma entrega nesse período.
        </p>
      ) : (
        <div className="flex flex-1 flex-col gap-2">
          {dias.map((d) => (
            <div
              key={d.diaSemana}
              className="flex items-center justify-between gap-2 rounded-md border border-cafe/8 px-3 py-2"
            >
              <span className="text-sm font-semibold text-cafe">{d.diaSemana}</span>
              <div className="flex items-baseline gap-3 text-right">
                <span className="text-xs text-tinta/55">
                  {d.qtdMarmitas || 0} <span className="text-tinta/35">marmitas</span>
                </span>
                <span className="text-xs text-tinta/55">
                  {d.qtdLanches || 0} <span className="text-tinta/35">lanches</span>
                </span>
                <span className="min-w-[84px] text-sm font-bold text-dourado">{formatarMoeda(d.valorTotal)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
