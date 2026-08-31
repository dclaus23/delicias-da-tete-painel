import type { ResultadoMensal } from './types';

export function faturamentoTotal(r: ResultadoMensal) {
  return r.faturamentoEscola + r.faturamentoAvulsos;
}

export function lucro(r: ResultadoMensal) {
  return faturamentoTotal(r) - r.gastos;
}

export function margemLucro(r: ResultadoMensal) {
  const total = faturamentoTotal(r);
  return total === 0 ? 0 : lucro(r) / total;
}

export function dizimo(r: ResultadoMensal) {
  return lucro(r) * 0.1;
}

export function oferta(r: ResultadoMensal) {
  return lucro(r) * 0.1;
}

// variação percentual mês a mês (retorna null pro primeiro mês da série)
export function variacaoMoM(atual: number, anterior: number | undefined) {
  if (anterior === undefined || anterior === 0) return null;
  return (atual - anterior) / anterior;
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Versão curta pra caber como rótulo em cima da barra do gráfico (ex: "12,3k")
export function formatarMoedaCompacta(valor: number) {
  if (Math.abs(valor) >= 1000) {
    return `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  }
  return formatarMoeda(valor);
}

export function formatarPercentual(valor: number) {
  return `${(valor * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

export function nomeMes(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const data = new Date(ano, mes - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
}

// Só o mês abreviado, sem o ano (ex: "ago") — usado nos gráficos da Visão
// geral, que já mostram só o ano selecionado (o ano ficaria redundante
// repetido em cada barra).
export function nomeMesCurto(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const data = new Date(ano, mes - 1, 1);
  return data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

// "2026-08" -> "2026-07" (mês calendário anterior, cruza o ano corretamente)
export function mesAnterior(mesIso: string) {
  const [ano, mes] = mesIso.split('-').map(Number);
  const data = new Date(ano, mes - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

// "2026-08-05" -> "2026-08" — usado pra filtrar listas já carregadas no
// client por mês, sem precisar de uma nova busca no servidor.
export function mesDaData(dataIso: string) {
  return dataIso.slice(0, 7);
}
