import type { ResultadoMensal, ClienteResumo, PratoRanking, Pendencia } from './types';

// Números aproximados/estendidos a partir dos dados reais que a Tereza já
// tem nas planilhas — servem pra demonstração, não são o valor exato.
export const resultadosMensais: ResultadoMensal[] = [
  { mes: '2026-03', faturamentoEscola: 8200, faturamentoAvulsos: 1400, gastos: 3600 },
  { mes: '2026-04', faturamentoEscola: 8500, faturamentoAvulsos: 1550, gastos: 3750 },
  { mes: '2026-05', faturamentoEscola: 8900, faturamentoAvulsos: 1700, gastos: 3900 },
  { mes: '2026-06', faturamentoEscola: 9400, faturamentoAvulsos: 1900, gastos: 4100 },
  { mes: '2026-07', faturamentoEscola: 9800, faturamentoAvulsos: 2100, gastos: 4300 },
  { mes: '2026-08', faturamentoEscola: 10300, faturamentoAvulsos: 2300, gastos: 4500 },
];

export const clientesResumo: ClienteResumo[] = [
  { nome: 'Sival Rumão Freitas', contexto: 'SAQUE', pedidos: 14, valorTotal: 342, pratoFavorito: 'Filé de Frango grelhado', recorrente: true },
  { nome: 'Carla dos Santos Casemiro', contexto: 'CAJ', pedidos: 9, valorTotal: 203, pratoFavorito: 'Filé de Frango à milanesa', recorrente: true },
  { nome: 'Adriano José Ferreira dos Santos', contexto: 'CASA', pedidos: 6, valorTotal: 660, pratoFavorito: 'Quentinhas Diversas', recorrente: true },
  { nome: 'Suelen Pintor de Araújo e Souza', contexto: 'CAJ', pedidos: 5, valorTotal: 178, pratoFavorito: 'Escalopinho de Carne', recorrente: false },
  { nome: 'Rafael Ferreira Saroldi Pereira', contexto: 'CAJ', pedidos: 4, valorTotal: 92, pratoFavorito: 'Filé de Peixe empanado', recorrente: true },
  { nome: 'Marcela Moraes Costa', contexto: 'EXTRA', pedidos: 3, valorTotal: 69, pratoFavorito: 'Bife com fritas', recorrente: false },
  { nome: 'Rosana da Silva Cruz', contexto: 'CAJ', pedidos: 4, valorTotal: 86, pratoFavorito: 'Carne assada ao molho madeira', recorrente: true },
  { nome: 'Bruna do Carmo Silva', contexto: 'BARRA', pedidos: 8, valorTotal: 166, pratoFavorito: 'Bife com fritas', recorrente: false },
];

export const pratosRanking: PratoRanking[] = [
  { prato: 'Filé de Frango à milanesa', quantidade: 21 },
  { prato: 'Bife com fritas', quantidade: 17 },
  { prato: 'Filé de Peixe empanado', quantidade: 15 },
  { prato: 'Escalopinho de Carne', quantidade: 11 },
  { prato: 'Canelone frango com molho vermelho', quantidade: 9 },
];

export const pendencias: Pendencia[] = [
  { tipo: 'PEDIDO_SEM_PAGAMENTO', data: '2026-08-09', nome: 'Suelen Pintor de Araújo e Souza', contexto: 'CAJ', valor: 46, diasEmAberto: 7 },
  { tipo: 'PEDIDO_SEM_PAGAMENTO', data: '2026-08-12', nome: 'Marcela Moraes Costa', contexto: 'EXTRA', valor: 23, diasEmAberto: 4 },
  { tipo: 'PAGAMENTO_SEM_PEDIDO', data: '2026-08-07', nome: 'Christiane Gonzalez de Almeida', contexto: 'SAQUE', valor: 22, diasEmAberto: 9 },
  { tipo: 'PAGAMENTO_SEM_PEDIDO', data: '2026-08-10', nome: 'Natanael A. Guimarães', contexto: 'SAQUE', valor: 130, diasEmAberto: 6 },
];

export const ultimaSincronizacao = '2026-08-16T08:42:00-03:00';
