/* =========================================================
   app.js — l'interface : relie la page HTML aux autres fichiers
   ---------------------------------------------------------
   Ce fichier ne calcule rien lui-même : il écoute les actions
   de l'utilisateur (taper, cliquer…) et met la page à jour.
   ========================================================= */

/* ---------- Les éléments de la page dont on a besoin ---------- */
var formulaireRecherche = document.getElementById("formulaire-recherche");
var champMood = document.getElementById("champ-mood");
var zoneMessage = document.getElementById("message");
var titrePalette = document.getElementById("titre-palette");
var grille = document.getElementById("grille");
var boutonTheme = document.getElementById("bouton-theme");
var boutonRegenerer = document.getElementById("bouton-regenerer");
var curseurHue = document.getElementById("curseur-hue");
var valeurHue = document.getElementById("valeur-hue");
var boutonResetHue = document.getElementById("bouton-reset-hue");
var canvasDegrade = document.getElementById("canvas-degrade");
var curseurGrain = document.getElementById("curseur-grain");
var valeurGrain = document.getElementById("valeur-grain");
var champNomExport = document.getElementById("champ-nom-export");
var apercuNomExport = document.getElementById("apercu-nom-export");
var boutonImporter = document.getElementById("bouton-importer");
var champImage = document.getElementById("champ-image");
var blocImage = document.getElementById("image-importee");
var vignetteImage = document.getElementById("vignette-image");
var nomImage = document.getElementById("nom-image");


/* ---------- État de l'application ---------- */
// Tout ce qu'il faut savoir pour redessiner la page.
var etat = {
  moodPrincipal: null,   // le mood qui domine la palette
  moodAccent: null,      // le second mood, qui influence l'accent (ou null)
  paletteDeBase: [],     // les 9 couleurs générées (avant tout décalage HUE)
  decalageHue: 0,        // position du curseur HUE, de -180 à +180 degrés
  intensiteGrain: 45     // curseur "Intensité du grain", de 0 à 100
};


/* ---------- Affichage de la palette ---------- */

// La palette réellement affichée : la palette de base, tournée du décalage HUE.
// On repart TOUJOURS de la base : les décalages ne se cumulent jamais.
function paletteAffichee() {
  return etat.paletteDeBase.map(function (couleur) {
    return {
      role: couleur.role,
      libelle: couleur.libelle,
      hsl: Couleurs.decalerTeinte(couleur.hsl, etat.decalageHue)
    };
  });
}

// Peint les 9 cases de la grille avec les couleurs données.
function afficherPalette(couleurs) {
  var cases = grille.querySelectorAll(".case");
  couleurs.forEach(function (couleur, index) {
    var hex = Couleurs.hslVersHex(couleur.hsl);
    var caseCouleur = cases[index];
    caseCouleur.style.background = hex;
    caseCouleur.style.color = Couleurs.couleurTexte(hex);   // noir ou blanc selon le contraste
    caseCouleur.dataset.hex = hex;                           // mémorisé pour la copie
    caseCouleur.querySelector(".case__hex").textContent = hex;
    caseCouleur.title = couleur.libelle + " — cliquer pour copier";
  });
}

// Redessine tout ce qui dépend des couleurs : la grille et le dégradé.
function rafraichir() {
  var couleurs = paletteAffichee();
  afficherPalette(couleurs);
  Degrade.dessiner(canvasDegrade, couleurs, etat.moodPrincipal, etat.intensiteGrain);
}


/* ---------- Messages ---------- */

// Affiche un texte sous la barre de recherche, suivi (si besoin) de moods
// cliquables. "quandOnClique" dit quoi faire du mood cliqué.
function afficherMessage(texte, moodsCliquables, quandOnClique) {
  zoneMessage.textContent = texte;
  if (!moodsCliquables) return;

  moodsCliquables.forEach(function (mood) {
    var bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "suggestion";
    bouton.textContent = mood.nom;
    bouton.addEventListener("click", function () {
      quandOnClique(mood);
    });
    zoneMessage.appendChild(document.createTextNode(" "));
    zoneMessage.appendChild(bouton);
  });
}

// Mot inconnu : message doux + 3 moods proches cliquables.
function afficherSuggestions(texteTape, suggestions) {
  afficherMessage("Je ne connais pas encore « " + texteTape + " »… Peut-être :", suggestions, function (mood) {
    champMood.value = mood.nom;
    choisirMoods(mood, null, null);
  });
}


/* ---------- Choix du mood ---------- */

// Un élément au hasard dans une liste. Ex : tirerAuHasard([Automnal, Gourmand])
function tirerAuHasard(liste) {
  return liste[Math.floor(Math.random() * liste.length)];
}

// "de" ou "d'" selon la première lettre : "de Serein", mais "d'Azur", "d'Énergique".
function de(nom) {
  var premiereLettre = Moods.normaliser(nom).charAt(0);
  return "aeiouyh".indexOf(premiereLettre) !== -1 ? "d'" + nom : "de " + nom;
}

// Enregistre le(s) mood(s) choisi(s) et met la page à jour.
// - principal  : le mood qui domine
// - accent     : le mood qui colore l'accent (ou null)
// - motPartage : si le mot tapé appartient à plusieurs moods,
//                { expression: "cannelle", candidats: [Automnal, Gourmand] }, sinon null
function choisirMoods(principal, accent, motPartage) {
  etat.moodPrincipal = principal;
  etat.moodAccent = accent;

  titrePalette.textContent = principal.nom;
  titrePalette.classList.remove("visuellement-cache");   // il a pu être caché par une image
  blocImage.hidden = true;                                // on n'est plus sur l'image importée

  var texte = "";
  if (accent) {
    texte = principal.nom + ", avec une touche " + de(accent.nom) + " dans l'accent.";
  }

  if (motPartage) {
    // "Voir aussi" : les autres moods qui contiennent le mot tapé
    var autres = motPartage.candidats.filter(function (mood) { return mood !== principal; });
    texte += (texte ? " " : "") + "« " + motPartage.expression + " » : voir aussi";
    afficherMessage(texte, autres, function (mood) {
      choisirMoods(mood, accent, motPartage);
    });
  } else {
    afficherMessage(texte);
  }

  etat.paletteDeBase = Palette.generer(principal, accent);
  rafraichir();
}

// Lance la recherche à partir du texte tapé.
function lancerRecherche(texte) {
  if (texte.trim() === "") {
    afficherMessage("Tape une émotion ou une ambiance pour commencer.");
    return;
  }

  var groupes = Moods.trouverMoods(texte);

  if (groupes.length === 0) {
    afficherSuggestions(texte.trim(), Moods.suggerer(texte, 3));
    return;
  }

  // Le premier mot reconnu donne le mood principal (tiré au hasard
  // s'il appartient à plusieurs moods).
  var premier = groupes[0];
  var principal = tirerAuHasard(premier.candidats);
  var motPartage = premier.candidats.length > 1 ? premier : null;

  // Le mot reconnu suivant (s'il existe) influence l'accent.
  var accent = null;
  for (var i = 1; i < groupes.length && !accent; i++) {
    var possibles = groupes[i].candidats.filter(function (mood) { return mood !== principal; });
    if (possibles.length > 0) accent = tirerAuHasard(possibles);
  }

  choisirMoods(principal, accent, motPartage);
}


/* ---------- Écouteurs d'événements ---------- */

formulaireRecherche.addEventListener("submit", function (evenement) {
  evenement.preventDefault();   // empêche le rechargement de la page
  lancerRecherche(champMood.value);
});


/* ---------- Import d'une image ---------- */

// Le bouton "Importer" ouvre le sélecteur de fichier (caché).
boutonImporter.addEventListener("click", function () {
  champImage.click();
});

// Affiche la vignette de l'image choisie, pour confirmer qu'elle est bien lue.
function afficherImageImportee(fichier) {
  // Libère l'adresse de l'image précédente (elle occupe de la mémoire)
  if (vignetteImage.src) {
    URL.revokeObjectURL(vignetteImage.src);
  }
  // Une adresse temporaire qui pointe vers le fichier choisi, sans l'envoyer nulle part
  vignetteImage.src = URL.createObjectURL(fichier);
  nomImage.textContent = fichier.name;
  blocImage.hidden = false;
}

// "change" : l'utilisateur a choisi un fichier dans le sélecteur.
champImage.addEventListener("change", function () {
  var fichier = champImage.files[0];
  if (!fichier) return;   // sélecteur fermé sans choisir

  if (fichier.type.indexOf("image/") !== 0) {
    afficherMessage("Ce fichier n'est pas une image. Choisis un JPG, un PNG ou un WebP.");
    return;
  }

  afficherImageImportee(fichier);
  // Remis à zéro : choisir deux fois de suite la même image redéclenche "change".
  champImage.value = "";

  mettreImportEnCours(true);
  ImageCouleurs.analyser(fichier)
    .then(function (analyse) {
      choisirImage(analyse);
    })
    .catch(function () {
      afficherMessage("Impossible de lire cette image. Essaie avec un autre fichier.");
    })
    .then(function () {
      mettreImportEnCours(false);   // dans tous les cas, le bouton redevient normal
    });
});

// Petit état de chargement sur le bouton pendant l'analyse.
function mettreImportEnCours(enCours) {
  boutonImporter.disabled = enCours;
  boutonImporter.textContent = enCours ? "Analyse…" : "Importer";
  boutonImporter.setAttribute("aria-busy", enCours ? "true" : "false");
}

// Génère la palette à partir de l'analyse d'une image.
// Même moteur que pour un mood : on fabrique une fiche "sur mesure"
// (Palette.ficheDepuisParametres) et on la garde comme mood en cours.
// Régénérer, la barre HUE, le dégradé et les exports s'en servent tels quels.
function choisirImage(analyse) {
  var fiche = Palette.ficheDepuisParametres(ImageCouleurs.parametresPalette(analyse));
  etat.moodPrincipal = fiche;
  etat.moodAccent = null;   // l'accent vient déjà de la teinte secondaire de l'image

  // Le nom de mood ne s'affiche pas quand l'image est la source.
  // Le titre reste lisible par les lecteurs d'écran (caché visuellement seulement).
  titrePalette.textContent = "Palette de l'image importée";
  titrePalette.classList.add("visuellement-cache");
  champMood.value = "";
  afficherMessage("Palette créée à partir de ton image. Régénérer propose une variation.");

  etat.paletteDeBase = Palette.generer(fiche, null);
  rafraichir();
}


/* ---------- Copie d'un HEX au clic ---------- */

// Copie un texte dans le presse-papier. Renvoie une "promesse" : on peut
// attendre la fin de la copie avec .then(...).
function copierTexte(texte) {
  // Méthode moderne (navigateurs récents, page en https ou ouverte en local)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texte).catch(function () {
      return copierTexteAncienneMethode(texte);
    });
  }
  return Promise.resolve(copierTexteAncienneMethode(texte));
}

// Méthode de secours : on sélectionne le texte dans un champ caché, puis "copier".
function copierTexteAncienneMethode(texte) {
  var champ = document.createElement("textarea");
  champ.value = texte;
  champ.setAttribute("readonly", "");
  champ.style.position = "fixed";
  champ.style.opacity = "0";
  document.body.appendChild(champ);
  champ.select();
  document.execCommand("copy");
  document.body.removeChild(champ);
}

// Retour visuel : "Copié" s'affiche à la place du HEX pendant un instant.
function montrerCopie(caseCouleur) {
  var etiquette = caseCouleur.querySelector(".case__hex");
  etiquette.textContent = "Copié !";
  caseCouleur.classList.add("case--copiee");
  setTimeout(function () {
    etiquette.textContent = caseCouleur.dataset.hex;   // le HEX actuel (il a pu changer entre-temps)
    caseCouleur.classList.remove("case--copiee");
  }, 1200);
}

grille.addEventListener("click", function (evenement) {
  var caseCouleur = evenement.target.closest(".case");
  if (!caseCouleur) return;
  copierTexte(caseCouleur.dataset.hex).then(function () {
    montrerCopie(caseCouleur);
  });
});


/* ---------- Bouton Régénérer ---------- */
// Même mood, nouvelle variation (le décalage HUE en cours est conservé).
boutonRegenerer.addEventListener("click", function () {
  etat.paletteDeBase = Palette.generer(etat.moodPrincipal, etat.moodAccent);
  rafraichir();
});


/* ---------- Barre HUE ---------- */

// Affiche la valeur du curseur : "+30°", "-45°" ou "0°".
function afficherValeurHue() {
  var degres = etat.decalageHue;
  valeurHue.textContent = (degres > 0 ? "+" : "") + degres + "°";
}

function changerDecalageHue(degres) {
  etat.decalageHue = degres;
  curseurHue.value = degres;
  afficherValeurHue();
  rafraichir();
}

// "input" se déclenche en continu pendant qu'on fait glisser : mise à jour en direct.
curseurHue.addEventListener("input", function () {
  changerDecalageHue(Number(curseurHue.value));
});

boutonResetHue.addEventListener("click", function () {
  changerDecalageHue(0);
});


/* ---------- Intensité du grain ---------- */
curseurGrain.addEventListener("input", function () {
  etat.intensiteGrain = Number(curseurGrain.value);
  valeurGrain.textContent = etat.intensiteGrain;
  rafraichir();
});


/* ---------- Exports ---------- */

// Prépare le contenu demandé, à partir de ce qui est affiché à l'écran
// (donc avec le décalage HUE en cours).
// Renvoie { contenu, nomFichier, type } — le contenu peut être une promesse (PNG).
function preparerExport(format) {
  var couleurs = paletteAffichee();
  var mood = etat.moodPrincipal;

  if (format === "png-palette") {
    return { contenu: Export.pngPalette(couleurs, mood, etat.decalageHue),
             nomFichier: Export.nomDeFichier(champNomExport.value, "palette", "png"), type: "image/png" };
  }
  if (format === "png-degrade") {
    return { contenu: Export.pngDegrade(couleurs, mood, etat.intensiteGrain),
             nomFichier: Export.nomDeFichier(champNomExport.value, "degrade", "png"), type: "image/png" };
  }
  if (format === "css") {
    return { contenu: Export.css(couleurs, mood, etat.decalageHue),
             nomFichier: Export.nomDeFichier(champNomExport.value, "", "css"), type: "text/css" };
  }
  return { contenu: Export.json(couleurs, mood, etat.moodAccent, etat.decalageHue),
           nomFichier: Export.nomDeFichier(champNomExport.value, "", "json"), type: "application/json" };
}

// Montre sous le champ les noms exacts des fichiers qui seront téléchargés.
function afficherApercuNomExport() {
  apercuNomExport.textContent = "Fichiers : " +
    Export.nomDeFichier(champNomExport.value, "palette", "png") + ", " +
    Export.nomDeFichier(champNomExport.value, "degrade", "png") + ", " +
    Export.nomDeFichier(champNomExport.value, "", "css") + ", " +
    Export.nomDeFichier(champNomExport.value, "", "json");
}

champNomExport.addEventListener("input", afficherApercuNomExport);

// Champ vidé puis quitté : on remet le nom par défaut, pour qu'il soit visible.
champNomExport.addEventListener("blur", function () {
  if (champNomExport.value.trim() === "") {
    champNomExport.value = Export.NOM_PAR_DEFAUT;
    afficherApercuNomExport();
  }
});

// Retour visuel sur le bouton : "Copié !" ou "Téléchargé !" pendant un instant.
function confirmerSurBouton(bouton, texte) {
  var texteNormal = bouton.textContent;
  bouton.textContent = texte;
  bouton.disabled = true;
  setTimeout(function () {
    bouton.textContent = texteNormal;
    bouton.disabled = false;
  }, 1200);
}

document.querySelector(".exports").addEventListener("click", function (evenement) {
  var bouton = evenement.target.closest("button[data-export]");
  if (!bouton) return;

  var fichier = preparerExport(bouton.dataset.export);

  if (bouton.dataset.action === "copier") {
    copierTexte(fichier.contenu).then(function () {
      confirmerSurBouton(bouton, "Copié !");
    });
    return;
  }

  // Promise.resolve : marche que le contenu soit déjà prêt (texte) ou pas encore (PNG)
  Promise.resolve(fichier.contenu).then(function (contenu) {
    Export.telecharger(contenu, fichier.nomFichier, fichier.type);
    confirmerSurBouton(bouton, "Téléchargé !");
  });
});


/* ---------- Thème clair / sombre ---------- */
// Le CSS fait tout le travail : il suffit de poser data-theme="dark" ou
// "light" sur la balise <html>. Le choix est mémorisé dans le navigateur
// (localStorage) pour la prochaine visite.

var CLE_THEME = "mood-colors-theme";

// Le thème réellement affiché : le choix de l'utilisateur, sinon celui de l'ordinateur.
function themeActuel() {
  var choix = document.documentElement.getAttribute("data-theme");
  if (choix) return choix;
  var ordinateurEnSombre = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return ordinateurEnSombre ? "dark" : "light";
}

// Le bouton propose toujours l'AUTRE thème.
function mettreAJourBoutonTheme() {
  var sombre = themeActuel() === "dark";
  boutonTheme.textContent = sombre ? "Mode clair" : "Mode sombre";
  boutonTheme.setAttribute("aria-pressed", sombre ? "true" : "false");
}

function appliquerTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  mettreAJourBoutonTheme();
  try {
    localStorage.setItem(CLE_THEME, theme);
  } catch (erreur) {
    // Navigation privée ou stockage bloqué : le thème marche, il n'est juste pas retenu.
  }
}

function chargerThemeMemorise() {
  try {
    var theme = localStorage.getItem(CLE_THEME);
    if (theme === "dark" || theme === "light") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (erreur) {
    // Rien de mémorisé : on garde le réglage de l'ordinateur.
  }
  mettreAJourBoutonTheme();
}

boutonTheme.addEventListener("click", function () {
  appliquerTheme(themeActuel() === "dark" ? "light" : "dark");
});


/* ---------- Au chargement de la page ---------- */
// On démarre avec un mood d'exemple pour que la page ne soit jamais vide.
chargerThemeMemorise();
afficherValeurHue();
afficherApercuNomExport();
choisirMoods(Moods.parId("mysterieux"), null, null);
