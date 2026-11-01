# Synthèse du Projet — md2print

> **Version : 1.2.0** — Dernière mise à jour : 2026-10-31

---

## 1. Description du Projet

**md2print** est une application web monopage (SPA) développée en HTML5, CSS3 Vanilla et JavaScript ES6+ modulaire permettant de lister, éditer et sauvegarder des fichiers Markdown (`.md`) sur la moitié gauche de l'écran, de prévisualiser le rendu formaté en temps réel sur la moitié droite (`iframe`), et d'exporter le document vers trois formats autonomes : **HTML (`.html`)**, **Word (`.docx`)** et **PowerPoint (`.pptx`)**.

---

## 2. Fonctionnalités Clés

- **Gestion des fichiers, dossiers et persistance IndexedDB (F1)** : ouverture unitaire, ouverture de dossier avec liste déroulante des fichiers `.md`, création d'un nouveau fichier avec alerte si modifié (`isDirty`), sauvegarde par téléchargement classique (`Sauvegarder` ou `Ctrl+S`), et persistance automatique du brouillon, des images Base64, des préférences UI (thème, mode, largeur du séparateur) et des modèles personnalisés dans `IndexedDB` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js).
- **Éditeur Markdown non-WYSIWYG enrichi (F2)** : moteur dédié [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) sur `<div id="mdEditor" contenteditable="true">` conservant toutes les balises Markdown visibles tout en appliquant leur formatage visuel en temps réel (titres `#` à `#####`, gras, souligné, italique, barré, code inline, liens, blocs de code, citations, séparateurs, listes à puces/numérotées/tâches décalées de 5 caractères par niveau d'imbrication, alignement automatique des colonnes de tableaux en grille CSS, et objets graphiques `.image-cartouche` sur 2 lignes de hauteur).
- **Aperçu temps réel `iframe` avec `debounce` et Export HTML autonome (F3 & F4)** : rendu fidèle en mode **Rapport** continu ou **Slide** présentation (rafraîchissement débouncé à `120 ms` lors de la frappe), bandeau supérieur sobre, sommaire latéral repliable avec `ScrollSpy`, coloration syntaxique `highlight.js`.
- **Exports Word `.docx` et PowerPoint `.pptx` avec styles inline récursifs, habillage de blocs et conversion SVG/WebP (F5 & F6)** : chargement par défaut (et personnalisable avec persistance `IndexedDB`, validation structurelle et bouton `Réinitialiser par défaut` via le menu `Configuration`) de `output_config.json` et `Modele_word.docx`, support des titres, listes, tableaux, blocs de code, citations, séparateurs, images Base64 (avec rastérisation PNG automatique des formats `.svg` et `.webp`) et styles inline combinés/imbriqués.
- **Charte graphique sobre sans émoji ni icône (F7)** : interface 100 % textuelle proposant deux thèmes CSS : **Mode Sombre (Bleu foncé et gris)** par défaut et **Mode Clair (Sépia)**.

---

## 3. Structure des Fichiers

| Fichier | Rôle |
|---|---|
| [`index.html`](file:///g:/devapps/md2print/index.html) | Structure HTML5 de la SPA (barre de menu supérieure, split-view 50/50 redimensionnable) |
| [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) | Feuille de style CSS3 avec variables pour les thèmes Sombre (Bleu/Gris) et Clair (Sépia) |
| [`js/app.js`](file:///g:/devapps/md2print/js/app.js) | Orchestrateur principal (état, persistance `IndexedDB`, fichiers/dossiers, raccourcis, resizer, scroll sync, exports) |
| [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) | Moteur de l'éditeur non-WYSIWYG (`contenteditable`, offsets de curseur, cartouches image, tableaux en grille CSS) |
| [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) | Service de persistance locale haute capacité `IndexedDB` (`md2print_db` : brouillon, images Base64, préférences et modèles) |
| [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) | Fonctions utilitaires, normalisation Markdown, validation JSON, conversion SVG/WebP en PNG et résolution/purge d'images Base64 |
| [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) | Parseur Markdown vers AST structuré et extraction récursive des styles inline pour DOCX et PPTX |
| [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) | Générateur du document HTML autonome (Rapport & Slide, Sommaire repliable, ScrollSpy) |
| [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) | Générateur Word `.docx` avec injection dans le modèle Word et transfert des images |
| [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) | Générateur PowerPoint `.pptx` par découpage de sections |
| `vendor/` | Bibliothèques locales (`marked.min.js`, `highlight.min.js`, `docx.umd.js`, `pptxgen.bundle.js`, `jszip.min.js`) |
| `docs/` | `CAHIER_DES_CHARGES.md`, `CHANGELOG.md` et `PROJECT_KNOWLEDGE.md` |

---

## 4. Dernières Améliorations (v1.2.0)

1. **Extraction du moteur d'édition dans [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js)** : séparation nette entre l'orchestrateur SPA (`js/app.js`) et la mécanique DOM `contenteditable`.
2. **Persistance haute capacité via `IndexedDB` ([`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js)) et nettoyage mémoire (`pruneUnusedLocalImages`)** : sauvegarde transactionnelle du brouillon, des images Base64 (`local_images`), des préférences d'interface (incluant la position du séparateur central) et des fichiers `output_config.json` / `Modele_word.docx` personnalisés.
3. **Parsing inline récursif ([`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js)) et habillage complet Word/PowerPoint** : prise en charge des styles imbriqués (`***`, `**`, `__`, `<u>`, `~~`, `*`, `_`, `` ` ``, `[...](...)`), des sauts de ligne (`break: 1`), des blocs de code, citations et séparateurs, ainsi que la rastérisation PNG automatique des images `.svg` et `.webp` (`ensureOfficeCompatibleImage`).
4. **Debounce de l'aperçu `iframe` (`120 ms`) et validation structurelle de `output_config.json` (`validateOutputConfig`)**.

---

## 5. Statut du Code

- **État global** : Version 1.2.0 livrée, modulaire (9 modules ES6, 5 141 lignes), 100 % hors-ligne, conforme aux directives d'interface (zéro émoji, zéro icône).
