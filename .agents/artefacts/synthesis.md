# Synthèse du Projet — md2print

> **Version : 1.0.0** — Dernière mise à jour : 2026-10-25

---

## 1. Description du Projet

**md2print** est une application web monopage (SPA) développée en HTML5, CSS3 Vanilla et JavaScript ES6+ modulaire permettant de lister, éditer et sauvegarder des fichiers Markdown (`.md`) sur la moitié gauche de l'écran, de prévisualiser le rendu formaté en temps réel sur la moitié droite (`iframe`), et d'exporter le document vers trois formats autonomes : **HTML (`.html`)**, **Word (`.docx`)** et **PowerPoint (`.pptx`)**.

---

## 2. Fonctionnalités Clés

- **Gestion des fichiers et dossiers Markdown (F1)** : ouverture unitaire, ouverture de dossier avec liste déroulante des fichiers `.md`, création d'un nouveau fichier avec alerte si modifié (`isDirty`), et sauvegarde par téléchargement classique (`Sauvegarder` ou `Ctrl+S`).
- **Éditeur Markdown standard (F2)** : champ `<textarea>` pleine hauteur, indentation par touche `Tab`, glisser-déposer de fichier `.md`, collage/dépôt d'images converties en Base64, et normalisation automatique des tableaux Markdown.
- **Aperçu temps réel `iframe` et Export HTML autonome (F3 & F4)** : rendu fidèle en mode **Rapport** continu ou **Slide** présentation, bandeau supérieur sobre, sommaire latéral repliable avec `ScrollSpy`, coloration syntaxique `highlight.js` sans barre d'en-tête.
- **Exports Word `.docx` et PowerPoint `.pptx` (F5 & F6)** : chargement par défaut (et personnalisable via le menu `Configuration`) de `output_config.json` et `Modele_word.docx`, support des titres, listes, tableaux et images Base64.
- **Charte graphique sobre sans émoji ni icône (F7)** : interface 100 % textuelle proposant deux thèmes CSS : **Mode Sombre (Bleu foncé et gris)** par défaut et **Mode Clair (Sépia)**.

---

## 3. Structure des Fichiers

| Fichier | Rôle |
|---|---|
| [`index.html`](file:///g:/devapps/md2print/index.html) | Structure HTML5 de la SPA (barre de menu supérieure, split-view 50/50 redimensionnable) |
| [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) | Feuille de style CSS3 avec variables pour les thèmes Sombre (Bleu/Gris) et Clair (Sépia) |
| [`js/app.js`](file:///g:/devapps/md2print/js/app.js) | Orchestrateur principal (état, fichiers/dossiers, raccourcis, resizer, scroll sync, exports) |
| [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) | Fonctions utilitaires, normalisation Markdown et résolution/conversion d'images Base64 |
| [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) | Parseur Markdown vers AST structuré pour DOCX et PPTX |
| [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) | Générateur du document HTML autonome (Rapport & Slide, Sommaire repliable, ScrollSpy) |
| [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) | Générateur Word `.docx` avec injection dans le modèle Word et transfert des images |
| [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) | Générateur PowerPoint `.pptx` par découpage de sections |
| `vendor/` | Bibliothèques locales (`marked.min.js`, `highlight.min.js`, `docx.umd.js`, `pptxgen.bundle.js`, `jszip.min.js`) |
| `docs/` | `CAHIER_DES_CHARGES.md`, `CHANGELOG.md` et `PROJECT_KNOWLEDGE.md` |

---

## 4. Dernières Améliorations (v1.0.0)

1. **Rédaction et validation du Cahier des Charges V1** (`docs/CAHIER_DES_CHARGES.md`).
2. **Implémentation complète de l'architecture modulaire ES6+** unifiant l'édition Markdown, l'aperçu `iframe` synchronisé et les trois moteurs d'export (`.html`, `.docx`, `.pptx`).
3. **Intégration locale des 5 bibliothèques tierces dans `vendor/`** pour garantir un fonctionnement 100 % hors-ligne.
4. **Documentation JSDoc complète** sur l'ensemble des modules JavaScript.

---

## 5. Statut du Code

- **État global** : Version 1.0.0 livrée, modulaire, 100 % hors-ligne, conforme aux directives d'interface (zéro émoji, zéro icône).
- **Prochaines pistes suggérées** : Validation manuelle complète par le développeur via serveur HTTP local, persistance optionnelle du brouillon dans `localStorage`.
