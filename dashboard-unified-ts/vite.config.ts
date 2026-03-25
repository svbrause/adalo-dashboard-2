import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Post-Visit Blueprint links put the full payload in ?d= (very long URLs). Node’s default
// ~16KB max header size causes 431 on the dev server — see package.json "dev"/"preview"
// (NODE --max-http-header-size). Production proxies need large_client_header_buffers (nginx) etc.

/** Same-origin proxy so ElevenLabs works in dev/preview (their API does not allow browser CORS). */
function elevenLabsDevProxy(apiKey: string) {
  return {
    '/__elevenlabs-proxy': {
      target: 'https://api.elevenlabs.io',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/__elevenlabs-proxy/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('xi-api-key', apiKey)
        })
      },
    },
  } as const
}

/** Same-origin proxy for Gemini (Generative Language API blocks browser CORS). Key stays on the dev server. */
function geminiDevProxy(apiKey: string) {
  return {
    '/__gemini-proxy': {
      target: 'https://generativelanguage.googleapis.com',
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/__gemini-proxy/, ''),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq) => {
          const p = proxyReq.path || ''
          const sep = p.includes('?') ? '&' : '?'
          proxyReq.path = `${p}${sep}key=${encodeURIComponent(apiKey)}`
        })
      },
    },
  } as const
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const elevenLabsKey = env.VITE_ELEVENLABS_API_KEY?.trim() ?? ''
  const geminiKey = env.VITE_GEMINI_API_KEY?.trim() ?? ''

  const devProxy = {
    ...(elevenLabsKey ? elevenLabsDevProxy(elevenLabsKey) : {}),
    ...(geminiKey ? geminiDevProxy(geminiKey) : {}),
  }
  const proxy =
    Object.keys(devProxy).length > 0 ? devProxy : undefined

  return {
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    ...(proxy ? { proxy } : {}),
  },
  preview: {
    ...(proxy ? { proxy } : {}),
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
  }
})
