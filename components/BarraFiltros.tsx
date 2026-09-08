'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import SeletorDropdown from './SeletorDropdown';

const NOMES_MES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const OPCOES_CONTEXTO = [
  { valor: 'TODOS', rotulo: 'Escola + Avulsos' },
  { valor: 'ESCOLA', rotulo: 'Só Escola' },
  { valor: 'AVULSOS', rotulo: 'Só Avulsos' },
];

// Filtro de Período (mês + ano combinados numa única caixa, ex.: "Agosto
// 2026" — em vez de dois seletores separados) e contexto (Escola/Avulsos),
// lidos e gravados na URL — assim a seleção é compartilhada entre as
// páginas do painel ao navegar de uma pra outra. Layout revisado no Lote 25
// (2026-09-08) pra ficar com uma caixa só por filtro, no mesmo estilo do
// OsClauss-Financeiro, em vez de dois dropdowns (Mês/Ano) + três botões
// (Escola+Avulsos/Só Escola/Só Avulsos) espalhados.
// `mostrarContexto=false` esconde a caixa de contexto pra páginas que já
// são só de um tipo (ex: Pedidos avulsos).
export default function BarraFiltros({
  meses,
  mostrarContexto = true,
}: {
  meses: { valor: string; rotulo: string }[];
  mostrarContexto?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mesDefault = meses[meses.length - 1]?.valor ?? '';
  const mesAtual = searchParams.get('mes') ?? mesDefault;
  const contextoAtual = searchParams.get('contexto') ?? 'TODOS';

  // "Agosto 2026" em vez de "ago 26" (formato usado nos gráficos) — mais
  // legível como opção de dropdown. Mais recente primeiro: é o que
  // normalmente se procura.
  const opcoesPeriodo = [...meses]
    .map((m) => {
      const [ano, mesNum] = m.valor.split('-');
      const nomeCompleto = NOMES_MES[Number(mesNum) - 1] ?? m.rotulo;
      return { valor: m.valor, rotulo: `${nomeCompleto} ${ano}` };
    })
    .reverse();

  function atualizar(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(chave, valor);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SeletorDropdown
        rotulo="Período"
        valor={mesAtual}
        opcoes={opcoesPeriodo}
        onChange={(v) => atualizar('mes', v)}
      />
      {mostrarContexto && (
        <SeletorDropdown
          rotulo="Contexto"
          valor={contextoAtual}
          opcoes={OPCOES_CONTEXTO}
          onChange={(v) => atualizar('contexto', v)}
        />
      )}
    </div>
  );
}
