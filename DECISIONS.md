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

## 2026-10-08 — Index composé Dexie omis
Contexte : SPEC §6.6 demande `[deleted_at+occurred_on]`. IndexedDB ne peut pas indexer `null` : toute ligne active (deleted_at = null) serait absente de l'index.
Choix : index simple sur `occurred_on`, filtre `deleted_at` en mémoire (volumes personnels, quelques milliers de lignes).

## 2026-10-08 — Identifiant de budget déterministe
Contexte : `budgets` a `unique (user_id, month)`. Deux appareils créant le budget d'un même mois hors ligne avec des UUID aléatoires feraient échouer la synchro indéfiniment.
Choix : `id = uuid(SHA-256(user_id:mois))` (forme v4), calculé côté client ; un seul identifiant possible par mois.
Écartée : `onConflict: 'user_id,month'` (deux lignes locales pour un mois côté autre appareil).

## 2026-10-08 — Curseurs de pull par table
SPEC §6.6 prévoit un `lastPulledAt` unique ; un curseur par table (`cursor:<table>` dans `meta`) évite qu'une table lente fasse sauter des lignes d'une autre. `server_updated_at` utilise `clock_timestamp()` (pas `now()`) pour rester monotone entre transactions concurrentes.

## 2026-10-08 — Validation de ✓ du clavier
« ✓ évalue puis valide » : une expression en cours est évaluée puis enregistrée dans le même appui ; l'aperçu `= résultat` est affiché pendant la saisie. ✓ est désactivé tant que montant = 0 ou catégorie absente (saisie de transaction).

## 2026-10-08 — Contrastes (accessibilité, M10)
Contexte : `--text-muted #8A8F98` (3,2:1), `--income #2196F3` et `--primary #2F8FED` (≈3,4:1) échouent WCAG AA pour du texte courant (audit axe).
Choix : on garde les jetons de la spec pour les éléments graphiques (courbes, anneaux, fonds), et on ajoute `--text-muted-aa #636A73` (texte secondaire), `--income-text #1A73C9` (montants/liens bleus) et on utilise `--primary-dark` pour les boutons à libellé blanc. L'écart visuel avec les maquettes est léger.

## 2026-10-08 — Jeu de démonstration février–juillet
Les maquettes (tableau « Xu hướng ») n'ont pas été fournies : valeurs plausibles (voir `src/sync/demoData.ts`). Janvier 2026 respecte exactement la spec (38,000,000 / 9,250,000 / 28,750,000, budget 18,000,000).

## 2026-10-08 — date-fns non utilisé
La spec liste date-fns, mais tout le formatage (`thg`, `ngày`) et l'arithmétique de mois sont faits sur des chaînes `YYYY-MM-DD` dans `src/lib/dates.ts` (testés) ; dépendance retirée.

## 2026-10-08 — Lighthouse
Mesuré sur `/login` (seule page accessible sans session) avec le build de production, profil mobile : performance 96, accessibilité 100, bonnes pratiques 100, SEO 100. Les écrans authentifiés sont couverts par axe (aucune violation serious/critical) et par la taille de bundle (route graphiques et catégories chargées à la demande).

## 2026-10-08 — OAuth iOS en mode standalone
Non vérifiable ici (pas d'iPhone ni de projet Supabase). `/login` détecte le mode standalone iOS et affiche la consigne prévue ; le comportement réel reste à constater sur appareil (voir PROGRESS.md).
