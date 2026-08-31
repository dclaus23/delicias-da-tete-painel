import { Suspense } from 'react';
import { buscarResultadosMensais, buscarCobrancas } from '@/lib/dados';
import { nomeMes } from '@/lib/calculos';
import CobrancaClient from './CobrancaClient';

export const revalidate = 0;

export default async function CobrancaPage() {
  const [resultadosMensais, cobrancas] = await Promise.all([
    buscarResultadosMensais(),
    buscarCobrancas(),
  ]);
  const meses = resultadosMensais.map((r) => ({ valor: r.mes, rotulo: nomeMes(r.mes) }));

  return (
    <Suspense fallback={null}>
      <CobrancaClient meses={meses} cobrancas={cobrancas} />
    </Suspense>
  );
}
