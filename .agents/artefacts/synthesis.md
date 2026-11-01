# Synthèse du Projet — md2print

> **Version : 1.4.0** — Dernière mise à jour : 2026-11-01

---

## 1. Description du Projet

**md2print** est une application web monopage (SPA) développée en HTML5, CSS3 Vanilla et JavaScript ES6+ modulaire permettant de lister, éditer et sauvegarder des fichiers Markdown (`.md`) sur la moitié gauche de l'écran, de prévisualiser le rendu formaté en temps réel sur la moitié droite (`iframe`), et d'exporter le document vers trois formats autonomes : **HTML (`.html`)**, **Word (`.docx`)** et **PowerPoint (`.pptx`)**.

---

## 2. Fonctionnalités Clés

- **Gestion des fichiers, dossiers et persistance IndexedDB (F1)** : ouverture unitaire, ouverture de dossier avec liste déroulante des fichiers `.md`, création d'un nouveau fichier avec alerte si modifié (`isDirty`), sauvegarde par téléchargement classique (`Sauvegarder` ou `Ctrl+S`), et persistance automatique du brouillon, des images Base64, des préférences UI (thème, mode, largeur du séparateur) et des modèles personnalisés dans `IndexedDB` via [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js).
- **Éditeur Markdown non-WYSIWYG enrichi (F2)** : moteur dédié [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) sur `<div id="mdEditor" contenteditable="true">` conservant toutes les balises Markdown visibles tout en appliquant leur formatage visuel en temps réel (titres `#` à `#####`, gras, souligné, italique, barré, code inline, liens, blocs de code, citations, séparateurs `---`, listes à puces/numérotées/tâches décalées de 5 caractères par niveau d'imbrication, alignement automatique des colonnes de tableaux en grille CSS avec retour à la ligne plafonné à 60 caractères, objets graphiques `.image-cartouche` sur 2 lignes de hauteur, et cartouches interactifs `.mermaid-cartouche` repliables/dépliables avec éditeur direct et suppression unifiée).
- **Aperçu temps réel `iframe` avec `debounce` et Export HTML autonome (F3 & F4)** : rendu fidèle en mode **Rapport** continu ou **Slide** présentation (rafraîchissement débouncé lors de la frappe), bandeau supérieur sobre, sommaire latéral repliable avec `ScrollSpy`, coloration syntaxique `highlight.js`, et schémas Mermaid intégrés dans un cadre ombré sur fond sombre.
- **Page interactive de paramétrage des styles de balises (F4.1)** : contrôleur [`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js) permettant de personnaliser en direct les couleurs, polices et tailles de chaque type d'élément (titres, corps, données métriques 5x, callouts, citations, code, tableaux, liens, arrière-plans) avec un panneau d'aperçu dynamique (*Live Preview*), génération CSS à la volée, exportation `.css` et persistance `IndexedDB`.
- **Exports Word `.docx` et PowerPoint `.pptx` avec styles inline récursifs, habillage de blocs et conversion SVG/WebP/Mermaid (F5 & F6)** : chargement par défaut (et personnalisable avec persistance `IndexedDB`, validation structurelle et bouton `Réinitialiser par défaut` via le menu `Configuration`) de `output_config.json` et `Modele_word.docx`, support des titres, listes, tableaux, blocs de code, citations, séparateurs, images Base64 (avec rastérisation PNG automatique des formats `.svg` et `.webp`), schémas Mermaid vectoriels rastérisés en PNG 2x haute résolution et styles inline combinés/imbriqués.
- **Planification unifiée des diapositives ([`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js))** : algorithme partagé garantissant un découpage rigoureusement identique des diapositives entre le mode Diaporama HTML et l'export PowerPoint (`.pptx`), incluant la règle de saut forcé par séparateur horizontal `---`.
- **Charte graphique sobre sans émoji ni icône (F7)** : interface 100 % textuelle proposant deux thèmes CSS : **Mode Sombre (Bleu foncé et gris)** par défaut et **Mode Clair (Sépia)**.

---

## 3. Structure des Fichiers

| Fichier | Rôle |
|---|---|
| [`index.html`](file:///g:/devapps/md2print/index.html) | Structure HTML5 de la SPA (barre de menu supérieure, split-view 50/50 redimensionnable, page de styles `#pageStyleConfig`) |
| [`css/styles.css`](file:///g:/devapps/md2print/css/styles.css) | Feuille de style CSS3 avec variables pour les thèmes Sombre (Bleu/Gris) et Clair (Sépia), styles de la page de paramétrage des balises |
| [`css/report.css`](file:///g:/devapps/md2print/css/report.css) | Feuille de style paramétrable de la Vision Rapport (inspirée de `Modele_word.docx`, marges 25mm, titres `#C00000`/`#2F5496`) |
| [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css) | Feuille de style paramétrable de la Vision Slide (inspirée de `Modele_presentation.potx`, 16:9, Aptos/Slate, tiroir sommaire) |
| [`js/app.js`](file:///g:/devapps/md2print/js/app.js) | Orchestrateur principal (état, persistance `IndexedDB`, navigation vers la page de styles, raccourcis, resizer, scroll sync, exports) |
| [`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js) | Contrôleur de paramétrage interactif des styles, couleurs, polices et tailles de police pour chaque type de balise avec Live Preview |
| [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js) | Feuilles de style par défaut intégrées (`DEFAULT_REPORT_CSS`, `DEFAULT_SLIDE_CSS`) assurant la portabilité 100 % hors-ligne `file:///` |
| [`js/EditorEngine.js`](file:///g:/devapps/md2print/js/EditorEngine.js) | Moteur de l'éditeur non-WYSIWYG (`contenteditable`, curseur, cartouches image et Mermaid repliables, tableaux en grille CSS avec wrap à 60 car.) |
| [`js/SlidePlanner.js`](file:///g:/devapps/md2print/js/SlidePlanner.js) | Planificateur unifié de diapositives pour la prévisualisation/export HTML Slide et l'export PowerPoint PPTX (règle `---`, calcul prédictif de hauteur) |
| [`js/StorageService.js`](file:///g:/devapps/md2print/js/StorageService.js) | Service de persistance locale haute capacité `IndexedDB` (`md2print_db` : brouillon, images Base64, préférences, styles et modèles) |
| [`js/utils.js`](file:///g:/devapps/md2print/js/utils.js) | Fonctions utilitaires, normalisation Markdown, validation JSON, rastérisation Mermaid/SVG/WebP en PNG 2x et résolution/purge d'images Base64 |
| [`js/MarkdownParser.js`](file:///g:/devapps/md2print/js/MarkdownParser.js) | Parseur Markdown vers AST structuré (avec propriété `raw`) et extraction récursive des styles inline pour DOCX et PPTX |
| [`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js) | Générateur du document HTML autonome avec isolation DOM stricte (Rapport centré ou Diaporama 16:9, tiroir escamotable, ScrollSpy) |
| [`js/DocxGenerator.js`](file:///g:/devapps/md2print/js/DocxGenerator.js) | Générateur Word `.docx` avec injection dans le modèle Word, intégration des schémas Mermaid rastérisés et transfert des images |
| [`js/PptxGenerator.js`](file:///g:/devapps/md2print/js/PptxGenerator.js) & [`js/PptxSlideBuilders.js`](file:///g:/devapps/md2print/js/PptxSlideBuilders.js) | Générateur PowerPoint `.pptx` piloté par `SlidePlanner` avec rendu des masques de titre/chapitre/contenu et schémas Mermaid |
| `vendor/` | Bibliothèques locales (`marked.min.js`, `highlight.min.js`, `mermaid.min.js`, `docx.umd.js`, `pptxgen.bundle.js`, `jszip.min.js`) |
| `docs/` | `CAHIER_DES_CHARGES.md`, `CHANGELOG.md` et `PROJECT_KNOWLEDGE.md` |

---

## 4. Dernières Améliorations (v1.4.0)

1. **Page interactive de paramétrage des styles et des balises ([`js/StyleSettingsManager.js`](file:///g:/devapps/md2print/js/StyleSettingsManager.js))** :
   - Écran plein écran `#pageStyleConfig` permettant de configurer les couleurs (palette et champ hexadécimal), les polices (sélecteur et personnalisation) et les tailles pour chaque élément (titres, corps, données métriques 5x, encarts callouts, citations, code, tableaux, liens, arrière-plans).
   - Panneau d'aperçu dynamique en direct (*Live Preview*) actualisé instantanément à chaque réglage.
   - Bascule d'onglets entre Vision Rapport (Word) et Vision Slide (PowerPoint).
   - Boutons textuels d'application immédiate, d'exportation CSS (`.css`), de réinitialisation et de persistance IndexedDB.
2. **Sommaire escamotable (Drawer) en Vision Slide** :
   - Restauration du bandeau supérieur sobre bleu nuit ardoise (`#0E2841`) et liseré rouge (`#C41718`).
   - Sommaire latéral escamotable en tiroir animé, se déployant en superposition au-dessus de la diapositive 16:9 sans impacter ses proportions.
   - Navigation directe vers la diapositive avec fermeture automatique du tiroir, et raccourci clavier <kbd>Échap</kbd> de fermeture.
3. **Thèmes CSS par défaut paramétrables (Word & PowerPoint)** :
   - Fichiers [`css/report.css`](file:///g:/devapps/md2print/css/report.css) et [`css/slide.css`](file:///g:/devapps/md2print/css/slide.css) et répercussion dans [`js/defaultThemeStyles.js`](file:///g:/devapps/md2print/js/defaultThemeStyles.js) pour fonctionnement garanti sous protocole local `file:///`.
4. **Correction et isolation complète de la Vision Rapport** :
   - Suppression totale des nœuds et contrôles de diapositives dans le DOM du rapport ([`js/HtmlGenerator.js`](file:///g:/devapps/md2print/js/HtmlGenerator.js)).
   - Rétablissement de la mise en page en bloc centré, du défilement clavier naturel et de la synchronisation asymétrique.

---

## 5. Statut du Code

- **État global** : Version 1.4.0 livrée, modulaire (12 modules ES6, 100 % hors-ligne, zéro émoji, zéro icône).
