import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(() => {
  // O usuário está rodando 'npm run dev' (vite) em um ambiente que ele considera produção (Docker).
  // O erro 'client:536' ocorre porque o cliente HMR tenta conectar sem porta ou com porta errada.
  // Para resolver "NUNCA MAIS aparecer", configuramos clientPort explicitamente para 5173.
  // Se estiver realmente em build de produção (vite build), server.hmr nem é usado.

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      allowedHosts: true as any,
      hmr: {
        // Força o cliente a usar a porta 5173 para HMR, evitando que tente conectar na porta 80 (sem porta)
        // quando acessado via hostname (ex: http://inventario) e falhe, ou gere URLs inválidas.
        clientPort: 5173,
      },
      watch: {
        usePolling: true,
      }
    },
    build: {
      sourcemap: false,
    }
  }
})
