# Cahier des Charges Détaillé — `md2print` (V1)

## 1. Contexte, Objectif et Règles d'Encadrement

**`md2print`** est une application web **Single Page Application (SPA)** développée en **HTML5, CSS3 Vanilla et JavaScript Vanilla (ES6+ avec modules ES)**. Elle s'exécute via un serveur HTTP local et embarque toutes ses bibliothèques tierces localement dans le dossier `vendor/` pour fonctionner sans dépendance réseau externe.

### 1.1. Objectif Fonctionnel Global
Permettre à un utilisateur de :
1. **Lister, ouvrir, créer, modifier et sauvegarder** un fichier au format Markdown (`.md`) via un éditeur de texte standard (non-WYSIWYG en V1) situé sur la moitié gauche de l'écran.
2. **Prévisualiser en temps réel** le document Markdown formaté sur la moitié droite de l'écran (dans une `iframe` isolée), avec choix du mode d'affichage (**Rapport** continu ou **Slide** présentation).
3. **Exporter** le document Markdown dans trois formats :
   - **HTML (`.html`)** : un fichier unique auto-porteur contenant la mise en page (CSS), le contenu formaté (figé dans le mode actif Rapport ou Slide) et un menu de navigation latéral repliable.
   - **Word (`.docx`)** : document généré avec styles, tableaux, images Base64 et injection dans un modèle `.docx`.
   - **PowerPoint (`.pptx`)** : présentation générée suivant la hiérarchie des titres (`#` Couverture, `##` Chapitre, `###` Contenu), listes, tableaux et images Base64.

### 1.2. Règles Impératives de Développement
1. **Périmètre strict** : Développer **strictement et uniquement** les fonctionnalités décrites dans ce cahier des charges. Aucun élément hors périmètre (pas de barre d'outils WYSIWYG, pas de compteurs de mots, pas de sélecteur de couleurs HTML) ne doit être ajouté.
2. **Politique zéro émoji / zéro icône** : L'application et le document HTML généré ne doivent contenir **aucun émoji ni aucune icône** (pas de FontAwesome, pas de caractères Unicode décoratifs, pas d'icônes SVG). Tous les contrôles utilisent exclusivement des libellés textuels sobres.
3. **Politique zéro test automatisé / zéro serveur** : Les agents ne doivent lancer aucune séquence de tests automatisés ni aucun serveur HTTP. Le développeur se charge seul de lancer son serveur et de valider les développements à partir de la liste d'actions fournie.

---

## 2. Ergonomie Générale, Layout et Charte Graphique

### 2.1. Architecture Visuelle de l'Écran (`100vh`)

- **Barre de menu supérieure** :
  - **Zone Gauche (Fichier)** : `[Nouveau]` `[Ouvrir fichier]` `[Ouvrir dossier]` `[Liste déroulante .md]` `[Sauvegarder]` — Nom du fichier en lecture seule avec `*` si modifié.
  - **Zone Centrale (Vue Aperçu / HTML)** : Sélecteur `[Rapport | Slide]`.
  - **Zone Droite (Config, Export & Thème)** : Menu déroulant `[Configuration]`, Menu déroulant `[Exporter]`, Bouton `[Thème : Sombre / Sépia]`.
- **Espace de travail principal (Split-View 50% / 50% par défaut)** :
  - **Moitié Gauche** : Éditeur de texte standard (`<textarea>`) en plein espace.
  - **Séparateur Central Déplaçable** : Barre verticale permettant de redimensionner la largeur entre 20 % et 80 %.
  - **Moitié Droite** : Aperçu temps réel dans une `<iframe>` isolée avec synchronisation du défilement vertical.

### 2.2. Thèmes Visuels de l'Application (`css/styles.css`)

- **État initial au démarrage** : L'application s'ouvre avec un **éditeur vide** (`Sans titre.md`) et le **thème Sombre (Bleu foncé et gris)** actif par défaut.
- **Portée des thèmes** : Les thèmes **Sombre** et **Clair (Sépia)** habillent l'interface de l'application. Le document HTML affiché dans l'`iframe` et exporté en `.html` utilise le **style de rapport classique Azur** (fond blanc, texte anthracite, accents bleus `#2563eb`).

| Variable CSS (`:root`) | Mode Sombre (Bleu foncé & Gris) — *Défaut* | Mode Clair (Sépia) |
|---|---|---|
| `--bg-primary` (Fond éditeur `<textarea>`) | `#0f172a` (Bleu nuit profond) | `#f4ecd8` (Papier sépia clair) |
| `--bg-secondary` (Barre de menu / Menus) | `#1e293b` (Gris ardoise) | `#e8dec5` (Sépia soutenu) |
| `--bg-hover` (Survol des boutons / items) | `#334155` (Gris bleuté moyen) | `#dccfb2` (Sépia ambré doux) |
| `--border-color` (Bordures et séparateur) | `#334155` (Gris bleuté) | `#cbbba0` (Brun sépia doux) |
| `--text-primary` (Texte principal) | `#e2e8f0` (Gris très clair) | `#2c241b` (Brun encre foncé) |
| `--text-secondary` (Texte secondaire / Muted) | `#94a3b8` (Gris moyen) | `#6e5d4f` (Brun grisé) |
| `--accent-color` (Boutons primaires / Actif) | `#3b82f6` (Bleu acier) | `#8c5a2b` (Brun ambré / Terre) |
| `--accent-hover` (Survol accent) | `#2563eb` (Bleu franc) | `#6e451f` (Brun chaud) |

---

## 3. Spécifications Détaillées des Fonctionnalités

### F1 — Gestion des Fichiers Markdown (Barre Supérieure — Zone Gauche)

1. **Affichage du nom du fichier et de l'état modifié (`isDirty`)** :
   - Le nom du fichier courant est affiché en **lecture seule** dans la barre supérieure (`Sans titre.md` au démarrage, ou le nom du fichier ouvert).
   - Dès que le contenu de l'éditeur est modifié (`state.isDirty = true`), un astérisque `*` est ajouté après le nom (ex: `rapport.md *`).
2. **Bouton `Nouveau` (Vider l'écran)** :
   - Si `state.isDirty === true`, affiche une boîte de confirmation native `window.confirm("Des modifications non sauvegardées seront perdues. Voulez-vous continuer ?")`.
   - Vide l'éditeur `<textarea>`, réinitialise `state.markdown = ''`, `state.currentFileName = 'Sans titre.md'`, `state.isDirty = false`, remet la liste déroulante des fichiers sur son option par défaut et rafraîchit l'aperçu.
3. **Bouton `Ouvrir fichier` (Sélection unitaire)** :
   - Ouvre le sélecteur de fichier `<input type="file" accept=".md,.markdown,.txt">`.
   - Si `state.isDirty === true`, demande confirmation avant d'écraser le contenu en cours.
   - Lit le fichier sélectionné en UTF-8, charge le texte dans l'éditeur, met à jour `state.currentFileName = file.name`, passe `state.isDirty = false` et met à jour l'aperçu.
4. **Bouton `Ouvrir dossier` et Liste déroulante `<select>` (Lister les fichiers `.md`)** :
   - Ouvre le sélecteur de dossier `<input type="file" webkitdirectory multiple>`.
   - Filtre les fichiers du dossier ayant une extension `.md` ou `.markdown` et les trie par ordre alphabétique.
   - Remplit la liste déroulante `<select id="folderFileSelect">` dans la barre supérieure.
   - Lorsque l'utilisateur sélectionne un fichier dans cette liste déroulante :
     - Si `state.isDirty === true`, demande confirmation (en cas d'annulation, restaure la sélection précédente du `<select>`).
     - Lit le fichier sélectionné en UTF-8, l'affiche dans l'éditeur et met à jour l'aperçu.
5. **Bouton `Sauvegarder` et Raccourci `Ctrl+S`** :
   - Déclenché par un clic sur le bouton `Sauvegarder` ou par le raccourci clavier `Ctrl+S` / `Cmd+S`.
   - Déclenche systématiquement un **téléchargement classique** du fichier `.md` via le navigateur (`Blob` `text/markdown;charset=utf-8`).
   - Nom du fichier téléchargé : conserve le nom du fichier ouvert, ou extrait le premier titre `# Titre` du Markdown pour former `<slug>.md` (`document.md` par défaut).
   - Passe `state.isDirty = false`.

---

### F2 — Éditeur de Texte Standard (Moitié Gauche), Images & Redimensionnement

1. **Champ de saisie `<textarea id="mdEditor">`** :
   - Éditeur de texte standard en plein espace de la moitié gauche, sans interprétation WYSIWYG.
   - Raccourci `Tab` : insère 2 espaces à la position du curseur sans quitter le champ.
   - À chaque saisie (`input`), met à jour `state.markdown`, active `state.isDirty = true` et rafraîchit l'aperçu `iframe`.
2. **Glisser-Déposer (Drag & Drop) et Collage d'Images (`Ctrl+V`)** :
   - **Dépôt d'un fichier `.md` / `.markdown` / `.txt`** sur l'éditeur : ouvre le fichier (après confirmation si `state.isDirty === true`).
   - **Dépôt ou collage (`Ctrl+V`) d'un fichier image** (`image/*`) dans l'éditeur :
     - Convertit l'image en Data URL Base64 via `FileReader.readAsDataURL()`.
     - L'enregistre dans le dictionnaire en mémoire `state.localImages` et insère la syntaxe Markdown `![alt](data:image/...;base64,...)` à la position du curseur.
     - La fonction `resolveImagePaths()` résout également toute référence de type `(data:image/...;chemin)` vers son flux Base64.
3. **Normalisation Automatique du Markdown (`normalizeMarkdown`)** :
   - Répare automatiquement les tableaux Markdown dont la ligne de séparation `|---|` ou les lignes de données ont un nombre de colonnes différent de l'en-tête.
   - Garantit les sauts de ligne avant et après les tableaux.
   - Nettoie les ancres factices devant les titres et insère des espaces insécables devant le symbole `€`.
4. **Séparateur Central Déplaçable (`#paneResizer`)** :
   - Répartition initiale : **50 % gauche / 50 % droite**.
   - Glisser-déposer horizontal permettant d'ajuster la largeur entre 20 % et 80 %.
5. **Synchronisation du Défilement (Scroll Sync)** :
   - En mode **Rapport**, le défilement vertical de l'éditeur `<textarea>` synchronise proportionnellement le défilement vertical de l'`iframe` d'aperçu, et réciproquement.

---

### F3 & F4 — Aperçu `iframe` (Moitié Droite) et Export HTML Autonome

1. **Sélecteur de Mode `Rapport` / `Slide` (Barre Supérieure — Zone Centrale)** :
   - Deux boutons textuels (`Rapport` actif par défaut, `Slide`) dans la barre supérieure de l'application.
   - Change `state.currentViewport` (`'report'` ou `'slide'`), met à jour immédiatement l'aperçu `iframe`, et **fige ce mode actif** (`<body data-view-mode="...">`) dans le fichier `.html` lors de l'export.
2. **Style et Structure du Document HTML Généré (`HtmlGenerator.js`)** :
   - Palette **Azur** par défaut (fond blanc `#ffffff`, surface `#f8fafc`, texte `#0f172a`, couleur primaire `#2563eb`, couleur secondaire `#1d4ed8`, fond léger `#eff6ff`).
   - **Bandeau supérieur fixe** dans le document HTML :
     - Gauche : Bouton textuel `Sommaire` permettant de replier ou déplier le menu de navigation latéral.
     - Centre : Titre principal du document (extrait automatiquement du premier `# Titre` ou du nom de fichier).
     - Droite : Date du jour (format `fr-FR`) et bouton textuel `Imprimer` (`window.print()`).
   - **Menu de navigation latéral (Sommaire / TOC)** :
     - Généré automatiquement à partir des titres `H1`, `H2`, `H3` avec indentation hiérarchique.
     - Liens d'ancrage fluides vers les sections (ou vers la diapositive correspondante en mode `Slide`).
     - Suivi automatique de la section visible au défilement (**ScrollSpy**).
     - Repliable/dépliable via le bouton `Sommaire` du bandeau supérieur.
   - **Rendu des blocs de code** :
     - Coloration syntaxique via `highlight.js`, affichage sobre dans un bloc `<pre><code class="hljs">...</code></pre>` **sans barre d'en-tête de langage ni bouton Copier**.
   - **Mode Slide interactif** (lorsque `Slide` est sélectionné) :
     - Découpage automatique par sections `##` (centrées) et `###` (alignées en haut).
     - Navigation par boutons textuels sobres (`Précédent` / `Suivant`), compteur `X / Y` et flèches du clavier (`ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `Espace`).
   - **Zéro icône / Zéro émoji** : Exclusivement des libellés textuels purs.

---

### F5 & F6 — Configuration et Exports Word (`.docx`) et PowerPoint (`.pptx`)

1. **Chargement de la Configuration et du Modèle par Défaut** :
   - Au démarrage (`DOMContentLoaded`), l'application charge automatiquement par `fetch()` :
     - `config/output_config.json` (styles Word et masters/thèmes PowerPoint).
     - `templates/Modele_word.docx` (modèle Word binaire en `ArrayBuffer`).
2. **Menu déroulant `Configuration` (Barre Supérieure — Zone Droite)** :
   - Affiche l'état des fichiers chargés par défaut et propose deux actions textuelles :
     - `Charger configuration (.json)` : permet à l'utilisateur d'importer un fichier `.json` personnalisé.
     - `Charger modèle Word (.docx)` : permet à l'utilisateur d'importer un fichier `.docx` ou `.dotx` personnalisé.
3. **Export Word (`.docx`) — `DocxGenerator.js`** :
   - Accessible depuis le menu déroulant `Exporter > Word (.docx)`.
   - Applique `resolveImagePaths()` et `normalizeMarkdown()` sur le Markdown.
   - Parse le Markdown via `MarkdownParser.js` (titres, paragraphes, listes à puces/numérotées, tableaux, blocs de code, formatages inline, et **images Base64** converties en `docx.ImageRun`).
   - Génère le document via `window.docx` et l'injecte dans le modèle `templateBuffer` actif via `window.JSZip`.
4. **Export PowerPoint (`.pptx`) — `PptxGenerator.js` & `PptxSlideBuilders.js`** :
   - Accessible depuis le menu déroulant `Exporter > PowerPoint (.pptx)`.
   - Applique `resolveImagePaths()` et `normalizeMarkdown()` sur le Markdown.
   - Découpe le document selon les règles : `#` = Couverture (Master `TITRE`), `##` = Chapitre (Master `CHAPITRE`), `###` = Contenu (Master `SLIDE`), avec listes, tableaux et **images Base64**.

---

### F7 — Bascule de Thème Applicatif (`Sombre` ↔ `Sépia`)

- Bouton textuel dans la barre supérieure droite (`Thème : Sombre` / `Thème : Sépia`) basculant entre `data-theme="dark"` (bleu foncé et gris, actif par défaut) et `data-theme="sepia"` (clair sépia).
