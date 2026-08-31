'use client';

import { useMemo, useState } from 'react';

export type Direcao = 'asc' | 'desc';

// Ordenação genérica de tabela por coluna — clicar alterna asc/desc; trocar
// de coluna reinicia em asc. Usado por ListaClientes, TabelaGastos,
// TabelaDetalhamento e TabelaPendencias.
export function useOrdenacao<T extends Record<string, unknown>>(
  linhas: T[],
  colunaInicial: keyof T | null = null,
  direcaoInicial: Direcao = 'asc'
) {
  const [coluna, setColuna] = useState<keyof T | null>(colunaInicial);
  const [direcao, setDirecao] = useState<Direcao>(direcaoInicial);

  function alternar(col: keyof T) {
    if (coluna === col) {
      setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setColuna(col);
      setDirecao('asc');
    }
  }

  const linhasOrdenadas = useMemo(() => {
    if (!coluna) return linhas;
    const copia = [...linhas];
    copia.sort((a, b) => {
      const va = a[coluna];
      const vb = b[coluna];
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else if (typeof va === 'boolean' && typeof vb === 'boolean') {
        cmp = Number(va) - Number(vb);
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR');
      }
      return direcao === 'asc' ? cmp : -cmp;
    });
    return copia;
  }, [linhas, coluna, direcao]);

  return { linhasOrdenadas, coluna, direcao, alternar };
}
