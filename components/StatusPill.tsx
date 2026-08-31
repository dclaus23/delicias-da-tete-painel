const ESTILOS: Record<string, { cor: string; texto: string; icone: string }> = {
  PAGO: { cor: 'bg-sucesso/10 text-sucesso', texto: 'Pago', icone: '✓' },
  PENDENTE: { cor: 'bg-alerta/10 text-alerta', texto: 'Pendente', icone: '✕' },
  NAO_ENTREGUE: { cor: 'bg-tinta/8 text-tinta/50', texto: 'Não entregue', icone: '–' },
  SEM_PEDIDO: { cor: 'bg-alerta/10 text-alerta', texto: 'Sem pedido', icone: '✕' },
};

export default function StatusPill({ status }: { status: keyof typeof ESTILOS }) {
  const estilo = ESTILOS[status] ?? ESTILOS.PENDENTE;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${estilo.cor}`}
    >
      <span>{estilo.icone}</span>
      {estilo.texto}
    </span>
  );
}
