/* =========================================================
   selecteur.js — le sélecteur de couleur de base
   ---------------------------------------------------------
   Une roue chromatique (dessinée dans un <canvas>), un curseur de
   luminosité, un champ HEX, le choix du mode (camaïeu, dégradé,
   harmonie) et un aperçu de la palette calculée par couleurBase.js.

   - La ROUE donne la teinte (l'angle) et la saturation (la distance
     au centre). La luminosité se règle avec le curseur : la roue est
     redessinée à chaque changement de luminosité.
   - En mode "dégradé", il y a DEUX couleurs (départ et arrivée) : les
     boutons Départ / Arrivée disent laquelle la roue modifie.

   Ce fichier ne touche pas à la palette de la page : quand on clique sur
   « Utiliser cette palette », il prévient l'appli par une fonction
   (voir surApplication), qui décide quoi faire.
   ========================================================= */

var SelecteurCouleur = (function () {

  /* ---------- Réglages ---------- */

  var TAILLE_ROUE = 240;                       // côté de la roue, en pixels CSS
  var COULEUR_DEPART_PAR_DEFAUT = "#5188F5";   // un bleu
  var COULEUR_ARRIVEE_PAR_DEFAUT = "#BA52F5";  // un violet
  var PAS_CLAVIER = 2;                         // une flèche = 2° de teinte ou 2 % de saturation
  var PAS_CLAVIER_RAPIDE = 10;                 // avec Maj : 10


  /* ---------- Les éléments de la page ---------- */

  var bloc = document.getElementById("bloc-base");
  var roue = document.getElementById("roue");
  var canvasRoue = document.getElementById("roue-canvas");
  var repereRoue = document.getElementById("roue-repere");
  var curseurLuminosite = document.getElementById("curseur-luminosite");
  var champHex = document.getElementById("champ-hex");
  var pastilleActive = document.getElementById("pastille-active");
  var pastilleDepart = document.getElementById("pastille-depart");
  var pastilleArrivee = document.getElementById("pastille-arrivee");
  var choixMode = document.getElementById("choix-mode");
  var choixCible = document.getElementById("base-cibles");
  var zoneAutreHarmonie = document.getElementById("bouton-autre-harmonie");
  var boutonUtiliser = document.getElementById("bouton-utiliser-palette");
  var titreApercu = document.getElementById("base-titre");
  var apercu = document.getElementById("base-apercu");


  /* ---------- L'état du sélecteur ---------- */

  var etat = {
    mode: "camaieu",                                    // "camaieu", "degrade" ou "harmonie"
    cible: "depart",                                    // la couleur que la roue modifie : "depart" ou "arrivee"
    depart: Couleurs.hexVersHsl(COULEUR_DEPART_PAR_DEFAUT),     // { h, s, l }
    arrivee: Couleurs.hexVersHsl(COULEUR_ARRIVEE_PAR_DEFAUT),
    harmonie: null,                                     // l'harmonie tirée au hasard (mode "harmonie")
    nombre: 9,                                          // 9 (grille 3x3) ou 16 (grille 4x4)
    resultat: null                                      // la dernière palette calculée
  };
  var luminositeDessinee = null;   // la luminosité avec laquelle la roue est dessinée
  var quandOnApplique = null;      // la fonction à prévenir (voir surApplication)


  /* ---------- Petits outils ---------- */

  function couleurActive() {
    return etat[etat.cible];
  }

  function hex(hsl) {
    return Couleurs.hslVersHex(hsl);
  }

  // Un "HEX" saisi (avec ou sans #, 3 ou 6 caractères) est-il valide ?
  function hexValide(texte) {
    return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(texte.trim());
  }


  /* ---------- 1. La roue ---------- */

  // Dessine la roue pour la luminosité de la couleur active.
  // Chaque point du disque : l'angle donne la teinte, la distance au centre
  // la saturation (0 % au centre, 100 % au bord).
  function dessinerRoue() {
    var echelle = Math.min(window.devicePixelRatio || 1, 2);   // écrans nets, sans alourdir
    var taille = Math.round(TAILLE_ROUE * echelle);
    canvasRoue.width = taille;
    canvasRoue.height = taille;

    var ctx = canvasRoue.getContext("2d");
    var image = ctx.createImageData(taille, taille);
    var rayon = taille / 2;
    var luminosite = couleurActive().l;

    for (var y = 0; y < taille; y++) {
      for (var x = 0; x < taille; x++) {
        var dx = x + 0.5 - rayon;
        var dy = y + 0.5 - rayon;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > rayon) continue;   // hors du disque : pixel transparent

        var teinte = Couleurs.normaliserTeinte(Math.atan2(dy, dx) * 180 / Math.PI);
        var rgb = Couleurs.hslVersRgb({ h: teinte, s: distance / rayon * 100, l: luminosite });
        var position = (y * taille + x) * 4;
        image.data[position] = rgb.r;
        image.data[position + 1] = rgb.g;
        image.data[position + 2] = rgb.b;
        // Bord doux sur le dernier pixel : le cercle n'est pas crénelé
        image.data[position + 3] = Math.round(255 * Couleurs.limiter(rayon - distance, 0, 1));
      }
    }
    ctx.putImageData(image, 0, 0);
    luminositeDessinee = luminosite;
  }

  // Place le repère rond sur la roue, à l'endroit de la couleur active.
  function placerRepere() {
    var couleur = couleurActive();
    var angle = couleur.h * Math.PI / 180;
    var distance = couleur.s / 100 * 50;   // en % de la largeur de la roue (le rayon vaut 50 %)
    repereRoue.style.left = (50 + Math.cos(angle) * distance) + "%";
    repereRoue.style.top = (50 + Math.sin(angle) * distance) + "%";
    repereRoue.style.background = hex(couleur);
  }

  // Une position de souris ou de doigt → une teinte et une saturation.
  function pointerSurLaRoue(evenement) {
    var cadre = canvasRoue.getBoundingClientRect();
    var dx = evenement.clientX - (cadre.left + cadre.width / 2);
    var dy = evenement.clientY - (cadre.top + cadre.height / 2);
    var rayon = cadre.width / 2;

    var couleur = couleurActive();
    couleur.h = Couleurs.normaliserTeinte(Math.atan2(dy, dx) * 180 / Math.PI);
    couleur.s = Couleurs.limiter(Math.sqrt(dx * dx + dy * dy) / rayon * 100, 0, 100);
  }


  /* ---------- 2. Mise à jour de l'affichage ---------- */

  // Colore la piste du curseur de luminosité : du foncé au clair, pour la teinte
  // et la saturation de la couleur active.
  function colorerCurseur() {
    var couleur = couleurActive();
    var base = Math.round(couleur.h) + " " + Math.round(couleur.s) + "%";
    curseurLuminosite.style.setProperty("--piste",
      "linear-gradient(to right, hsl(" + base + " 0%), hsl(" + base + " 50%), hsl(" + base + " 100%))");
  }

  // Met à jour tout ce qui montre la couleur active : roue, repère, curseur, HEX, pastilles.
  function afficherCouleurActive(sauterChampHex) {
    var couleur = couleurActive();
    if (luminositeDessinee !== couleur.l) dessinerRoue();
    placerRepere();
    colorerCurseur();
    curseurLuminosite.value = Math.round(couleur.l);
    if (!sauterChampHex) {
      champHex.value = hex(couleur);
      champHex.removeAttribute("aria-invalid");
    }
    pastilleActive.style.background = hex(couleur);
    pastilleDepart.style.background = hex(etat.depart);
    pastilleArrivee.style.background = hex(etat.arrivee);
  }

  // Marque le bouton choisi d'un groupe (aria-checked), pour les modes comme pour la cible.
  function marquerChoix(conteneur, attribut, valeur) {
    conteneur.querySelectorAll("[" + attribut + "]").forEach(function (bouton) {
      bouton.setAttribute("aria-checked", bouton.getAttribute(attribut) === valeur ? "true" : "false");
    });
  }

  // Les parties de l'interface qui dépendent du mode.
  function afficherSelonLeMode() {
    marquerChoix(choixMode, "data-mode", etat.mode);
    choixCible.hidden = etat.mode !== "degrade";
    zoneAutreHarmonie.hidden = etat.mode !== "harmonie";
    if (etat.mode !== "degrade" && etat.cible !== "depart") {
      etat.cible = "depart";   // hors dégradé, il n'y a qu'une couleur : celle de départ
      marquerChoix(choixCible, "data-cible", etat.cible);
    }
  }


  /* ---------- 3. L'aperçu de la palette ---------- */

  // Calcule la palette. En mode "harmonie", les couleurs sont tirées au hasard :
  // on ne recalcule donc qu'à la fin d'un geste ("valider"), pas pendant qu'on
  // fait glisser la souris (sinon l'aperçu scintillerait).
  function recalculerApercu(valider) {
    if (etat.mode === "harmonie" && !valider && etat.resultat) {
      apercu.classList.add("base__apercu--attente");
      return;
    }
    apercu.classList.remove("base__apercu--attente");

    etat.resultat = CouleurBase.generer({
      mode: etat.mode,
      couleur: hex(etat.depart),
      arrivee: hex(etat.arrivee),
      harmonie: etat.harmonie
    });
    etat.harmonie = etat.resultat.harmonie;   // on garde la même harmonie jusqu'à "Autres couleurs"
    dessinerApercu();
  }

  function dessinerApercu() {
    var couleurs = etat.nombre === 16 ? etat.resultat.seize : etat.resultat.neuf;
    titreApercu.textContent = etat.resultat.titre;
    apercu.classList.toggle("base__apercu--16", etat.nombre === 16);
    apercu.textContent = "";
    couleurs.forEach(function (couleur) {
      var case_ = document.createElement("span");
      case_.className = "base__apercu-case";
      case_.style.background = hex(couleur.hsl);
      case_.title = couleur.libelle + " " + hex(couleur.hsl);
      apercu.appendChild(case_);
    });
  }

  // Une couleur ou un réglage a changé : on met tout à jour.
  // "valider" vaut vrai à la fin d'un geste (relâcher la souris, taper un HEX, changer de mode…).
  function appliquer(valider, sauterChampHex) {
    afficherCouleurActive(sauterChampHex);
    recalculerApercu(valider);
  }


  /* ---------- 4. Les gestes de l'utilisateur ---------- */

  // La roue : souris ou doigt (pointer events). Pendant le glissement, on met à jour
  // en continu ; au relâchement, on "valide".
  var enGlissement = false;

  roue.addEventListener("pointerdown", function (evenement) {
    enGlissement = true;
    roue.setPointerCapture(evenement.pointerId);
    roue.focus();
    pointerSurLaRoue(evenement);
    appliquer(false);
  });

  roue.addEventListener("pointermove", function (evenement) {
    if (!enGlissement) return;
    pointerSurLaRoue(evenement);
    appliquer(false);
  });

  function finirGlissement() {
    if (!enGlissement) return;
    enGlissement = false;
    appliquer(true);
  }
  roue.addEventListener("pointerup", finirGlissement);
  roue.addEventListener("pointercancel", finirGlissement);

  // La roue au clavier : gauche / droite = teinte, haut / bas = saturation (Maj = plus vite).
  roue.addEventListener("keydown", function (evenement) {
    var pas = evenement.shiftKey ? PAS_CLAVIER_RAPIDE : PAS_CLAVIER;
    var couleur = couleurActive();
    if (evenement.key === "ArrowRight") couleur.h = Couleurs.normaliserTeinte(couleur.h + pas);
    else if (evenement.key === "ArrowLeft") couleur.h = Couleurs.normaliserTeinte(couleur.h - pas);
    else if (evenement.key === "ArrowUp") couleur.s = Couleurs.limiter(couleur.s + pas, 0, 100);
    else if (evenement.key === "ArrowDown") couleur.s = Couleurs.limiter(couleur.s - pas, 0, 100);
    else return;
    evenement.preventDefault();
    appliquer(true);
  });

  // Le curseur de luminosité : en continu pendant qu'on le déplace, validé au relâchement.
  curseurLuminosite.addEventListener("input", function () {
    couleurActive().l = Number(curseurLuminosite.value);
    appliquer(false);
  });
  curseurLuminosite.addEventListener("change", function () {
    appliquer(true);
  });

  // Le champ HEX : dès que le code est valide, la couleur est appliquée.
  champHex.addEventListener("input", function () {
    if (!hexValide(champHex.value)) {
      champHex.setAttribute("aria-invalid", "true");
      return;
    }
    champHex.removeAttribute("aria-invalid");
    var texte = champHex.value.trim();
    var couleur = Couleurs.hexVersHsl(texte.charAt(0) === "#" ? texte : "#" + texte);
    etat[etat.cible] = couleur;
    appliquer(true, true);   // true : on ne réécrit pas le champ pendant que l'utilisateur tape
  });
  // En sortant du champ, on remet un HEX propre ("5188f5" → "#5188F5", ou l'ancien si invalide).
  champHex.addEventListener("blur", function () {
    champHex.value = hex(couleurActive());
    champHex.removeAttribute("aria-invalid");
  });

  // Le choix du mode : camaïeu, dégradé ou harmonie.
  choixMode.addEventListener("click", function (evenement) {
    var bouton = evenement.target.closest("[data-mode]");
    if (!bouton) return;
    etat.mode = bouton.dataset.mode;
    etat.harmonie = null;   // une nouvelle harmonie sera tirée si on passe en "harmonie"
    afficherSelonLeMode();
    appliquer(true);
  });

  // Dégradé : Départ ou Arrivée, c'est la couleur que la roue modifie.
  choixCible.addEventListener("click", function (evenement) {
    var bouton = evenement.target.closest("[data-cible]");
    if (!bouton) return;
    etat.cible = bouton.dataset.cible;
    marquerChoix(choixCible, "data-cible", etat.cible);
    afficherCouleurActive();
  });

  // « Utiliser cette palette » : l'appli reçoit ce que montre l'aperçu.
  boutonUtiliser.addEventListener("click", function () {
    if (quandOnApplique && etat.resultat) quandOnApplique(lire());
  });

  // Harmonie : « Autres couleurs » tire une autre harmonie au hasard.
  zoneAutreHarmonie.addEventListener("click", function () {
    etat.harmonie = null;
    appliquer(true);
  });


  /* ---------- Ce que l'appli peut utiliser ---------- */

  // Donne la fonction à appeler quand on clique sur « Utiliser cette palette ».
  function surApplication(fonction) {
    quandOnApplique = fonction;
  }

  // 9 (grille 3x3) ou 16 (grille 4x4) : l'aperçu suit la grille choisie.
  function definirNombre(nombre) {
    etat.nombre = nombre;
    if (etat.resultat) dessinerApercu();
  }

  // L'état courant (sans modifier le sélecteur).
  function lire() {
    return {
      mode: etat.mode,
      couleur: hex(etat.depart),
      arrivee: hex(etat.arrivee),
      harmonie: etat.harmonie,
      resultat: etat.resultat
    };
  }


  /* ---------- Démarrage ---------- */

  afficherSelonLeMode();
  appliquer(true);

  return {
    surApplication: surApplication,
    definirNombre: definirNombre,
    lire: lire
  };

})();
