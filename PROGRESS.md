# Avancement

| Jalon | État | Notes |
|---|---|---|
| M0 | ✅ | Scaffold, PWA, CI. Vercel : non fait (voir « Points ouverts ») |
| M1 | ✅ | Migration + tests SQL (PGlite). Projet Supabase distant non créé (coût) : migrations non appliquées, edge function non déployée |
| M2 | ✅ | Auth Google (code), garde de routes, layout + onglets. Connexion Google réelle non testée (pas de projet Supabase ni d'identifiants) ; connexion de test e2e OK |
| M3 | ✅ | Dexie, dépôts, moteur de synchro : 15 tests (push, pull, LWW, reprise, 401, verrou, lots, pagination) |
| M4 | ✅ | Catégories : e2e créer / renommer / réordonner / archiver / restaurer |
| M5 | ✅ | Clavier-calculatrice + saisie/édition/suppression : tests du parseur + e2e |
| M6 | ✅ | Accueil + budget : e2e totaux, reste, héritage, « tháng sau », dépassement, masquage |
| M7 | ✅ | Graphiques : e2e 38,000,000 / -9,250,000 / 28,750,000 / -4,625,000 |
| M8 | ✅ | Tendance : e2e jeu de 7 mois |
| M9 | ✅ | Plus : masquage, CSV (BOM), suppression du compte (e2e), indicateur de synchro |
| M10 | ✅ | Interface alignée sur les maquettes (`docs/mockups/`, comparaisons dans `docs/comparisons/`), axe OK, Lighthouse 94/100/100/100 sur /login, e2e mode avion OK |

Contrôles : `npm run check` (74 tests) · `npm run e2e` (26 tests) · `npm run build`.

## Infrastructure Supabase (projet `Compta`, réf. `jtiepqlakyyraimjiikw`)
- URL : https://jtiepqlakyyraimjiikw.supabase.co · région ap-southeast-1
- Migration `init` appliquée ; advisors sécurité : aucun ; performance : infos seulement (index pas encore utilisés, stratégie de connexions Auth).
- Edge Function `delete-account` déployée (JWT requis).
- `.env.local` écrit (clé publishable, ignoré par git) ; `.env.example` à jour.

## Points ouverts (actions humaines)
1. **Google OAuth** : créer le client (SETUP.md §2) avec
   - URI de redirection : `https://jtiepqlakyyraimjiikw.supabase.co/auth/v1/callback`
   - origines JavaScript : `http://localhost:5173` et l'URL de production,
   puis activer Google dans Supabase (Authentication → Providers) avec l'ID client et le secret.
2. **Auth → URL Configuration** : Site URL = URL de production ; Redirect URLs = `http://localhost:5173/**` + URL de production.
3. **Vercel** : importer le dépôt (framework Vite), variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Production + Preview) — valeurs dans `.env.local`. Aucun outil Vercel dans l'environnement.
4. **OAuth iOS standalone** : à vérifier sur un iPhone après déploiement et à consigner dans `DECISIONS.md`.
6. **Réseau de l'environnement cloud** : `*.supabase.co` est refusé par le proxy, donc aucun test en direct depuis la session (le MCP fonctionne). Pour en faire : Network access → autoriser `*.supabase.co`.
