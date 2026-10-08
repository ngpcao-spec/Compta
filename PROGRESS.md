# Avancement

| Jalon | État | Notes                                                                                                                                                           |
| ----- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0    | ✅   | Scaffold, PWA, CI. Vercel : non fait (voir « Points ouverts »)                                                                                                  |
| M1    | ✅   | Migration + tests SQL (PGlite). Projet Supabase distant non créé (coût) : migrations non appliquées, edge function non déployée                                 |
| M2    | ✅   | Auth Google (code), garde de routes, layout + onglets. Connexion Google réelle non testée (pas de projet Supabase ni d'identifiants) ; connexion de test e2e OK |
| M3    | ✅   | Dexie, dépôts, moteur de synchro : 15 tests (push, pull, LWW, reprise, 401, verrou, lots, pagination)                                                           |
| M4    | ✅   | Catégories : e2e créer / renommer / réordonner / archiver / restaurer                                                                                           |
| M5    | ✅   | Clavier-calculatrice + saisie/édition/suppression : tests du parseur + e2e                                                                                      |
| M6    | ✅   | Accueil + budget : e2e totaux, reste, héritage, « tháng sau », dépassement, masquage                                                                            |
| M7    | ✅   | Graphiques : e2e 38,000,000 / -9,250,000 / 28,750,000 / -4,625,000                                                                                              |
| M8    | ✅   | Tendance : e2e jeu de 7 mois                                                                                                                                    |
| M9    | ✅   | Plus : masquage, CSV (BOM), suppression du compte (e2e), indicateur de synchro                                                                                  |
| M10   | ✅   | Interface alignée sur les maquettes (`docs/mockups/`, comparaisons dans `docs/comparisons/`), axe OK, Lighthouse 94/100/100/100 sur /login, e2e mode avion OK   |

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
- Branche de production : `main` (réglée dans Vercel → Settings → Environments → Production). Les envois sur `claude/ecstatic-johnson-9kiz30` ne créent que des aperçus protégés ; pour publier, fusionner dans `main`.

## Scan de facture par IA (SPEC §3.10) — branche `claude/ecstatic-johnson-9kiz30`, PR vers `main` (non fusionnée, en attente d'un OK)

- Code et tests (unitaires, fonction avec OpenAI simulé, SQL, e2e) : faits. Détails dans `DECISIONS.md`.
- Migration `0002_receipt_scans` et Edge Function `scan-receipt` : à déployer sur le projet Supabase `Compta` (statut mis à jour ci-dessous).
- Secrets : `OPENAI_MODEL`, puis `OPENAI_API_KEY` (la fonction répond `not_configured` tant que la clé manque).
- Aperçu Vercel de la branche à tester sur iPhone. Prérequis OAuth : ajouter `https://so-thu-chi-git-*-vietgolf.vercel.app/**` aux Redirect URLs de Supabase, sinon la connexion Google renvoie vers la production.

## Vérifié en production (https://so-thu-chi-vietgolf.vercel.app, projet Supabase `Compta`)

- Connexion Google (client OAuth dédié « Sổ Thu Chi ») : OK sur iPhone ; création automatique du profil + 35 dépenses + 5 revenus.
- Saisie en ligne : transaction reçue par le serveur en ~2 s.
- Mode avion : transaction créée hors ligne, envoyée automatiquement 22 s plus tard au retour du réseau, horodatage client conservé, aucun doublon.

## Points ouverts

1. **Installation iPhone (PWA)** : ajouter à l'écran d'accueil et vérifier que la session Google est conservée au lancement depuis l'icône ; consigner le résultat dans `DECISIONS.md` (point de vigilance SPEC §9).
2. **Branche par défaut GitHub** : `main` existe ; la définir comme branche par défaut (Settings → General → Default branch) si ce n'est pas déjà fait.
3. **Sauvegarde de la clé Google** : le secret du client OAuth n'est plus consultable dans Google Cloud ; il ne vit que dans Supabase.
4. **Réseau de l'environnement cloud** : `*.supabase.co` et `*.vercel.app` sont refusés par le proxy (les tests en direct se font depuis l'appareil de l'utilisateur).
