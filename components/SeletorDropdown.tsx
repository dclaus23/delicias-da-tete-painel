'use client';

interface Opcao {
  valor: string;
  rotulo: string;
}

export default function SeletorDropdown({
  rotulo,
  valor,
  opcoes,
  onChange,
}: {
  rotulo: string;
  valor: string;
  opcoes: Opcao[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-cafe/15 bg-white px-3 py-1.5 text-sm shadow-cartao">
      <span className="text-[11px] uppercase tracking-wide text-tinta/45">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-tinta outline-none"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
}
