/* =========================================================
   selecteur.js — le sélecteur de couleur de base
   ---------------------------------------------------------
   Une roue chromatique (dessinée dans un <canvas>), un curseur de
   luminosité, un champ HEX et le choix du mode (camaïeu, dégradé,
   harmonie).

   - La ROUE donne la teinte (l'angle) et la saturation (la distance
     au centre). La luminosité se règle avec le curseur : la roue est
     redessinée à chaque changement de luminosité.
   - En mode "dégradé", il y a DEUX couleurs (départ et arrivée) : les
     boutons Départ / Arrivée disent laquelle la roue modifie.

   Ce fichier ne calcule pas la palette : à chaque geste, il prévient l'appli
   par une fonction (voir surChangement). C'est elle qui calcule la palette
   (couleurBase.js) et met à jour la page, en direct. Au chargement, le
   sélecteur ne change rien : il ne prend la main qu'au premier geste.
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


  /* ---------- L'état du sélecteur ---------- */

  var etat = {
    mode: "camaieu",                                    // "camaieu", "degrade" ou "harmonie"
    cible: "depart",                                    // la couleur que la roue modifie : "depart" ou "arrivee"
    depart: Couleurs.hexVersHsl(COULEUR_DEPART_PAR_DEFAUT),     // { h, s, l }
    arrivee: Couleurs.hexVersHsl(COULEUR_ARRIVEE_PAR_DEFAUT)
  };
  var luminositeDessinee = null;   // la luminosité avec laquelle la roue est dessinée
  var quandCaChange = null;        // la fonction à prévenir à chaque geste (voir surChangement)
  var quandAutresCouleurs = null;  // la fonction à prévenir pour « Autres couleurs »
  var envoiPrevu = false;          // un envoi est déjà prévu à la prochaine image


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


  /* ---------- 3. Prévenir l'appli ---------- */

  // L'état courant (sans modifier le sélecteur).
  function lire() {
    return {
      mode: etat.mode,
      couleur: hex(etat.depart),
      arrivee: hex(etat.arrivee)
    };
  }

  // Prévient l'appli qu'une couleur ou un réglage a changé. Pendant qu'on fait glisser
  // la souris, les événements arrivent bien plus vite que l'écran ne se rafraîchit :
  // on ne prévient donc qu'UNE fois par image (requestAnimationFrame), avec l'état le
  // plus récent. La roue reste fluide, même si la palette et le dégradé se redessinent.
  function prevenir() {
    if (envoiPrevu || !quandCaChange) return;
    envoiPrevu = true;
    requestAnimationFrame(function () {
      envoiPrevu = false;
      quandCaChange(lire());
    });
  }

  // Une couleur ou un réglage a changé par un geste de l'utilisateur :
  // on met à jour l'affichage du sélecteur, puis on prévient l'appli.
  function appliquer(sauterChampHex) {
    afficherCouleurActive(sauterChampHex);
    prevenir();
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
    appliquer();
  });

  roue.addEventListener("pointermove", function (evenement) {
    if (!enGlissement) return;
    pointerSurLaRoue(evenement);
    appliquer();
  });

  function finirGlissement() {
    enGlissement = false;
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
    appliquer();
  });

  // Le curseur de luminosité : la palette suit en continu pendant qu'on le déplace.
  curseurLuminosite.addEventListener("input", function () {
    couleurActive().l = Number(curseurLuminosite.value);
    appliquer();
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
    appliquer(true);   // true : on ne réécrit pas le champ pendant que l'utilisateur tape
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
    afficherSelonLeMode();
    appliquer();
  });

  // Dégradé : Départ ou Arrivée, c'est la couleur que la roue modifie.
  choixCible.addEventListener("click", function (evenement) {
    var bouton = evenement.target.closest("[data-cible]");
    if (!bouton) return;
    etat.cible = bouton.dataset.cible;
    marquerChoix(choixCible, "data-cible", etat.cible);
    afficherCouleurActive();
  });

  // Harmonie : « Autres couleurs » demande une autre harmonie (l'appli tire une autre graine).
  zoneAutreHarmonie.addEventListener("click", function () {
    if (quandAutresCouleurs) quandAutresCouleurs();
  });


  /* ---------- Ce que l'appli peut utiliser ---------- */

  // Donne la fonction à appeler à chaque geste ; elle reçoit { mode, couleur, arrivee }.
  function surChangement(fonction) {
    quandCaChange = fonction;
  }

  // Donne la fonction à appeler quand on clique sur « Autres couleurs ».
  function surAutresCouleurs(fonction) {
    quandAutresCouleurs = fonction;
  }


  /* ---------- Démarrage ---------- */

  // On prépare l'affichage, sans prévenir l'appli : la palette de la page reste celle
  // d'avant (mood, image…) tant que l'utilisateur n'a pas touché au sélecteur.
  afficherSelonLeMode();
  afficherCouleurActive();

  return {
    surChangement: surChangement,
    surAutresCouleurs: surAutresCouleurs,
    lire: lire
  };

})();
