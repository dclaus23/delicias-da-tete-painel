'use client';

interface Opcao {
  valor: string;
  rotulo: string;
}

export default function PillFiltro({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: Opcao[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            onClick={() => onChange(o.valor)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              ativo
                ? 'border-cafe bg-cafe text-white'
                : 'border-cafe/15 bg-white text-tinta/70 hover:border-cafe/30'
            }`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
