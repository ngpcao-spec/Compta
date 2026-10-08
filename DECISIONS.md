# Décisions

Format : date — contexte — choix — alternative écartée.

## 2026-10-08 — Maquettes (canevas de design HTML)
Contexte : les maquettes ont été fournies après M10 sous forme d'un canevas de design (10 écrans HTML), pas de 5 JPG. Elles sont rendues dans `docs/mockups/` et comparées côte à côte à l'implémentation (`docs/comparisons/`).
Choix : l'interface a été alignée sur elles (en-tête bleu uni, saisie en deux temps avec feuille de montant, clavier à touches claires, tableaux et cartes). Écarts conservés, SPEC.md primant :
- **Hàng ngày** : la maquette affiche -298,387 (mois entier) ; la spec (§3.7) divise par les jours écoulés, d'où -4,625,000 pour le 2 janvier. Formule de la spec conservée.
- **Couleurs des 10 premières catégories** : la maquette utilise des teintes légèrement différentes (ex. Ăn uống #F9A825) de la table §4 (#FBC02D). Table de la spec conservée (migration déjà appliquée). La palette du sélecteur de couleur reprend celle de la maquette.
- **« Áp dụng cho các tháng sau »** : décochée par défaut (la maquette l'affiche cochée) pour ne pas modifier le budget par défaut par inadvertance.
- **Jetons de couleur** : la maquette (#1A6ED8, #6B7280, #1976D2) passe WCAG AA, pas les jetons de la spec (#2F8FED…). Valeurs de la maquette adoptées ; le gris secondaire est assombri à #646B78 pour rester ≥ 4,5:1 sur fond gris.
- Le texte du segment est `Chi tiêu (35)` (avec espace) comme la maquette.
Écartée : conserver l'interface « spec seule » (échecs d'accessibilité axe sur les jetons d'origine).

## 2026-10-08 — Docker indisponible dans l'environnement cloud
Contexte : le démon Docker ne tourne pas, donc pas de `supabase start`.
Choix : (1) les tests SQL (RLS, triggers, 35+5 catégories) tournent dans Vitest avec PGlite (Postgres WASM) et un schéma `auth` simulé ; (2) les e2e Playwright tournent avec `VITE_E2E=1`, qui remplace le transport Supabase par un backend en mémoire (`src/sync/fakeTransport.ts`) et affiche le bouton de connexion de test. Le bouton et le faux transport sont exclus du build de production (`import.meta.env.VITE_E2E` statiquement faux → code mort éliminé).
Écartée : e2e contre un Supabase distant (risque sur des données réelles, secrets en CI).

## 2026-10-08 — Projet Supabase `Compta` (réf. jtiepqlakyyraimjiikw)
Contexte : le projet n'a pas été créé par moi (coût, accord requis par CLAUDE.md) ; l'humain l'a créé sous le nom « Compta » (et non `so-thu-chi`), région ap-southeast-1, plan Pro.
Choix : réutilisé tel quel. Migration `0001_init` appliquée, Edge Function `delete-account` déployée (verify_jwt), types générés dans `src/types/supabase.ts`, advisors sécurité vides.
Vérifié en base : nouvel utilisateur = profil + 35 dépenses + 5 revenus ; un autre utilisateur ne voit aucune de ses lignes (bloc SQL annulé par exception, aucune donnée résiduelle).

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

## 2026-10-08 — Jeu de démonstration
`src/sync/demoData.ts` reprend exactement la maquette : janvier 2026 (38,000,000 / 9,250,000 / 28,750,000, budget 18,000,000) et le tableau « Xu hướng » de février à juillet (année : 228,000,000 / -101,250,000 / 126,750,000 ; moyenne mensuelle 32,571,429 / -14,464,286 / 18,107,143).

## 2026-10-08 — date-fns non utilisé
La spec liste date-fns, mais tout le formatage (`thg`, `ngày`) et l'arithmétique de mois sont faits sur des chaînes `YYYY-MM-DD` dans `src/lib/dates.ts` (testés) ; dépendance retirée.

## 2026-10-08 — Lighthouse
Mesuré sur `/login` (seule page accessible sans session) avec le build de production, profil mobile : performance 94, accessibilité 100, bonnes pratiques 100, SEO 100. Les écrans authentifiés sont couverts par axe (aucune violation serious/critical) et par la taille de bundle (route graphiques et catégories chargées à la demande).

## 2026-10-08 — OAuth iOS en mode standalone
Non vérifiable ici (pas d'iPhone ni de projet Supabase). `/login` détecte le mode standalone iOS et affiche la consigne prévue ; le comportement réel reste à constater sur appareil (voir PROGRESS.md).
