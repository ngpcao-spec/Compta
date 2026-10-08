# Sổ Thu Chi

PWA mobile de suivi des dépenses et revenus (VND, vietnamien), connexion Google, données dans Supabase et utilisables hors ligne. Spécification : `SPEC.md`. Suivi : `PROGRESS.md`. Décisions : `DECISIONS.md`.

## Démarrer

```bash
npm ci
cp .env.example .env.local   # renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev                  # http://localhost:5173
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run check` | `tsc --noEmit` + ESLint + Vitest (unitaires, moteur de synchro, tests SQL PGlite) |
| `npm run e2e` | Playwright (390×844) sur un build `VITE_E2E=1` : connexion de test + faux serveur en mémoire |
| `npm run build` | build de production + garde « aucun code e2e dans le bundle » |
| `npm run seed:demo` | jeu de démonstration sur le compte de test Supabase |
| `npm run gen:types` | régénère `src/types/supabase.ts` (`SUPABASE_PROJECT_REF` requis) |

## Architecture

- UI ⇄ **Dexie** (IndexedDB) via `src/db/repo/*` ; seul `src/sync/` parle aux tables Supabase (`engine.ts` : push → pull, dernier écrit gagne).
- Calculs purs et testés : `src/lib/stats.ts`, `expr.ts` (parseur sans `eval`), `csv.ts`, `dates.ts`.
- Textes : `src/i18n/vi.ts` ; montants : `formatVnd` (`src/lib/money.ts`).
- Schéma : `supabase/migrations/` ; Edge Function : `supabase/functions/delete-account`.
