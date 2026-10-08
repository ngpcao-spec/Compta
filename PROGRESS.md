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
| M10 | ✅ (partiel) | Captures `docs/screenshots/`, axe OK, Lighthouse 96/100/100/100 sur /login, e2e mode avion OK. Comparaison aux maquettes : en attente des maquettes |

Contrôles : `npm run check` (71 tests) · `npm run e2e` (26 tests) · `npm run build`.

## Points ouverts (actions humaines)
1. **Supabase — accord de coût requis.** L'organisation « ngpcao@gmail.com's Org » est en plan **Pro** et compte déjà 3 projets (2 actifs). Créer `so-thu-chi` (ap-southeast-1) ajoute un projet facturable (compute Micro, environ 10 USD/mois, partiellement couvert par le crédit Pro). Aucune création tant que tu n'as pas dit oui. Alternative : réutiliser un projet existant (déconseillé : mélange de données).
2. **Google OAuth** : à fournir quand le projet existe (voir SETUP.md §2).
3. **Vercel** : aucun outil Vercel ni CLI dans cet environnement ; le projet doit être relié au dépôt GitHub depuis ton compte.
4. **Maquettes** : `docs/mockups/*.jpg` à ajouter.
5. **Déploiement** — commandes exactes une fois Supabase prêt :
   ```bash
   # 1. projet Supabase (après accord sur le coût) puis, avec la CLI et un token d'accès :
   supabase link --project-ref <ref> && supabase db push
   supabase functions deploy delete-account
   SUPABASE_PROJECT_REF=<ref> npm run gen:types
   # 2. auth : activer Google (client id/secret), site_url = URL Vercel, uri_allow_list = localhost:5173 + URL Vercel
   # 3. Vercel : importer le dépôt (framework Vite), variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (Production + Preview)
   ```
6. **OAuth iOS standalone** : à vérifier sur un iPhone après déploiement et à consigner dans `DECISIONS.md`.
