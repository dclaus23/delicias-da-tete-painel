'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import PillFiltro from './PillFiltro';
import SeletorDropdown from './SeletorDropdown';

const MESES = [
  { valor: '01', rotulo: 'Janeiro' },
  { valor: '02', rotulo: 'Fevereiro' },
  { valor: '03', rotulo: 'Março' },
  { valor: '04', rotulo: 'Abril' },
  { valor: '05', rotulo: 'Maio' },
  { valor: '06', rotulo: 'Junho' },
  { valor: '07', rotulo: 'Julho' },
  { valor: '08', rotulo: 'Agosto' },
  { valor: '09', rotulo: 'Setembro' },
  { valor: '10', rotulo: 'Outubro' },
  { valor: '11', rotulo: 'Novembro' },
  { valor: '12', rotulo: 'Dezembro' },
];

const OPCOES_CONTEXTO = [
  { valor: 'TODOS', rotulo: 'Escola + Avulsos' },
  { valor: 'ESCOLA', rotulo: 'Só Escola' },
  { valor: 'AVULSOS', rotulo: 'Só Avulsos' },
];

// Filtro de Mês e Ano (dois seletores independentes, combinados por baixo
// dos panos em ?mes=YYYY-MM) + contexto (Escola/Avulsos), lidos e gravados
// na URL — assim a seleção é compartilhada entre as páginas do painel ao
// navegar de uma pra outra. `mostrarContexto=false` esconde o pill de
// contexto pra páginas que já são só de um tipo (ex: Pedidos avulsos).
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
  const [anoAtual, mesNumAtual] = mesAtual ? mesAtual.split('-') : ['', ''];
  const contextoAtual = searchParams.get('contexto') ?? 'TODOS';

  const anosDisponiveis = Array.from(new Set(meses.map((m) => m.valor.slice(0, 4))))
    .sort()
    .map((ano) => ({ valor: ano, rotulo: ano }));

  function atualizar(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(chave, valor);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function atualizarMesNum(mesNum: string) {
    atualizar('mes', `${anoAtual}-${mesNum}`);
  }

  function atualizarAno(ano: string) {
    atualizar('mes', `${ano}-${mesNumAtual}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SeletorDropdown rotulo="Mês" valor={mesNumAtual} opcoes={MESES} onChange={atualizarMesNum} />
        <SeletorDropdown rotulo="Ano" valor={anoAtual} opcoes={anosDisponiveis} onChange={atualizarAno} />
      </div>
      {mostrarContexto && (
        <PillFiltro
          opcoes={OPCOES_CONTEXTO}
          valor={contextoAtual}
          onChange={(v) => atualizar('contexto', v)}
        />
      )}
    </div>
  );
}
