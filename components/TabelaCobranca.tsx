'use client';

import { useState } from 'react';
import type { Cobranca } from '@/lib/types';
import { formatarMoeda } from '@/lib/calculos';

export default function TabelaCobranca({ cobrancas }: { cobrancas: Cobranca[] }) {
  const [copiadoIndex, setCopiadoIndex] = useState<number | null>(null);

  async function copiar(mensagem: string, i: number) {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiadoIndex(i);
      setTimeout(() => setCopiadoIndex((atual) => (atual === i ? null : atual)), 2000);
    } catch {
      // clipboard indisponível (ex: navegador sem permissão) — sem problema,
      // a mensagem continua selecionável/copiável manualmente na tela.
    }
  }

  if (cobrancas.length === 0) {
    return (
      <div className="rounded-lg border border-cafe/8 bg-white p-6 text-center text-sm text-tinta/55 shadow-cartao">
        Nenhuma cobrança pendente — tudo pago.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cobrancas.map((c, i) => (
        <div key={i} className="rounded-lg border border-cafe/8 bg-white p-4 shadow-cartao">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-bold text-cafe">{c.nome}</p>
              <p className="text-xs text-tinta/50">
                Pedido de {new Date(c.data).toLocaleDateString('pt-BR')} · {c.diasEmAberto}d em aberto
              </p>
            </div>
            <p className="text-lg font-extrabold text-terracota">{formatarMoeda(c.valor)}</p>
          </div>

          {c.descricaoPedido && <p className="mt-1 text-sm text-tinta/70">{c.descricaoPedido}</p>}

          <div className="mt-3 rounded-md bg-creme p-3 text-sm text-tinta/80">{c.mensagem}</div>

          <div className="mt-3 flex flex-wrap gap-2">
            {c.linkWhatsApp ? (
              <a
                href={c.linkWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-sucesso px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Abrir WhatsApp
              </a>
            ) : (
              <span className="rounded-full bg-tinta/8 px-4 py-1.5 text-sm font-medium text-tinta/50">
                Telefone não encontrado
              </span>
            )}
            <button
              onClick={() => copiar(c.mensagem, i)}
              className="rounded-full border border-cafe/15 px-4 py-1.5 text-sm font-medium text-tinta/70 transition hover:border-cafe/30"
            >
              {copiadoIndex === i ? 'Copiado!' : 'Copiar mensagem'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
