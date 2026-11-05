# Exemples de schémas Mermaid pris en charge

Ce document rassemble des exemples concrets pour chaque famille de diagrammes Mermaid supportée par md2print, que ce soit pour la prévisualisation dans l'éditeur, l'export HTML autonome, Word (.docx) ou PowerPoint (.pptx).

---

## 1. Histogramme et Courbe combinés (xychart-beta)

Ce graphique bénéficie du nouveau moteur de rendu vectoriel : cartouches arrondis, fond avec grille de points, courbe de Bézier lissée avec halo lumineux et légende intégrée.

```mermaid
xychart-beta
    title "Performance trimestrielle : Objectif vs Réalisé"
    x-axis ["T1", "T2", "T3", "T4"]
    y-axis "Montant en kEUR" 0 --> 120
    bar [40, 65, 80, 105]
    line [45, 60, 85, 110]
```

---

## 2. Histogramme multi-séries horizontales (xychart-beta horizontal)

Les séries de barres multiples sont automatiquement positionnées côte à côte (groupées) et adaptées aux couleurs du thème actif.

```mermaid
xychart-beta horizontal
    title "Comparatif des ventes régionales"
    x-axis ["Nord", "Sud", "Est", "Ouest"]
    y-axis "Taux d'atteinte (%)" 0 --> 100
    bar [75, 60, 85, 90]
    bar [80, 70, 65, 95]
```

---

## 3. Diagramme de flux de processus (Flowchart)

Idéal pour cartographier les processus décisionnels, les logiques métier et les parcours de validation.

```mermaid
flowchart TD
    A["Demande client"] --> B["Analyse du besoin"]
    B --> C{"Faisabilité technique"}
    C -- "Oui" --> D["Élaboration du devis"]
    C -- "Non" --> E["Proposition alternative"]
    D --> F["Validation client"]
    E --> F
    F --> G["Lancement de la production"]
```

---

## 4. Diagramme de séquence (Sequence Diagram)

Permet de décrire les interactions chronologiques et les flux d'appels entre différents systèmes ou acteurs.

```mermaid
sequenceDiagram
    autonumber
    actor Client as "Utilisateur"
    participant App as "Interface Web"
    participant API as "Serveur API"
    participant DB as "Base de données"

    Client->>App: Saisie des identifiants
    App->>API: Requête d'authentification (POST /login)
    API->>DB: Vérification du compte
    DB-->>API: Données valides
    API-->>App: Jeton de session (JWT)
    App-->>Client: Redirection vers le tableau de bord
```

---

## 5. Diagramme circulaire (Pie Chart)

Utile pour illustrer la répartition proportionnelle d'un ensemble de catégories ou de budgets.

```mermaid
pie title Répartition du temps de travail par phase
    "Développement" : 45
    "Conception et architecture" : 25
    "Tests et recette" : 15
    "Coordination et revues" : 15
```

---

## 6. Diagramme de Gantt (Planning de projet)

Permet de suivre le calendrier d'un projet avec ses jalons, ses dépendances et l'état d'avancement des tâches.

```mermaid
gantt
    title Planning de déploiement de la version 2.0
    dateFormat YYYY-MM-DD
    section Conception
        Spécifications techniques : done, t1, 2026-11-01, 2026-11-07
        Architecture des données  : active, t2, 2026-11-08, 2026-11-15
    section Réalisation
        Développement du moteur   : t3, 2026-11-16, 2026-11-30
        Intégration de l'interface: t4, 2026-12-01, 2026-12-10
    section Déploiement
        Recette utilisateur       : t5, 2026-12-11, 2026-12-18
        Mise en production        : milestone, m1, 2026-12-20, 0d
```

---

## 7. Diagramme d'états (State Diagram)

Modélise le cycle de vie d'un objet métier ou d'un document au sein du système.

```mermaid
stateDiagram-v2
    [*] --> Brouillon
    Brouillon --> EnRevue : Soumettre pour relecture
    EnRevue --> Rejete : Demande de modifications
    Rejete --> Brouillon : Corriger
    EnRevue --> Valide : Approuver
    Valide --> Publie : Mettre en ligne
    Publie --> Archive : Archiver
    Archive --> [*]
```

---

## 8. Diagramme de classes UML (Class Diagram)

Présente la structure orientée objet, les attributs, méthodes et relations d'héritage ou d'association.

```mermaid
classDiagram
    class Document {
        +String titre
        +String auteur
        +Date dateCreation
        +exporter(format: String) void
    }
    class Rapport {
        +Int nombrePages
        +genererSommaire() void
    }
    class Presentation {
        +Int nombreDiapositives
        +appliquerTheme(nom: String) void
    }
    Document <|-- Rapport
    Document <|-- Presentation
```

---

## 9. Diagramme Entité-Relation (ER Diagram)

Définit le schéma d'une base de données relationnelle et les cardinalités entre tables.

```mermaid
erDiagram
    CLIENT ||--o{ COMMANDE : passe
    COMMANDE ||--|{ LIGNE_COMMANDE : contient
    PRODUIT ||--o{ LIGNE_COMMANDE : concerne

    CLIENT {
        string identifiant PK
        string nom
        string email
    }
    COMMANDE {
        string numero PK
        date dateCommande
        string statut
    }
    PRODUIT {
        string reference PK
        string designation
        float prixUnitaire
    }
```

---

## 10. Matrice de positionnement stratégique (Quadrant Chart)

Permet d'évaluer et de prioriser des éléments selon deux axes (effort/valeur, risque/rentabilité, etc.).

```mermaid
quadrantChart
    title Priorisation des fonctionnalités
    x-axis Effort faible --> Effort élevé
    y-axis Valeur faible --> Valeur élevée
    quadrant-1 Gains rapides
    quadrant-2 Projets majeurs
    quadrant-3 Tâches secondaires
    quadrant-4 Pièges à éviter
    "Export Word" : [0.3, 0.8]
    "Moteur SVG moderne" : [0.75, 0.9]
    "Support thèmes sombres" : [0.25, 0.4]
    "Refactorisation legacy" : [0.8, 0.3]
```

---

## 11. Carte mentale (Mindmap)

Structure visuellement des concepts, des arborescences de fonctionnalités ou des sessions de remue-méninges.

```mermaid
mindmap
  root((md2print))
    Formats d'export
      HTML autonome
      Document Word
      Diaporama PowerPoint
      Impression PDF
    Fonctionnalités
      Éditeur Markdown
      Thèmes graphiques
      Schémas Mermaid
      Cartouches visuels
    Performances
      Rendu vectoriel pur
      Optimisation DOM
```

---

## 12. Parcours utilisateur (User Journey)

Permet de cartographier l'expérience vécue par l'utilisateur étape par étape avec son niveau de satisfaction.

```mermaid
journey
    title Parcours de rédaction et d'export d'un document
    section Saisie
      Rédiger le contenu en Markdown: 5: Utilisateur
      Insérer un graphique Mermaid: 4: Utilisateur
    section Configuration
      Choisir le thème visuel: 5: Utilisateur
      Ajuster les options d'export: 4: Utilisateur
    section Export
      Générer le document Word: 5: Utilisateur, Système
      Vérifier le document final: 5: Utilisateur
```

---

## 13. Historique de branches (GitGraph)

Illustre les flux de gestion de versions Git, la création de branches, les fusions et les versions taguées.

```mermaid
gitGraph
    commit id: "Initialisation"
    commit id: "Ajout parser markdown"
    branch feature/mermaid-moderne
    checkout feature/mermaid-moderne
    commit id: "Moteur de rendu SVG"
    commit id: "Styles thématiques"
    checkout main
    merge feature/mermaid-moderne id: "Fusion v2.1"
    commit id: "Publication version"
```

