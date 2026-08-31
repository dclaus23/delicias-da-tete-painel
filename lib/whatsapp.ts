import { formatarMoeda } from './calculos';

interface Contato {
  nome: string;
  celular: string;
}

// Faixa Unicode das marcas diacríticas combinantes (acentos), construída por
// código de ponto pra evitar qualquer ambiguidade de escape no arquivo-fonte.
const PRIMEIRA_MARCA = String.fromCodePoint(768); // U+0300
const ULTIMA_MARCA = String.fromCodePoint(879); // U+036F
const REGEX_DIACRITICOS = new RegExp(`[${PRIMEIRA_MARCA}-${ULTIMA_MARCA}]`, 'g');

function normalizarNome(nome: string) {
  return nome
    .normalize('NFD')
    .replace(REGEX_DIACRITICOS, '') // remove acentos (marcas diacríticas combinantes, U+0300-U+036F)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Casa o nome do cliente (texto livre, vindo da planilha) com a base de
// contatos. Primeiro tenta igualdade exata (normalizada); se não achar,
// tenta um nome "contido" no outro — cobre apelidos/abreviações comuns.
// Assumção: como não é usado pra automação (só monta um link, quem manda é
// a pessoa), um match aproximado errado tem baixo risco — mas o nome
// encontrado sempre aparece na tela pra conferência visual.
export function encontrarCelular(nomeCliente: string, contatos: Contato[]): string | null {
  const alvo = normalizarNome(nomeCliente);
  if (!alvo) return null;

  const exato = contatos.find((c) => normalizarNome(c.nome) === alvo);
  if (exato) return exato.celular;

  const parcial = contatos.find((c) => {
    const n = normalizarNome(c.nome);
    return n.includes(alvo) || alvo.includes(n);
  });
  return parcial?.celular ?? null;
}

export function montarMensagemCobranca(
  nomeCliente: string,
  data: string,
  valor: number,
  descricaoPedido: string | null
) {
  const primeiroNome = nomeCliente.trim().split(' ')[0];
  const dataFormatada = new Date(data).toLocaleDateString('pt-BR');
  const valorFormatado = formatarMoeda(valor);
  const item = descricaoPedido ? ` (${descricaoPedido})` : '';

  return `Oi ${primeiroNome}, tudo bem? Aqui é da Delícias da Tetê. Vi que o pedido do dia ${dataFormatada}${item}, no valor de ${valorFormatado}, ainda está em aberto. Pode confirmar o pagamento quando puder? Obrigada!`;
}

export function montarLinkWhatsApp(celular: string, mensagem: string) {
  return `https://wa.me/${celular}?text=${encodeURIComponent(mensagem)}`;
}
