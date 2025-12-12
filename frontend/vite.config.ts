import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      allowedHosts: true,
      // Ensure HMR is disabled explicitly if somehow running in a pseudo-prod mode via vite dev
      // though typically dev mode implies hmr.
      // If we are in dev, we want to avoid the "undefined" port issue if possible.
      // But if the user says "Desabilitar WebSocket do Vite HMR no ambiente de produção",
      // we can try to set hmr: false if it's not strictly development?
      // Actually, standard vite build does not use this server config.
      // But let's be safe.
      hmr: isProduction ? false : undefined,
    },
    build: {
      sourcemap: false,
    }
  }
})
