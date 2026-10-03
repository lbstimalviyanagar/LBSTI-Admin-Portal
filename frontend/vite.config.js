import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    if (!env.VITE_API_URL) throw new Error('Set VITE_API_URL to the deployed HTTPS API origin before building.');
    const apiUrl = new URL(env.VITE_API_URL);
    if (apiUrl.protocol !== 'https:' || /^(localhost|127(?:\.\d{1,3}){3}|::1)$/i.test(apiUrl.hostname)) {
      throw new Error('Production VITE_API_URL must use a public HTTPS API host.');
    }
  }
  return {
    plugins: [react()],
    server: { port: 5173, proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } } },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) return 'vendor';
            if (id.includes('/components/Charts/')) return 'charts';
          },
        },
      },
    },
  };
});
