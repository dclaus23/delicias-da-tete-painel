'use client';

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatarMoeda } from '@/lib/calculos';

export interface FatiaDonut {
  nome: string;
  valor: number;
  cor: string;
}

export default function GraficoDonut({
  titulo,
  subtitulo,
  fatias,
  formatoMoeda = true,
}: {
  titulo: string;
  subtitulo?: string;
  fatias: FatiaDonut[];
  formatoMoeda?: boolean;
}) {
  return (
    <div className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
      <h3 className="text-[15px] font-bold text-cafe">{titulo}</h3>
      {subtitulo && <p className="mb-1 text-xs text-tinta/45">{subtitulo}</p>}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={fatias}
              dataKey="valor"
              nameKey="nome"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
            >
              {fatias.map((f) => (
                <Cell key={f.nome} fill={f.cor} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => (formatoMoeda ? formatarMoeda(v) : v)}
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #3D281715',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-tinta/70">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
