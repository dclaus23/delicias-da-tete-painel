'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts';
import { formatarMoeda, formatarMoedaCompacta, formatarPercentual, variacaoMoM, nomeMesCurto } from '@/lib/calculos';

type Ponto = { mesLabel: string; mes: string; valor: number; variacao: number | null };

// Rótulo do eixo X com duas linhas: mês abreviado (em cima) e a variação
// vs. o mês anterior (embaixo, colorida) — assim cada barra carrega sua
// própria comparação, em vez de um único indicador no topo do gráfico que
// só valia pro mês selecionado.
function TickMesComVariacao({
  x,
  y,
  payload,
  variacaoPorLabel,
}: {
  x: number;
  y: number;
  payload: { value: string };
  variacaoPorLabel: Map<string, number | null>;
}) {
  const variacao = variacaoPorLabel.get(payload.value) ?? null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#3D2817" fontSize={13} fontWeight={600}>
        {payload.value}
      </text>
      {variacao !== null && (
        <text
          x={0}
          y={0}
          dy={32}
          textAnchor="middle"
          fill={variacao >= 0 ? '#3C8558' : '#7A1F3D'}
          fontSize={10}
          fontWeight={700}
        >
          {variacao >= 0 ? '▲ ' : '▼ '}
          {formatarPercentual(Math.abs(variacao))}
        </text>
      )}
    </g>
  );
}

export default function GraficoIndicadorMensal({
  titulo,
  dados,
  mesSelecionado,
  cor,
}: {
  titulo: string;
  dados: { mes: string; valor: number }[];
  mesSelecionado: string;
  cor: string;
}) {
  // Variação calculada por barra (contra o mês anterior dentro da própria
  // série do ano exibido) — não só pro mês selecionado.
  const pontos: Ponto[] = dados.map((d, i) => {
    const anteriorPonto = dados[i - 1];
    const variacao = anteriorPonto ? variacaoMoM(d.valor, anteriorPonto.valor) : null;
    return { mesLabel: nomeMesCurto(d.mes), mes: d.mes, valor: d.valor, variacao };
  });
  const variacaoPorLabel = new Map(pontos.map((p) => [p.mesLabel, p.variacao]));

  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-5 shadow-cartao">
      <div className="mb-2">
        <h3 className="text-base font-bold text-cafe">{titulo}</h3>
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={pontos} margin={{ top: 24, right: 12, left: 0, bottom: 4 }} barCategoryGap="12%">
            <CartesianGrid strokeDasharray="3 3" stroke="#3D281712" vertical={false} />
            <XAxis
              dataKey="mesLabel"
              height={44}
              tick={(props) => <TickMesComVariacao {...props} variacaoPorLabel={variacaoPorLabel} />}
              axisLine={{ stroke: '#3D281720' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#3D281780' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number) => formatarMoeda(v)}
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #3D281715',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={110}>
              <LabelList
                dataKey="valor"
                position="top"
                formatter={(v: number) => formatarMoedaCompacta(Number(v))}
                style={{ fontSize: 12, fontWeight: 600, fill: '#3D2817' }}
              />
              {pontos.map((p) => (
                <Cell key={p.mes} fill={p.mes === mesSelecionado ? cor : `${cor}55`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
