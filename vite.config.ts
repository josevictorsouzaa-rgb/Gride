
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Configuração para permitir câmera no mobile via HTTPS
// Proxy reencaminha chamadas /api para o backend na porta 8000
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Gera um certificado automático para HTTPS funcionar
  ],
  server: {
    host: true, // Permite acesso via IP (ex: 192.168.x.x)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
