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

## 2026-10-08 — Scan de facture : modèle, API et réglages

Contexte : nouvelle fonctionnalité (SPEC §3.10), exception autorisée à la règle « ne pas modifier SPEC.md ». `SPEC.md` n'était pas dans le dépôt (il n'avait été fourni qu'en pièce jointe) : la copie d'origine y a été ajoutée, avec la section §3.10 et l'entrée 12 du périmètre.

- **Modèle par défaut : `gpt-5.4-mini`**, modifiable par le secret `OPENAI_MODEL` (alternative moins chère : `gpt-5.4-nano`). Les modèles `gpt-5-mini`/`gpt-5-nano` sont signalés dépréciés dans la documentation. L'identifiant `gpt-5.4-nano` et son entrée image sont confirmés par la page officielle des modèles ; `gpt-5.4-mini` l'est par l'annonce de la gamme et les grilles de prix, mais **aucun appel réel n'a pu être fait depuis la session** (réseau bloqué, la documentation OpenAI n'a été consultée que via la recherche web) : à valider au premier scan (un identifiant erroné donne un 502 puis la saisie manuelle). Choix de « mini » plutôt que « nano » : meilleure lecture des tickets froissés ou peu contrastés, pour un surcoût de l'ordre de 0,003 USD par scan.
- **API Responses** (`POST /v1/responses`) avec `text.format = json_schema` strict, image en `input_image` (data URL, `detail: high`), `store: false`. Le schéma strict n'utilise ni minimum ni maximum (non garantis) : la confiance est bornée par la validation serveur.
- **Raisonnement** : `reasoning.effort = low` par défaut (secret optionnel `OPENAI_REASONING_EFFORT`) pour limiter les jetons de sortie ; si le modèle refuse ce paramètre (erreur 400), un unique nouvel essai est fait sans lui.
- **Limite : 30 scans par utilisateur sur 24 h glissantes** (et non par jour calendaire : pas de bascule à minuit à gérer). Le scan est **comptabilisé avant** l'appel à OpenAI : un échec OpenAI consomme une unité, mais le coût reste borné même en cas d'abus ou de panne.
- **Table `receipt_scans`** : `(user_id, created_at)` seulement, clé primaire composite (évite l'alerte « sans clé primaire »), RLS avec une politique de lecture de ses propres lignes (plutôt qu'aucune politique) ; écriture par la clé service.
- **Quota atteint** : message dédié en plus du message générique (extension du texte demandé, plus clair pour l'utilisateur).
- **Double validation** : la fonction valide (montant, catégorie → « Khác », date), puis le client revalide avec ses catégories locales (une catégorie archivée entre-temps retombe sur « Khác ») ; le code de validation est commun (`supabase/functions/scan-receipt/validate.ts`, importé par le client).
- **iOS et `capture`** : voir l'entrée « Scan : deux boutons » ci-dessous (l'attribut `capture` empêche de choisir une photo de la bibliothèque sur iPhone ; corrigé).
- **tsconfig** : `allowImportingTsExtensions` activé (les fonctions Deno importent avec l'extension `.ts`).
- **Coût estimé par scan** (hypothèses : photo 1600 px ≈ 2 000 jetons d'image, prompt et schéma ≈ 700, sortie ≈ 100 de JSON + raisonnement « low » ≈ 300 ; tarifs d'octobre 2026 relevés sur des grilles tierces : mini 0,75 / 4,50 USD par million de jetons en entrée / sortie, nano 0,20 / 1,25) :
  - `gpt-5.4-mini` ≈ 0,004 USD (≈ 100 VND) ; `gpt-5.4-nano` ≈ 0,001 USD (≈ 25 VND).
  - Plafond par utilisateur : 30 scans par 24 h ≈ 0,12 USD (mini).
  - Estimation à confirmer sur le tableau de bord d'usage OpenAI après les premiers scans réels.

## 2026-10-08 — Scan : deux boutons (appareil photo / bibliothèque) et décodage robuste

- **Deux champs fichier** : `Chụp ảnh` (`capture="environment"`) et `Thư viện ảnh` (sans `capture`), car sur iPhone `capture` ouvre directement la caméra et interdit la photothèque. Chaque bouton a un `aria-label` explicite ; le reste (fonction, enregistrement direct, toast `Sửa`) est inchangé.
- **HEIC** : avec `accept="image/*"`, iOS convertit normalement les HEIC en JPEG au moment du choix. Si un HEIC brut arrive quand même, `createImageBitmap` est essayé d'abord, puis un élément `<img>` + `decode()` (Safari sait lire le HEIC ainsi). Si tout échoue : message `Không đọc được ảnh này`, rien n'est envoyé ni enregistré. **Non vérifiable ici** (Chromium ne décode pas le HEIC) : le chemin d'erreur est testé en e2e avec un faux HEIC ; la lecture d'un vrai HEIC reste à constater sur l'iPhone.
- **Orientation EXIF** : le décodage demande `imageOrientation: 'from-image'` ; en plus, un petit lecteur d'EXIF JPEG (`readJpegInfo`) détecte le cas où le décodeur a ignoré une orientation 5–8 (dimensions décodées = dimensions stockées, image non carrée) et redresse à la main via une matrice de canvas. Les orientations 2–4 gardent les dimensions : on se fie au navigateur.
- **Grandes images** : le décodage se fait une fois, le canvas est directement à la taille finale (côté long 1600 px) ; au-delà de 60 Mo le fichier est refusé avant décodage (sécurité mémoire du téléphone), avec le même message.
- **Captures PNG** : fond blanc avant le JPEG (pas de transparence), ratio conservé (testé sur une image 800×3000).

## 2026-10-08 — Scan : TVA, catégorie selon les articles, note de repli

Constat sur une vraie facture (MM Mega Market, « Thành tiền 1.020.331đ — chưa bao gồm VAT », 8 articles alimentaires) : montant correct mais catégorie « Mua sắm » et note vide.

- **`vat_included: boolean | null`** ajouté au schéma strict (et à `ScanResult`). `true` = total TTC lu ; `false` = la facture dit explicitement « chưa bao gồm VAT » sans total TTC ; `null` = non mentionné. Valeur non booléenne renvoyée par l'IA → `null`. Le prompt interdit d'inventer ou de calculer une TVA : on ne corrige jamais le montant.
- **Côté client** : `vat_included === false` → note préfixée `(chưa VAT) ` (le tout reste ≤ 100 caractères, le préfixe est conservé) et toast « Đã thêm … — số tiền chưa gồm VAT, kiểm tra lại » avec `Sửa`. `true` et `null` se comportent comme avant (pas d'avertissement). Le préfixe n'est appliqué qu'à l'enregistrement direct ; en saisie manuelle (confiance < 0,5) l'utilisateur vérifie de toute façon le montant.
- **Catégorie** : le prompt demande de décider d'après les articles, en cumulant les montants par catégorie, l'alimentaire (y compris courses de supermarché/grossiste) allant en « Ăn uống » et « Mua sắm » étant réservé aux achats non alimentaires dominants ; capture tronquée → on décide sur les lignes visibles. C'est une consigne au modèle : elle n'est pas vérifiable sans appel réel (voir ci-dessous).
- **Note** : le champ `merchant` du schéma est conservé (compatibilité avec la fonction déployée et les tests) mais sert de libellé de note : commerçant visible, sinon numéro de facture, sinon type d'achat, sinon `null`.
- **Limite des tests** : aucun appel OpenAI n'est possible depuis la session. Les tests vérifient le contenu du prompt, le schéma, la validation serveur et la normalisation client sur une réponse simulée qui reproduit cette facture ; le choix réel de la catégorie par le modèle est à confirmer en rescannant la facture MM Mega Market.

## 2026-10-08 — Scan : notifications bancaires et e-wallet

Cas réel qui échouait : SMS « NamABank: TK 4010…0007 nop 3.500.000VND luc 21:36 07/10/2026. So du 3.617.661VND. ND: CAO MINH NHAN Chuyen tien » (message « Không đọc được hóa đơn »). Attendu : revenu de 3 500 000 le 07/10/2026.

- **Envoi des deux listes de catégories** : le corps de la requête garde le tableau `categories` mais chaque entrée porte maintenant `type` (`expense` | `income`) ; le message envoyé à OpenAI contient deux sections « Expense categories » et « Income categories ». Un client plus ancien (sans `type`) reste servi : tout est traité en dépense, ce qui permet de déployer la fonction avant le client.
- **Schéma de sortie** : `doc_kind` (`invoice` | `bank_notification` | `other`) et `tx_type` (`expense` | `income`), en énumérations strictes, ajoutés aux champs existants (le champ `merchant` reste le libellé de la note, `vat_included` ne concerne que les factures).
- **Garde-fous côté serveur, indépendants du modèle** (la validation est partagée avec le client) :
  - `doc_kind = other` (ni facture ni notification, plusieurs transactions…) ou valeur inconnue → réponse 422 `unreadable`, rien n'est enregistré, message d'échec habituel. Même si le modèle donne un montant et une confiance élevés.
  - Une facture est toujours une dépense, même si le modèle répond `income`. Pour une notification, un sens absent ou invalide n'est pas deviné → rien n'est enregistré.
  - La catégorie doit appartenir à la liste du type détecté, sinon catégorie de secours de ce type : `Khác` (dépense) ou `Thu nhập khác` (revenu).
  - **Numéros de compte** : le prompt les interdit dans la note, et un nettoyage défensif (`stripAccountNumbers`) retire des notes de notification toute suite de 4 chiffres ou plus, les masques type `****0007` / `4010…0007` et les libellés « TK / STK / thẻ / card » qui les précèdent. Il n'est pas appliqué aux factures (le numéro de facture est une note légitime). Conséquence assumée : un nombre de 4 chiffres ou plus dans le contenu du virement (ex. une année) est aussi retiré.
- **Client** : le type détecté prime sur l'onglet ouvert (la transaction prend de toute façon son type de sa catégorie) ; en saisie manuelle (confiance < 0,5) l'onglet bascule sur le type détecté, sinon il reste inchangé. Toast d'un revenu : « Đã thêm thu nhập … vào … » (+ « Sửa »). Message d'échec : « Không đọc được hóa đơn hoặc giao dịch, vui lòng kiểm tra ».
- **Boutons dans l'onglet Thu nhập** : ils étaient déjà affichés dans les deux onglets (même écran) ; ils sont désormais aussi couverts par un test e2e et alimentés avec les catégories des deux types.
- **Heure du message** : lue par l'IA mais non conservée (une transaction n'a qu'une date, SPEC §3).
- **Limite des tests** : aucun appel OpenAI possible depuis la session ; les tests simulent la réponse que le modèle devrait donner pour chaque cas (SMS NamABank, SMS de débit, capture MoMo, plusieurs transactions) et vérifient le prompt, le schéma et les garde-fous. La lecture réelle du SMS NamABank est à confirmer en le rescannant.

