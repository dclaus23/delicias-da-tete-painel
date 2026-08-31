'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { ResultadoMensal } from '@/lib/types';
import { lucro, formatarMoeda, nomeMes } from '@/lib/calculos';

export default function GraficoMensal({ dados }: { dados: ResultadoMensal[] }) {
  const pontos = dados.map((r) => ({
    mes: nomeMes(r.mes),
    Escola: r.faturamentoEscola,
    Avulsos: r.faturamentoAvulsos,
    Gastos: -r.gastos,
    Lucro: lucro(r),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={pontos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#3D281712" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 12, fill: '#3D2817' }}
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
            formatter={(valor: number, nome: string) => [formatarMoeda(Math.abs(valor)), nome]}
            contentStyle={{
              background: '#FFFFFF',
              border: '1px solid #3D281715',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="Escola" stackId="receita" fill="#3D2817" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Avulsos" stackId="receita" fill="#E3A63E" radius={[3, 3, 0, 0]} />
          <Bar dataKey="Gastos" fill="#B5651D66" radius={[3, 3, 3, 3]} />
          <Line
            type="monotone"
            dataKey="Lucro"
            stroke="#3C8558"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#3C8558' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
