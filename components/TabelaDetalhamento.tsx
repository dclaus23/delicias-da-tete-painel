'use client';

import { useMemo, useState } from 'react';
import type { DetalheLancamento } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';
import { useOrdenacao } from '@/lib/useOrdenacao';
import ThOrdenavel from './ThOrdenavel';

function formatarData(data: string | null) {
  return data ? new Date(data).toLocaleDateString('pt-BR') : '—';
}

// Colunas do Excel exportado — inclui Origem/Quem/Descrição mesmo essas
// tendo saído da tabela na tela (Lote 9): pra conferência externa (o
// arquivo que a Tereza manda pro cliente todo dia 11) esse detalhe ainda é
// útil, mesmo que a tela tenha ficado mais enxuta.
async function exportarExcel(linhas: DetalheLancamento[], mesRotulo: string, origemFiltro: string | null) {
  const XLSX = await import('xlsx');

  const cabecalho = [
    'Ano/Mês',
    'Data',
    'Origem',
    'Quem',
    'Descrição',
    'Qtd. marmitas',
    'Qtd. lanches',
    'Unit. marmita',
    'Unit. lanche',
    'Total marmitas',
    'Total lanches',
    'Valor a pagar',
    'Valor pago',
    'Data pagto.',
    'Obs',
  ];

  const linhasExcel = linhas.map((l) => [
    l.anoMes,
    l.data ? new Date(l.data).toLocaleDateString('pt-BR') : '',
    l.origem,
    l.quem ?? '',
    l.descricao,
    l.qtdMarmitas || '',
    l.qtdLanches || '',
    l.valorUnitMarmita || '',
    l.valorUnitLanche || '',
    l.valorTotalMarmitas || '',
    l.valorTotalLanches || '',
    l.valorTotal,
    l.valorPago ?? '',
    l.dataPagamento ? new Date(l.dataPagamento).toLocaleDateString('pt-BR') : '',
    l.obs ?? '',
  ]);

  const totais = linhas.reduce(
    (acc, l) => ({
      qtdMarmitas: acc.qtdMarmitas + l.qtdMarmitas,
      qtdLanches: acc.qtdLanches + l.qtdLanches,
      valorTotalMarmitas: acc.valorTotalMarmitas + l.valorTotalMarmitas,
      valorTotalLanches: acc.valorTotalLanches + l.valorTotalLanches,
      valorTotal: acc.valorTotal + l.valorTotal,
      valorPago: acc.valorPago + (l.valorPago ?? 0),
    }),
    { qtdMarmitas: 0, qtdLanches: 0, valorTotalMarmitas: 0, valorTotalLanches: 0, valorTotal: 0, valorPago: 0 }
  );

  const linhaTotais = [
    'Totais',
    '',
    '',
    '',
    '',
    totais.qtdMarmitas,
    totais.qtdLanches,
    '',
    '',
    totais.valorTotalMarmitas,
    totais.valorTotalLanches,
    totais.valorTotal,
    totais.valorPago,
    '',
    '',
  ];

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhasExcel, linhaTotais]);
  planilha['!cols'] = cabecalho.map(() => ({ wch: 14 }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, 'Detalhamento');

  const sufixoOrigem = origemFiltro ? ` - ${origemFiltro}` : '';
  XLSX.writeFile(livro, `Detalhamento ${mesRotulo}${sufixoOrigem}.xlsx`);
}

// Detalhamento do período na Visão geral — mesmo nível de detalhe da
// planilha da Tereza (Ano/Mês do arquivo, valores unitários e totais
// separados por marmita/lanche, valor pago x a pagar), com totais no
// rodapé, filtro por origem (pills), colunas ordenáveis (clica no
// cabeçalho) e exportação pra Excel (respeita o filtro de origem
// selecionado). As colunas Origem/Quem/Descrição saíram da tabela na TELA a
// pedido da Tereza (2026-08-30) — os dados continuam disponíveis em
// `linhas`, o filtro por origem (pills) continua funcionando normalmente, e
// o Excel exportado continua trazendo essas colunas (útil pro cliente que
// recebe o arquivo pra conferência/pagamento).
export default function TabelaDetalhamento({
  linhas,
  mesRotulo,
}: {
  linhas: DetalheLancamento[];
  mesRotulo: string;
}) {
  const origens = useMemo(() => Array.from(new Set(linhas.map((l) => l.origem))).sort(), [linhas]);
  const [origemFiltro, setOrigemFiltro] = useState<string | null>(null);
  const linhasFiltradas = origemFiltro ? linhas.filter((l) => l.origem === origemFiltro) : linhas;
  const { linhasOrdenadas, coluna, direcao, alternar } = useOrdenacao<DetalheLancamento>(
    linhasFiltradas,
    'data',
    'desc'
  );

  const totais = useMemo(
    () =>
      linhasFiltradas.reduce(
        (acc, l) => ({
          qtdMarmitas: acc.qtdMarmitas + l.qtdMarmitas,
          qtdLanches: acc.qtdLanches + l.qtdLanches,
          valorTotalMarmitas: acc.valorTotalMarmitas + l.valorTotalMarmitas,
          valorTotalLanches: acc.valorTotalLanches + l.valorTotalLanches,
          valorTotal: acc.valorTotal + l.valorTotal,
          valorPago: acc.valorPago + (l.valorPago ?? 0),
        }),
        {
          qtdMarmitas: 0,
          qtdLanches: 0,
          valorTotalMarmitas: 0,
          valorTotalLanches: 0,
          valorTotal: 0,
          valorPago: 0,
        }
      ),
    [linhasFiltradas]
  );

  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[15px] font-bold text-cafe">Detalhamento do período</h3>
        <div className="flex flex-wrap items-center gap-2">
          {origens.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setOrigemFiltro(null)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                  origemFiltro === null ? 'bg-cafe text-white' : 'bg-cafe/5 text-tinta/60 hover:bg-cafe/10'
                }`}
              >
                Todas as origens
              </button>
              {origens.map((o) => (
                <button
                  key={o}
                  onClick={() => setOrigemFiltro(o)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                    origemFiltro === o ? 'bg-cafe text-white' : 'bg-cafe/5 text-tinta/60 hover:bg-cafe/10'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          )}
          {linhasFiltradas.length > 0 && (
            <button
              onClick={() => exportarExcel(linhasFiltradas, mesRotulo, origemFiltro)}
              className="rounded-full bg-dourado/15 px-2.5 py-1 text-xs font-semibold text-terracota transition hover:bg-dourado/25"
            >
              Exportar Excel
            </button>
          )}
        </div>
      </div>
      {linhasOrdenadas.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta/45">
          {linhas.length === 0 ? 'Nenhum lançamento nesse período.' : 'Nenhum lançamento com essa origem.'}
        </p>
      ) : (
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-cafe/10 text-[11px] uppercase tracking-wide text-tinta/40">
                <ThOrdenavel label="Ano/Mês" ativo={coluna === 'anoMes'} direcao={direcao} onClick={() => alternar('anoMes')} />
                <ThOrdenavel label="Data" ativo={coluna === 'data'} direcao={direcao} onClick={() => alternar('data')} />
                <ThOrdenavel
                  label="Qtd. marmitas"
                  ativo={coluna === 'qtdMarmitas'}
                  direcao={direcao}
                  onClick={() => alternar('qtdMarmitas')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Qtd. lanches"
                  ativo={coluna === 'qtdLanches'}
                  direcao={direcao}
                  onClick={() => alternar('qtdLanches')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Unit. marmita"
                  ativo={coluna === 'valorUnitMarmita'}
                  direcao={direcao}
                  onClick={() => alternar('valorUnitMarmita')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Unit. lanche"
                  ativo={coluna === 'valorUnitLanche'}
                  direcao={direcao}
                  onClick={() => alternar('valorUnitLanche')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Total marmitas"
                  ativo={coluna === 'valorTotalMarmitas'}
                  direcao={direcao}
                  onClick={() => alternar('valorTotalMarmitas')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Total lanches"
                  ativo={coluna === 'valorTotalLanches'}
                  direcao={direcao}
                  onClick={() => alternar('valorTotalLanches')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Valor a pagar"
                  ativo={coluna === 'valorTotal'}
                  direcao={direcao}
                  onClick={() => alternar('valorTotal')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Valor pago"
                  ativo={coluna === 'valorPago'}
                  direcao={direcao}
                  onClick={() => alternar('valorPago')}
                  alinhamento="right"
                />
                <ThOrdenavel
                  label="Data pagto."
                  ativo={coluna === 'dataPagamento'}
                  direcao={direcao}
                  onClick={() => alternar('dataPagamento')}
                />
                <th className="pb-2 text-left font-semibold">Obs</th>
              </tr>
            </thead>
            <tbody>
              {linhasOrdenadas.map((l, i) => (
                <tr key={i} className="border-b border-cafe/5 last:border-0">
                  <td className="py-2 text-tinta/55">{l.anoMes}</td>
                  <td className="py-2 text-tinta/70">{formatarData(l.data)}</td>
                  <td className="py-2 text-right">{l.qtdMarmitas || '—'}</td>
                  <td className="py-2 text-right">{l.qtdLanches || '—'}</td>
                  <td className="py-2 text-right text-tinta/55">
                    {l.valorUnitMarmita ? formatarMoeda(l.valorUnitMarmita) : '—'}
                  </td>
                  <td className="py-2 text-right text-tinta/55">
                    {l.valorUnitLanche ? formatarMoeda(l.valorUnitLanche) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    {l.valorTotalMarmitas ? formatarMoeda(l.valorTotalMarmitas) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    {l.valorTotalLanches ? formatarMoeda(l.valorTotalLanches) : '—'}
                  </td>
                  <td className="py-2 text-right font-semibold">{formatarMoeda(l.valorTotal)}</td>
                  <td className="py-2 text-right">{l.valorPago != null ? formatarMoeda(l.valorPago) : '—'}</td>
                  <td className="py-2 text-tinta/55">{formatarData(l.dataPagamento)}</td>
                  <td className="py-2 text-tinta/45">{l.obs ?? '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-creme">
              <tr className="border-t-2 border-cafe/20 text-sm font-bold text-cafe">
                <td className="py-2.5" colSpan={2}>
                  Totais
                </td>
                <td className="py-2.5 text-right">{totais.qtdMarmitas || '—'}</td>
                <td className="py-2.5 text-right">{totais.qtdLanches || '—'}</td>
                <td className="py-2.5" colSpan={2}></td>
                <td className="py-2.5 text-right">{formatarMoeda(totais.valorTotalMarmitas)}</td>
                <td className="py-2.5 text-right">{formatarMoeda(totais.valorTotalLanches)}</td>
                <td className="py-2.5 text-right">{formatarMoeda(totais.valorTotal)}</td>
                <td className="py-2.5 text-right">{formatarMoeda(totais.valorPago)}</td>
                <td className="py-2.5" colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
