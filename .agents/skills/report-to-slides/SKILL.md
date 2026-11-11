---
name: report-to-slides
description: >-
  Transforme un document brut, dense ou structuré (rapport d'audit, synthèse stratégique, compte-rendu, note de cadrage, analyse technique) en diaporama Markdown optimisé pour md2print (format 16:9, vision Slide et export PPTX). Exploite l'ensemble des balisages riches de md2print (colonnes, KPI [chiffre], frises chronologiques [frise], alertes [!NOTE]/[!WARNING], badges, schémas Mermaid et tableaux) avec une ergonomie visuelle percutante et sans aucun émoji.
---

# Skill: report-to-slides

## Déclenchement
Ce skill s'active sur demande explicite de l'utilisateur, notamment avec les instructions :
- `/report-to-slides`
- `report-to-slides`
- `transforme ce rapport en slides`
- `convertis ce document en présentation`
- `génère des slides à partir de ce texte`
- `retraite ce rapport en diaporama`

---

## Objectif
Analyser un document source textuel (paragraphes rédigés, rapports, bilans, comptes-rendus) et le restructurer intégralement en un jeu de diapositives Markdown professionnel, aéré et percutant, prêt pour la vision Diaporama (Slide 16:9) et l'export PowerPoint (`.pptx`) de **md2print**.

---

## Directives Fondamentales et Invariants

1. **Règle stricte sur les icônes et émojis :**
   - **Ne JAMAIS insérer d'émojis ni d'icônes** (aucun symbole Unicode décoratif, aucune balise d'icône) dans les titres, sous-titres, boutons, badges, textes ou légendes.
   - L'élégance et l'impact visuel reposent exclusivement sur la typographie, les contrastes, la hiérarchie et les balisages natifs de md2print.

2. **Pas de copier-coller de blocs narratifs :**
   - Une diapositive 16:9 n'est pas une page de livre. Bannir les paragraphes de plus de 2 à 3 lignes.
   - Synthétiser l'information en messages clés percutants, listes rythmées, métriques agrandies et visualisations graphiques.

3. **Équilibre et aération de l'espace 16:9 :**
   - Une diapositive = un message ou un axe thématique clair.
   - Limiter le contenu à 3 ou 4 points majeurs par bloc.
   - Varier la mise en scène d'une slide à l'autre pour maintenir l'attention.

---

## Matrice de Retraitement (Texte Brut -> Balises md2print)

| Contenu dans le rapport source | Balisage md2print cible | Recommandations d'usage |
| :--- | :--- | :--- |
| **Titre global & Métadonnées** (auteur, date, contexte) | `# Titre Principal`<br>`Sous-titre / Entité / Date` | Diapositive de couverture (type Titre). |
| **Grandes sections / Chapitres** (Parties 1, 2, 3...) | `## Numéro. Titre du Chapitre` | Diapositive d'inter-titre (séparateur de section). |
| **Sujets d'analyse / Écrans de contenu** | `### Titre de la Diapositive` | Bandeau supérieur de la diapositive standard. |
| **Sujet dense nécessitant 2 diapositives** | `---` | Coupe la slide sans changer de titre `###`. |
| **Chiffres clés, métriques, pourcentages, montants** | `[chiffre:valeur:libellé:variante]` | Aligner 2 à 4 indicateurs sur une même ligne.<br>Variantes : `info`, `success`, `warning`, `danger`, `important`, `neutral`. |
| **Chronologies, séquences temporelles, processus** | `[frise]`<br>`- **Jalon** (couleur) \| **Titre** \| Description`<br>`[/frise]` | Représentation horizontale avec pastilles reliées.<br>Couleurs : `(danger)`, `(warning)`, `(success)`, `(info)`, `(purple)`, `(muted)`. |
| **Comparatifs, multi-aspects, avant/après, briques** | `[colonne:taille:titre:couleur:ratio]` ... `[/colonne]` | 2 ou 3 colonnes côte à côte avec titre centré (`####`), couleur de bandeau (`info`, `success`, `warning`, `danger`, `important`, `neutral`) et ratio de police optionnel (ex. `85%`, `0.9`). |
| **Statuts, priorités, catégories, qualifications** | `[badge:type:texte]` | À intégrer dans les puces, tableaux ou sous-titres.<br>Types : `success`, `danger`, `warning`, `info`, `important`, `neutral`. |
| **Recommandations, points de vigilance, alertes** | `> [!IMPORTANT]`, `> [!WARNING]`, `> [!TIP]`, `> [!CAUTION]`, `> [!NOTE]` | Encadrés préformatés avec bordure colorée et titre optionnel (`> [!WARNING] Mesures d'urgence`). |
| **Données chiffrées évolutives ou comparatives** | ```` ```mermaid xychart-beta ... ``` ```` | Histogrammes et courbes (mixte ou individuel), multi-séries côte à côte avec le moteur SVG moderne. |
| **Flux décisionnels, architectures, workflows** | ```` ```mermaid flowchart TD ... ``` ```` | Schémas de processus vectoriels clairs et synthétiques. |
| **Échanges d'acteurs ou de systèmes** | ```` ```mermaid sequenceDiagram ... ``` ```` | Flux chronologiques d'appels et réponses. |
| **Répartitions de parts ou de budgets** | ```` ```mermaid pie ... ``` ```` | Camemberts vectoriels avec titre et pourcentages. |
| **Matrice d'évaluation ou de priorisation** | ```` ```mermaid quadrantChart ... ``` ```` | Matrice 2x2 (Gains rapides, Projets majeurs, etc.). |
| **Données comparatives tabulaires denses** | Tableaux Markdown enrichis | Colonnes synthétiques avec en-têtes et badges de statut. |
| **Plans d'actions, étapes de remédiation** | Checklists `- [x]` / `- [ ]` | Actions réalisées ou en attente. |

---

## Workflow d'Exécution en 5 Étapes

Dès que la commande ou la demande de retraitement est formulée :

### 1. Analyse Documentaire et Extraction
- Identifier le sujet central, l'émetteur, la date et le public cible.
- Décomposer le document brut en 3 à 5 grands chapitres logiques (`##`).
- Repérer systématiquement :
  - Les chiffres marquants à convertir en cartouches `[chiffre:...]`.
  - Les jalons temporels et dates à transformer en `[frise]`.
  - Les contrastes ou comparatifs à structurer en `[colonne]`.
  - Les alertes, recommandations et risques à encadrer en `> [!...]`.
  - Les données statistiques ou fonctionnelles justifiant un schéma Mermaid (`xychart-beta`, `flowchart`, `pie`).

### 2. Découpage en Diapositives
- **Diapositive 1** : Couverture `# Titre` suivie du sous-titre et des métadonnées.
- **Diapositives de transition** : `## Chapitre` pour chaque grande partie.
- **Diapositives de contenu** : `### Sujet précis`.
- Si un sujet comporte à la fois des chiffres, des explications et un tableau, le scinder avec `---` plutôt que de saturer une diapositive.

### 3. Rédaction Visuelle et Enrichissement
- Remplacer les longs paragraphes par des puces courtes avec mot-clé en gras :
  - *Avant :* "Nous avons constaté que le taux de disponibilité a chuté à 98.2% en raison de pannes serveurs."
  - *Après :* `[chiffre:98.2%:Disponibilité Système:warning]` puis `- **Indisponibilité** : Ruptures d'alimentation constatées sur le cluster primaire`.
- Intégrer des badges de statut `[badge:success:Conforme]`, `[badge:danger:Non Conforme]` dans les points d'étape et tableaux.
- Placer des alertes ciblées `> [!IMPORTANT]` ou `> [!WARNING]` pour isoler les décisions requises.

### 4. Contrôle Qualité et Conformité
Vérifier impérativement les points suivants avant livraison :
- [ ] Aucun émoji ni icône décorative dans tout le document généré.
- [ ] Syntaxe des balises fermées (`[/colonne]`, `[/frise]`, clôtures de blocs de code).
- [ ] Chaque diapositive `###` tient confortablement dans le cadre 16:9.
- [ ] Préservation stricte des faits, chiffres et données du rapport initial.

### 5. Restitution
- Présenter le document Markdown prêt à l'emploi.
- Indiquer à l'utilisateur qu'il peut le copier directement dans l'éditeur de **md2print** ou l'enregistrer dans un fichier `.md` pour export instantané en HTML, Word et PowerPoint.

