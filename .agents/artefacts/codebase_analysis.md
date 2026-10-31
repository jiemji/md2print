# Rapport d'Analyse — md2print

> Généré le 31 octobre 2026 — Version 1.2.0 (réf. [`docs/CHANGELOG.md`](file:///g:/devapps/md2print/docs/CHANGELOG.md))

## 1. Fiche d'Identité

| Propriété | Valeur |
|-----------|--------|
| **Type** | Webapp SPA (Single Page Application) 100 % client-side et hors-ligne |
| **Stack** | HTML5, CSS3 Vanilla (Variables CSS), JavaScript ES6+ (ES Modules natifs) |
| **Version** | `1.2.0` ([`docs/CHANGELOG.md`](file:///g:/devapps/md2print/docs/CHANGELOG.md), [`docs/PROJECT_KNOWLEDGE.md`](file:///g:/devapps/md2print/docs/PROJECT_KNOWLEDGE.md)) |
| **Taille estimée** | 9 modules JS (**4 871 lignes** / 153,9 Ko) + 1 fichier CSS (**586 lignes** / 12,1 Ko) + [`index.html`](file:///g:/devapps/md2print/index.html) (**106 lignes**) |
| **Build system** | Non — exécution directe via serveur HTTP statique local (`<script type="module">`) |
| **Tests** | Non — aucun framework automatisé (validation manuelle conformément à [`.agents/rules/ui-guidelines.md`](file:///g:/devapps/md2print/.agents/rules/ui-guidelines.md)) |
| **Persistance** | `IndexedDB` (`md2print_db` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js)) + singleton `state` en mémoire + sauvegarde par téléchargement `.md` (`Blob`) |
| **Point d'entrée** | [`index.html`](file:///g:/devapps/md2print/index.html#L104) → [`js/app.js`](file:///g:/devapps/md2print/js/app.js) |

---

## 2. Architecture

### Diagramme

```mermaid
graph TD
    HTML["index.html<br/>Structure SPA Split-View"] --> CSS["css/styles.css<br/>Thèmes Dark & Sepia (586 l.)"]
    HTML --> VENDOR["vendor/<br/>marked, highlight, jszip, docx, pptxgen"]
    HTML --> APP["js/app.js<br/>Contrôleur SPA, Persistance & Événements (1 047 l.)"]

    APP --> CFG["config/output_config.json<br/>Configuration DOCX & PPTX"]
    APP --> TPL["templates/Modele_word.docx<br/>Modèle OpenXML Word"]

    APP --> EDITOR["js/EditorEngine.js<br/>Moteur Éditeur Non-WYSIWYG & Cartouches (877 l.)"]
    APP --> STORAGE["js/StorageService.js<br/>Persistance IndexedDB Brouillon & Images (225 l.)"]
    APP --> UTILS["js/utils.js<br/>Helpers, Images Base64, Validation & Normalisation (416 l.)"]
    APP --> HTMLGEN["js/HtmlGenerator.js<br/>Aperçu Iframe & Export HTML autonome (992 l.)"]
    APP --> DOCXGEN["js/DocxGenerator.js<br/>Export Word & Injection XML (368 l.)"]
    APP --> PPTXGEN["js/PptxGenerator.js<br/>Export PowerPoint par sections (231 l.)"]

    EDITOR --> UTILS
    HTMLGEN --> UTILS
    DOCXGEN --> UTILS
    DOCXGEN --> PARSER["js/MarkdownParser.js<br/>Parseur Markdown -> AST récursif (357 l.)"]
    PPTXGEN --> UTILS
    PPTXGEN --> SLIDES["js/PptxSlideBuilders.js<br/>Constructeurs de slides & masters (332 l.)"]
    SLIDES --> PARSER
```

### Description des couches

1. **Couche Présentation ([`index.html`](file:///g:/devapps/md2print/index.html) + [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css))**
   - **Responsabilité** : Structure visuelle Split-View (50 % éditeur à gauche / 50 % aperçu `iframe` à droite, redimensionnable de 20 % à 80 %), barre d'outils supérieure 100 % textuelle (zéro icône, zéro émoji), système de thèmes Sombre (`data-theme="dark"`) et Clair Sépia (`data-theme="sepia"`).
   - **Fichiers clés** : [`index.html`](file:///g:/devapps/md2print/index.html#L18-L101), [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css#L7-L586).

2. **Couche Orchestration & Persistance ([`js/app.js`](file:///g:/devapps/md2print/js/app.js))**
   - **Responsabilité** :
     - Gestion de l'état global singleton [`state`](file:///g:/devapps/md2print/js/app.js#L35-L49) et du cache DOM [`dom`](file:///g:/devapps/md2print/js/app.js#L52-L94).
     - Persistance automatique et restauration depuis `localStorage` du brouillon courant (`md2print_draft_v1`) et des préférences d'interface (`md2print_prefs_v1`) via [`restoreFromStorage()`](file:///g:/devapps/md2print/js/app.js#L186-L233), [`saveDraftToStorage()`](file:///g:/devapps/md2print/js/app.js#L139-L169) et [`savePreferencesToStorage()`](file:///g:/devapps/md2print/js/app.js#L122-L133).
     - Chargement initial par `fetch()` de [`config/output_config.json`](file:///g:/devapps/md2print/config/output_config.json) et [`templates/Modele_word.docx`](file:///g:/devapps/md2print/templates/Modele_word.docx) via [`loadDefaultConfigAndTemplate()`](file:///g:/devapps/md2print/js/app.js#L239-L262).
     - Rafraîchissement de l'aperçu `iframe` avec `debounce` de `120 ms` lors de la frappe ([`schedulePreviewUpdate()`](file:///g:/devapps/md2print/js/app.js#L814-L820)) et synchronisation bidirectionnelle du défilement en mode `report`.
   - **Dépendances** : [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js), [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js), [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js), [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js), [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js).

3. **Couche Moteur d'Édition Non-WYSIWYG ([`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js))**
   - **Responsabilité** :
     - Maintien de l'invariant `1 caractère = 1 unité`, `1 cartouche .image-cartouche = 1 unité` et `sentinelle <br data-sentinel="true"> = 0 unité` ([`getNodeUnitLength()`](file:///g:/devapps/md2print/js/EditorEngine.js#L69-L83), [`getEditorSelectionOffsets()`](file:///g:/devapps/md2print/js/EditorEngine.js#L144-L157), [`restoreEditorSelectionOffsets()`](file:///g:/devapps/md2print/js/EditorEngine.js#L232-L247)).
     - Formatage syntaxique en direct sans masquer les délimiteurs ([`buildFormattedTextNodes()`](file:///g:/devapps/md2print/js/EditorEngine.js#L264-L369), [`setEditorContent()`](file:///g:/devapps/md2print/js/EditorEngine.js#L533-L702)) : titres `#` à `#####`, gras, souligné, italique, barré, code inline, liens, blocs de code, citations, listes décalées de `5ch` par niveau, alignement des colonnes de tableaux en grille CSS ([`buildTableBlockRowSpans()`](file:///g:/devapps/md2print/js/EditorEngine.js#L423-L494)) et objets graphiques `.image-cartouche` sur 2 lignes de hauteur.

4. **Couche Utilitaires, Normalisation & Validation ([`js/utils.js`](file:///g:/devapps/md2print/js/utils.js))**
   - **Responsabilité** : Lecture de fichiers (`FileReader`), téléchargement `Blob`, transformation des images Base64 en jetons `[image : alt (img-X)]` ([`collapseBase64ToCartouches`](file:///g:/devapps/md2print/js/utils.js#L176-L186)), réinjection Base64 ([`resolveImagePaths`](file:///g:/devapps/md2print/js/utils.js#L195-L230)), purge des images Base64 orphelines ([`pruneUnusedLocalImages`](file:///g:/devapps/md2print/js/utils.js#L389-L410)), réparation automatique des tableaux Markdown ([`normalizeMarkdown`](file:///g:/devapps/md2print/js/utils.js#L237-L345)) et validation structurelle de `output_config.json` ([`validateOutputConfig`](file:///g:/devapps/md2print/js/utils.js#L352-L380)).

5. **Couche Parsing AST & Moteurs d'Export**
   - **AST ([`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js))** : Parseur de blocs [`parseToAST()`](file:///g:/devapps/md2print/js/MarkdownParser.js#L195-L352) et analyseur récursif de styles inline [`extractInlineStyles()`](file:///g:/devapps/md2print/js/MarkdownParser.js#L30-L136) prenant en charge l'imbrication (`**gras et *italique***`, `***gras+italique***`, `__souligné__`, `<u>souligné</u>`, `~~barré~~`, `` `code` ``, `[libellé](url)`).
   - **HTML ([`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js))** : Génère via [`generateStandaloneHTML()`](file:///g:/devapps/md2print/js/HtmlGenerator.js#L168-L992) un document HTML5 autonome (thème Azur, sommaire repliable `H1`-`H3`, `ScrollSpy`, modes Rapport et Slide).
   - **Word ([`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js))** : Génère le `.docx` via `window.docx` et l'injecte dans `Modele_word.docx` via `window.JSZip` ([`injectIntoTemplate()`](file:///g:/devapps/md2print/js/DocxGenerator.js#L244-L307)).
   - **PowerPoint ([`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js))** : Découpe le Markdown par sections `##` et construit les diapositives selon les masques de `output_config.json`.

---

## 3. Flux de Données

```mermaid
sequenceDiagram
    actor User as Utilisateur
    participant Editor as EditorEngine.js (#mdEditor)
    participant App as app.js (state + localStorage)
    participant Utils as utils.js
    participant Preview as HtmlGenerator.js / Iframe
    participant Office as DocxGenerator / PptxGenerator

    User->>Editor: Frappe clavier / Collage image / Ouverture .md
    Editor->>App: input / paste / drop -> syncFromEditorDOM()
    App->>Editor: serializeEditorToMarkdown(dom.mdEditor) -> state.markdown
    App->>Editor: setEditorContent(..., preserveCaret = true)
    App->>App: schedulePreviewUpdate(120ms) + scheduleDraftSave(300ms)
    App->>Utils: pruneUnusedLocalImages() -> localStorage.setItem('md2print_draft_v1')
    App->>Preview: generateStandaloneHTML(state.markdown, { docTitle, viewMode, localImages })
    Preview->>Utils: resolveImagePaths() + normalizeMarkdown()
    Preview-->>App: Document HTML complet -> iframe.contentDocument.write(html)

    User->>App: Clic sur Sauvegarder (Ctrl+S) ou Exporter (HTML / DOCX / PPTX)
    App->>Utils: pruneUnusedLocalImages() + resolveImagePaths(state.markdown, state.localImages)
    alt Sauvegarde .md
        App->>Utils: downloadBlob(fullMarkdown, fileName)
    else Export DOCX ou PPTX
        App->>Office: generateDocx() ou generatePptx()
        Office->>Utils: resolveImagePaths() + normalizeMarkdown()
        Office-->>App: Blob (.docx ou .pptx)
        App->>Utils: downloadBlob(blob, filename)
    end
```

---

## 4. Conventions du Projet

> [!IMPORTANT]
> Respecter ces conventions ainsi que les règles de `.agents/rules/` pour toute future intervention.

| Aspect | Convention |
|--------|-----------|
| **Nommage variables & fonctions** | `camelCase` strict (`state`, `initDomRefs`, `serializeEditorToMarkdown`), constantes figées en `UPPER_SNAKE_CASE` (`DEFAULT_FORMAT`, `STORAGE_KEY_DRAFT`) |
| **Nommage fichiers** | `PascalCase.js` pour les moteurs spécialisés (`EditorEngine.js`, `DocxGenerator.js`, `MarkdownParser.js`), `camelCase.js` pour l'orchestrateur et les utilitaires (`app.js`, `utils.js`) |
| **Modules** | ES Modules natifs (`import { ... } from './...'` / `export`) sans bundler |
| **Exports** | Named exports exclusivement (`export const`, `export function`, `export async function`) |
| **Async** | `async/await` systématique avec `Promise` encapsulant `FileReader` et `Image.onload`, plus [`yieldToMain()`](file:///g:/devapps/md2print/js/utils.js#L103) pour ne pas bloquer l'UI |
| **Erreurs** | `try/catch` avec notification utilisateur via [`showToast(msg, 'error')`](file:///g:/devapps/md2print/js/app.js#L1032-L1047) dans l'UI, et repli gracieux sur `localStorage` |
| **Commentaires** | JSDoc complète en français (`@param`, `@returns`) au-dessus de chaque fonction |
| **CSS** | Variables CSS thématiques (`:root`, `[data-theme="dark"]`, `[data-theme="sepia"]`), Flexbox/Grid, nomenclature descriptive et variantes BEM (`.toast--error`, `.toast--success`) |
| **Politique UI** | **Zéro icône, zéro émoji** dans toute l'interface et les documents générés ([`.agents/rules/ui-guidelines.md`](file:///g:/devapps/md2print/.agents/rules/ui-guidelines.md)) |

### Patterns Architecturaux Identifiés

- **Singleton d'état centralisé avec persistance `localStorage` résiliente** : Objet `state` dans [`js/app.js`](file:///g:/devapps/md2print/js/app.js#L35-L49) synchronisé automatiquement vers `localStorage` avec repli sans images si le quota navigateur (~5 Mo) est atteint.
- **Invariant d'unités de sélection DOM (`contenteditable`)** : Dans [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js#L69-L247), chaque caractère texte ou `<br>` vaut `1` unité, chaque `<span class="image-cartouche">` vaut `1` unité, et la sentinelle `<br data-sentinel="true">` vaut `0` unité.
- **Substitution de jeton et Garbage Collection (`localImages`)** : Les chaînes Base64 sont remplacées dans l'éditeur par `[image : alt (img-X)]` ([`collapseBase64ToCartouches`](file:///g:/devapps/md2print/js/utils.js#L176-L186)) et les entrées `img-X` supprimées sont purgées automatiquement via [`pruneUnusedLocalImages()`](file:///g:/devapps/md2print/js/utils.js#L389-L410).
- **Debounce de rendu Iframe** : [`schedulePreviewUpdate(120)`](file:///g:/devapps/md2print/js/app.js#L814-L820) découple le formatage immédiat de `#mdEditor` de la réécriture complète de l'`iframe`.

---

## 5. Dépendances Clés

Toutes les bibliothèques tierces sont **vendored** dans `vendor/` et chargées globalement via `<script>` dans [`index.html`](file:///g:/devapps/md2print/index.html#L11-L15) pour garantir un fonctionnement 100 % hors-ligne :

| Dépendance | Fichier | Variable Globale | Rôle | Type |
|-----------|---------|------------------|------|------|
| **Marked.js** | `vendor/marked.min.js` (39,9 Ko) | `window.marked` | Parsing Markdown GFM vers HTML avec renderers personnalisés dans [`HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js#L51-L157) | Vendored |
| **Highlight.js** | `vendor/highlight.min.js` (121,7 Ko) | `window.hljs` | Coloration syntaxique des blocs de code dans l'aperçu et l'export HTML | Vendored |
| **JSZip** | `vendor/jszip.min.js` (97,6 Ko) | `window.JSZip` | Ouverture, modification XML/médias et recompression du modèle OpenXML `.docx` | Vendored |
| **docx** | `vendor/docx.umd.js` (808,2 Ko) | `window.docx` | Génération orientée objet des paragraphes, tableaux et `ImageRun` Word | Vendored |
| **PptxGenJS** | `vendor/pptxgen.bundle.js` (460,9 Ko) | `window.PptxGenJS` | Génération de présentations PowerPoint `.pptx` (formes, textes, tableaux, images) | Vendored |

---

## 6. Points d'Attention

> [!WARNING]
> Zones de vigilance à garder à l'esprit lors des évolutions futures.

### Dette Technique
- Aucun marqueur `TODO`, `FIXME`, `HACK` ou `console.log` n'est présent dans le code source actif (`js/`, `css/`, `index.html`).
- Le dossier `référence/` (contenant les anciens projets `md2html` et `md2office`) reste présent à titre d'archive : **ne jamais importer ni modifier les fichiers de `référence/`**.

### Zones Sensibles
1. **Invariant de sélection dans [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js#L69-L247)** :
   - Toute évolution de [`setEditorContent()`](file:///g:/devapps/md2print/js/EditorEngine.js#L533-L702) ou [`buildFormattedTextNodes()`](file:///g:/devapps/md2print/js/EditorEngine.js#L264-L369) doit conserver le nombre exact de caractères du texte Markdown source afin que [`getEditorSelectionOffsets()`](file:///g:/devapps/md2print/js/EditorEngine.js#L144-L157) et [`restoreEditorSelectionOffsets()`](file:///g:/devapps/md2print/js/EditorEngine.js#L232-L247) restent exacts au caractère près.
2. **Cohérence entre les 3 moteurs Markdown** :
   - Les règles inline sont alignées entre [`EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js#L264-L369), [`HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js#L51-L157) et [`MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js#L30-L136) ; toute nouvelle balise Markdown doit être ajoutée dans ces trois modules.

---

## 7. Score de Maintenabilité

| Critère | Score | Justification |
|---------|-------|---------------|
| **Lisibilité** | 5/5 | Code moderne ES6+, nommage explicite, fonctions bien découpées et JSDoc complète en français. |
| **Séparation des responsabilités** | 5/5 | Orchestration (`app.js`), moteur d'éditeur (`EditorEngine.js`), utilitaires (`utils.js`), parseur AST (`MarkdownParser.js`) et moteurs d'export (`HtmlGenerator.js`, `DocxGenerator.js`, `PptxGenerator.js`) sont chacun isolés dans leur module. |
| **Cohérence des conventions** | 5/5 | Respect intégral des règles ES6+, CSS variables et de la politique zéro icône / zéro émoji. |
| **Documentation** | 5/5 | Documentation complète et synchronisée (`CAHIER_DES_CHARGES.md`, `PROJECT_KNOWLEDGE.md`, `CHANGELOG.md`, `codebase_analysis.md`, JSDoc sur 100 % des fonctions). |
| **Testabilité** | 4/5 | Les fonctions de `utils.js`, `MarkdownParser.js` et `EditorEngine.js` sont découplées de l'état global et paramétrées explicitement (validation manuelle selon la politique du projet). |
| **Extensibilité** | 5/5 | Architecture modulaire prête pour l'ajout de nouveaux formats d'export ou de nouveaux thèmes CSS. |

---

## 8. Guide d'Intervention Rapide

### Pour ajouter une feature
1. **Nouvelle syntaxe Markdown** :
   - Mettre à jour la colorisation non-WYSIWYG dans [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) ([`buildFormattedTextNodes`](file:///g:/devapps/md2print/js/EditorEngine.js#L264-L369) ou [`setEditorContent`](file:///g:/devapps/md2print/js/EditorEngine.js#L533-L702)) **en respectant strictement l'invariant `1 caractère = 1 unité`**.
   - Mettre à jour le renderer Marked.js dans [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js#L51-L157).
   - Mettre à jour [`extractInlineStyles`](file:///g:/devapps/md2print/js/MarkdownParser.js#L30-L136) ou [`parseToAST`](file:///g:/devapps/md2print/js/MarkdownParser.js#L195-L352) dans [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js).
2. **Nouveau moteur d'export** :
   - Créer `js/MonFormatGenerator.js` sur le modèle de [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) (appeler `resolveImagePaths` puis `normalizeMarkdown` en entrée).
   - Ajouter le bouton dans `#dropdownExport` de [`index.html`](file:///g:/devapps/md2print/index.html#L63-L71), référencer l'élément dans [`initDomRefs()`](file:///g:/devapps/md2print/js/app.js#L58-L94) et attacher l'écouteur dans [`initEventListeners()`](file:///g:/devapps/md2print/js/app.js#L645-L648).

### Pour corriger un bug
1. **Bug de curseur ou de saisie dans l'éditeur** :
   - Inspecter [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) (`serializeEditorToMarkdown`, `getNodeUnitLength`, `getPointOffset`, `findDomPosition`, `ensureTrailingSentinel`).
2. **Bug de rendu sur les tableaux ou images** :
   - Vérifier [`resolveImagePaths()`](file:///g:/devapps/md2print/js/utils.js#L195-L230), [`pruneUnusedLocalImages()`](file:///g:/devapps/md2print/js/utils.js#L389-L410) et [`normalizeMarkdown()`](file:///g:/devapps/md2print/js/utils.js#L237-L345) dans [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js).
3. **Validation** :
   - Ne lancer aucun serveur de test ([`.agents/rules/ui-guidelines.md`](file:///g:/devapps/md2print/.agents/rules/ui-guidelines.md)) ; lister les étapes de vérification manuelle pour l'utilisateur.

---

## 9. Checklist Pré-Intervention

- [ ] J'ai lu et compris l'architecture du projet (`PROJECT_KNOWLEDGE.md` & `codebase_analysis.md`)
- [ ] J'ai identifié les modules impactés par mon changement (et vérifié si les 3 pipelines Markdown `EditorEngine.js`, `HtmlGenerator.js`, `MarkdownParser.js` doivent évoluer ensemble)
- [ ] Je respecte les conventions du projet (`camelCase`, ES6+, JSDoc en français, variables CSS)
- [ ] Je respecte strictement la directive UI : **zéro icône, zéro émoji** et je ne lance aucun serveur de test
- [ ] J'ai vérifié que l'invariant de sélection de `#mdEditor` (`1 caractère = 1 unité`, `1 cartouche = 1 unité`, sentinelle `<br data-sentinel="true"> = 0 unité`) est préservé
- [ ] Je ne touche pas au dossier `référence/` et je ne mélange pas refactoring et ajout de feature
