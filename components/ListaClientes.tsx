'use client';

import { useState } from 'react';
import type { ClienteResumo } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';
import { useOrdenacao } from '@/lib/useOrdenacao';
import ThOrdenavel from './ThOrdenavel';

const OPCOES_QTD = [15, 30, 50] as const;

export default function ListaClientes({ clientes }: { clientes: ClienteResumo[] }) {
  const [qtd, setQtd] = useState<number | 'TODOS'>(15);
  const { linhasOrdenadas, coluna, direcao, alternar } = useOrdenacao<ClienteResumo>(
    clientes,
    'valorTotal',
    'desc'
  );
  const linhas = qtd === 'TODOS' ? linhasOrdenadas : linhasOrdenadas.slice(0, qtd);

  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-cafe">
          Clientes no período{' '}
          <span className="font-normal text-tinta/40">
            ({qtd !== 'TODOS' && clientes.length > qtd ? `top ${qtd} de ${clientes.length}` : clientes.length})
          </span>
        </h3>
        <div className="flex gap-1">
          {OPCOES_QTD.map((n) => (
            <button
              key={n}
              onClick={() => setQtd(n)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                qtd === n ? 'bg-cafe text-white' : 'bg-cafe/5 text-tinta/60 hover:bg-cafe/10'
              }`}
            >
              Top {n}
            </button>
          ))}
          <button
            onClick={() => setQtd('TODOS')}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              qtd === 'TODOS' ? 'bg-cafe text-white' : 'bg-cafe/5 text-tinta/60 hover:bg-cafe/10'
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {clientes.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta/45">Nenhum cliente nesse período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-cafe/10 text-[11px] uppercase tracking-wide text-tinta/40">
                <ThOrdenavel label="Nome" ativo={coluna === 'nome'} direcao={direcao} onClick={() => alternar('nome')} />
                <ThOrdenavel
                  label="Contexto"
                  ativo={coluna === 'contexto'}
                  direcao={direcao}
                  onClick={() => alternar('contexto')}
                />
                <ThOrdenavel
                  label="Pedidos"
                  ativo={coluna === 'pedidos'}
                  direcao={direcao}
                  onClick={() => alternar('pedidos')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Total"
                  ativo={coluna === 'valorTotal'}
                  direcao={direcao}
                  onClick={() => alternar('valorTotal')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Prato favorito"
                  ativo={coluna === 'pratoFavorito'}
                  direcao={direcao}
                  onClick={() => alternar('pratoFavorito')}
                />
                <ThOrdenavel
                  label="Status"
                  ativo={coluna === 'recorrente'}
                  direcao={direcao}
                  onClick={() => alternar('recorrente')}
                  alinhamento="right"
                />
              </tr>
            </thead>
            <tbody>
              {linhas.map((c) => (
                <tr key={c.nome} className="border-b border-cafe/5 last:border-0">
                  <td className="py-2.5 font-medium text-cafe">{c.nome}</td>
                  <td className="py-2.5 text-tinta/55">{c.contexto}</td>
                  <td className="py-2.5 text-right">{c.pedidos}</td>
                  <td className="py-2.5 text-right font-semibold">{formatarMoeda(c.valorTotal)}</td>
                  <td className="py-2.5 text-tinta/55">{c.pratoFavorito}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        c.recorrente ? 'bg-sucesso/10 text-sucesso' : 'bg-dourado/15 text-terracota'
                      }`}
                    >
                      {c.recorrente ? 'Recorrente' : 'Novo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
