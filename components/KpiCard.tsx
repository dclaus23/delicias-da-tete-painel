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
    <div className={`rounded-lg border border-cafe/8 border-l-4 bg-white px-4 py-3.5 shadow-cartao ${estilo.borda}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-tinta/45">{rotulo}</p>
      <p className={`mt-1 text-2xl font-extrabold ${estilo.valor}`}>{valor}</p>
      {variacao && <p className="mt-0.5 text-xs text-tinta/45">{variacao} vs. mês anterior</p>}
    </div>
  );
}
