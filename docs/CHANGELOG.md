# Changelog — md2print

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.1.0] - 2026-10-25

### Feature
- **Objet graphique Cartouche `[image]` sur 2 lignes de hauteur dans l'éditeur** :
  - Transformation de `#mdEditor` en éditeur `contenteditable="true"` permettant d'afficher chaque image Base64 sous la forme d'un objet graphique dédié (`.image-cartouche`) de 2 lignes de hauteur sans exposer la chaîne Base64 à l'utilisateur.
  - Suppression de l'objet graphique et de son image associée en le sélectionnant comme du texte puis en appuyant sur `Suppr` (`Delete`) ou `Backspace` (`handleCartoucheDeletion`).
  - Fichiers impactés : [`index.html`](file:///g:/devapps/md2print/index.html), [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css), [`js/app.js`](file:///g:/devapps/md2print/js/app.js), [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js).
- **Formatage syntaxique en direct non-WYSIWYG dans l'éditeur Markdown (`#mdEditor`)** :
  - **Titres `#` à `#####`** : mise en gras et échelle de tailles typographiques progressives (`.md-h1` à `.md-h5`) tout en conservant les dièses `#` visibles.
  - **Styles inline récursifs** : prise en charge du gras (`**texte**`), du souligné (`__texte__` et `<u>texte</u>`), de l'italique (`*texte*` et `_texte_`), du gras-italique (`***texte***`), du barré (`~~texte~~`), du code inline (`` `code` ``) et des liens (`[libellé](url)`), tout en préservant l'invariant `1 caractère = 1 unité de sélection` pour le maintien exact du curseur.
  - **Listes à puces (`-`, `*`), listes numérotées (`1.`) et listes de tâches (`- [ ]`, `- [x]`)** : décalage de 5 caractères (`5ch`) vers la droite dès le premier niveau et +5 caractères supplémentaires par niveau d'imbrication (`Tab` / `Shift+Tab`), avec style barré automatique sur les tâches cochées (`[x]`).
  - **Alignement visuel automatique des colonnes de tableaux (`| ... |`)** : calcul dynamique de la largeur maximale (`ch`) de chaque colonne et alignement vertical en grille de toutes les barres `|` via CSS (`buildTableBlockRowSpans`) sans ajouter d'espaces parasites dans le fichier `.md`.
  - **Blocs de code (` ``` ... ``` `), citations (`> ...`) et séparateurs horizontaux (`---`, `***`, `___`)** : mise en forme dédiée des délimiteurs et lignes de bloc, et désactivation de l'interprétation Markdown à l'intérieur des blocs de code.
  - Fichiers impactés : [`js/app.js`](file:///g:/devapps/md2print/js/app.js), [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css), [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js).

### Fix
- **Saut de ligne immédiat au premier appui sur `Entrée` et support des touches mortes (`^`, `¨`)** :
  - Maintien d'un élément sentinelle `<br data-sentinel="true">` en fin d'éditeur (`ensureTrailingSentinel`) pour qu'un seul appui sur `Entrée` en fin de document crée immédiatement un saut de ligne visible.
  - Prise en charge de `e.isComposing` et `compositionend` pour ne pas interrompre la saisie des accents composés au clavier.
  - Fichiers impactés : [`js/app.js`](file:///g:/devapps/md2print/js/app.js).

## [1.0.0] - 2026-10-25

### Feature
- **Gestion des fichiers et dossiers Markdown (F1)** :
  - Ouverture d'un fichier `.md` unitaire via le sélecteur système ou par glisser-déposer sur l'éditeur.
  - Ouverture d'un dossier local (`webkitdirectory`) avec filtrage et tri alphabétique des fichiers `.md` dans une liste déroulante de la barre supérieure.
  - Création d'un nouveau fichier (vidage de l'écran) avec demande de confirmation si des modifications non sauvegardées sont présentes (`isDirty`).
  - Sauvegarde par téléchargement classique du fichier `.md` via le bouton `Sauvegarder` ou le raccourci clavier `Ctrl+S`, et affichage du nom du fichier en lecture seule avec astérisque (`*`) en cas de modification.
  - Fichiers impactés : [`index.html`](file:///g:/devapps/md2print/index.html), [`js/app.js`](file:///g:/devapps/md2print/js/app.js), [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js).
- **Éditeur Markdown brut, Images Base64 et Normalisation (F2)** :
  - Éditeur de texte standard (`<textarea>`) sur la moitié gauche de l'écran avec support de la touche `Tab` (insertion de 2 espaces).
  - Support du glisser-déposer et du collage (`Ctrl+V`) d'images converties automatiquement en Base64 et résolution des chemins locaux via `resolveImagePaths()`.
  - Normalisation et réparation automatique des tableaux Markdown mal alignés via `normalizeMarkdown()`.
  - Barre verticale centrale déplaçable à la souris pour ajuster la largeur gauche/droite (20 % à 80 %) et synchronisation proportionnelle du défilement vertical avec l'aperçu.
  - Fichiers impactés : [`js/app.js`](file:///g:/devapps/md2print/js/app.js), [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js).
- **Aperçu temps réel `iframe` et Export HTML autonome avec menu de navigation (F3 & F4)** :
  - Rendu isolé dans une `iframe` fidèle au document `.html` final exporté, avec bascule entre le mode **Rapport** continu et le mode **Slide** interactif.
  - Génération d'un fichier `.html` unique intégrant la feuille de style CSS (thème Azur classique), le bandeau supérieur (`Sommaire`, titre, date, `Imprimer`), le menu de navigation latéral repliable (`H1`, `H2`, `H3` avec `ScrollSpy`) et la coloration syntaxique sobre des blocs de code via `highlight.js`.
  - Fichiers impactés : [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`js/app.js`](file:///g:/devapps/md2print/js/app.js).
- **Exports Microsoft Word (`.docx`) et PowerPoint (`.pptx`) configurables (F5 & F6)** :
  - Chargement automatique par défaut de `config/output_config.json` et `templates/Modele_word.docx`, avec possibilité de charger des fichiers personnalisés via le menu `Configuration`.
  - Export `.docx` avec hiérarchie des titres, listes, tableaux, images Base64 (`ImageRun`) et injection dans le modèle Word via `JSZip`.
  - Export `.pptx` suivant le découpage `#` (Couverture), `##` (Chapitre), `###` (Contenu), listes, tableaux et images Base64 via `PptxGenJS`.
  - Fichiers impactés : [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js), [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js), [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js), [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js).

### UI-UX
- **Interface sobre 100 % textuelle et Thèmes Sombre / Clair Sépia (F7)** :
  - Application stricte de la politique zéro émoji et zéro icône décorative sur l'ensemble de l'application et des documents générés.
  - Création de deux thèmes CSS pilotés par variables : **Mode Sombre (Bleu foncé `#0f172a` et Gris `#1e293b`)** actif par défaut, et **Mode Clair (Sépia `#f4ecd8`)**.
  - Embarquement local de toutes les bibliothèques tierces dans `vendor/` pour un fonctionnement 100 % hors-ligne.
  - Fichiers impactés : [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css), [`index.html`](file:///g:/devapps/md2print/index.html).
