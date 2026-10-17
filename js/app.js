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
var choixGrille = document.getElementById("choix-grille");
var boutonAjuster = document.getElementById("bouton-ajuster");
var descriptionPngPalette = document.getElementById("description-png-palette");
var descriptionCss = document.getElementById("description-css");
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
  paletteDeBase: [],     // les 16 couleurs de la grille 4x4 (avant tout décalage HUE)
  paletteNeuf: [],       // les 9 couleurs de la grille 3x3 (et du dégradé)
  neufEstLeDebut: true,  // les 9 couleurs sont-elles les 9 premières des 16 ? (vrai pour un mood, une image, une harmonie)
  nombreDeCases: 9,      // combien on en affiche : 9 (grille 3x3) ou 16 (grille 4x4)
  ajustement: false,     // vrai : chaque case montre des barres RGB pour retoucher sa couleur
  base: null,            // si la palette vient du sélecteur de couleur : { mode, couleur, arrivee, harmonie, graine, variation }, sinon null
  decalageHue: 0,        // position du curseur HUE, de -180 à +180 degrés
  intensiteGrain: 45     // curseur "Intensité du grain", de 0 à 100
};


/* ---------- Affichage de la palette ---------- */

// Mémorise une palette : ses 16 couleurs (grille 4x4) et ses 9 couleurs (grille 3x3).
// Pour un mood ou une image, les 9 sont simplement les 9 premières des 16 ; pour un
// camaïeu ou un dégradé, ce sont deux calculs différents (voir couleurBase.js).
function definirPalette(seize, neuf) {
  etat.paletteDeBase = seize;
  etat.paletteNeuf = neuf || seize.slice(0, 9);
  // Un camaïeu ou un dégradé ont deux palettes DIFFÉRENTES (9 et 16 étapes) ; pour les
  // autres, les 9 sont le début des 16. Ça décide si une retouche passe de l'une à l'autre.
  etat.neufEstLeDebut = !neuf || etat.paletteNeuf.every(function (couleur, i) {
    return couleur.hsl.h === seize[i].hsl.h && couleur.hsl.s === seize[i].hsl.s && couleur.hsl.l === seize[i].hsl.l;
  });
}

// La palette réellement affichée : la palette de base, tournée du décalage HUE.
// On repart TOUJOURS de la base : les décalages ne se cumulent jamais.
// "nombre" (9 ou 16) : par défaut, celui de la grille choisie. Le dégradé et les
// exports qui en dépendent demandent toujours 9.
function paletteAffichee(nombre) {
  var base = (nombre || etat.nombreDeCases) === 16 ? etat.paletteDeBase : etat.paletteNeuf;
  return base.map(function (couleur) {
    return {
      role: couleur.role,
      libelle: couleur.libelle,
      hsl: Couleurs.decalerTeinte(couleur.hsl, etat.decalageHue)
    };
  });
}

// Fabrique une case vide. Normalement c'est un bouton (un clic copie le HEX). En mode
// « Ajuster », c'est un bloc avec 3 barres : on ne peut pas mettre des barres DANS un
// bouton (un élément interactif dans un autre n'est pas permis en HTML).
var CANAUX = [["r", "Rouge"], ["g", "Vert"], ["b", "Bleu"]];

function creerCase(ajustable) {
  var element = document.createElement(ajustable ? "div" : "button");
  if (!ajustable) element.type = "button";
  element.className = ajustable ? "case case--ajustable" : "case";

  var hex = document.createElement("span");
  hex.className = "case__hex";
  element.appendChild(hex);

  if (ajustable) {
    var barres = document.createElement("div");
    barres.className = "case__barres";
    CANAUX.forEach(function (canal) {
      var barre = document.createElement("input");
      barre.type = "range";
      barre.min = 0;
      barre.max = 255;
      barre.step = 1;
      barre.className = "case__barre";
      barre.dataset.canal = canal[0];   // "r", "g" ou "b"
      barres.appendChild(barre);
    });
    element.appendChild(barres);
  }
  return element;
}

// Prépare la grille pour un certain nombre de cases (9 ou 16) : on ajoute les
// boutons manquants ou on retire ceux en trop, et on règle le nombre de colonnes.
// Si on passe du mode normal au mode « Ajuster » (ou l'inverse), on refait toutes les cases.
function preparerGrille(nombre) {
  var premiere = grille.firstElementChild;
  if (premiere && premiere.classList.contains("case--ajustable") !== etat.ajustement) {
    grille.textContent = "";
  }
  while (grille.children.length < nombre) {
    grille.appendChild(creerCase(etat.ajustement));
  }
  while (grille.children.length > nombre) {
    grille.removeChild(grille.lastElementChild);
  }
  grille.classList.toggle("grille--4x4", nombre === 16);
}

// Règle les 3 barres d'une case sur sa couleur, et colore leur piste : chaque barre va
// de « ce canal à 0 » à « ce canal à 255 », les deux autres canaux restant ce qu'ils sont.
function mettreAJourBarres(caseCouleur, couleur) {
  var rgb = Couleurs.hslVersRgb(couleur.hsl);
  caseCouleur.querySelectorAll(".case__barre").forEach(function (barre) {
    var canal = barre.dataset.canal;
    var debut = { r: rgb.r, g: rgb.g, b: rgb.b };
    var fin = { r: rgb.r, g: rgb.g, b: rgb.b };
    debut[canal] = 0;
    fin[canal] = 255;
    // La barre qu'on est en train de déplacer garde sa position (pas de petit saut d'un point)
    if (barre !== document.activeElement) barre.value = rgb[canal];
    barre.style.setProperty("--piste", "linear-gradient(to right, rgb(" + debut.r + "," + debut.g + "," + debut.b +
      "), rgb(" + fin.r + "," + fin.g + "," + fin.b + "))");
  });
}

// Peint les cases de la grille avec les couleurs données (9 ou 16).
function afficherPalette(couleurs) {
  preparerGrille(couleurs.length);
  var cases = grille.querySelectorAll(".case");
  couleurs.forEach(function (couleur, index) {
    var hex = Couleurs.hslVersHex(couleur.hsl);
    var caseCouleur = cases[index];
    caseCouleur.style.background = hex;
    caseCouleur.style.color = Couleurs.couleurTexte(hex);   // noir ou blanc selon le contraste
    caseCouleur.dataset.hex = hex;                           // mémorisé pour la copie
    caseCouleur.querySelector(".case__hex").textContent = hex;
    if (etat.ajustement) {
      caseCouleur.title = couleur.libelle;
      caseCouleur.querySelectorAll(".case__barre").forEach(function (barre, i) {
        barre.setAttribute("aria-label", CANAUX[i][1] + " — " + couleur.libelle);
      });
      mettreAJourBarres(caseCouleur, couleur);
    } else {
      caseCouleur.title = couleur.libelle + " — cliquer pour copier";
    }
  });
}

// Redessine tout ce qui dépend des couleurs : la grille et le dégradé.
function rafraichir() {
  var couleurs = paletteAffichee();
  afficherPalette(couleurs);
  Degrade.dessiner(canvasDegrade, paletteAffichee(9), etat.moodPrincipal, etat.intensiteGrain);   // toujours les 9
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
  etat.base = null;                                       // ni sur une couleur de base
  mettreAJourBoutonRegenerer();

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

  definirPalette(Palette.generer(principal, accent));
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
  etat.base = null;         // on n'est plus sur une couleur de base
  mettreAJourBoutonRegenerer();

  // Le nom de mood ne s'affiche pas quand l'image est la source.
  // Le titre reste lisible par les lecteurs d'écran (caché visuellement seulement).
  titrePalette.textContent = "Palette de l'image importée";
  titrePalette.classList.add("visuellement-cache");
  champMood.value = "";
  afficherMessage("Palette créée à partir de ton image. Régénérer propose une variation.");

  definirPalette(Palette.generer(fiche, null));
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
  if (etat.ajustement) return;   // en mode « Ajuster », un clic sur une case ne copie pas
  var caseCouleur = evenement.target.closest(".case");
  if (!caseCouleur) return;
  copierTexte(caseCouleur.dataset.hex).then(function () {
    montrerCopie(caseCouleur);
  });
});


/* ---------- Palette à partir d'une couleur de base ---------- */

// Régénérer n'a rien à varier pour un dégradé strict (c'est une transition exacte
// entre deux couleurs) : le bouton est alors grisé (aria-disabled, pas "disabled",
// pour garder le même aspect que partout ailleurs sauf dans ce cas).
function mettreAJourBoutonRegenerer() {
  var rienAVarier = Boolean(etat.base) && etat.base.mode === "degrade";
  boutonRegenerer.setAttribute("aria-disabled", rienAVarier ? "true" : "false");
  boutonRegenerer.title = rienAVarier ? "Rien à varier : un dégradé strict est toujours le même" : "";
}

// Calcule la palette de la couleur de base (couleurBase.js) et met la page à jour.
// "etat.base" garde tout ce qu'il faut pour retrouver la même palette : le mode, les
// couleurs, la GRAINE du hasard (même graine = mêmes nuances, donc pas de scintillement
// quand on déplace la roue) et l'harmonie tirée.
// Le "mood" est ici une fiche fabriquée à partir de la couleur : la barre Teinte, le
// dégradé et les exports s'en servent comme pour un mood.
function afficherCouleurBase() {
  var resultat = CouleurBase.generer(etat.base);
  etat.base.graine = resultat.graine;
  etat.base.harmonie = resultat.harmonie;   // l'harmonie tirée est gardée tant qu'on ne demande pas d'autres couleurs

  etat.moodPrincipal = resultat.fiche;
  etat.moodAccent = null;
  definirPalette(resultat.seize, resultat.neuf);
  titrePalette.textContent = resultat.titre;
  mettreAJourBoutonRegenerer();   // grisé en mode "dégradé"
  rafraichir();
}

// Le sélecteur de couleur a bougé : la palette de la page le suit, en direct.
// Au premier geste (ou si on change de mode), c'est lui qui reprend la main sur le mood
// ou l'image, avec une nouvelle graine.
function suivreSelecteur(choix) {
  var premierGeste = !etat.base;
  var autreMode = !premierGeste && etat.base.mode !== choix.mode;

  etat.base = {
    mode: choix.mode,
    couleur: choix.couleur,
    arrivee: choix.arrivee,
    harmonie: (premierGeste || autreMode) ? null : etat.base.harmonie,
    graine: (premierGeste || autreMode) ? undefined : etat.base.graine,   // undefined : une nouvelle graine sera tirée
    variation: (premierGeste || autreMode) ? 0 : etat.base.variation
  };

  if (premierGeste) {
    titrePalette.classList.remove("visuellement-cache");   // il a pu être caché par une image
    blocImage.hidden = true;
    champMood.value = "";
    afficherMessage("Palette calculée à partir de ta couleur. Régénérer propose une variation.");
  }
  afficherCouleurBase();
}

// Une autre harmonie (la couleur reste la même) ou un autre jeu de nuances en camaïeu :
// on change la graine du hasard. C'est le rôle de « Régénérer » et de « Autres couleurs ».
function regenererCouleurBase() {
  etat.base.graine = undefined;   // une nouvelle graine sera tirée
  etat.base.harmonie = null;      // en mode "harmonie" : une autre harmonie est tirée
  etat.base.variation = 1;        // en mode "camaïeu" : léger jeu sur les nuances
  afficherCouleurBase();
}

SelecteurCouleur.surChangement(suivreSelecteur);
SelecteurCouleur.surAutresCouleurs(function () {
  if (etat.base) regenererCouleurBase();
  else suivreSelecteur(SelecteurCouleur.lire());   // pas encore pris la main : on la prend
});


/* ---------- Bouton Régénérer ---------- */
// Même mood (ou même couleur de base), nouvelle variation (le décalage HUE en cours est conservé).
boutonRegenerer.addEventListener("click", function () {
  if (boutonRegenerer.getAttribute("aria-disabled") === "true") return;

  if (etat.base) {
    regenererCouleurBase();   // se redessine tout seul
  } else {
    definirPalette(Palette.generer(etat.moodPrincipal, etat.moodAccent));
    rafraichir();
  }
});


/* ---------- Retoucher une couleur avec les barres RGB ---------- */

// Un seul recalcul par image affichée, même si les barres envoient plus d'événements.
var rafraichissementPrevu = false;
function rafraichirPlusTard() {
  if (rafraichissementPrevu) return;
  rafraichissementPrevu = true;
  requestAnimationFrame(function () {
    rafraichissementPrevu = false;
    rafraichir();
  });
}

// Mémorise la couleur retouchée dans la palette de base. Pour un mood, une image ou une
// harmonie, une des 9 premières cases est la même en 3x3 et en 4x4 : on la change des
// deux côtés. Pour un camaïeu ou un dégradé, ce sont deux palettes différentes : on ne
// change que celle qui est affichée.
function memoriserCouleur(index, hsl) {
  var affichee = etat.nombreDeCases === 16 ? etat.paletteDeBase : etat.paletteNeuf;
  affichee[index].hsl = { h: hsl.h, s: hsl.s, l: hsl.l };

  if (etat.neufEstLeDebut && index < 9) {
    var autre = affichee === etat.paletteDeBase ? etat.paletteNeuf : etat.paletteDeBase;
    autre[index].hsl = { h: hsl.h, s: hsl.s, l: hsl.l };
  }
}

// Change UN canal (r, g ou b) de la couleur d'une case.
// La couleur affichée est la couleur de base tournée du décalage HUE : on retourne donc
// la couleur retouchée dans l'autre sens avant de la mémoriser. Ainsi la retouche suit
// la barre Teinte, et revient exactement à ce qu'on a réglé quand on remet la teinte à 0.
function retoucherCouleur(index, canal, valeur) {
  var rgb = Couleurs.hslVersRgb(paletteAffichee()[index].hsl);
  rgb[canal] = valeur;
  memoriserCouleur(index, Couleurs.decalerTeinte(Couleurs.rgbVersHsl(rgb), -etat.decalageHue));
  rafraichirPlusTard();
}

grille.addEventListener("input", function (evenement) {
  var barre = evenement.target.closest(".case__barre");
  if (!barre) return;
  var index = Array.prototype.indexOf.call(grille.children, barre.closest(".case"));
  retoucherCouleur(index, barre.dataset.canal, Number(barre.value));
});

// Le bouton « Ajuster » : montre ou cache les barres dans les cases.
boutonAjuster.addEventListener("click", function () {
  etat.ajustement = !etat.ajustement;
  boutonAjuster.setAttribute("aria-pressed", etat.ajustement ? "true" : "false");
  rafraichir();
});


/* ---------- Choix de la grille : 3x3 ou 4x4 ---------- */

// Les descriptions des exports citent la taille de la grille et le nombre de variables.
function mettreAJourDescriptionsExports(nombre) {
  var cotes = Math.round(Math.sqrt(nombre));   // 9 → 3, 16 → 4
  descriptionPngPalette.textContent = "PNG · grille " + cotes + "×" + cotes + " avec les HEX";
  descriptionCss.textContent = "--mood-1 à --mood-" + nombre + " + dégradé en radial-gradient";
}

// Basculer ne change AUCUNE couleur : la palette de base contient toujours
// les 16 couleurs, on affiche seulement les 9 premières ou les 16.
choixGrille.addEventListener("click", function (evenement) {
  var option = evenement.target.closest("[data-cases]");
  if (!option) return;

  etat.nombreDeCases = Number(option.dataset.cases);
  choixGrille.querySelectorAll("[data-cases]").forEach(function (bouton) {
    bouton.setAttribute("aria-checked", bouton === option ? "true" : "false");
  });
  mettreAJourDescriptionsExports(etat.nombreDeCases);
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
    return { contenu: Export.pngDegrade(paletteAffichee(9), mood, etat.intensiteGrain),
             nomFichier: Export.nomDeFichier(champNomExport.value, "degrade", "png"), type: "image/png" };
  }
  if (format === "css") {
    return { contenu: Export.css(couleurs, mood, etat.decalageHue, paletteAffichee(9)),
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
