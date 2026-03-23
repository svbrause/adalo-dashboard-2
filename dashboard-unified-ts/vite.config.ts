import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Post-Visit Blueprint links put the full payload in ?d= (very long URLs). Node’s default
// ~16KB max header size causes 431 on the dev server — see package.json "dev"/"preview"
// (NODE --max-http-header-size). Production proxies need large_client_header_buffers (nginx) etc.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/data/skinTypeQuiz.ts', 'src/utils/skinQuizLink.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types/**']
    }
  }
})
