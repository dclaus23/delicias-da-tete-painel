'use client';

import type { GastoDetalhado } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';
import { useOrdenacao } from '@/lib/useOrdenacao';
import ThOrdenavel from './ThOrdenavel';

// Substitui o gráfico de rosca na Visão geral. Respeita o filtro Escola/
// Avulsos/Todos igual ao resto da página (ver lib/dados.ts): o contexto de
// cada gasto vem do nome do arquivo onde foi lançado, então cada linha
// exibida aqui já é só do lado selecionado, com o valor cheio (sem rateio).
// Linhas de pagamento a colaboradoras vêm marcadas (destaque=true).
export default function TabelaGastos({ gastos }: { gastos: GastoDetalhado[] }) {
  const total = gastos.reduce((s, g) => s + g.valor, 0);
  const { linhasOrdenadas, coluna, direcao, alternar } = useOrdenacao<GastoDetalhado>(gastos, 'data', 'desc');

  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-cafe">Gastos do período</h3>
        <span className="text-sm font-semibold text-terracota">{formatarMoeda(total)}</span>
      </div>
      {gastos.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta/45">Nenhum gasto nesse período.</p>
      ) : (
        <div className="max-h-96 overflow-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-cafe/10 text-[11px] uppercase tracking-wide text-tinta/40">
                <ThOrdenavel label="Data" ativo={coluna === 'data'} direcao={direcao} onClick={() => alternar('data')} />
                <ThOrdenavel
                  label="Pessoa/Local"
                  ativo={coluna === 'pessoaLocal'}
                  direcao={direcao}
                  onClick={() => alternar('pessoaLocal')}
                />
                <ThOrdenavel
                  label="Tipo"
                  ativo={coluna === 'tipoPagamento'}
                  direcao={direcao}
                  onClick={() => alternar('tipoPagamento')}
                />
                <ThOrdenavel
                  label="Valor"
                  ativo={coluna === 'valor'}
                  direcao={direcao}
                  onClick={() => alternar('valor')}
                  alinhamento="right"
                />
              </tr>
            </thead>
            <tbody>
              {linhasOrdenadas.map((g, i) => (
                <tr
                  key={i}
                  className={`border-b border-cafe/5 last:border-0 ${g.destaque ? 'bg-dourado/10' : ''}`}
                >
                  <td className="py-2 text-tinta/70">
                    {g.data ? new Date(g.data).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-2 font-medium text-cafe">
                    {g.pessoaLocal}
                    {g.destaque && (
                      <span className="ml-2 rounded-full bg-dourado/20 px-2 py-0.5 text-[10px] font-semibold text-terracota">
                        Colaboradora
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-tinta/55">{g.tipoPagamento ?? '—'}</td>
                  <td className="py-2 text-right font-semibold">{formatarMoeda(g.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
