# Mood Colors

Générateur de palettes moodboard : on tape une émotion ou une ambiance
(« mélancolique », « serein », « dark academia », « cannelle »…) et la page
compose une palette de **9 couleurs harmonieuses**, un **dégradé avec grain**
au format 9:16, et des **exports** prêts à l'emploi.

Tout fonctionne en local : HTML, CSS et JavaScript « vanilla », sans framework,
sans dépendance et sans étape de construction (build).


## Fonctionnalités

- **Recherche d'émotion** en français et en anglais, sans tenir compte des
  accents ni des majuscules. 75 moods et plusieurs centaines de mots-clés.
  - Petites fautes tolérées (« serin » → Serein).
  - Mot inconnu : message + 3 moods proches cliquables.
  - Deux mots (« nostalgique et serein ») : le premier donne la palette,
    le second colore l'accent.
  - Un mot qui appartient à plusieurs moods (« cannelle », « rose ») :
    un mood est tiré au hasard, les autres sont proposés en « voir aussi ».
- **Import d'une image** (bouton « Importer ») : la palette est générée à
  partir des couleurs de la photo, analysée localement (rien n'est envoyé).
  - L'image est réduite à 150 px et lue en HSL ; les teintes sont regroupées
    en familles de 15°. Les pixels presque noirs, blancs ou gris sont ignorés
    pour la teinte.
  - Teinte dominante → dominante de la palette ; teinte secondaire → accent ;
    saturation moyenne → palette plus douce ou plus vive.
  - Harmonie selon l'écart entre les deux teintes : moins de 60° analogue,
    moins de 150° complémentaire divisée, au-delà complémentaire.
  - Image noir et blanc → palette de gris légèrement réchauffés.
  - Le nom de mood n'est pas affiché ; Régénérer, la barre Teinte, le dégradé
    et les exports fonctionnent comme pour un mood (fichiers `mood-colors-image-…`).
- **Palette 3×3** : 2 sombres teintés, 3 tons moyens, 2 accents, 2 clairs
  teintés. Jamais de noir ni de blanc purs. Texte noir ou blanc selon le
  contraste (formule WCAG). Clic sur une case = HEX copié.
- **Régénérer** : une nouvelle variation du même mood.
- **Barre Teinte** : fait tourner la teinte des 9 couleurs d'un bloc
  (de -180° à +180°), toujours à partir de la palette de base.
- **Dégradé mesh avec grain** (canvas 2D), avec un curseur d'intensité du grain.
- **Exports** : PNG du moodboard, PNG du dégradé en 1080×1920, variables CSS
  (+ dégradé en `radial-gradient`), JSON.
- **Mode clair / sombre**, mémorisé dans le navigateur.


## Lancer le projet en local

**Le plus simple :** double-cliquer sur `index.html`. La page s'ouvre dans le
navigateur et tout fonctionne (recherche, copie, dégradé, exports).

**Avec un petit serveur local** (utile pour tester comme sur un vrai site),
dans un terminal ouvert dans le dossier du projet :

```bash
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000 dans le navigateur. `Ctrl + C` pour arrêter.


## Importer et lancer le projet sur Replit

1. Sur Replit : **Create App** → **Import from GitHub** → choisir le dépôt
   `palette-generator`, branche `main`.
2. Le fichier `.replit` est déjà configuré : le bouton **Run** lance
   `python3 -m http.server 5000 --bind 0.0.0.0` et affiche la page dans
   l'onglet de prévisualisation.
3. Les règles de travail du projet (pour l'agent Replit) sont dans `replit.md`.


## Le cycle pull / push (travailler à plusieurs endroits)

Le dépôt GitHub est la référence commune. La règle d'or : **toujours récupérer
avant de modifier**.

1. **Avant de travailler** : récupérer la dernière version
   ```bash
   git pull origin main
   ```
2. **Modifier**, tester dans le navigateur.
3. **Enregistrer** l'étape dans un commit (message en français)
   ```bash
   git add .
   git commit -m "Ce que j'ai changé"
   ```
4. **Envoyer** sur GitHub
   ```bash
   git push origin main
   ```

Sur Replit, les mêmes actions se font depuis l'onglet **Git** (Pull, Commit,
Push). Si deux personnes modifient le même fichier en même temps, Git demande
de « résoudre un conflit » : c'est pour ça qu'on tire (pull) avant de commencer.


## Organisation des fichiers

```
index.html        la page (structure)
css/style.css     l'apparence (couleurs de l'interface en variables tout en haut)
js/colors.js      conversions HEX / RGB / HSL, contraste, décalage de teinte
js/moods.js       le dictionnaire des moods et la recherche
js/palette.js     la fabrication des 9 couleurs d'un mood
js/gradient.js    le dégradé canvas et le grain
js/export.js      les exports PNG, CSS et JSON
js/image.js       l'analyse des couleurs d'une image importée
js/app.js         l'interface : relie les boutons et curseurs aux calculs
fonts/            emplacement de la police du titre (voir fonts/LISEZMOI.txt)
```

Les scripts sont chargés dans cet ordre avec `<script defer>` (pas de modules
ES) : c'est ce qui permet d'ouvrir la page par double-clic.


## Personnaliser

- **Analyse des images** : réglages en haut de `js/image.js` (taille d'analyse,
  largeur des familles de teintes, seuils noir / blanc / gris, conditions de la
  teinte secondaire).
- **Ajouter ou affiner un mood** : `js/moods.js`. Chaque mood est une fiche
  de réglages commentée (teinte, saturation, luminosité, harmonie, accent,
  sombres, clairs, composition du dégradé) suivie de ses mots-clés.
- **Rendu du dégradé** : en haut de `js/gradient.js`, `TAILLE_DES_TACHES`
  (plus grand = plus fondu), `ETIREMENT` (taches plus ovales) et
  `COMPOSITIONS` (position de chaque tache).
- **Couleurs de l'interface** (clair et sombre) : variables au début de
  `css/style.css`.
- **Police du titre** « Mistical Spring » : déposer le fichier dans `fonts/`
  (instructions et rappel de licence dans `fonts/LISEZMOI.txt`). Sans lui,
  le titre s'affiche en Georgia.
