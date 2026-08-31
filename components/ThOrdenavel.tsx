'use client';

// Cabeçalho de coluna clicável — usado dentro de tabelas com useOrdenacao.
export default function ThOrdenavel({
  label,
  ativo,
  direcao,
  onClick,
  alinhamento = 'left',
}: {
  label: string;
  ativo: boolean;
  direcao: 'asc' | 'desc';
  onClick: () => void;
  alinhamento?: 'left' | 'right';
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none whitespace-nowrap pb-2 font-semibold transition hover:text-tinta/70 ${
        alinhamento === 'right' ? 'text-right' : 'text-left'
      } ${ativo ? 'text-tinta/80' : ''}`}
    >
      {label}
      <span className="ml-1 inline-block w-2.5 text-[10px]">{ativo ? (direcao === 'asc' ? '▲' : '▼') : ''}</span>
    </th>
  );
}
