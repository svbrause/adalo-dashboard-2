# Gemini (AI Studio) + Vertex AI — integration guide

Portable instructions derived from the **dashboard-unified-ts-merged** Vite app. Use this document in another Cursor chat or repo to reproduce the same patterns.

There are **two** related setups:

| Path | API | Where keys live | Typical use |
|------|-----|-----------------|-------------|
| **A. Local dev proxy** | Google **Generative Language API** (`generativelanguage.googleapis.com`) | `VITE_GEMINI_API_KEY` in `.env.local` (see security note below) | Fast iteration in `npm run dev` |
| **B. Production / server** | **Vertex AI** (Gemini on GCP) | Service account JSON or ADC; **no** browser API key | Hosted backends, GCP credits, enterprise IAM |

---

## Part A — Vite: same-origin proxy + browser `fetch`

### Why a proxy?

Google’s Generative Language API does not allow arbitrary browser origins (CORS). The dev server proxies `/__gemini-proxy` → `https://generativelanguage.googleapis.com` and appends the API key **on the proxy request** so calls are same-origin from the browser.

### 1. Environment variables (`.env.local`)

```bash
# Required for the proxy to register (Vite loadEnv reads this file).
VITE_GEMINI_API_KEY=your-google-ai-studio-api-key

# Optional; default in reference app is gemini-2.0-flash
# VITE_GEMINI_MODEL=gemini-2.0-flash

# Optional localhost fallback when Gemini returns 429 (direct browser call to OpenAI — key is in bundle)
# VITE_OPENAI_API_KEY=...
# VITE_OPENAI_MODEL=gpt-4o-mini
```

**Security:** Any variable prefixed with `VITE_` is exposed to client code. This project uses `VITE_GEMINI_API_KEY` both to enable the proxy and to gate `shouldUseDevGeminiProxy()` in the client, so **the key can appear in the built JS**. Treat this as **local/demo only**, not production.

### 2. `vite.config.ts` — proxy block

Add `loadEnv` and merge a proxy only when the key is set:

```ts
import { defineConfig, loadEnv } from 'vite'

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
  const geminiKey = env.VITE_GEMINI_API_KEY?.trim() ?? ''
  const devProxy = geminiKey ? geminiDevProxy(geminiKey) : {}
  const proxy = Object.keys(devProxy).length > 0 ? devProxy : undefined

  return {
    // ...
    server: {
      ...(proxy ? { proxy } : {}),
    },
    preview: {
      ...(proxy ? { proxy } : {}),
    },
  }
})
```

### 3. Client request shape

- **URL:** `POST /__gemini-proxy/v1beta/models/{MODEL}:generateContent`
- **Body (JSON):** Gemini `generateContent` format, for example:

```json
{
  "contents": [{ "role": "user", "parts": [{ "text": "Your prompt here" }] }],
  "generationConfig": {
    "temperature": 0.65,
    "maxOutputTokens": 2048
  }
}
```

- **Response:** Read `candidates[0].content.parts[].text` (concatenate parts).

Reference defaults from the source app: `temperature: 0.65`, `maxOutputTokens: 2048`, request timeout ~25s, basic handling for `429` + optional OpenAI fallback for one code path.

### 4. When to enable client-side Gemini in the reference app

The reference implementation only uses the dev proxy when:

- `VITE_GEMINI_API_KEY` is set, and  
- `window.location.hostname` is `localhost` or `127.0.0.1`

So production builds are not left calling a missing proxy. Adapt this guard if you use preview tunnels or other hostnames.

### 5. TypeScript (`vite-env.d.ts`)

Extend `ImportMetaEnv` with at least:

```ts
readonly VITE_GEMINI_API_KEY?: string;
readonly VITE_GEMINI_MODEL?: string;
readonly VITE_OPENAI_API_KEY?: string;
readonly VITE_OPENAI_MODEL?: string;
```

### 6. Not using Vite?

Reproduce the same behavior with any dev server that can:

- Proxy a path to `https://generativelanguage.googleapis.com`
- Append `?key=` or `&key=` with your API key to the upstream URL

Examples: Next.js `rewrites` in `next.config.js`, Express middleware, etc. The browser must call **your** origin, not Google’s URL directly.

---

## Part B — Server: Vertex AI (Gemini on GCP)

This dashboard repo **does not** ship the backend; it documents the following for a **separate** Node/Express (or other) server.

### Environment variables

```bash
LLM_PROVIDER=vertex

# Optional if project_id is already inside your service account JSON
VERTEX_PROJECT_ID=your-gcp-project

VERTEX_LOCATION=us-central1
VERTEX_GEMINI_MODEL=gemini-2.0-flash-001

# One of:
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/sa-key.json
# or (e.g. on Vercel) paste JSON:
GCS_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### GCP setup checklist

1. Enable **Vertex AI API** on the GCP project.
2. Grant the service account **Vertex AI User** (`roles/aiplatform.user`).
3. Use **Application Default Credentials** or the JSON key path env var above.

### Provider selection

If both **AI Studio** (`GEMINI_API_KEY`) and **Vertex** are configured on the server, the reference docs state the default remains Gemini (AI Studio) unless **`LLM_PROVIDER=vertex`**.

### Implementation hint (Node)

Use the official **`@google-cloud/vertexai`** package (or call Vertex’s REST `generateContent` for your region). Do **not** point the server at `generativelanguage.googleapis.com` unless you intentionally use an API key from AI Studio; Vertex uses OAuth2/service accounts and regional endpoints.

---

## Optional UI branding

The reference app can show a “Gemini” wordmark when:

```bash
VITE_SHOW_GEMINI_BRAND=true
```

---

## Quick verification

1. **Local AI Studio path:** `npm run dev`, set `VITE_GEMINI_API_KEY`, trigger a feature that POSTs to `/__gemini-proxy/v1beta/models/...:generateContent`. Check Network tab: request goes to your origin, status 200, response contains `candidates`.
2. **Vertex path:** From a small server script or route, call Vertex with the service account; confirm IAM and model ID in `VERTEX_LOCATION`.

---

## Source files in the original repo (for diffing)

| Concern | File |
|--------|------|
| Vite proxy | `vite.config.ts` |
| Dev Gemini client + prompts | `src/services/geminiDevAssessment.ts` |
| Env typing | `src/vite-env.d.ts` |
| Env documentation | `.env.example` (server + Vite sections) |
| API orchestration / fallbacks | `src/services/api.ts` (imports from `geminiDevAssessment`) |

Copy the proxy + one small `fetch` helper into a new project first; port prompt builders only if you need the same product behavior.
