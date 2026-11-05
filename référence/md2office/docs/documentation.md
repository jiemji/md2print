# Documentation md2office

## Présentation
**md2office** est une application web autonome (SPA) permettant la conversion de fichiers Markdown (`.md`) en documents Microsoft Office : **PowerPoint (.pptx)** et **Word (.docx)**. L'application s'exécute entièrement côté client, garantissant la confidentialité des données (approche Local-First).

## Fonctionnalités Principales
1. **Import de Fichiers Markdown**
   - Interface de glisser-déposer de fichiers `.md`, `.markdown` ou `.txt`.
   - Parsing automatique via un parseur fait-maison (`MarkdownParser.js`) pour extraire la structure du document (Titres, Paragraphes, Listes, Tableaux, Blocs de code).

2. **Configuration Flexible**
   - **Configuration JSON** : Chargement facultatif d'un fichier `output_config.json` pour définir les styles, le formatage et les règles d'export.
   - **Template Word** : Possibilité de charger un document `.docx` ou `.dotx` modèle servant de base (styles, en-têtes/pieds de page) pour l'export Word.

3. **Génération de Documents**
   - **Export PowerPoint** : Utilise la bibliothèque `PptxGenJS`. Construit intelligemment les diapositives (Cover, Chapitre, Slides de contenu classiques).
   - **Export Word** : Utilise la bibliothèque `docx`. Conserve la hiérarchie des titres, le formatage inline (gras, italique, etc.) et insère correctement les tableaux Markdown en préservant le contexte du template d'origine.

## Architecture Technique
- **HTML/CSS** : Interface responsive, design moderne (variables CSS, Drag & Drop interactif, système de notifications Toast).
- **JavaScript (Vanilla ES6+)** :
  - `app.js` : Orchestrateur principal gérant l'état global et les événements de l'UI.
  - `MarkdownParser.js` : Moteur de parsing convertissant le texte Markdown brut en un Abstract Syntax Tree (AST) manipulable.
  - `PptxGenerator.js` : Moteur de génération de fichiers PPTX basé sur l'AST.
  - `DocxGenerator.js` : Moteur de génération de fichiers DOCX basé sur l'AST.
  - `utils.js` : Fonctions utilitaires asynchrones (lecture de fichiers, génération de téléchargements).
