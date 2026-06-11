# SAT Tutor

A mastery-based SAT practice app with LaTeX math rendering, AI-powered explanations, and progress tracking. Converted from Python tkinter to a full-stack web app.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/sat-tutor run dev` — run the frontend (port 19208)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `GROQ_API_KEY` — Groq API key for AI explanations (get free at https://console.groq.com)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, TailwindCSS, KaTeX (LaTeX rendering), TanStack Query
- API: Express 5
- DB: File-based JSON (progress/stats stored in `artifacts/api-server/data/`)
- AI: Groq (llama-3.3-70b-versatile) for explanations
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `artifacts/sat-tutor/src/` — React frontend
  - `pages/Home.tsx` — dashboard, session config, stats overview
  - `pages/Session.tsx` — active practice session with LaTeX + AI explanations
  - `pages/Review.tsx` — history review with LaTeX rendering
  - `pages/Stats.tsx` — topic analytics with accuracy breakdown
  - `components/MathText.tsx` — KaTeX LaTeX renderer component
- `artifacts/api-server/src/routes/` — Express route handlers
  - `questions.ts` — question fetching with mastery-based filtering
  - `explain.ts` — Groq AI explanation endpoint
  - `progress.ts` — progress log CRUD (JSON files)
  - `stats.ts` — topic stats aggregation
- `artifacts/api-server/data/` — runtime data files
  - `sat_database.json` — question database (place your own here to replace the samples)
  - `sat_math_progress.json` — math progress log (auto-created)
  - `sat_english_progress.json` — English progress log (auto-created)

## Architecture decisions

- **File-based persistence**: Progress/stats stored as JSON files in `data/` — no DB needed, easy to inspect and reset.
- **Mastery filtering on the server**: Mastered IDs sent as a query param; server excludes them and falls back if pool is too small.
- **KaTeX on the frontend**: LaTeX rendered client-side via `katex.renderToString`. Math detection via `$...$`, `$$...$$`, `\(...\)`, `\[...\]` patterns.
- **AI explanations via Groq**: Server calls Groq API so the key stays server-side. Falls back gracefully if key is missing.
- **localStorage for session state**: Config (subject, difficulty, count, target date) and mastered IDs stored in localStorage.

## Product

- Subject selector: English R&W or Math
- Mastery-based question selection (avoids repeating correctly answered questions)
- Full LaTeX rendering in math questions, options, passages, and AI explanations
- AI-powered explanations after each answer (Groq llama-3.3-70b)
- Session history review with question details
- Topic accuracy analytics with weak/strong area identification
- Countdown to exam date

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Place your own `sat_database.json` in `artifacts/api-server/data/` to replace the sample questions. Format: array of `{ id, subject, topic, difficulty, passage?, question, options: string[], correct, explanation? }`.
- `GROQ_API_KEY` must be set in the Secrets tab for AI explanations to work. Without it, the app still functions but shows a fallback message instead of AI explanations.
- When subject is "math", wrap ALL text in `<MathText>` — plain English text should NOT use MathText.
- CSS import order matters: Google Fonts `@import url(...)` must be line 1, before all other imports.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
