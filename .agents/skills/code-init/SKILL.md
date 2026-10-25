---
name: code-init
description: >-
  Trigger on explicit user command or request (such as '/code-init', 'code-init', 'état des lieux', 'analyse la codebase', 'découvre le projet'). Autonomously explores the codebase, maps out architecture, state management, module interactions, dependencies, and git status, then outputs a structured overview and readiness report before starting any coding work.
---

# Skill: code-init (Action /code-init)

## Déclenchement
Ce skill s'active et s'exécute lorsque l'utilisateur tape l'une des instructions suivantes :
- `/code-init`
- `code-init`
- `état des lieux`
- `analyse la codebase`
- `prend connaissance du projet`
- `découvre le code avant de commencer`

---

## Objectif
Permettre à l'agent d'explorer méthodiquement le projet, de comprendre son architecture, ses conventions, son modèle de données et son état actuel, puis de restituer un état des lieux clair et synthétique avant toute intervention de développement ou de refactorisation.

---

## Workflow d'Exécution

Dès que `/code-init` est invoqué, suivre scrupuleusement les 4 étapes suivantes :

### 1. Cartographie de l'Arborescence & Découverte Globale
- Inspecter la racine du projet (`list_dir`) pour repérer les points d'entrée et fichiers structurants :
  - Points d'entrée web : `index.html`, fichiers HTML secondaires.
  - Configurations : `package.json`, dossiers `config/`, manifests, etc.
  - Organisation des dossiers sources : `js/core/`, `js/modules/`, `js/ui/`, `js/components/`, `css/`, etc.
- Déterminer la stack technique employée (ex: Vanilla JS ES6+ Modules, Web Components, CSS natif avec variables, bibliothèques tierces chargées via CDN ou bundle).

### 2. Modèle de Données & Gestion d'État (State Management)
- Identifier et analyser les modules de gestion d'état central (`State.js`, `Store`, etc.) :
  - Structure de l'état réactif (`currentForm`, données globales, collections).
  - Mécanismes de persistance (`localStorage`, exports JSON/fichiers).
  - Système d'abonnement / notification (`subscribe`, `notify`).
- Comprendre les entités et formats de données manipulés (ex: audits, recommandations, colonnes, métadonnées, livrables).

### 3. Cartographie Fonctionnelle des Modules & Flux
- Parcourir les modules principaux pour comprendre leurs responsabilités :
  - **Core** : Fonctions utilitaires, calculs, transformations, adaptateurs IA.
  - **Modules / Vues** : Écrans applicatifs (ex: Grille d'audit, Carrousel, Conseils, Dashboard KPI, Export, Livrables, Créateur).
  - **UI & Composants** : Modales, navigation, éditeurs (ex: Web Components personnalisés).
  - **API / Services** : Connecteurs LLM/IA, parsers de fichiers (Excel, CSV, JSON).
- Identifier les points d'ancrage et la navigation (hash routing, switch de vues).

### 4. Diagnostic Technique & État Actuel
- Vérifier l'état git actuel (`git status`) pour repérer les fichiers modifiés, non suivis ou en cours d'édition.
- Tester la cohérence syntaxique des fichiers clés (`node --check`).
- Identifier les conventions de code en place (JSDoc, règles de typage dynamique, nommage BEM/CSS, etc.).

---

## Format de Restitution (Rapport d'État des Lieux)

Présenter à l'utilisateur un rapport structuré et lisible contenant :

1. **🏷️ Identité & Stack Technique du Projet**
   - Type d'application, technologies (JS ES6+ Vanilla, CSS natif, librairies externes).
2. **🏗️ Architecture & Organisation des Dossiers**
   - Arborescence commentée des dossiers et fichiers clés.
3. **🔄 Flux de Données & Gestion d'État**
   - Comment l'état est structuré, partagé, muté et persisté.
4. **🧩 Cartographie des Modules & Vues**
   - Tableau ou liste à puces récapitulant chaque vue/module et ses responsabilités.
5. **⚡ État Actuel & Points de Vigilance**
   - Fichiers modifiés ou en cours de travail, statut de validation syntaxique, règles/conventions clés à respecter.
6. **🚀 Prêt pour l'Action**
   - Confirmation que l'agent a une vision complète du système et est prêt à exécuter les tâches demandées.
