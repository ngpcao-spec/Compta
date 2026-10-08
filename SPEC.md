# Sổ Thu Chi — Spécification fonctionnelle et technique

PWA mobile de suivi des dépenses et revenus personnels, en vietnamien, monnaie VND, multi-comptes avec connexion Google, données synchronisées via Supabase et utilisables hors ligne.

Les maquettes de référence sont dans `docs/mockups/` (5 captures : catégories, budget, tendance, saisie/accueil, graphiques). En cas de doute visuel, la maquette fait foi ; en cas de conflit entre la maquette et ce document, ce document fait foi.

---

## 1. Périmètre

### Inclus (v1)
1. Connexion Google (Supabase Auth), un espace de données par utilisateur.
2. Accueil mensuel : solde, dépenses, revenus, budget du mois, transactions groupées par jour.
3. Saisie / modification / suppression d'une transaction avec clavier-calculatrice.
4. Budget mensuel avec barre de progression et reste.
5. Gestion des catégories (dépense / revenu) : ajout, édition, réordonnancement, archivage.
6. Graphiques du mois : 4 tuiles + donut par catégorie + classement.
7. Tendance annuelle : courbe mensuelle + tableau année / moyenne / mois.
8. Masquage des montants (icône œil).
9. Fonctionnement hors ligne complet après première connexion, synchronisation automatique.
10. Installation PWA (Android + iOS), mise à jour avec bandeau.
11. Écran « Thêm » (Plus) : catégories, export CSV, déconnexion, suppression du compte.
12. Scan d'une facture par IA qui crée une dépense (§3.10).

### Exclus (v1)
- Premium / abonnement (l'icône couronne des maquettes n'est **pas** affichée).
- Multi-devises, comptes bancaires multiples, transactions récurrentes, pièces jointes, partage de budget, notifications push.

---

## 2. Conventions d'affichage

| Élément | Règle |
|---|---|
| Montants | Entiers VND, séparateur de milliers **virgule** comme les maquettes : `28,750,000`. Une seule fonction `formatVnd(n)` dans `src/lib/money.ts`. Pas de symbole ₫. |
| Signe | Dépense : préfixe `-`, couleur texte principale. Revenu : sans signe, couleur bleue `--income`. Solde : bleu si ≥ 0, rouge si < 0. |
| Moyennes | Arrondies à l'entier (la maquette affiche des décimales ; on ne les reproduit pas). |
| Mois | `thg 1 2026` |
| En-tête de jour | `ngày 2 thg 1, 2026` |
| Montants masqués | `******` à la place de chaque montant, partout dans l'app. |
| Langue | Tous les textes UI en vietnamien, centralisés dans `src/i18n/vi.ts` (un seul objet de chaînes, pas de lib i18n). |

---

## 3. Écrans et comportements

### Navigation
Barre d'onglets inférieure fixe (respecte `safe-area-inset-bottom`) :
`Sổ thu chi` (accueil) · `Biểu đồ` · **bouton central `+`** · `Thêm`.
Routes : `/`, `/charts`, `/trend`, `/tx/new`, `/tx/:id`, `/more`, `/more/categories`, `/more/categories/:id`, `/login`.

### 3.1 Connexion `/login`
- Logo + nom de l'app + bouton « Đăng nhập bằng Google ».
- `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin } })`.
- Toute route hors `/login` redirige vers `/login` si aucune session locale.
- Hors ligne avec session en cache : l'app s'ouvre normalement (pas de redirection).

### 3.2 Accueil `/` (maquette « Ghi Thu Chi »)
**En-tête bleu (dégradé primaire)** :
- Pastille mois `thg 1 2026` + boutons `<` `>` ; tap sur la pastille ouvre un sélecteur mois/année.
- `Số dư` + icône œil (bascule le masquage global, persisté dans le profil).
- Solde du mois en très grand, puis `Chi tiêu` et `Thu nhập` du mois.
- Menu `…` : raccourcis vers Danh mục et Xuất CSV.

**Carte budget** (chevauche l'en-tête) :
- `Ngân sách: 18,000,000` + chevron ; barre de progression = dépenses / budget (plafonnée à 100 %, rouge si dépassée) ; `Còn lại: 8,750,000` (négatif en rouge si dépassé).
- Tap → feuille « Chỉnh sửa ngân sách » (§3.4).
- Sans budget défini : carte « Đặt ngân sách » avec bouton.

**Liste des transactions du mois**, groupées par jour, jour le plus récent en haut :
- En-tête de groupe : date à gauche, `Chi tiêu: -4,800,000` et `Thu nhập: 38,000,000` à droite (n'afficher que les totaux non nuls).
- Ligne : pastille ronde colorée avec icône de catégorie, nom de catégorie, note en sous-titre gris si présente, montant à droite.
- Dans un jour : ordre de création décroissant.
- Tap → `/tx/:id`. Swipe gauche → bouton supprimer (avec confirmation).
- État vide : illustration simple + « Chưa có giao dịch » + bouton ajouter.

**Calcul** : solde du mois = revenus du mois − dépenses du mois (pas de report des mois précédents).

### 3.3 Saisie / édition `/tx/new`, `/tx/:id` (maquette « Ghi Thu Chi »)
- Segment `Chi tiêu` / `Thu nhập` en haut (défaut : Chi tiêu).
- Grille de catégories actives du type choisi (4 colonnes, ordre `sort_order`), dernière case « Chỉnh sửa » → gestion des catégories.
- Sélectionner une catégorie fait monter le panneau de saisie :
  - Affichage du montant / de l'expression en cours.
  - Champ note (`Ghi chú`, 100 caractères max).
  - Sélecteur de date (défaut : aujourd'hui ; si on est sur un autre mois à l'accueil, défaut = aujourd'hui quand même).
  - **Clavier-calculatrice** (§3.5).
- Validation : montant > 0 et catégorie choisie ; sinon bouton désactivé.
- En édition : mêmes champs pré-remplis + bouton supprimer.
- Après enregistrement : retour à l'écran précédent, toast court.

### 3.4 Budget (maquette « Đạt Ngân Sách »)
- Feuille modale bas d'écran : titre `Chỉnh sửa ngân sách`, sous-titre du mois, montant en grand bleu, clavier-calculatrice.
- Un budget par mois. Si un mois n'a pas de budget, il **hérite** du budget du mois le plus récent qui en a un (affiché tel quel, mais pas recopié en base tant que l'utilisateur ne le modifie pas).
- Case « Áp dụng cho các tháng sau » : si cochée, met à jour le budget hérité par défaut (champ `default_budget` du profil) au lieu de créer une exception pour ce mois.
- Montant 0 = supprimer le budget du mois.

### 3.5 Clavier-calculatrice (composant partagé `<AmountKeypad>`)
- Grille 4×4 : `7 8 9 +×` / `4 5 6 −÷` / `1 2 3 ⌫` / `000 0 = ✓`. La touche `+×` alterne entre + et × à chaque appui long ; plus simple : `+×` insère `+` au tap et `×` à l'appui long, idem `−÷`.
- Évaluation par un parseur maison (`src/lib/expr.ts`, pas d'`eval`), priorités usuelles, résultat arrondi à l'entier, négatif interdit.
- `✓` évalue puis valide ; si expression en cours, `✓` évalue d'abord.
- Maximum 13 chiffres. Vibration courte (`navigator.vibrate(10)`) si supporté.

### 3.6 Catégories `/more/categories` (maquette « Tùy Chỉnh Danh Mục »)
- Barre : `< Thêm` · `Danh mục` · bouton tri ↑↓ · bouton `+`.
- Segment `Chi tiêu(35)` / `Thu nhập(5)` (compte = catégories actives).
- Liste de cartes : pastille couleur + icône, nom, menu `…` (Sửa, Ẩn/Lưu trữ).
- Bouton ↑↓ : bascule en mode réorganisation (poignées glisser-déposer, `@dnd-kit/sortable`), bouton « Xong » pour quitter.
- `+` ou Sửa → `/more/categories/:id` : nom (30 car. max), sélecteur d'icône (grille ~60 icônes lucide), sélecteur de couleur (palette de 16), type (non modifiable en édition).
- Archiver : la catégorie disparaît des listes de saisie mais reste dans l'historique et les graphiques. Section repliable « Đã ẩn » en bas pour la restaurer. Pas de suppression définitive.

### 3.7 Graphiques du mois `/charts` (maquette « Biểu Đồ Trực Quan »)
- Titre `Biểu đồ`, menu `…` → lien vers Tendance (`/trend`).
- Sélecteur de mois en liste déroulante.
- 4 tuiles 2×2 : `Thu nhập`, `Chi tiêu`, `Số dư`, `Hàng ngày`.
  - **Hàng ngày** = dépenses du mois ÷ nombre de jours écoulés dans le mois (mois en cours : jour courant ; mois passé : nombre de jours du mois ; mois futur : 0).
- Carte `Danh mục` : segment `Thu nhập` / `Chi tiêu` (défaut Chi tiêu), donut avec total au centre (`Tổng`), étiquettes externes `xx.x%` + nom pour les parts ≥ 5 %, nom seul en dessous.
- Sous le donut : classement des catégories (pastille, nom, barre fine proportionnelle, %, montant). Tap → liste filtrée des transactions de cette catégorie pour ce mois.

### 3.8 Tendance `/trend` (maquette « Xu Hướng Chi Tiêu »)
- Sélecteur d'année.
- Carte `Xu hướng` : segment `Thu nhập` / `Chi tiêu`, courbe mensuelle (points + ligne, rouge pour dépense, bleu pour revenu), axe X = mois de l'année jusqu'au mois courant.
- Tableau colonnes `Ngày | Thu nhập | Chi tiêu | Số dư` :
  - Ligne année (`2026`) : totaux.
  - Ligne `Hàng tháng` : moyenne = total ÷ nombre de mois écoulés de l'année (année passée : 12).
  - Une ligne par mois, du plus récent au plus ancien, chevron → ouvre `/charts` sur ce mois.

### 3.9 Plus `/more`
- Carte profil (avatar et nom Google, email).
- Danh mục · Xuất CSV (toutes les transactions : date, type, catégorie, montant, note ; UTF-8 avec BOM pour Excel) · Ẩn số tiền (bascule) · Đăng xuất · Xóa tài khoản (confirmation en tapant « XÓA », supprime toutes les données via une Edge Function) · version de l'app.
- Indicateur de synchronisation : « Đã đồng bộ lúc 08:20 » / « Đang chờ đồng bộ (3) » / « Ngoại tuyến ».

### 3.10 Scan de facture (IA)

Dans l'écran de saisie (`/tx/new`), deux boutons côte à côte, de même largeur (contour bleu), apparaissent en haut de la liste des catégories (absents en édition d'une transaction existante) : `Chụp ảnh` (icône appareil photo) ouvre directement l'appareil photo via `<input type="file" accept="image/*" capture="environment">` ; `Thư viện ảnh` (icône image) ouvre la photothèque via `<input type="file" accept="image/*">` **sans** `capture`. Les photos de la bibliothèque (HEIC, captures PNG, 12 Mpx et plus, orientation EXIF) passent par la même compression ; une image illisible affiche `Không đọc được ảnh này` sans rien enregistrer.

**Comportement**

- L'IA lit la facture et crée **une seule dépense** : montant total à payer, catégorie dominante, date de la facture.
- **Enregistrement direct, sans écran de vérification** : la transaction passe par le repository habituel (Dexie, `_dirty = 1`, synchro normale). Un toast `Đã thêm 250,000 vào Ăn uống` propose un bouton `Sửa` qui ouvre `/tx/:id`.
- Date absente, future ou de plus d'un an → aujourd'hui. Le nom du marchand va en note (100 caractères max).
- Pendant l'analyse : voile `Đang đọc hóa đơn…`, annulable (`Hủy`).
- Hors ligne : bouton désactivé, message `Cần kết nối mạng để quét hóa đơn`.
- Échec de la fonction, montant illisible ou confiance < 0,5 : **rien n'est enregistré** ; la saisie manuelle s'ouvre pré-remplie avec ce qui a été lu, avec le message `Không đọc được hóa đơn, vui lòng kiểm tra`. Quota atteint : message dédié (`Đã hết 30 lượt quét hôm nay…`), même saisie manuelle.

**Confidentialité** : la photo n'est jamais conservée (ni Storage, ni base, ni journaux, `store: false` côté OpenAI) ; elle est compressée sur l'appareil (côté le plus long 1600 px, JPEG qualité 0,8), analysée, puis oubliée.

**Architecture**

- La clé OpenAI reste **uniquement côté serveur** : Edge Function Supabase `scan-receipt` (secrets `OPENAI_API_KEY`, `OPENAI_MODEL`, optionnel `OPENAI_REASONING_EFFORT`).
- Entrée : JWT de l'utilisateur, image en base64 (5 Mo décodés max), liste des catégories de dépense actives (`id`, `nom`).
- Appel de l'API OpenAI Responses avec Structured Outputs (schéma strict) : `{ amount: integer VND, date: "YYYY-MM-DD" | null, category_id: string, merchant: string | null, confidence: 0..1 }`.
- Validation serveur : montant > 0 ; `category_id` dans la liste, sinon la catégorie `Khác` ; date ni future ni vieille de plus d'un an (sinon `null`).
- Quota : 30 scans par utilisateur sur 24 h glissantes, table `receipt_scans (user_id, created_at)` protégée par RLS (lecture de ses propres lignes, écriture par la clé service uniquement).
- Codes de réponse : 401 non authentifié, 400 requête invalide, 413 image trop lourde, 422 facture illisible, 429 quota, 502 erreur OpenAI ou réponse invalide, 500 non configuré.

---

## 4. Catégories par défaut

Créées côté serveur à l'inscription (trigger, §6.3). Les 10 premières reprennent les maquettes. Icônes = noms `lucide-react`.

**Chi tiêu (35)**
| # | Nom | Icône | Couleur |
|---|---|---|---|
|1|Ăn uống|utensils|#FBC02D|
|2|Quần áo|shirt|#26C6DA|
|3|Thú cưng|cat|#7986CB|
|4|Mua sắm|shopping-cart|#2196F3|
|5|Cà phê|coffee|#FF8A65|
|6|Du lịch|plane|#7E57C2|
|7|Thể thao|dumbbell|#C0CA33|
|8|Trái cây|apple|#66BB6A|
|9|Quà tặng|gift|#EC407A|
|10|Game|gamepad-2|#FF7043|
|11|Đi lại|bus|#42A5F5|
|12|Xăng xe|fuel|#8D6E63|
|13|Tiền nhà|home|#5C6BC0|
|14|Điện|zap|#FFCA28|
|15|Nước|droplet|#29B6F6|
|16|Internet|wifi|#26A69A|
|17|Điện thoại|smartphone|#78909C|
|18|Y tế|stethoscope|#EF5350|
|19|Thuốc|pill|#E57373|
|20|Giáo dục|graduation-cap|#3F51B5|
|21|Sách|book-open|#8D6E63|
|22|Làm đẹp|sparkles|#F06292|
|23|Giải trí|party-popper|#AB47BC|
|24|Phim ảnh|clapperboard|#5E35B1|
|25|Con cái|baby|#FFB74D|
|26|Gia đình|users|#4DB6AC|
|27|Bảo hiểm|shield|#546E7A|
|28|Sửa chữa|wrench|#90A4AE|
|29|Đồ gia dụng|sofa|#A1887F|
|30|Rau củ|carrot|#9CCC65|
|31|Đồ uống|cup-soda|#4FC3F7|
|32|Hiếu hỉ|heart|#E91E63|
|33|Từ thiện|hand-heart|#BA68C8|
|34|Thuế|receipt|#757575|
|35|Khác|ellipsis|#9E9E9E|

**Thu nhập (5)**
| # | Nom | Icône | Couleur |
|---|---|---|---|
|1|Lương|circle-dollar-sign|#AB47BC|
|2|Thưởng|award|#FFA726|
|3|Đầu tư|trending-up|#26A69A|
|4|Làm thêm|briefcase|#42A5F5|
|5|Thu nhập khác|plus-circle|#9E9E9E|

---

## 5. Stack technique

| Couche | Choix |
|---|---|
| Build | Vite + React 19 + TypeScript strict |
| Style | Tailwind CSS v4, tokens CSS (§8) |
| Routing | React Router (mode data) |
| PWA | `vite-plugin-pwa` (Workbox, `registerType: 'prompt'`) |
| Backend | Supabase : Auth (Google), Postgres, RLS, 1 Edge Function |
| Local | Dexie (IndexedDB) = source de vérité de l'UI ; `dexie-react-hooks` (`useLiveQuery`) |
| Graphiques | Recharts (donut + courbe) |
| Dates | date-fns (formatage vietnamien maison pour `thg`/`ngày`) |
| Drag & drop | @dnd-kit/sortable |
| Icônes | lucide-react (import dynamique par nom via une table de correspondance limitée aux icônes autorisées) |
| Tests | Vitest (unitaires), Playwright (e2e, viewport 390×844) |
| Qualité | ESLint + Prettier, `tsc --noEmit` |
| Hébergement | Vercel (SPA, rewrites vers `index.html`) |
| Police | Be Vietnam Pro (Google Fonts, poids 400/500/600/700), mise en cache par Workbox |

Pas de state manager global : Dexie + `useLiveQuery` pour les données, un petit store React context pour la session et les préférences.

---

## 6. Données

### 6.1 Règles générales
- Identifiants UUID v4 générés **côté client** (`crypto.randomUUID()`) pour permettre la création hors ligne.
- Montants : `bigint` > 0 en VND ; le signe est déduit du `type`.
- Suppression logique : `deleted_at`. Jamais de `DELETE` depuis le client.
- Chaque table synchronisée a `updated_at` (horodatage client, sert au dernier-écrit-gagne) et `server_updated_at` (posé par trigger, sert de curseur de synchronisation).

### 6.2 Schéma Postgres (`supabase/migrations/0001_init.sql`)

```sql
create type tx_type as enum ('expense', 'income');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  hide_amounts boolean not null default false,
  default_budget bigint check (default_budget is null or default_budget > 0),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create table categories (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  type tx_type not null,
  name text not null check (char_length(name) between 1 and 30),
  icon text not null,
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid not null references categories on delete restrict,
  type tx_type not null,
  amount bigint not null check (amount > 0 and amount < 10000000000000),
  note text check (note is null or char_length(note) <= 100),
  occurred_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now()
);

create table budgets (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount bigint not null check (amount > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  server_updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index on transactions (user_id, occurred_on);
create index on transactions (user_id, server_updated_at);
create index on categories (user_id, server_updated_at);
create index on budgets (user_id, server_updated_at);
```

- Trigger `before insert or update` sur les 4 tables : `server_updated_at = now()`.
- Trigger LWW `before update` sur categories, transactions, budgets : si `new.updated_at < old.updated_at`, conserver l'ancienne ligne (`return old`).
- Contrainte applicative (trigger) : `transactions.type` doit égaler le `type` de sa catégorie, et la catégorie doit appartenir au même `user_id`.

### 6.3 Inscription
Fonction `handle_new_user()` `security definer`, trigger `after insert on auth.users` :
1. Crée `profiles` (nom et avatar depuis `raw_user_meta_data`).
2. Insère les 40 catégories du §4 avec `sort_order` 0..n.

### 6.4 RLS
Activée sur toutes les tables. Une politique par table et par opération (`select`, `insert`, `update`) : `user_id = auth.uid()` (`id = auth.uid()` pour `profiles`). Aucune politique `delete`.

### 6.5 Edge Function `delete-account`
Vérifie le JWT, supprime l'utilisateur via la clé service (`auth.admin.deleteUser`), la cascade efface tout.

### 6.6 Base locale Dexie (`src/db/local.ts`)
Mêmes tables et champs + `_dirty: 0 | 1`. Table `meta` (clé/valeur) : `lastPulledAt`, `userId`.
Index : `transactions: id, occurred_on, category_id, _dirty, [deleted_at+occurred_on]` ; `categories: id, type, sort_order, _dirty` ; `budgets: id, month, _dirty`.
À la déconnexion ou changement d'utilisateur : vider toute la base locale.

---

## 7. Synchronisation (`src/sync/engine.ts`)

1. **Écriture locale** : toute mutation passe par un repository (`src/db/repo/*.ts`) qui écrit dans Dexie avec `updated_at = new Date().toISOString()` et `_dirty = 1`. L'UI ne parle jamais directement à Supabase pour les données.
2. **Push** : lit les lignes `_dirty = 1` par table (ordre : categories → budgets → transactions, pour respecter la clé étrangère), `upsert` par lots de 200, puis remet `_dirty = 0` uniquement si `updated_at` local n'a pas changé entre-temps.
3. **Pull** : pour chaque table, `select * where server_updated_at > lastPulledAt order by server_updated_at limit 1000` (boucle tant que plein). Pour chaque ligne reçue : si la ligne locale est `_dirty` et plus récente, on la garde ; sinon on écrase. Mettre à jour `lastPulledAt` avec le max reçu.
4. **Déclencheurs** : démarrage, événement `online`, retour au premier plan (`visibilitychange`), 2 s après la dernière écriture (debounce), toutes les 60 s quand l'app est visible.
5. **Verrou** : une seule synchro à la fois (promesse partagée).
6. **Erreurs** : réseau → retenter au prochain déclencheur ; 401 → tenter `refreshSession`, sinon garder les données locales et afficher un bandeau « Phiên đăng nhập hết hạn — Đăng nhập lại » (ne rien effacer tant que des lignes sont `_dirty`).
7. **Premier lancement** : après la connexion, pull complet avec écran de chargement, puis accès à l'app.
8. État exposé (`idle | syncing | offline | error`, nombre de lignes en attente, dernière synchro) pour l'écran Plus.

---

## 8. Design

Tokens dans `src/styles/tokens.css` :

```
--primary: #2F8FED;           /* en-tête, boutons, accents */
--primary-dark: #1E78D6;      /* dégradé en-tête */
--income: #2196F3;
--expense: #1F2329;           /* montants de dépense */
--danger: #E53935;
--bg: #F2F3F7;                /* fond d'app */
--card: #FFFFFF;
--text: #1F2329;
--text-muted: #8A8F98;
--divider: #ECEDF1;
--radius-card: 16px;
--radius-pill: 999px;
```

- Cartes blanches, rayon 16 px, ombre très légère, espacement 12 px entre cartes, marges latérales 16 px.
- Pastille catégorie : cercle 40 px, icône blanche 20 px.
- Montant principal accueil : 40 px gras ; secondaires : 24 px gras.
- Segments (Chi tiêu/Thu nhập) : fond gris clair, onglet actif blanc avec ombre, comme les maquettes.
- Thème clair uniquement en v1, `theme-color` = `--primary`.
- Cibles tactiles ≥ 44 px. Animations sobres (150–200 ms), feuilles modales avec glisser-pour-fermer.

---

## 9. PWA

- Manifest : `name: "Sổ Thu Chi"`, `short_name: "Thu Chi"`, `display: standalone`, `orientation: portrait`, `lang: vi`, `start_url: /`, icônes 192/512 + maskable (générées par `@vite-pwa/assets-generator` à partir de `public/logo.svg`, logo simple : carnet blanc sur fond `--primary`).
- iOS : `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: default`, `viewport-fit=cover`.
- Precache de l'app shell ; runtime cache `StaleWhileRevalidate` pour les polices ; aucune mise en cache des appels Supabase (Dexie s'en charge).
- Bandeau « Có phiên bản mới — Cập nhật » quand un nouveau service worker attend.
- Invite d'installation : Android via `beforeinstallprompt` (bouton dans Plus) ; iOS : encart d'aide « Chia sẻ → Thêm vào MH chính » affiché une fois si non installé.
- **Point de vigilance OAuth iOS en mode standalone** : vérifier que la redirection Google revient bien dans la PWA. Si ce n'est pas le cas, la page `/login` détecte le mode standalone iOS et affiche une consigne ; documenter le comportement constaté dans `DECISIONS.md`.

---

## 10. Structure du projet

```
docs/mockups/            captures de référence
supabase/
  migrations/            SQL versionné
  functions/delete-account/
  seed.sql               utilisateur de test local (e2e)
src/
  app/                   routes, layout, onglets
  features/
    home/ transactions/ budget/ categories/ charts/ trend/ more/ auth/
  components/            AmountKeypad, BottomSheet, Segmented, CategoryIcon, MonthPicker, Money
  db/                    local.ts (Dexie), repo/*.ts
  sync/                  engine.ts, status.ts
  lib/                   money.ts, expr.ts, dates.ts, stats.ts, csv.ts, supabase.ts
  i18n/vi.ts
  styles/
tests/e2e/
```

Toute la logique de calcul (totaux, moyenne journalière, moyenne mensuelle, héritage de budget, répartition par catégorie) est dans des fonctions pures de `src/lib/stats.ts`, testées unitairement.

---

## 11. Jalons et critères d'acceptation

Chaque jalon se termine par `npm run check` vert (typecheck + lint + tests unitaires) et un commit.

| # | Jalon | Terminé quand |
|---|---|---|
| M0 | Scaffold Vite/React/TS/Tailwind, PWA, scripts, CI GitHub Actions | `npm run build` OK, Lighthouse PWA installable en local |
| M1 | Migrations Supabase, RLS, triggers, seed des catégories, types TS générés | Tests SQL (via `supabase test db` ou script) : un utilisateur ne voit pas les données d'un autre ; nouvel utilisateur = 35 + 5 catégories |
| M2 | Auth Google, garde de routes, layout + barre d'onglets | Connexion/déconnexion fonctionnelles ; session conservée hors ligne |
| M3 | Dexie + repositories + moteur de synchro | Tests unitaires du moteur avec Supabase simulé : push, pull, conflit LWW, reprise après erreur |
| M4 | Catégories (liste, ajout, édition, tri, archivage) | e2e : créer, renommer, réordonner, archiver, restaurer |
| M5 | Clavier-calculatrice + saisie/édition/suppression transaction | Tests du parseur (priorités, arrondi, erreurs) ; e2e : ajouter dépense et revenu |
| M6 | Accueil + budget | e2e : totaux et reste corrects sur un jeu de données fixe ; héritage du budget vérifié |
| M7 | Graphiques du mois | Valeurs de la maquette reproduites avec le jeu de données de la maquette (38,000,000 / -9,250,000 / 28,750,000 / -4,625,000) |
| M8 | Tendance annuelle | Tableau conforme pour un jeu de données de 7 mois |
| M9 | Plus : masquage, export CSV, suppression du compte, état de synchro | CSV ouvrable dans Excel avec accents corrects |
| M10 | Finition : captures Playwright 390×844 comparées aux maquettes, accessibilité de base, perf | Lighthouse mobile ≥ 90 partout ; mode avion : saisie possible puis synchro au retour réseau |

---

## 12. Jeu de données de démonstration

Script `npm run seed:demo` (compte local de test) reproduisant les maquettes : janvier 2026 avec Lương 38,000,000 (2/1), Ăn uống 1,200,000, Trái cây 400,000, Quần áo 3,200,000 note « Mũ nón » (2/1), Quà tặng 3,700,000 et Game + Ăn uống (1/1) pour un total de dépenses de 9,250,000 ; budget janvier 18,000,000 ; mois février à juillet 2026 selon le tableau de la maquette Tendance.

---

## 13. Hors code : actions humaines requises

Voir `SETUP.md`. Tout le reste est à la charge de Claude Code.
