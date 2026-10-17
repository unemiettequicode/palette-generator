# Mood Colors — règles de travail

## Projet

Mood Colors est un générateur de palettes moodboard statique en HTML, CSS et
JavaScript vanilla. La palette peut venir de trois sources : une émotion ou une
ambiance saisie (75 moods, en français et en anglais), une image importée, ou
une couleur de base choisie sur une roue chromatique (camaïeu, dégradé entre
deux couleurs ou harmonie). Elle compte 9 couleurs (grille 3×3) ou 16 (grille
4×4, au choix). La page propose aussi une barre HUE, la retouche de chaque
couleur avec des barres RGB (bouton « Ajuster »), un dégradé avec grain et des
exports PNG, CSS et JSON, nommés `mc_` + un nom au choix.

Les fichiers JavaScript (`js/`) sont des objets globaux chargés dans cet ordre :
`colors`, `moods`, `palette`, `gradient`, `export`, `image`, `couleurBase`,
`selecteur`, `app`. Voir `README.md` pour le détail de chacun.

## Stack à conserver

- HTML, CSS et JavaScript vanilla uniquement.
- Aucun framework, aucune dépendance externe, aucun build et aucun serveur Node.
- Conserver les scripts classiques avec `defer`, sans modules ES.
- Ne pas renommer, déplacer ou supprimer un fichier existant sans accord préalable.
- Ne pas recréer ni réécrire le projet ; modifier uniquement la demande et les fichiers concernés.

## Style de travail

- Répondre en français avec des explications simples et pédagogiques.
- Le code et les commentaires doivent rester en français.
- Préférer des fonctions courtes et des noms explicites.
- Travailler par petites étapes : expliquer, modifier, tester, puis attendre la validation.
- Pour une nouvelle fonctionnalité : résumer le plan avant de coder et attendre l'accord.
- Faire un commit en français à chaque étape validée.
- Une branche `feature_…` par nouvelle fonctionnalité, créée depuis `main`. Fusion
  dans `main` seulement quand l'utilisateur le demande.
- Ne jamais toucher à la branche `Moodboard_colors_V0` (la V0 du projet).
- Ne jamais pousser sur GitHub sans demande explicite de l'utilisateur.

## Replit

Le workflow **Start application** sert le projet statique avec :

`python3 -m http.server 5000 --bind 0.0.0.0`

Le serveur démarre depuis la racine du projet et l'aperçu Replit est accessible
sur le port 5000. `index.html` charge directement les fichiers CSS et JavaScript.

La police optionnelle « Mistical Spring » n'est pas incluse dans le dépôt. Le
titre utilise donc la police de secours Georgia. Voir `fonts/LISEZMOI.txt` avant
d'ajouter une copie correctement licenciée.