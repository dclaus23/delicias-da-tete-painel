import type { PratoComparativo } from '@/lib/types';

export default function RankingPratos({
  pratos,
  mesLabel,
  mesAnteriorLabel,
}: {
  pratos: PratoComparativo[];
  mesLabel: string;
  mesAnteriorLabel: string;
}) {
  const max = Math.max(1, ...pratos.map((p) => p.quantidade));

  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <h3 className="text-[15px] font-bold text-cafe">Pratos mais pedidos</h3>
      <p className="mb-3 text-xs text-tinta/45">
        Top 5 de {mesLabel} vs. {mesAnteriorLabel}
      </p>

      {pratos.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta/45">Sem pedidos nesse mês.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pratos.map((p) => {
            const delta = p.quantidade - p.quantidadeAnterior;
            return (
              <li key={p.prato}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-tinta/80">{p.prato}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="font-semibold text-terracota">{p.quantidade}×</span>
                    {p.quantidadeAnterior === 0 ? (
                      <span className="text-[11px] font-medium text-dourado">novo</span>
                    ) : (
                      <span
                        className={`text-[11px] font-medium ${delta >= 0 ? 'text-sucesso' : 'text-vinho'}`}
                      >
                        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-cafe/6">
                  <div
                    className="h-1.5 rounded-full bg-dourado"
                    style={{ width: `${(p.quantidade / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
