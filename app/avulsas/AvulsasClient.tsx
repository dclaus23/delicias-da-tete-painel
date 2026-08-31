'use client';

import { Suspense, useMemo, useState } from 'react';
import type { ResultadoMensal, ClienteResumo, PratoComparativo, Pendencia, ResumoAvulsosMes } from '@/lib/types';
import { formatarMoeda, formatarPercentual, nomeMes, mesAnterior } from '@/lib/calculos';
import BarraFiltros from '@/components/BarraFiltros';
import SeletorDropdown from '@/components/SeletorDropdown';
import KpiCard from '@/components/KpiCard';
import ListaClientes from '@/components/ListaClientes';
import RankingPratos from '@/components/RankingPratos';
import TabelaPendencias from '@/components/TabelaPendencias';
import GraficoDonut from '@/components/GraficoDonut';

export default function AvulsasClient({
  meses,
  mesSelecionado,
  resultadosMensais,
  clientesResumo,
  pratosComparativo,
  pendencias,
  resumoMes,
}: {
  meses: { valor: string; rotulo: string }[];
  mesSelecionado: string;
  resultadosMensais: ResultadoMensal[];
  clientesResumo: ClienteResumo[];
  pratosComparativo: PratoComparativo[];
  pendencias: Pendencia[];
  resumoMes: ResumoAvulsosMes;
}) {
  const opcoesCliente = useMemo(
    () => [
      { valor: 'TODOS', rotulo: 'Todos os clientes' },
      ...clientesResumo.map((c) => ({ valor: c.nome, rotulo: c.nome })),
    ],
    [clientesResumo]
  );
  const [clienteSelecionado, setClienteSelecionado] = useState('TODOS');

  const clientesFiltrados =
    clienteSelecionado === 'TODOS'
      ? clientesResumo
      : clientesResumo.filter((c) => c.nome === clienteSelecionado);

  const totalClientes = clientesFiltrados.length;
  const recorrentes = clientesFiltrados.filter((c) => c.recorrente).length;

  // Com "Todos os clientes" selecionado, os totais vêm de resumoMes (soma
  // TODAS as linhas do mês, com ou sem "Quem pediu?" preenchido) — assim
  // uma venda sem nome não some do KPI. Com um cliente específico
  // selecionado, o total é só dele mesmo (que por definição tem nome).
  const valorVendido =
    clienteSelecionado === 'TODOS'
      ? resumoMes.valorTotal
      : clientesFiltrados.reduce((s, c) => s + c.valorTotal, 0);
  const totalPedidos =
    clienteSelecionado === 'TODOS'
      ? resumoMes.totalPedidos
      : clientesFiltrados.reduce((s, c) => s + c.pedidos, 0);

  const resultadoMes = resultadosMensais.find((r) => r.mes === mesSelecionado);
  const margemSobreDespesas =
    resultadoMes && resultadoMes.gastos > 0
      ? resultadoMes.faturamentoAvulsos / resultadoMes.gastos - 1
      : 0;

  const pendentesCount = pendencias.filter((p) => p.tipo === 'PEDIDO_SEM_PAGAMENTO').length;
  const semPedidoCount = pendencias.filter((p) => p.tipo === 'PAGAMENTO_SEM_PEDIDO').length;
  const pagosCount = Math.max(totalPedidos - pendentesCount, 0);

  const mesLabel = mesSelecionado ? nomeMes(mesSelecionado) : '—';
  const mesAnteriorLabel = mesSelecionado ? nomeMes(mesAnterior(mesSelecionado)) : '—';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-cafe">Pedidos avulsos</h1>
          <p className="text-sm text-tinta/55">Clientes, recorrência e conciliação de pagamentos</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Suspense fallback={null}>
            <BarraFiltros meses={meses} mostrarContexto={false} />
          </Suspense>
          <SeletorDropdown
            rotulo="Cliente"
            valor={clienteSelecionado}
            opcoes={opcoesCliente}
            onChange={setClienteSelecionado}
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard rotulo="Vendido no período" valor={formatarMoeda(valorVendido)} cor="dourado" />
        <KpiCard rotulo="Pedidos" valor={String(totalPedidos)} cor="petroleo" />
        <KpiCard rotulo="Clientes" valor={String(totalClientes)} cor="petroleo" />
        <KpiCard rotulo="Recorrentes" valor={`${recorrentes} de ${totalClientes}`} cor="sucesso" />
        <KpiCard rotulo="Margem s/ despesas" valor={formatarPercentual(margemSobreDespesas)} cor="vinho" />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ListaClientes clientes={clientesFiltrados} />
        </div>
        <RankingPratos pratos={pratosComparativo} mesLabel={mesLabel} mesAnteriorLabel={mesAnteriorLabel} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TabelaPendencias pendencias={pendencias} />
        </div>
        <GraficoDonut
          titulo="Situação dos pedidos"
          subtitulo="Pago vs. pendente vs. sem pedido correspondente"
          formatoMoeda={false}
          fatias={[
            { nome: 'Pago', valor: pagosCount, cor: '#3C8558' },
            { nome: 'Pendente', valor: pendentesCount, cor: '#C0392B' },
            { nome: 'Sem pedido', valor: semPedidoCount, cor: '#B5651D' },
          ]}
        />
      </div>
    </div>
  );
}
