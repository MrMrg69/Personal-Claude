import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    sourcemap: true,
    // O chunk do three passa de 500 kB minificado (~150–170 kB gz); o aviso padrão
    // só poluiria o build. Orçamento real é acompanhado pelo tamanho gz impresso.
    chunkSizeWarningLimit: 700,
    // Vite 8 (rolldown): three em chunk próprio para cache do navegador entre deploys.
    // É otimização — se a versão exata reclamar do formato, remova o bloco sem efeito no jogo.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  server: { port: 5173 },
});
