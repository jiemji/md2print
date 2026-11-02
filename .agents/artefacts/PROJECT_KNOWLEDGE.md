# md2print — Documentation Technique de Référence (PROJECT_KNOWLEDGE)

> **Version courante : 1.4.0** --- Mise à jour : 2026-11-01

---

## 1. Stack Technologique & Dépendances

| Élément | Description | Rôle |
|---|---|---|
| **HTML5 / CSS3** | Vanilla CSS avec variables CSS (`:root`, `[data-theme="dark"]`, `[data-theme="sepia"]`) | Structure Split-View et thèmes Sombre (Bleu/Gris) et Clair (Sépia) |
| **JavaScript ES6+** | Vanilla JS modulaire (`<script type="module">`) sans framework ni bundler | Logique applicative, gestion de l'état, parsing et génération multi-formats |
| **IndexedDB** | API native du navigateur encapsulée dans [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) | Persistance locale haute capacité du brouillon, des images Base64, des préférences UI, des styles et des modèles personnalisés |
| **Marked.js** | `vendor/marked.min.js` | Parser Markdown vers HTML avec renderers personnalisés |
| **Highlight.js** | `vendor/highlight.min.js` | Coloration syntaxique des blocs de code dans l'aperçu et l'export HTML |
| **Mermaid.js** | `vendor/mermaid.min.js` | Moteur de rendu vectoriel (SVG) pour les schémas diagrammatiques (flux, architecture, séquences, états, classes) côté client |
| **docx** | `vendor/docx.umd.js` | Génération de documents Microsoft Word (`.docx`) côté client |
| **PptxGenJS** | `vendor/pptxgen.bundle.js` | Génération de présentations Microsoft PowerPoint (`.pptx`) côté client |
| **JSZip** | `vendor/jszip.min.js` | Manipulation d'archives OpenXML pour l'injection dans le modèle Word `.docx` |

---

## 2. Architecture Globale

L'application est une SPA modulaire exécutée localement via navigateur avec 100 % des dépendances embarquées (fonctionnement autonome sans connexion internet et compatible avec le protocole `file:///`).

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        SPA md2print (index.html)                        │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Barre Supérieure : Fichier | Rapport/Slide | Styles | Config | UI │  │
│  └───────────────┬───────────────────────────────────┬───────────────┘  │
│                  │                                   │                  │
│                  ▼                                   ▼                  │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │ Moitié Gauche : Éditeur (.md) │   │ Moitié Droite : Aperçu Iframe │  │
│  │ - <div id="mdEditor">         │◄─►│ - Mode Rapport (Word)         │  │
│  │ - EditorEngine.js             │   │ - Mode Slide (PowerPoint 16:9)│  │
│  │ - Cartouches [image] (2 lig.) │   │ - Sommaire repliable / drawer │  │
│  │ - Cartouches [mermaid] (▼/▲)  │   │ - Cartouches métriques 5x     │  │
│  └───────────────┬───────────────┘   └───────────────▲───────────────┘  │
│                  │                                   │                  │
│                  ▼                                   │                  │
│    Objet `state` + StorageService (IndexedDB) ──► `SlidePlanner.js`     │
│                  │                                   │                  │
│                  ├──────────► `StyleSettingsManager` │                  │
│                  │            (Page paramétrage CSS) ├──► `HtmlGen.js`  │
│                  │                                   └──► `PptxGen.js`  │
│                  │                                                      │
│                  ├──────────► `HtmlGenerator.js` ──► Export .html       │
│                  ├──────────► `DocxGenerator.js` ──► Export .docx       │
│                  └──────────► `PptxGenerator.js` ──► Export .pptx       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

- [`index.html`](file:///g:/devapps/md2print/index.html) : Conteneur principal de la SPA (barre de menu supérieure, éditeur gauche, séparateur central, aperçu `iframe` droit, page de paramétrage des styles `#pageStyleConfig`).
- [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) : Styles de l'interface, layout Flexbox 50/50 redimensionnable, thèmes Sombre et Clair (Sépia), objets graphiques `.image-cartouche` et `.mermaid-cartouche`, styles de la page de paramétrage des balises.
- [`css/report.css`](file:///g:/devapps/md2print/css/report.css) : Feuille de style paramétrable de la Vision Rapport inspirée du modèle Word (`Modele_word.docx`) avec corps de texte centré A4, typographie Calibri, marges et titres `#C00000` / `#2F5496`.
- [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css) : Feuille de style paramétrable de la Vision Slide inspirée du modèle PowerPoint (`Modele_presentation.potx`) au format 16:9 avec palette Aptos/Bleu nuit `#0E2841`, bandeau supérieur, tiroir de sommaire escamotable et contrôles interactifs.
- [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js) : Feuilles de style CSS par défaut intégrées sous forme de constantes JavaScript (`DEFAULT_REPORT_CSS`, `DEFAULT_SLIDE_CSS`), garantissant un fonctionnement 100 % hors-ligne même sous restriction CORS du protocole `file:///`.
- [`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js) : Contrôleur de la page interactive de paramétrage des styles de chaque balise (titres, corps, métriques 5x, callouts, citations, code, tableaux, liens, arrière-plans), génération dynamique de CSS et aperçu en direct (*Live Preview*).
- [`js/app.js`](file:///g:/devapps/md2print/js/app.js) : Orchestrateur principal (état global, persistance `IndexedDB`, gestion des fichiers/dossiers `.md`, raccourcis clavier, sélection des cartouches, synchronisation du défilement, gestion de la page de styles, `debounce` d'aperçu et déclenchement des exports).
- [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) : Moteur d'édition `contenteditable="true"` non-WYSIWYG (calcul et restauration des offsets de sélection, cartouches graphiques `.image-cartouche` et `.mermaid-cartouche` avec éditeur intégré et toggle `▼`/`▲`, suppression unifiée `Suppr`/`Backspace`, alignement CSS des colonnes de tableaux plafonné à 60 caractères, formatage syntaxique en direct).
- [`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js) : Planificateur unifié de diapositives partagé par l'export PowerPoint (`.pptx`) et le mode Diaporama HTML (calcul prédictif de hauteur selon `area.y + area.h`, couverture, inter-titres, saut de diapositive forcé par `---`, répartition 1-pour-1 des blocs).
- [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) : Service de persistance locale `IndexedDB` (`md2print_db`, stores `app_state` et `local_images`) stockant de manière atomique le brouillon Markdown, les images Base64, les préférences d'interface (`theme`, `viewport`, `editorWidthPct`), les styles CSS personnalisés (`custom_css`) et les réglages de balises (`custom_theme_configs`).
- [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) : Fonctions utilitaires (`toSlug`, `escapeHtml`, `extractTitle`, lecture de fichiers, `normalizeMarkdown`, `resolveImagePaths`, `pruneUnusedLocalImages`, `validateOutputConfig`, `ensureOfficeCompatibleImage`, `renderMermaidBlocksMap`, `renderMermaidToPngDataUrl`, `readSvgDiagramSize`, `fitDimensions`).
- [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) : Parseur Markdown vers AST structuré avec mémorisation de la propriété `raw` par bloc et extraction récursive des styles inline pour les moteurs Word et PowerPoint.
- [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) : Générateur du document `.html` autonome avec isolation stricte du DOM (Rapport centré ou Diaporama 16:9 interactif piloté par `SlidePlanner`), tiroir de sommaire escamotable, ScrollSpy et cartouches métriques 5x.
- [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) : Générateur Word `.docx` avec support des images Base64, des diagrammes Mermaid (rastérisés en PNG haute résolution 2x), des blocs de code, citations, séparateurs et injection XML dans un modèle `.docx`.
- [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) : Générateur PowerPoint `.pptx` piloté par `SlidePlanner` avec rendu des masques de titre/chapitre/contenu, blocs de code, citations, séparateurs, tableaux, schémas Mermaid encadrés et images Base64.

---

## 3. Gestion de l'État Applicatif (`state`) & Persistance `IndexedDB`

L'objet singleton `state` dans [`js/app.js`](file:///g:/devapps/md2print/js/app.js) centralise les données en mémoire et se synchronise de manière transactionnelle avec la base `IndexedDB` `md2print_db` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) :

```javascript
const state = {
  markdown: '',                                   // Contenu brut Markdown (avec jetons [image])
  currentFileName: 'Sans titre.md',               // Nom du fichier actif
  isDirty: false,                                 // Indicateur de modifications non sauvegardées (*)
  folderFiles: [],                                // Liste des objets File (.md) du dossier ouvert
  selectedFolderIndex: '',                        // Index sélectionné dans la liste déroulante
  localImages: {},                                // Dictionnaire de correspondance des images Base64
  imageSeq: 1,                                    // Compteur séquentiel d'identifiants img-X
  currentViewport: 'report',                      // Mode d'affichage : 'report' | 'slide'
  theme: 'dark',                                  // Thème UI : 'dark' | 'sepia'
  editorWidthPct: 50,                             // Largeur en % du volet éditeur gauche (20 à 80)
  outputConfig: null,                             // Configuration JSON pour DOCX / PPTX
  configFileName: 'output_config.json (défaut)',  // Libellé de la configuration active
  templateBuffer: null,                           // ArrayBuffer du modèle Word (.docx)
  templateFileName: 'Modele_word.docx (défaut)',  // Libellé du modèle Word actif
  pptTemplateBuffer: null,                        // ArrayBuffer du modèle PowerPoint (.potx)
  pptTemplateFileName: 'Modele_presentation.potx (défaut)',
  reportCss: null,                                // Feuille de style active pour la Vision Rapport
  slideCss: null,                                 // Feuille de style active pour la Vision Slide
  customCssFileName: null,                        // Libellé du CSS personnalisé chargé
  themeConfigs: null,                             // Paramétrages personnalisés des balises (Rapport & Slide)
  syncScroll: true,                               // Défilement lié asymétrique activé/désactivé
};
```

---

## 4. Éditeur Non-WYSIWYG (`EditorEngine.js`), Cartouches Image et Normalisation

1. **Objet Graphique Cartouche `[image]` sur 2 lignes de hauteur (`createCartoucheElement` / `setEditorContent`)** : Toute image déposée ou collée (`Ctrl+V`) dans `#mdEditor` (ou présente en Base64 à l'ouverture d'un fichier `.md`) est stockée dans `state.localImages[id]` et affichée dans l'éditeur sous la forme d'un composant graphique non-éditable (`<span class="image-cartouche" contenteditable="false">[image]</span>`) occupant 2 lignes de hauteur (`height: calc(2 * 1.65em)`). L'utilisateur peut sélectionner cet objet graphique comme du texte (au clic ou par sélection glissée) et appuyer sur `Suppr` (`Delete`) ou `Backspace` pour supprimer l'objet et l'image associée (`handleCartoucheDeletion`).
2. **Formatage Syntaxique en Direct Non-WYSIWYG (`setEditorContent` / `buildFormattedTextNodes` / `buildTableBlockRowSpans`)** :
   - **Invariant de sélection (`1 caractère = 1 unité`, `1 cartouche = 1 unité`)** : Toutes les balises Markdown restent visibles dans `#mdEditor`, ce qui permet à `getEditorSelectionOffsets()` et `restoreEditorSelectionOffsets()` de préserver la position exacte du curseur lors de la frappe. Un élément `<br data-sentinel="true">` (`ensureTrailingSentinel`) garantit la prise en compte immédiate d'un seul appui sur `Entrée` en fin de document.
   - **Blocs et lignes** : Titres `#` à `#####` (`.md-h1` à `.md-h5`), listes `-`, `*`, `1.` et listes de tâches `- [ ]` / `- [x]` décalées de `5ch` par niveau d'imbrication (`Tab` / `Shift+Tab`), blocs de code ` ``` ... ``` `, citations `> ...`, séparateurs `---` et alignement visuel automatique des colonnes de tableaux `| ... |` en grille via CSS (`min-width` en `ch`).
   - **Styles inline récursifs** : Code inline (`` `code` ``), liens (`[libellé](url)`), gras-italique (`***texte***`), gras (`**texte**`), souligné (`__texte__` et `<u>texte</u>`), barré (`~~texte~~`) et italique (`*texte*` et `_texte_`).
3. **Résolution Base64, Rastérisation Office et Nettoyage Mémoire (`resolveImagePaths` / `ensureOfficeCompatibleImage` / `pruneUnusedLocalImages`)** : Convertit les cartouches `[image]` vers leur syntaxe Markdown Base64 complète (`![alt](data:image/...;base64,...)`) lors de la prévisualisation, de la sauvegarde `.md` et des exports HTML, DOCX et PPTX, rastérise automatiquement les images `.svg` et `.webp` en `image/png` via `<canvas>` pour Word et PowerPoint, et purge les images Base64 orphelines.
4. **Normalisation et Validation (`normalizeMarkdown` / `validateOutputConfig`)** : Répare automatiquement les tableaux Markdown, garantit les sauts de ligne autour des tableaux, ajoute des espaces insécables devant `€` et valide la structure des fichiers `output_config.json` personnalisés.

---

## 5. Moteurs d'Export Multi-Formats

- **Export HTML Autonome (`HtmlGenerator.js`)** : Produit un fichier `.html` unique intégrant la feuille de style CSS (Rapport A4 ou Diaporama 16:9), le bandeau supérieur (`Sommaire`, titre, date, `Imprimer`), le sommaire (latéral en rapport ou tiroir escamotable en slide avec `ScrollSpy`) et le script autonome sans dépendance réseau.
- **Export Word (`DocxGenerator.js`)** : Construit les paragraphes, titres, listes, tableaux, blocs de code (fond grisé, bordure gauche, police `Consolas`, sauts de ligne `break: 1`), citations, séparateurs et images (`ImageRun`) via `docx` (avec styles inline récursifs via `MarkdownParser.js`), puis injecte le corps XML et les relations médias dans `templateBuffer` via `JSZip`.
- **Export PowerPoint (`PptxGenerator.js` & `PptxSlideBuilders.js`)** : Découpe le document en diapositives (`#` Couverture, `##` Chapitre, `###` Contenu) et génère les textes, listes, blocs de code, citations, séparateurs, tableaux et images Base64 selon les masques définis dans `output_config.json`.

---

## 6. Page de Paramétrage des Styles de Balises (`StyleSettingsManager.js`)

L'application intègre une page interactive plein écran permettant de personnaliser finement l'apparence des documents sans manipulation de code :
- **Bascule de mode** : Personnalisation distincte pour la **Vision Rapport (Word)** et la **Vision Slide (PowerPoint)**.
- **Typologies de balises configurables** :
  - Titre principal et titres 1 à 4 (police, taille, couleur).
  - Corps de texte (`p`, `li`) et liens hypertextes (`a`).
  - Cartouches de données métriques 5x (`> [!data]`) : valeur agrandie, liseré supérieur et légende.
  - Encarts d'alerte et recommandations (`[!note]`, `[!tip]`, `[!warning]`, `[!danger]`, `[!important]`).
  - Citations (`blockquote`), code inline et blocs de code (`pre`, `code`).
  - Tableaux Markdown (en-têtes, cellules, alternance de rangées, bordures).
  - Arrière-plans de scène et conteneurs de page.
- **Aperçu en direct (*Live Preview*)** : Un panneau latéral affiche instantanément le rendu d'un échantillon complet de balises au fur et à mesure des modifications.
- **Actions disponibles** : Application en temps réel, export du fichier CSS (`.css`), réinitialisation aux chartes officielles et persistance locale via `IndexedDB`.

