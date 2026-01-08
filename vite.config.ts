
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// IMPORTANTE: Para usar HTTPS (necessário para câmera no mobile),
// gere os arquivos key.pem e cert.pem na raiz usando mkcert.
// Se eles não existirem, o servidor rodará em HTTP (câmera pode falhar no mobile).

export default defineConfig({
  plugins: [react()],
  server: {
    // 'true' habilita escuta em todos os IPs da rede (0.0.0.0)
    host: true, 
    // Configura HTTPS apenas se os arquivos de certificado existirem
    https: (fs.existsSync('key.pem') && fs.existsSync('cert.pem')) ? {
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
    } : undefined
  }
})
