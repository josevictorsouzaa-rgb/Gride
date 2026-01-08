
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Configuração para permitir câmera no mobile via HTTPS
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Gera um certificado automático para HTTPS funcionar
  ],
  server: {
    host: true, // Permite acesso via IP (ex: 192.168.x.x)
    https: true // Força o modo seguro
  }
})
