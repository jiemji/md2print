---
name: post-doc
description: >-
  Trigger ONLY on explicit user command or request (such as '/post-doc', 'post-doc', 'documente le code', 'lance post-doc'). Thoroughly audits and documents all modified, refactored, or newly created functions, modules, parameters, and classes with standard JSDoc/docstrings, cleaning obsolete comments and validating syntax.
---

# Skill: post-doc (Action /post-doc)

## Déclenchement
Ce skill s'active et s'exécute lorsque l'utilisateur tape la commande ou l'instruction :
- `/post-doc`
- `post-doc`
- `lance post-doc`
- `documente le code modifié`

---

## Workflow d'Exécution

Dès que `/post-doc` est invoqué :

### 1. Identifier le périmètre des modifications
- Identifier tous les fichiers de code créés, modifiés ou refactorisés lors de la session de travail en cours.

### 2. Auditer et enrichir la documentation JSDoc
Pour chaque fichier modifié :
- **En-tête de module (`@module`)** : Vérifier la présence du bloc `@module` décrivant le rôle du fichier et ses dépendances principales (`@requires`).
- **Fonctions & Méthodes** :
  - Ajouter/mettre à jour la description concise et précise de la fonction.
  - Définir chaque `@param` avec son type précis (`{string}`, `{number}`, `{Object}`, `{Array}`, etc.) et sa description.
  - Définir le `@returns` avec son type et sa signification.
  - Ajouter `@async` ou `@throws` si pertinent.
- **Structures complexes** : Documenter avec `@typedef` ou `@property` les objets métiers manipulés.
- **Commentaires internes** : Ajouter des explications sur le « pourquoi » des algorithmes non triviaux, règles métier ou cas limites.
- **Nettoyage** : Supprimer ou corriger les commentaires devenus faux ou obsolètes après les modifications de code.

### 3. Contrôle de syntaxe
- Exécuter la vérification de syntaxe JS (`node --check <file>`) pour garantir qu'aucune erreur n'a été introduite.

### 4. Synthèse à l'utilisateur
- Présenter un récapitulatif clair des fichiers et fonctions documentés.
