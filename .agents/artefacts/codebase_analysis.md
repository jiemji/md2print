# Rapport d'Analyse — md2print

> Généré le 1er novembre 2026 — Version 1.4.0 (réf. [`docs/CHANGELOG.md`](file:///g:/devapps/md2print/docs/CHANGELOG.md))

## 1. Fiche d'Identité

| Propriété | Valeur |
|-----------|--------|
| **Type** | Webapp SPA (Single Page Application) 100 % client-side et hors-ligne |
| **Stack** | HTML5, CSS3 Vanilla (Variables CSS), JavaScript ES6+ (ES Modules natifs), IndexedDB |
| **Version** | `1.4.0` ([`docs/CHANGELOG.md`](file:///g:/devapps/md2print/docs/CHANGELOG.md), [`docs/PROJECT_KNOWLEDGE.md`](file:///g:/devapps/md2print/docs/PROJECT_KNOWLEDGE.md)) |
| **Taille estimée** | 12 modules JS + 3 feuilles CSS (`styles.css`, `report.css`, `slide.css`) + [`index.html`](file:///g:/devapps/md2print/index.html) |
| **Build system** | Non — exécution directe via navigateur web / protocole local `file:///` (`<script type="module">`) |
| **Tests** | Non — aucun framework automatisé (validation manuelle conformément à [`.agents/rules/ui-guidelines.md`](file:///g:/devapps/md2print/.agents/rules/ui-guidelines.md)) |
| **Persistance** | `IndexedDB` (`md2print_db` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js)) + singleton `state` en mémoire + sauvegarde par téléchargement `.md` (`Blob`) |
| **Point d'entrée** | [`index.html`](file:///g:/devapps/md2print/index.html) → [`js/app.js`](file:///g:/devapps/md2print/js/app.js) |

---

## 2. Architecture

### Diagramme

```mermaid
graph TD
    HTML["index.html<br/>Structure SPA Split-View & Page Styles"] --> CSS["css/styles.css, css/report.css, css/slide.css<br/>Thèmes Dark/Sepia, Styles Word/PPT"]
    HTML --> VENDOR["vendor/<br/>marked, highlight, mermaid, jszip, docx, pptxgen"]
    HTML --> APP["js/app.js<br/>Contrôleur SPA, Persistance & Événements"]

    APP --> CFG["config/output_config.json<br/>Configuration DOCX & PPTX"]
    APP --> TPL["templates/Modele_word.docx<br/>Modèle OpenXML Word"]
    APP --> PPTX_TPL["templates/Modele_presentation.potx<br/>Modèle OpenXML PowerPoint"]

    APP --> STYLEMGR["js/StyleSettingsManager.js<br/>Paramétrage des balises & Live Preview"]
    STYLEMGR --> DEFAULT_STYLES["js/defaultThemeStyles.js<br/>CSS embarqué hors-ligne (file:///)"]

    APP --> EDITOR["js/EditorEngine.js<br/>Moteur Éditeur Non-WYSIWYG, Image & Mermaid"]
    APP --> PLANNER["js/SlidePlanner.js<br/>Planificateur unifié de diapositives HTML & PPTX"]
    APP --> STORAGE["js/StorageService.js<br/>Persistance IndexedDB Brouillon, Images, Styles & Config"]
    APP --> UTILS["js/utils.js<br/>Helpers, Images, Mermaid PNG, Validation & Normalisation"]
    APP --> HTMLGEN["js/HtmlGenerator.js<br/>Aperçu Iframe & Export HTML autonome"]
    APP --> DOCXGEN["js/DocxGenerator.js<br/>Export Word & Injection XML"]
    APP --> PPTXGEN["js/PptxGenerator.js<br/>Export PowerPoint unifié"]

    EDITOR --> UTILS
    HTMLGEN --> UTILS
    HTMLGEN --> PLANNER
    HTMLGEN --> DEFAULT_STYLES
    DOCXGEN --> UTILS
    DOCXGEN --> PARSER["js/MarkdownParser.js<br/>Parseur Markdown -> AST récursif"]
    PPTXGEN --> UTILS
    PPTXGEN --> PLANNER
    PPTXGEN --> SLIDES["js/PptxSlideBuilders.js<br/>Constructeurs de slides & masques"]
    SLIDES --> PARSER
```

### Description des couches

1. **Couche Présentation ([`index.html`](file:///g:/devapps/md2print/index.html) + [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css))**
   - **Responsabilité** : Structure visuelle Split-View (éditeur gauche / aperçu `iframe` droit redimensionnable), page plein écran de paramétrage des styles de balises (`#pageStyleConfig`), barre d'outils supérieure 100 % textuelle (zéro icône, zéro émoji), thèmes Sombre et Clair Sépia, objets graphiques `.image-cartouche` et `.mermaid-cartouche`.
   - **Fichiers clés** : [`index.html`](file:///g:/devapps/md2print/index.html), [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css), [`css/report.css`](file:///g:/devapps/md2print/css/report.css), [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css).

2. **Couche Paramétrage des Styles & Thèmes ([`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js) + [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js))**
   - **Responsabilité** : Formulaire interactif organisant le réglage des couleurs, polices et tailles pour chaque type d'élément Markdown (titres, corps, métriques 5x, callouts, citations, code, tableaux, liens, arrière-plans) en Vision Rapport et Vision Slide. Panneau d'aperçu dynamique en direct (*Live Preview*), génération CSS dynamique, export `.css` et persistance `IndexedDB`.

3. **Couche Orchestration & Persistance ([`js/app.js`](file:///g:/devapps/md2print/js/app.js) + [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js))**
   - **Responsabilité** :
     - Gestion de l'état global singleton `state` et du cache DOM `dom`.
     - Persistance transactionnelle dans `IndexedDB` (`md2print_db`, stores `app_state` et `local_images`) du brouillon courant, des images Base64, des préférences d'interface (`theme`, `viewport`, `editorWidthPct`), des styles personnalisés et des configurations de balises.
     - Raccourcis clavier (`Ctrl+S` pour enregistrer, `Ctrl+M` pour insérer un diagramme Mermaid, `F8` pour basculer le défilement lié).
     - Rafraîchissement de l'aperçu `iframe` avec `debounce` lors de la frappe et synchronisation asymétrique du défilement en mode `report`.

4. **Couche Moteur d'Édition Non-WYSIWYG ([`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js))**
   - **Responsabilité** :
     - Maintien de l'invariant `1 caractère = 1 unité`, `1 cartouche = 1 unité` et `sentinelle = 0 unité`.
     - Cartouches `.image-cartouche` (hauteur 2 lignes) et `.mermaid-cartouche` vert interactif (replié par défaut avec flèche toggle `▼`/`▲`, zone de texte `<textarea>` éditable en mode déplié).
     - Formatage syntaxique en direct sans masquer les délimiteurs Markdown : titres `#` à `#####`, styles inline, blocs de code, citations, séparateurs `---`, listes décalées de `5ch` par niveau, et alignement automatique des colonnes de tableaux en grille CSS avec repli automatique (`max-width: 60ch`).

5. **Couche Planification de Diapositives ([`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js))**
   - **Responsabilité** :
     - Moteur commun de segmentation et de pagination pour la vue Diaporama HTML et l'export PowerPoint (`.pptx`).
     - Application uniforme des règles de découpage : diapositives de couverture (`#`), sections/chapitres (`##`), sous-titres (`###`), calcul de débordement vertical selon les dimensions du masque (`area.y + area.h`), et création systématique d'une nouvelle diapositive lors de la rencontre d'un séparateur horizontal `---`.

6. **Couche Utilitaires, Diagrammes & Rastérisation ([`js/utils.js`](file:///g:/devapps/md2print/js/utils.js))**
   - **Responsabilité** :
     - Lecture de fichiers, téléchargement `Blob`, normalisation Markdown, validation structurelle JSON.
     - Gestion des diagrammes Mermaid : rendu SVG asynchrone côté client (`renderMermaidBlocksMap`), rastérisation en PNG 2x haute résolution via `<canvas>` (`renderMermaidToPngDataUrl`), conversion des balises `foreignObject` en `<text>`/`<tspan>` SVG pour assurer la compatibilité avec `canvas.drawImage`.
     - Conversion SVG/WebP en PNG pour Office, conversion et purge des images Base64 orphelines.

7. **Couche Parsing AST & Moteurs d'Export**
   - **AST ([`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js))** : Parseur de blocs `parseToAST()` avec préservation de la chaîne `raw` et analyseur récursif de styles inline `extractInlineStyles()`.
   - **HTML ([`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js))** : Génère un document HTML5 autonome avec isolation stricte du DOM (Rapport centré A4 ou Diaporama 16:9), tiroir de sommaire escamotable avec fermeture automatique et raccourci <kbd>Échap</kbd>, ScrollSpy et cartouches métriques 5x.
   - **Word ([`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js))** : Génère le document `.docx` avec intégration des schémas Mermaid convertis en images haute définition, injection dans `Modele_word.docx` via `JSZip`.
   - **PowerPoint ([`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js))** : Génère la présentation `.pptx` pilotée par `SlidePlanner` avec rendu fidèle des diapositives, masques de contenu et diagrammes Mermaid intégrés.
