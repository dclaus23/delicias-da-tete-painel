'use client';

import { useState } from 'react';
import type { Pendencia, TipoPendencia } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';
import { useOrdenacao } from '@/lib/useOrdenacao';
import ThOrdenavel from './ThOrdenavel';

const ROTULOS_STATUS: Record<TipoPendencia, { label: string; classe: string }> = {
  PEDIDO_SEM_PAGAMENTO: { label: 'Pediu e não pagou', classe: 'bg-vinho/10 text-vinho' },
  PAGAMENTO_SEM_PEDIDO: { label: 'Pagou sem pedido', classe: 'bg-terracota/10 text-terracota' },
};

function formatarData(data: string | null) {
  return data ? new Date(data).toLocaleDateString('pt-BR') : '—';
}

// Conciliação do mês — mistura os dois tipos de pendência numa única
// tabela. Clicar no status de uma linha filtra a tabela só por aquele
// status; clicar de novo (ou em "Mostrar todos") limpa o filtro. Colunas
// (menos Status) são ordenáveis clicando no cabeçalho.
export default function TabelaPendencias({ pendencias }: { pendencias: Pendencia[] }) {
  const [filtro, setFiltro] = useState<TipoPendencia | null>(null);
  const linhasFiltradas = filtro ? pendencias.filter((p) => p.tipo === filtro) : pendencias;
  const { linhasOrdenadas, coluna, direcao, alternar } = useOrdenacao<Pendencia>(
    linhasFiltradas,
    'diasEmAberto',
    'desc'
  );

  function alternarFiltro(tipo: TipoPendencia) {
    setFiltro((atual) => (atual === tipo ? null : tipo));
  }

  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-cafe">Conciliação</h3>
        {filtro && (
          <button
            onClick={() => setFiltro(null)}
            className="text-xs font-medium text-tinta/50 underline underline-offset-2 hover:text-tinta/70"
          >
            Mostrar todos ({pendencias.length})
          </button>
        )}
      </div>

      {linhasOrdenadas.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta/45">
          {pendencias.length === 0 ? 'Nada pendente nesse mês.' : 'Nenhuma linha com esse status.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-cafe/10 text-[11px] uppercase tracking-wide text-tinta/40">
                <ThOrdenavel
                  label="Data pedido"
                  ativo={coluna === 'dataPedido'}
                  direcao={direcao}
                  onClick={() => alternar('dataPedido')}
                />
                <ThOrdenavel
                  label="Data Pix"
                  ativo={coluna === 'dataPix'}
                  direcao={direcao}
                  onClick={() => alternar('dataPix')}
                />
                <ThOrdenavel label="Quem pediu" ativo={coluna === 'nome'} direcao={direcao} onClick={() => alternar('nome')} />
                <ThOrdenavel
                  label="Valor"
                  ativo={coluna === 'valor'}
                  direcao={direcao}
                  onClick={() => alternar('valor')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Em aberto"
                  ativo={coluna === 'diasEmAberto'}
                  direcao={direcao}
                  onClick={() => alternar('diasEmAberto')}
                  alinhamento="right"
                />
                <th className="pb-2 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {linhasOrdenadas.map((p, i) => {
                const rotulo = ROTULOS_STATUS[p.tipo];
                return (
                  <tr key={i} className="border-b border-cafe/5 last:border-0">
                    <td className="py-2.5 text-tinta/70">{formatarData(p.dataPedido)}</td>
                    <td className="py-2.5 text-tinta/70">{formatarData(p.dataPix)}</td>
                    <td className="py-2.5 font-medium text-cafe">{p.nome}</td>
                    <td className="py-2.5 text-right font-semibold">{formatarMoeda(p.valor)}</td>
                    <td className="py-2.5 text-right text-tinta/55">{p.diasEmAberto}d</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => alternarFiltro(p.tipo)}
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold transition ${rotulo.classe} ${
                          filtro === p.tipo ? 'ring-2 ring-offset-1 ring-cafe/25' : ''
                        }`}
                      >
                        {rotulo.label}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
