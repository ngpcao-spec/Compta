# Décisions

Format : date — contexte — choix — alternative écartée.

## 2026-10-08 — Maquettes absentes
Contexte : `docs/mockups/*.jpg` n'ont pas été fournies (seuls SPEC.md, CLAUDE.md, SETUP.md).
Choix : implémenter d'après SPEC.md (qui prime sur les maquettes en cas de conflit) ; les comparaisons visuelles de §« boucle de jalon » sont remplacées par des captures Playwright 390×844 revues pour cohérence avec SPEC §3 et §8. Les captures seront à comparer aux maquettes quand elles seront ajoutées.
Écartée : attendre les maquettes.

## 2026-10-08 — Docker indisponible dans l'environnement cloud
Contexte : le démon Docker ne tourne pas, donc pas de `supabase start`.
Choix : (1) les tests SQL (RLS, triggers, 35+5 catégories) tournent dans Vitest avec PGlite (Postgres WASM) et un schéma `auth` simulé ; (2) les e2e Playwright tournent avec `VITE_E2E=1`, qui remplace le transport Supabase par un backend en mémoire (`src/sync/fakeTransport.ts`) et affiche le bouton de connexion de test. Le bouton et le faux transport sont exclus du build de production (`import.meta.env.VITE_E2E` statiquement faux → code mort éliminé).
Écartée : e2e contre un Supabase distant (risque sur des données réelles, secrets en CI).

## 2026-10-08 — Types Supabase écrits à la main
Contexte : le projet Supabase n'est pas créé (coût, voir PROGRESS.md), donc pas de génération.
Choix : `src/types/supabase.ts` écrit au format généré, aligné sur la migration ; à régénérer par `npm run gen:types`.

## 2026-10-08 — Versions de dépendances
Contexte : l'installation résout des versions récentes (Vite 8, TypeScript 6, React Router 8, ESLint 10, lucide-react 1.x).
Choix : garder les dernières versions ; `baseUrl` retiré du tsconfig (déprécié en TS 6), `paths` en relatif.

## 2026-10-08 — Profil synchronisé comme 4ᵉ table
Contexte : SPEC §3.2 persiste le masquage dans le profil et §3.4 `default_budget` dans le profil, mais §7 ne liste pas `profiles`.
Choix : le moteur de synchro traite aussi `profiles` (une ligne, `update` seulement : la ligne est créée par le trigger d'inscription), ordre : profiles → categories → budgets → transactions.

## 2026-10-08 — Résolution du budget d'un mois
Contexte : SPEC §3.4 combine héritage du mois antérieur et `default_budget`.
Choix : ligne du mois > `default_budget` > ligne du mois antérieur le plus récent. Cocher « Áp dụng cho các tháng sau » écrit `default_budget` et supprime (logiquement) la ligne du mois courant pour qu'elle suive le défaut.
