/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // paleta tirada da logo real (prato dourado, frango tostado, contorno em café)
        cafe: '#3D2817', // navbar, texto de destaque
        creme: '#FBF6EA', // fundo da página
        dourado: '#E3A63E', // prato — faturamento
        terracota: '#B5651D', // frango — gastos / alerta
        petroleo: '#2C6E7F', // azul-petróleo — % lucro
        vinho: '#7A3B4E', // dízimo/oferta
        sucesso: '#3C8558', // lucro / pago
        alerta: '#C0392B', // pendências
        tinta: '#3D2817',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        cartao: '0 1px 2px rgba(61, 40, 23, 0.06), 0 1px 3px rgba(61, 40, 23, 0.04)',
      },
    },
  },
  plugins: [],
};
