# Changelog — md2print

Toutes les modifications notables apportées à ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.4.0] - 2026-11-01

### Feature
- **Page interactive de paramétrage des styles et des balises (`StyleSettingsManager.js`)** :
  - Création du module [`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js) et intégration de la page plein écran `#pageStyleConfig` accessible via le bouton d'en-tête « Styles des balises » et l'entrée « Paramétrer les styles des balises » du menu Configuration.
  - Personnalisation en temps réel des couleurs, polices et tailles de police pour chaque type d'élément Markdown :
    - Titres (titre principal `#`, titres 1 à 4 `##`, `###`, `####`, `#####`).
    - Corps de texte (`p`, `li`) et liens hypertextes (`a` avec couleur normale et survol).
    - Cartouche métrique 5x (`> [!data]` avec police, taille agrandie, couleur de la valeur, liseré supérieur et légende).
    - Encarts d'alerte et recommandations (callouts `[!note]`, `[!tip]`, `[!warning]`, `[!danger]`, `[!important]`).
    - Citations (`blockquote`), code inline et blocs de code (`pre`, `code`).
    - Tableaux Markdown (en-têtes `th`, cellules `td`, alternance de lignes, bordures).
    - Arrière-plans généraux de scène et conteneur papier/diapositive.
  - Panneau d'aperçu en direct (*Live Preview*) intégrant un échantillon complet et réactif instantanément à chaque réglage.
  - Bascule entre **Vision Rapport (Word)** et **Vision Slide (PowerPoint)** avec styles par défaut calqués sur `Modele_word.docx` et `Modele_presentation.potx`.
  - Actions d'application immédiate, d'exportation de fichier CSS (`.css`), de réinitialisation et de sauvegarde persistante dans IndexedDB via `saveThemeConfigs`.
  - Fichiers impactés : [`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js), [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js), [`index.html`](file:///g:/devapps/md2print/index.html), [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css), [`js/app.js`](file:///g:/devapps/md2print/js/app.js).
- **Sommaire escamotable (Tiroir / Drawer) en Vision Slide** :
  - Restauration du bandeau supérieur sobre bleu nuit (`#0E2841`) avec le titre du document et le bouton textuel « Sommaire ».
  - Transformation du sommaire latéral en tiroir escamotable replié par défaut (`.collapsed`), se déployant en superposition fluide sans altérer le ratio 16:9 de la présentation.
  - Navigation directe vers la diapositive sélectionnée avec repliage automatique du tiroir, et prise en charge du raccourci clavier <kbd>Échap</kbd> pour refermer le sommaire.
  - Fichiers impactés : [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css), [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js).
- **Thèmes CSS par défaut paramétrables pour la Vision Rapport et la Vision Slide** :
  - Création de [`css/report.css`](file:///g:/devapps/md2print/css/report.css) inspiré de `Modele_word.docx` (Calibri, Calibri Light, `#C00000`, `#2F5496`, marges 25mm).
  - Création de [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css) inspiré de `Modele_presentation.potx` (Aptos, Aptos Display, `#0E2841`, `#C41718`, `#FBAE40`, ratio 16:9).
  - Synchronisation complète dans [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js) pour un fonctionnement 100 % autonome et hors-ligne via le protocole `file:///`.
  - Fichiers impactés : [`css/report.css`](file:///g:/devapps/md2print/css/report.css), [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css), [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js).

### Fix
- **Rétablissement et isolation complète de la Vision Rapport** :
  - Isolation du rendu HTML dans [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) : suppression des nœuds `.slide-container` et `.slide-controls` du DOM en mode Rapport.
  - Correction de la mise en page en bloc centré pour `.document-body` et `.markdown-rendered-content` pour éliminer les déformations flexbox.
  - Restriction de la capture des touches fléchées au mode Diaporama, restaurant le défilement clavier naturel (flèches, PageUp, PageDown) dans le rapport.
  - Maintien du défilement lié asymétrique (le défilement de l'aperçu entraîne l'éditeur, tandis que l'éditeur est libre de défiler).
  - Fichiers impactés : [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`css/report.css`](file:///g:/devapps/md2print/css/report.css), [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js).

## [1.3.0] - 2026-11-01

### Feature
- **Cartouches graphiques interactives pour les schémas Mermaid (`.mermaid-cartouche`) dans l'éditeur** :
  - Transformation de tout schéma Mermaid dans l'éditeur non-WYSIWYG en une cartouche compacte verte avec bordure `--success-color` (#10b981), badge `[mermaid]` et flèche basse `▼`.
  - Dépliage / repliage au clic sur la flèche ou l'en-tête de la cartouche, avec bascule vers une flèche haute `▲`.
  - Intégration d'un éditeur `<textarea class="mermaid-code-textarea">` monospace avec prise en charge de la touche <kbd>Tab</kbd> (indentation de 4 espaces), rafraîchissement temps réel de la prévisualisation et persistance dans IndexedDB.
  - Suppression unifiée (repliée ou dépliée) avec les touches <kbd>Suppr</kbd> ou <kbd>Retour arrière</kbd> au clic ou lorsque le curseur est adjacent (`handleCartoucheDeletion`).
  - Raccourci clavier <kbd>Ctrl</kbd> + <kbd>M</kbd> pour insérer une nouvelle cartouche Mermaid dépliée au niveau du curseur.
  - Fichiers impactés : [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js), [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css), [`js/app.js`](file:///g:/devapps/md2print/js/app.js).
- **Rendu vectoriel et export complet des schémas Mermaid (HTML, Word, PowerPoint)** :
  - Intégration de la bibliothèque locale `vendor/mermaid.min.js` avec initialisation sans appel réseau (`securityLevel: 'loose'`).
  - Rendu HTML dans un cadre stylé (`.mermaid-card`) avec fond bleuté, bordure gauche primaire et léger ombrage.
  - Rastérisation haute résolution (PNG 2x) pour inclusion native dans les exports Word (`.docx`) et PowerPoint (`.pptx`).
  - Prise en charge des diagrammes sans clôture Markdown explicite (`graph TB...`), des labels multilignes `<br/>`, des nœuds stylés et des sous-graphes complexes.
  - Fichiers impactés : [`index.html`](file:///g:/devapps/md2print/index.html), [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js), [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js), [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js).
- **Planification unifiée des diapositives (`SlidePlanner.js`) entre la sortie HTML et PowerPoint (.pptx)** :
  - Création du module [`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js) centralisant l'algorithme de partitionnement des diapositives : diapositive de couverture (titre + date), diapositives d'inter-titres par chapitre et diapositives de contenu.
  - Pagination prédictive partagée selon la zone de contenu utile (`area.y + area.h`) garantissant un nombre total de diapositives (`1 / N`), des typologies et des allocations de blocs strictement identiques entre l'aperçu/export HTML et l'export PPTX.
  - Prise en compte de la hauteur des tableaux, diagrammes Mermaid, images, séparateurs, sous-titres, listes et paragraphes.
  - Fichiers impactés : [`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js), [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js), [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js), [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`js/app.js`](file:///g:/devapps/md2print/js/app.js).
- **Règle de saut de diapositive forcé par le séparateur horizontal (`---`)** :
  - Tout séparateur horizontal Markdown `---` (ou `***`, `___`) déclenche immédiatement la finalisation de la diapositive courante et le démarrage d'une nouvelle diapositive pour le contenu suivant, tant en HTML qu'en PPTX.
  - Fichiers impactés : [`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js), [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js).
- **Renvoi à la ligne des colonnes de tableaux trop longues dans l'éditeur non-WYSIWYG** :
  - Plafonnement de la largeur maximale des colonnes à 60 caractères (`TABLE_MAX_COL_WIDTH = 60`) avec découpage automatique des cellules longues (`<br>`) pour préserver la lisibilité de la grille de tableau dans l'éditeur sans déborder de l'écran.
  - Fichiers impactés : [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js).

### Fix
- **Rastérisation Canvas des diagrammes Mermaid avec balises HTML imbriquées** :
  - Conversion automatique des balises `<foreignObject>` SVG en éléments textuels `<text>` / `<tspan>` natifs lors de l'export PNG pour contourner les restrictions de sécurité du navigateur lors du dessin sur `<canvas>`.
  - Normalisation des fins de lignes Windows (`\r\n` -> `\n`) dans le cache de rendu des diagrammes Mermaid.
  - Fichiers impactés : [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js).

## [1.2.0] - 2026-10-31

### Feature
- **Persistance haute capacité via `IndexedDB` (`StorageService.js`) avec support complet des images Base64, de la configuration et du layout** :
  - Création du service [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) utilisant la base `IndexedDB` `md2print_db` (stores `app_state` et `local_images`) en remplacement du `localStorage`, permettant de persister sans limite de 5 Mo le brouillon Markdown, l'intégralité des images Base64 associées aux cartouches `[image]`, les préférences d'interface (thème Sombre/Sépia, mode Rapport/Slide, largeur du séparateur `#paneResizer`) ainsi que la configuration JSON et le modèle Word `.docx` personnalisés.
  - Ajout de l'action `Réinitialiser par défaut` dans le menu `Configuration` ([`index.html`](file:///g:/devapps/md2print/index.html), [`js/app.js`](file:///g:/devapps/md2print/js/app.js)).
  - Sauvegarde transactionnelle atomique immédiate lors de l'insertion d'une image (`insertImageAsBase64`), de l'ouverture ou de la sauvegarde d'un fichier, et sauvegarde débouncée (`60 ms`) lors de la frappe.
  - Recalcul automatique du compteur d'identifiants `state.imageSeq` (`computeNextImageSeq`) à la restauration pour éviter toute collision `img-N`, et purge automatique des images Base64 supprimées (`pruneUnusedLocalImages`).
  - Fichiers impactés : [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js), [`js/app.js`](file:///g:/devapps/md2print/js/app.js), [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js), [`index.html`](file:///g:/devapps/md2print/index.html).
- **Rendu des blocs de code (` ``` `), citations (`>`) et séparateurs (`---`) + conversion SVG/WebP en PNG dans Word et PowerPoint** :
  - Préservation des sauts de ligne (`\n` -> `break: 1`) et habillage dédié des blocs de code (fond grisé, bordure d'accentuation, police `Consolas`), des citations (retrait gauche, bordure latérale, italique) et des séparateurs horizontaux (`---`) dans [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) et [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js).
  - Ajout de `ensureOfficeCompatibleImage` dans [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) rastérisant automatiquement via `<canvas>` les images `.svg` et `.webp` en `image/png` pour une compatibilité native avec Word et PowerPoint.
- **Unification du parsing inline récursif pour les exports Word (`.docx`) et PowerPoint (`.pptx`)** :
  - Refonte récursive de `extractInlineStyles` dans [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) pour prendre en charge les styles combinés et imbriqués (`***gras+italique***`, `**gras**`, `__souligné__`, `<u>souligné</u>`, `~~barré~~`, `*italique*`, `_italique_`, `` `code` ``, `[libellé](url)`).
  - Prise en charge complète du barré (`strike`), du souligné (`underline`) et de la police monospace (`Consolas`) dans les titres et cellules de tableaux Word ([`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js)) ainsi que dans les diapositives PowerPoint ([`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js)).
- **Validation structurelle à l'import d'un fichier `output_config.json` personnalisé** :
  - Ajout de `validateOutputConfig` dans [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) vérifiant la présence et le typage des sections `documents` / `templates` avant d'appliquer la configuration dans [`js/app.js`](file:///g:/devapps/md2print/js/app.js).

### Refactor
- **Extraction du moteur d'édition non-WYSIWYG dans [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js)** :
  - Isolation complète de la gestion du DOM `contenteditable`, du calcul des offsets de sélection, de l'alignement des tableaux en grille CSS et des objets graphiques `.image-cartouche` dans un module dédié (`877 lignes`), réduisant [`js/app.js`](file:///g:/devapps/md2print/js/app.js) à son rôle d'orchestrateur SPA (`1 100 lignes`).
- **Fluidité de frappe sur les longs documents (`schedulePreviewUpdate`)** :
  - Ajout d'un `debounce` de `120 ms` sur la régénération de l'`iframe` lors de la saisie dans `#mdEditor` tout en conservant le formatage syntaxique de l'éditeur synchrone et instantané.

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
