const CORES: Record<string, { borda: string; valor: string }> = {
  dourado: { borda: 'border-l-dourado', valor: 'text-cafe' },
  terracota: { borda: 'border-l-terracota', valor: 'text-terracota' },
  sucesso: { borda: 'border-l-sucesso', valor: 'text-sucesso' },
  petroleo: { borda: 'border-l-petroleo', valor: 'text-petroleo' },
  vinho: { borda: 'border-l-vinho', valor: 'text-vinho' },
};

export default function KpiCard({
  rotulo,
  valor,
  variacao,
  cor = 'dourado',
}: {
  rotulo: string;
  valor: string;
  variacao?: string | null;
  cor?: keyof typeof CORES;
}) {
  const estilo = CORES[cor];
  return (
    // min-w-0 é o ajuste que resolve o "atropelo" no celular (Lote 27,
    // 2026-09-08): por padrão um item de grid tem min-width:auto, então um
    // valor comprido (ex.: "-146,1%", "R$ 3.660,00") força a própria
    // coluna a alargar e empurra/sobrepõe o card vizinho em telas
    // estreitas, mesmo o texto "cabendo" visualmente. Com min-w-0 o card
    // pode encolher até a largura da coluna e o texto quebra a linha (com
    // break-words) em vez de estourar. O tamanho da fonte do valor também
    // fica menor no celular (text-lg) e cresce em telas maiores (sm:text-2xl).
    <div
      className={`min-w-0 rounded-lg border border-cafe/8 border-l-4 bg-white px-3 py-3 shadow-cartao sm:px-4 sm:py-3.5 ${estilo.borda}`}
    >
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-tinta/45">{rotulo}</p>
      <p className={`mt-1 break-words text-lg font-extrabold leading-tight sm:text-2xl ${estilo.valor}`}>{valor}</p>
      {variacao && <p className="mt-0.5 text-xs text-tinta/45">{variacao} vs. mês anterior</p>}
    </div>
  );
}
