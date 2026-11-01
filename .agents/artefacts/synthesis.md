# Synthèse du Projet — md2print

> **Version : 1.3.0** — Dernière mise à jour : 2026-11-01

---

## 1. Description du Projet

**md2print** est une application web monopage (SPA) développée en HTML5, CSS3 Vanilla et JavaScript ES6+ modulaire permettant de lister, éditer et sauvegarder des fichiers Markdown (`.md`) sur la moitié gauche de l'écran, de prévisualiser le rendu formaté en temps réel sur la moitié droite (`iframe`), et d'exporter le document vers trois formats autonomes : **HTML (`.html`)**, **Word (`.docx`)** et **PowerPoint (`.pptx`)**.

---

## 2. Fonctionnalités Clés

- **Gestion des fichiers, dossiers et persistance IndexedDB (F1)** : ouverture unitaire, ouverture de dossier avec liste déroulante des fichiers `.md`, création d'un nouveau fichier avec alerte si modifié (`isDirty`), sauvegarde par téléchargement classique (`Sauvegarder` ou `Ctrl+S`), et persistance automatique du brouillon, des images Base64, des préférences UI (thème, mode, largeur du séparateur) et des modèles personnalisés dans `IndexedDB` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js).
- **Éditeur Markdown non-WYSIWYG enrichi (F2)** : moteur dédié [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) sur `<div id="mdEditor" contenteditable="true">` conservant toutes les balises Markdown visibles tout en appliquant leur formatage visuel en temps réel (titres `#` à `#####`, gras, souligné, italique, barré, code inline, liens, blocs de code, citations, séparateurs `---`, listes à puces/numérotées/tâches décalées de 5 caractères par niveau d'imbrication, alignement automatique des colonnes de tableaux en grille CSS avec retour à la ligne plafonné à 60 caractères, objets graphiques `.image-cartouche` sur 2 lignes de hauteur, et cartouches interactifs `.mermaid-cartouche` repliables/dépliables avec éditeur direct et suppression unifiée).
- **Aperçu temps réel `iframe` avec `debounce` et Export HTML autonome (F3 & F4)** : rendu fidèle en mode **Rapport** continu ou **Slide** présentation (rafraîchissement débouncé à `120 ms` lors de la frappe), bandeau supérieur sobre, sommaire latéral repliable avec `ScrollSpy`, coloration syntaxique `highlight.js`, et schémas Mermaid intégrés dans un cadre ombré sur fond sombre.
- **Exports Word `.docx` et PowerPoint `.pptx` avec styles inline récursifs, habillage de blocs et conversion SVG/WebP/Mermaid (F5 & F6)** : chargement par défaut (et personnalisable avec persistance `IndexedDB`, validation structurelle et bouton `Réinitialiser par défaut` via le menu `Configuration`) de `output_config.json` et `Modele_word.docx`, support des titres, listes, tableaux, blocs de code, citations, séparateurs, images Base64 (avec rastérisation PNG automatique des formats `.svg` et `.webp`), schémas Mermaid vectoriels rastérisés en PNG 2x haute résolution et styles inline combinés/imbriqués.
- **Planification unifiée des diapositives ([`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js))** : algorithme partagé garantissant un découpage rigoureusement identique des diapositives entre le mode Diaporama HTML et l'export PowerPoint (`.pptx`), incluant la règle de saut forcé par séparateur horizontal `---`.
- **Charte graphique sobre sans émoji ni icône (F7)** : interface 100 % textuelle proposant deux thèmes CSS : **Mode Sombre (Bleu foncé et gris)** par défaut et **Mode Clair (Sépia)**.

---

## 3. Structure des Fichiers

| Fichier | Rôle |
|---|---|
| [`index.html`](file:///g:/devapps/md2print/index.html) | Structure HTML5 de la SPA (barre de menu supérieure, split-view 50/50 redimensionnable) |
| [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) | Feuille de style CSS3 avec variables pour les thèmes Sombre (Bleu/Gris) et Clair (Sépia), styles des cartouches image et Mermaid |
| [`js/app.js`](file:///g:/devapps/md2print/js/app.js) | Orchestrateur principal (état, persistance `IndexedDB`, fichiers/dossiers, raccourcis `Ctrl+S`/`Ctrl+M`, resizer, scroll sync, exports) |
| [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) | Moteur de l'éditeur non-WYSIWYG (`contenteditable`, curseur, cartouches image et Mermaid repliables, tableaux en grille CSS avec wrap à 60 car.) |
| [`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js) | Planificateur unifié de diapositives pour la prévisualisation/export HTML Slide et l'export PowerPoint PPTX (règle `---`, calcul prédictif de hauteur) |
| [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) | Service de persistance locale haute capacité `IndexedDB` (`md2print_db` : brouillon, images Base64, préférences et modèles) |
| [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) | Fonctions utilitaires, normalisation Markdown, validation JSON, rastérisation Mermaid/SVG/WebP en PNG 2x et résolution/purge d'images Base64 |
| [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) | Parseur Markdown vers AST structuré (avec propriété `raw`) et extraction récursive des styles inline pour DOCX et PPTX |
| [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) | Générateur du document HTML autonome (Rapport & Slide piloté par `SlidePlanner`, Sommaire repliable, ScrollSpy, schémas Mermaid encadrés) |
| [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) | Générateur Word `.docx` avec injection dans le modèle Word, intégration des schémas Mermaid rastérisés et transfert des images |
| [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) | Générateur PowerPoint `.pptx` piloté par `SlidePlanner` avec rendu des masques de titre/chapitre/contenu et schémas Mermaid |
| `vendor/` | Bibliothèques locales (`marked.min.js`, `highlight.min.js`, `mermaid.min.js`, `docx.umd.js`, `pptxgen.bundle.js`, `jszip.min.js`) |
| `docs/` | `CAHIER_DES_CHARGES.md`, `CHANGELOG.md` et `PROJECT_KNOWLEDGE.md` |

---

## 4. Dernières Améliorations (v1.3.0)

1. **Intégration complète des diagrammes Mermaid (HTML, Word, PowerPoint)** :
   - Rendu vectoriel SVG dynamique dans l'aperçu et l'export HTML autonome au sein d'un cadre ombré (`.mermaid-wrapper`).
   - Rastérisation haute résolution PNG (échelle 2x) pour Word (`.docx`) et PowerPoint (`.pptx`) avec conversion des balises `foreignObject` en `<text>`/`<tspan>` SVG pour compatibilité totale avec les éléments `<canvas>`.
2. **Cartouche interactive `.mermaid-cartouche` dans l'éditeur non-WYSIWYG** :
   - Objet graphique vert distinctif repliable/dépliable avec flèche toggle `▼`/`▲`.
   - Zone de texte `<textarea>` intégrée permettant l'édition directe du diagramme en mode déplié.
   - Suppression atomique via `Suppr` ou `Backspace` et raccourci d'insertion `Ctrl+M`.
3. **Planification unifiée des diapositives ([`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js))** :
   - Synchronisation absolue du découpage des diapositives entre le mode Diaporama HTML et l'export PPTX.
   - Prise en compte de la règle de saut de diapositive forcé par séparateur horizontal `---`.
4. **Retour à la ligne automatique des colonnes de tableaux Markdown** :
   - Plafonnement de la largeur maximale des colonnes à 60 caractères (`max-width: 60ch`, `white-space: pre-wrap`, `word-break: break-word`) dans l'éditeur pour éviter les débordements horizontaux excessifs.

---

## 5. Statut du Code

- **État global** : Version 1.3.0 livrée, modulaire (10 modules ES6, 6 911 lignes, 215,7 Ko), 100 % hors-ligne, conforme aux directives d'interface (zéro émoji, zéro icône).
