import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// IMPORTANTE: Certifique-se de ter gerado os arquivos key.pem e cert.pem
// na raiz do projeto usando mkcert. Veja o arquivo INSTRUCOES_HTTPS.txt.

export default defineConfig({
  plugins: [react()],
  server: {
    // 'true' habilita escuta em todos os IPs (0.0.0.0)
    host: true, 
    https: {
      key: fs.readFileSync('key.pem'),
      cert: fs.readFileSync('cert.pem'),
    }
  }
})