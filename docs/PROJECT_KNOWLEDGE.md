# md2print — Documentation Technique de Référence (PROJECT_KNOWLEDGE)

> **Version courante : 1.0.0** --- Mise à jour : 2026-10-25

---

## 1. Stack Technologique & Dépendances

| Élément | Description | Rôle |
|---|---|---|
| **HTML5 / CSS3** | Vanilla CSS avec variables CSS (`:root`, `[data-theme="dark"]`, `[data-theme="sepia"]`) | Structure Split-View et thèmes Sombre (Bleu/Gris) et Clair (Sépia) |
| **JavaScript ES6+** | Vanilla JS modulaire (`<script type="module">`) sans framework ni bundler | Logique applicative, gestion de l'état, parsing et génération multi-formats |
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
│  │ - <textarea id="mdEditor">    │◄─►│ - Mode Rapport / Mode Slide   │  │
│  │ - Drag & Drop .md / Images    │   │ - Sommaire repliable (TOC)    │  │
│  └───────────────┬───────────────┘   └───────────────▲───────────────┘  │
│                  │                                   │                  │
│                  ▼                                   │                  │
│           Objet `state` ────► `HtmlGenerator.js` ────┘                  │
│                  │                                                      │
│                  ├──────────► `HtmlGenerator.js` ──► Export .html       │
│                  ├──────────► `DocxGenerator.js` ──► Export .docx       │
│                  └──────────► `PptxGenerator.js` ──► Export .pptx       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fichiers Clés

- [`index.html`](file:///g:/devapps/md2print/index.html) : Conteneur principal de la SPA (barre de menu supérieure, éditeur gauche, séparateur central, aperçu `iframe` droit).
- [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) : Styles de l'interface, layout Flexbox 50/50 redimensionnable, thèmes Sombre (Bleu foncé et gris) et Clair (Sépia).
- [`js/app.js`](file:///g:/devapps/md2print/js/app.js) : Orchestrateur principal (état global, gestion des fichiers/dossiers `.md`, raccourcis clavier, synchronisation du défilement, redimensionnement et déclenchement des exports).
- [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) : Fonctions utilitaires (`toSlug`, `escapeHtml`, `extractTitle`, lecture de fichiers, `normalizeMarkdown`, `resolveImagePaths`, conversion d'images Base64).
- [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) : Parseur Markdown vers AST structuré pour les moteurs Word et PowerPoint.
- [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) : Générateur du document `.html` autonome (styles Azur, sommaire repliable, ScrollSpy, modes Rapport et Slide).
- [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) : Générateur Word `.docx` avec support des images Base64 et injection XML dans un modèle `.docx`.
- [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) : Générateur PowerPoint `.pptx` suivant le découpage par niveaux de titres.

---

## 3. Gestion de l'État Applicatif (`state`)

L'objet singleton `state` dans [`js/app.js`](file:///g:/devapps/md2print/js/app.js) centralise les données en mémoire :

```javascript
const state = {
  markdown: '',                                   // Contenu brut Markdown
  currentFileName: 'Sans titre.md',               // Nom du fichier actif
  isDirty: false,                                 // Indicateur de modifications non sauvegardées (*)
  folderFiles: [],                                // Liste des objets File (.md) du dossier ouvert
  selectedFolderIndex: '',                        // Index sélectionné dans la liste déroulante
  localImages: {},                                // Dictionnaire de correspondance des images Base64
  currentViewport: 'report',                      // Mode d'affichage : 'report' | 'slide'
  theme: 'dark',                                  // Thème UI : 'dark' | 'sepia'
  outputConfig: null,                             // Configuration JSON pour DOCX / PPTX
  configFileName: 'output_config.json (défaut)',  // Libellé de la configuration active
  templateBuffer: null,                           // ArrayBuffer du modèle Word (.docx)
  templateFileName: 'Modele_word.docx (défaut)',  // Libellé du modèle Word actif
};
```

---

## 4. Gestion des Images et Normalisation Markdown

1. **Glisser-Déposer et Collage (`Ctrl+V`)** : Toute image déposée ou collée dans `#mdEditor` est convertie en Data URL Base64 (`readFileAsDataURL`), stockée dans `state.localImages` et insérée sous la forme `![alt](data:image/...;base64,...)`.
2. **Résolution de chemins locaux (`resolveImagePaths`)** : Convertit les références `(data:image/...;chemin)` vers leur flux Base64 avant le rendu HTML, DOCX et PPTX.
3. **Normalisation (`normalizeMarkdown`)** : Répare automatiquement les tableaux Markdown dont le nombre de colonnes diffère entre l'en-tête, le séparateur et les lignes de données, garantit les sauts de ligne autour des tableaux et ajoute des espaces insécables devant `€`.

---

## 5. Moteurs d'Export

- **Export HTML Autonome (`HtmlGenerator.js`)** : Produit un fichier `.html` unique intégrant la feuille de style CSS (thème Azur clair), le bandeau supérieur (`Sommaire`, titre, date, `Imprimer`), le menu de navigation latéral repliable (`H1`, `H2`, `H3` avec `ScrollSpy`) et le script IIFE gérant les modes `report` et `slide`.
- **Export Word (`DocxGenerator.js`)** : Construit les paragraphes, titres, listes, tableaux et images (`ImageRun`) via `docx`, puis injecte le corps XML et les relations médias dans `templateBuffer` via `JSZip`.
- **Export PowerPoint (`PptxGenerator.js` & `PptxSlideBuilders.js`)** : Découpe le document en diapositives (`#` Couverture, `##` Chapitre, `###` Contenu) et génère les textes, listes, tableaux et images Base64 selon les masques définis dans `output_config.json`.
