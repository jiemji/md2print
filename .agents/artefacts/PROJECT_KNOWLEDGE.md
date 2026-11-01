# md2print — Documentation Technique de Référence (PROJECT_KNOWLEDGE)

> **Version courante : 1.2.0** --- Mise à jour : 2026-10-31

---

## 1. Stack Technologique & Dépendances

| Élément | Description | Rôle |
|---|---|---|
| **HTML5 / CSS3** | Vanilla CSS avec variables CSS (`:root`, `[data-theme="dark"]`, `[data-theme="sepia"]`) | Structure Split-View et thèmes Sombre (Bleu/Gris) et Clair (Sépia) |
| **JavaScript ES6+** | Vanilla JS modulaire (`<script type="module">`) sans framework ni bundler | Logique applicative, gestion de l'état, parsing et génération multi-formats |
| **IndexedDB** | API native du navigateur encapsulée dans [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) | Persistance locale haute capacité du brouillon, des images Base64, des préférences UI et des modèles personnalisés |
| **Marked.js** | `vendor/marked.min.js` | Parser Markdown vers HTML avec renderers personnalisés |
| **Highlight.js** | `vendor/highlight.min.js` | Coloration syntaxique des blocs de code dans l'aperçu et l'export HTML |
| **docx** | `vendor/docx.umd.js` | Génération de documents Microsoft Word (`.docx`) côté client |
| **PptxGenJS** | `vendor/pptxgen.bundle.js` | Génération de présentations Microsoft PowerPoint (`.pptx`) côté client |
| **JSZip** | `vendor/jszip.min.js` | Manipulation d'archives OpenXML pour l'injection dans le modèle Word `.docx` |

---

## 2. Architecture Globale

L'application est une SPA modulaire exécutée via un serveur HTTP local avec 100 % des dépendances embarquées localement.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        SPA md2print (index.html)                        │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Barre Supérieure : Fichier | Rapport/Slide | Config | Export | UI │  │
│  └───────────────┬───────────────────────────────────┬───────────────┘  │
│                  │                                   │                  │
│                  ▼                                   ▼                  │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │ Moitié Gauche : Éditeur (.md) │   │ Moitié Droite : Aperçu Iframe │  │
│  │ - <div id="mdEditor">         │◄─►│ - Mode Rapport / Mode Slide   │  │
│  │ - EditorEngine.js             │   │ - Sommaire repliable (TOC)    │  │
│  │ - Cartouches [image] (2 lig.) │   │ - Debounce 120 ms             │  │
│  └───────────────┬───────────────┘   └───────────────▲───────────────┘  │
│                  │                                   │                  │
│                  ▼                                   │                  │
│    Objet `state` + StorageService (IndexedDB) ──► `HtmlGenerator.js`    │
│                  │                                                      │
│                  ├──────────► `HtmlGenerator.js` ──► Export .html       │
│                  ├──────────► `DocxGenerator.js` ──► Export .docx       │
│                  └──────────► `PptxGenerator.js` ──► Export .pptx       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

- [`index.html`](file:///g:/devapps/md2print/index.html) : Conteneur principal de la SPA (barre de menu supérieure, éditeur gauche, séparateur central, aperçu `iframe` droit).
- [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) : Styles de l'interface, layout Flexbox 50/50 redimensionnable, thèmes Sombre (Bleu foncé et gris) et Clair (Sépia).
- [`js/app.js`](file:///g:/devapps/md2print/js/app.js) : Orchestrateur principal (état global, persistance `IndexedDB`, gestion des fichiers/dossiers `.md`, raccourcis clavier, synchronisation du défilement, `debounce` d'aperçu et déclenchement des exports).
- [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) : Moteur d'édition `contenteditable="true"` non-WYSIWYG (calcul et restauration des offsets de sélection, objets graphiques `.image-cartouche` de 2 lignes, alignement CSS des colonnes de tableaux, formatage syntaxique en direct).
- [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) : Service de persistance locale `IndexedDB` (`md2print_db`, stores `app_state` et `local_images`) stockant de manière atomique le brouillon Markdown, les images Base64, les préférences d'interface (`theme`, `viewport`, `editorWidthPct`) ainsi que les fichiers `output_config.json` et `Modele_word.docx` personnalisés.
- [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) : Fonctions utilitaires (`toSlug`, `escapeHtml`, `extractTitle`, lecture de fichiers, `normalizeMarkdown`, `resolveImagePaths`, `pruneUnusedLocalImages`, `validateOutputConfig`, `ensureOfficeCompatibleImage`, conversion d'images Base64).
- [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) : Parseur Markdown vers AST structuré avec extraction récursive des styles inline pour les moteurs Word et PowerPoint.
- [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) : Générateur du document `.html` autonome (styles Azur, sommaire repliable, ScrollSpy, modes Rapport et Slide).
- [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) : Générateur Word `.docx` avec support des images Base64 (incluant conversion automatique SVG/WebP en PNG), des blocs de code, citations, séparateurs et injection XML dans un modèle `.docx`.
- [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) : Générateur PowerPoint `.pptx` suivant le découpage par niveaux de titres avec habillage des blocs de code, citations, tableaux et images Base64.

---

## 3. Gestion de l'État Applicatif (`state`) & Persistance `IndexedDB`

L'objet singleton `state` dans [`js/app.js`](file:///g:/devapps/md2print/js/app.js) centralise les données en mémoire et se synchronise de manière transactionnelle avec la base `IndexedDB` `md2print_db` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) (`saveDraftState`, `savePreferences`, `saveCustomConfig`, `saveCustomTemplate`, `clearCustomConfigAndTemplate`, `loadPersistedState`) :

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

## 5. Moteurs d'Export

- **Export HTML Autonome (`HtmlGenerator.js`)** : Produit un fichier `.html` unique intégrant la feuille de style CSS (thème Azur clair), le bandeau supérieur (`Sommaire`, titre, date, `Imprimer`), le menu de navigation latéral repliable (`H1`, `H2`, `H3` avec `ScrollSpy`) et le script IIFE gérant les modes `report` et `slide`.
- **Export Word (`DocxGenerator.js`)** : Construit les paragraphes, titres, listes, tableaux, blocs de code (fond grisé, bordure gauche, police `Consolas`, sauts de ligne `break: 1`), citations, séparateurs et images (`ImageRun`) via `docx` (avec styles inline récursifs via `MarkdownParser.js`), puis injecte le corps XML et les relations médias dans `templateBuffer` via `JSZip`.
- **Export PowerPoint (`PptxGenerator.js` & `PptxSlideBuilders.js`)** : Découpe le document en diapositives (`#` Couverture, `##` Chapitre, `###` Contenu) et génère les textes, listes, blocs de code, citations, séparateurs, tableaux et images Base64 selon les masques définis dans `output_config.json`.
