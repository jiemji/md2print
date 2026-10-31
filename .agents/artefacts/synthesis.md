# Synthèse du Projet — md2print

> **Version : 1.2.0** — Dernière mise à jour : 2026-10-31

---

## 1. Description du Projet

**md2print** est une application web monopage (SPA) développée en HTML5, CSS3 Vanilla et JavaScript ES6+ modulaire permettant de lister, éditer et sauvegarder des fichiers Markdown (`.md`) sur la moitié gauche de l'écran, de prévisualiser le rendu formaté en temps réel sur la moitié droite (`iframe`), et d'exporter le document vers trois formats autonomes : **HTML (`.html`)**, **Word (`.docx`)** et **PowerPoint (`.pptx`)**.

---

## 2. Fonctionnalités Clés

- **Gestion des fichiers, dossiers et persistance IndexedDB (F1)** : ouverture unitaire, ouverture de dossier avec liste déroulante des fichiers `.md`, création d'un nouveau fichier avec alerte si modifié (`isDirty`), sauvegarde par téléchargement classique (`Sauvegarder` ou `Ctrl+S`), et persistance automatique du brouillon, des images Base64 et des préférences UI dans `IndexedDB` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js).
- **Éditeur Markdown non-WYSIWYG enrichi (F2)** : moteur dédié [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) sur `<div id="mdEditor" contenteditable="true">` conservant toutes les balises Markdown visibles tout en appliquant leur formatage visuel en temps réel (titres `#` à `#####`, gras, souligné, italique, barré, code inline, liens, blocs de code, citations, séparateurs, listes à puces/numérotées/tâches décalées de 5 caractères par niveau d'imbrication, alignement automatique des colonnes de tableaux en grille CSS, et objets graphiques `.image-cartouche` sur 2 lignes de hauteur).
- **Aperçu temps réel `iframe` avec `debounce` et Export HTML autonome (F3 & F4)** : rendu fidèle en mode **Rapport** continu ou **Slide** présentation (rafraîchissement débouncé à `120 ms` lors de la frappe), bandeau supérieur sobre, sommaire latéral repliable avec `ScrollSpy`, coloration syntaxique `highlight.js`.
- **Exports Word `.docx` et PowerPoint `.pptx` avec styles inline récursifs (F5 & F6)** : chargement par défaut (et personnalisable avec validation structurelle via le menu `Configuration`) de `output_config.json` et `Modele_word.docx`, support des titres, listes, tableaux, images Base64 et styles inline combinés/imbriqués.
- **Charte graphique sobre sans émoji ni icône (F7)** : interface 100 % textuelle proposant deux thèmes CSS : **Mode Sombre (Bleu foncé et gris)** par défaut et **Mode Clair (Sépia)**.

---

## 3. Structure des Fichiers

| Fichier | Rôle |
|---|---|
| [`index.html`](file:///g:/devapps/md2print/index.html) | Structure HTML5 de la SPA (barre de menu supérieure, split-view 50/50 redimensionnable) |
| [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) | Feuille de style CSS3 avec variables pour les thèmes Sombre (Bleu/Gris) et Clair (Sépia) |
| [`js/app.js`](file:///g:/devapps/md2print/js/app.js) | Orchestrateur principal (état, persistance `IndexedDB`, fichiers/dossiers, raccourcis, resizer, scroll sync, exports) |
| [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) | Moteur de l'éditeur non-WYSIWYG (`contenteditable`, offsets de curseur, cartouches image, tableaux en grille CSS) |
| [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) | Service de persistance locale haute capacité `IndexedDB` (`md2print_db` : brouillon, images Base64 et préférences) |
| [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) | Fonctions utilitaires, normalisation Markdown, validation JSON et résolution/purge d'images Base64 |
| [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) | Parseur Markdown vers AST structuré et extraction récursive des styles inline pour DOCX et PPTX |
| [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) | Générateur du document HTML autonome (Rapport & Slide, Sommaire repliable, ScrollSpy) |
| [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) | Générateur Word `.docx` avec injection dans le modèle Word et transfert des images |
| [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) | Générateur PowerPoint `.pptx` par découpage de sections |
| `vendor/` | Bibliothèques locales (`marked.min.js`, `highlight.min.js`, `docx.umd.js`, `pptxgen.bundle.js`, `jszip.min.js`) |
| `docs/` | `CAHIER_DES_CHARGES.md`, `CHANGELOG.md` et `PROJECT_KNOWLEDGE.md` |

---

## 4. Dernières Améliorations (v1.2.0)

1. **Extraction du moteur d'édition dans [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js)** : séparation nette entre l'orchestrateur SPA (`js/app.js`) et la mécanique DOM `contenteditable`.
2. **Persistance `localStorage` et nettoyage mémoire (`pruneUnusedLocalImages`)** : sauvegarde automatique du brouillon (`md2print_draft_v1`) et des préférences (`md2print_prefs_v1`), et purge des images Base64 orphelines.
3. **Parsing inline récursif dans [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js)** : alignement des exports Word et PowerPoint avec l'éditeur et le HTML pour les styles imbriqués (`***`, `**`, `__`, `<u>`, `~~`, `*`, `_`, `` ` ``, `[...](...)`).
4. **Debounce de l'aperçu `iframe` (`120 ms`) et validation structurelle de `output_config.json` (`validateOutputConfig`)**.

---

## 5. Statut du Code

- **État global** : Version 1.2.0 livrée, modulaire (8 modules ES6), 100 % hors-ligne, conforme aux directives d'interface (zéro émoji, zéro icône).
