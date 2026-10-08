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

## Vercel (projet `so-thu-chi`, id prj_TSRKFKaYCHBfdy8pre7YwJRmgpGn)
- Relié à `ngpcao-spec/Compta` (framework Vite, `npm run build`), variables `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` en Production et Preview.
- URL de production : **https://so-thu-chi-vietgolf.vercel.app**
- Protection Vercel : limitée aux aperçus (la production doit être publique pour l'app et le retour OAuth).
- Branche de production : la seule branche du dépôt est `claude/ecstatic-johnson-9kiz30` ; créer `main` et la définir comme branche par défaut avant de fusionner.

## Points ouverts (actions humaines)
1. **Google OAuth** : créer le client (SETUP.md §2) avec
   - URI de redirection : `https://jtiepqlakyyraimjiikw.supabase.co/auth/v1/callback`
   - origines JavaScript : `http://localhost:5173` et `https://so-thu-chi-vietgolf.vercel.app`,
   puis activer Google dans Supabase (Authentication → Providers) avec l'ID client et le secret.
2. **Supabase → Authentication → URL Configuration** : Site URL = `https://so-thu-chi-vietgolf.vercel.app` ; Redirect URLs = `http://localhost:5173/**` et `https://so-thu-chi-vietgolf.vercel.app/**`.
3. **OAuth iOS standalone** : à vérifier sur un iPhone après déploiement et à consigner dans `DECISIONS.md`.
4. **Réseau de l'environnement cloud** : `*.supabase.co` et `*.vercel.app` sont refusés par le proxy, donc aucun test en direct depuis la session (les MCP fonctionnent).
