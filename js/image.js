/* =========================================================
   image.js — lit les couleurs d'une image importée
   ---------------------------------------------------------
   Principe :
   1. On dessine l'image en petit (150 px maximum) dans un canvas
      qui n'est pas affiché : c'est rapide, même pour une grande photo.
   2. On lit un pixel sur PAS_ECHANTILLON et on le convertit en HSL
      (avec colors.js).
   3. On range les teintes par "familles" de 15° sur le cercle
      chromatique (0-15°, 15-30°…). Pour chaque famille on note le nombre
      de pixels, leur saturation et leur luminosité moyennes.
   4. On regroupe les familles voisines (moins de 25° d'écart) en "blocs"
      de couleur : la peau, le brun et l'orange forment ainsi UN bloc.
   5. On classe les blocs par POIDS VISUEL (pixels x saturation : un vert
      vif compte plus qu'un brun terne) et on garde les 4 premiers.
   6. Pour chaque bloc, la "pipette" relève la vraie couleur moyenne :
      teinte, saturation, luminosité et HEX.

   Les pixels presque noirs ou presque blancs sont ignorés pour la
   teinte : ils n'en ont pas vraiment, et fausseraient le résultat.
   ========================================================= */

var ImageCouleurs = (function () {

  /* ---------- Réglages ---------- */
  var TAILLE_ANALYSE = 150;        // côté le plus long de l'image analysée, en pixels
  var PAS_ECHANTILLON = 2;         // on lit 1 pixel sur 2
  var LARGEUR_FAMILLE = 15;        // une famille de teintes = 15° du cercle
  var LUMINOSITE_MIN = 8;          // en dessous : presque noir, ignoré pour la teinte
  var LUMINOSITE_MAX = 92;         // au-dessus : presque blanc, ignoré pour la teinte
  var SATURATION_MIN = 8;          // en dessous : gris, teinte non significative
  var NOMBRE_TEINTES = 4;          // nombre de blocs de couleur retenus
  var ECART_MIN_TEINTES = 25;      // rayon d'un bloc : deux blocs retenus sont au moins à 25° l'un de l'autre
  var PART_MIN_TEINTE = 0.03;      // un bloc doit peser au moins 3 % du poids visuel total


  /* ---------- 1. Charger l'image ---------- */

  // Transforme un fichier en image utilisable. Renvoie une promesse.
  function chargerImage(fichier) {
    return new Promise(function (resoudre, rejeter) {
      var image = new Image();
      var adresse = URL.createObjectURL(fichier);
      image.onload = function () {
        URL.revokeObjectURL(adresse);
        resoudre(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(adresse);
        rejeter(new Error("Image illisible"));
      };
      image.src = adresse;
    });
  }

  // Dessine l'image en petit dans un canvas non affiché et renvoie ses pixels.
  function lirePixels(image) {
    var echelle = Math.min(1, TAILLE_ANALYSE / Math.max(image.naturalWidth, image.naturalHeight));
    var largeur = Math.max(1, Math.round(image.naturalWidth * echelle));
    var hauteur = Math.max(1, Math.round(image.naturalHeight * echelle));

    var canvas = document.createElement("canvas");   // jamais ajouté à la page
    canvas.width = largeur;
    canvas.height = hauteur;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, largeur, hauteur);
    return ctx.getImageData(0, 0, largeur, hauteur).data;   // [r, g, b, a, r, g, b, a, …]
  }


  /* ---------- 2. Compter les familles de teintes ---------- */

  // Écart entre deux teintes sur le cercle (toujours entre 0 et 180°).
  // Ex : 350° et 10° → 20°, pas 340°.
  function ecartDeTeinte(a, b) {
    var ecart = Math.abs(a - b) % 360;
    return ecart > 180 ? 360 - ecart : ecart;
  }

  function analyserPixels(pixels) {
    var nombreDeFamilles = 360 / LARGEUR_FAMILLE;   // 24 familles
    var familles = [];
    for (var f = 0; f < nombreDeFamilles; f++) {
      familles.push({
        debut: f * LARGEUR_FAMILLE,
        nombre: 0,
        sommeTeintes: 0,
        sommeSaturations: 0,
        sommeLuminosites: 0
      });
    }

    var sommeSaturations = 0;
    var pixelsUtiles = 0;     // ni presque noirs ni presque blancs
    var pixelsColores = 0;    // utiles ET assez saturés pour avoir une teinte

    for (var i = 0; i < pixels.length; i += 4 * PAS_ECHANTILLON) {
      if (pixels[i + 3] < 128) continue;   // pixel transparent (PNG détouré) : ignoré

      var hsl = Couleurs.rgbVersHsl({ r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] });
      if (hsl.l < LUMINOSITE_MIN || hsl.l > LUMINOSITE_MAX) continue;

      pixelsUtiles++;
      sommeSaturations += hsl.s;

      if (hsl.s < SATURATION_MIN) continue;
      pixelsColores++;
      var famille = familles[Math.floor(hsl.h / LARGEUR_FAMILLE) % nombreDeFamilles];
      famille.nombre++;
      famille.sommeTeintes += hsl.h;
      famille.sommeSaturations += hsl.s;
      famille.sommeLuminosites += hsl.l;
    }

    return {
      familles: familles,
      pixelsUtiles: pixelsUtiles,
      pixelsColores: pixelsColores,
      saturationMoyenne: pixelsUtiles > 0 ? sommeSaturations / pixelsUtiles : 0
    };
  }


  /* ---------- 3. Regrouper en blocs et relever les couleurs ---------- */

  // Teinte moyenne des pixels d'une famille (plus précise que le début de la tranche).
  function teinteDeFamille(famille) {
    return famille.sommeTeintes / famille.nombre;
  }

  // Poids visuel d'une famille : nombre de pixels x saturation moyenne.
  // Une petite zone très colorée pèse plus qu'une grande zone terne.
  function poidsDeFamille(famille) {
    return famille.sommeSaturations;   // = somme des saturations de chaque pixel
  }

  // Teinte moyenne de plusieurs familles. On passe par des flèches (cos / sin)
  // car le cercle boucle : la moyenne de 350° et 10° doit donner 0°, pas 180°.
  function teinteMoyenneDesFamilles(familles) {
    var x = 0;
    var y = 0;
    familles.forEach(function (famille) {
      var angle = teinteDeFamille(famille) * Math.PI / 180;
      x += famille.nombre * Math.cos(angle);
      y += famille.nombre * Math.sin(angle);
    });
    return Couleurs.normaliserTeinte(Math.atan2(y, x) * 180 / Math.PI);
  }

  // La "pipette" : résume un bloc de familles en UNE vraie couleur de l'image
  // (teinte, saturation et luminosité moyennes des pixels du bloc).
  function releverCouleur(bloc, poidsTotal) {
    var nombre = 0;
    var sommeSaturations = 0;
    var sommeLuminosites = 0;
    bloc.forEach(function (famille) {
      nombre += famille.nombre;
      sommeSaturations += famille.sommeSaturations;
      sommeLuminosites += famille.sommeLuminosites;
    });

    var couleur = {
      h: teinteMoyenneDesFamilles(bloc),
      s: sommeSaturations / nombre,
      l: sommeLuminosites / nombre
    };
    return {
      teinte: couleur.h,
      saturation: couleur.s,
      luminosite: couleur.l,
      hex: Couleurs.hslVersHex(couleur),
      part: sommeSaturations / poidsTotal   // part du poids visuel total (0 à 1)
    };
  }

  // Choisit les blocs de couleur les plus présents, du plus lourd au plus léger.
  function choisirTeintes(comptage) {
    var libres = comptage.familles
      .filter(function (famille) { return famille.nombre > 0; })
      .sort(function (a, b) { return poidsDeFamille(b) - poidsDeFamille(a); });

    var poidsTotal = libres.reduce(function (somme, famille) {
      return somme + poidsDeFamille(famille);
    }, 0);

    var teintes = [];
    while (libres.length > 0 && teintes.length < NOMBRE_TEINTES) {
      var pic = libres[0];   // la famille la plus lourde qui reste

      // Le bloc : le pic + toutes les familles voisines (moins de 25° d'écart).
      var bloc = libres.filter(function (famille) {
        return ecartDeTeinte(teinteDeFamille(famille), teinteDeFamille(pic)) < ECART_MIN_TEINTES;
      });
      libres = libres.filter(function (famille) { return bloc.indexOf(famille) === -1; });

      // Un bloc trop discret est écarté (on juge le bloc ENTIER, pas une seule tranche),
      // sauf le tout premier : même une image presque grise a une dominante.
      var poidsBloc = bloc.reduce(function (somme, famille) { return somme + poidsDeFamille(famille); }, 0);
      if (teintes.length > 0 && poidsBloc / poidsTotal < PART_MIN_TEINTE) continue;

      teintes.push(releverCouleur(bloc, poidsTotal));
    }
    return teintes;
  }

  /* ---------- Fonction principale ---------- */

  // Analyse un fichier image. Renvoie une promesse de :
  // {
  //   teintes:           jusqu'à 4 couleurs relevées dans l'image, de la plus présente
  //                      à la moins présente : { teinte, saturation, luminosite, hex, part }
  //                      (tableau vide si l'image n'a aucune couleur : noir et blanc)
  //   teinteDominante:   teinte de la 1re couleur (0-360), ou null
  //   teinteSecondaire:  teinte de la 2e couleur (la dominante si l'image n'en a qu'une), ou null
  //   saturationMoyenne: 0-100
  // }
  function analyser(fichier) {
    return chargerImage(fichier).then(function (image) {
      var comptage = analyserPixels(lirePixels(image));
      var teintes = choisirTeintes(comptage);

      return {
        teintes: teintes,
        teinteDominante: teintes.length > 0 ? teintes[0].teinte : null,
        teinteSecondaire: teintes.length > 1 ? teintes[1].teinte
                        : (teintes.length > 0 ? teintes[0].teinte : null),
        saturationMoyenne: comptage.saturationMoyenne
      };
    });
  }

  /* ---------- Des couleurs de l'image aux paramètres de palette ---------- */

  // Choisit l'harmonie selon l'écart entre la dominante et la secondaire :
  // - moins de 60°          → analogue (couleurs voisines)
  // - de 60° à moins de 150° → complémentaire divisée
  // - 150° et plus          → complémentaire (couleurs opposées)
  function choisirHarmonie(ecart) {
    if (ecart < 60) return "analogue";
    if (ecart < 150) return "complementaire-divisee";
    return "complementaire";
  }

  // Écart SIGNÉ de la dominante vers la secondaire, entre -180° et +180°
  // (le signe dit dans quel sens tourner sur le cercle).
  function ecartSigne(depart, arrivee) {
    var ecart = ((arrivee - depart) % 360 + 360) % 360;
    return ecart > 180 ? ecart - 360 : ecart;
  }

  // Vrai si la teinte est dans la zone des jaunes (40° à 80°) : assombris,
  // ils virent au kaki, donc on évite de les mettre dans un ton sombre.
  function estUnJaune(teinte) {
    var h = Couleurs.normaliserTeinte(teinte);
    return h >= 40 && h <= 80;
  }

  // Image riche en couleurs (3 ou 4 teintes relevées) : chaque teinte trouve sa place.
  // - dominante          → ton moyen "Dominante"
  // - la plus vive       → accent (un accent est une petite touche d'intensité)
  // - les autres         → tons moyens "Secondaire" et "Tertiaire"
  function parametresMulticolore(analyse) {
    var dominante = analyse.teintes[0];
    var autres = analyse.teintes.slice(1);   // de la plus présente à la moins présente

    var accent = autres.reduce(function (plusVive, teinte) {
      return teinte.saturation > plusVive.saturation ? teinte : plusVive;
    });
    var tonsMoyens = autres.filter(function (teinte) { return teinte !== accent; });

    // Écarts (en degrés) de la dominante vers la secondaire puis la tertiaire.
    var ecarts = tonsMoyens.map(function (teinte) {
      return ecartSigne(dominante.teinte, teinte.teinte);
    });
    // Image à 3 teintes seulement : la tertiaire est une teinte intermédiaire
    // entre la dominante et la secondaire.
    if (ecarts.length === 1) {
      ecarts.push(ecarts[0] / 2);
    }
    // La secondaire est le ton moyen le plus sombre, la tertiaire le plus clair :
    // un jaune doit donc être en tertiaire (sinon il vire au kaki).
    if (estUnJaune(dominante.teinte + ecarts[0]) && !estUnJaune(dominante.teinte + ecarts[1])) {
      ecarts.reverse();
    }

    return {
      teinte: dominante.teinte,
      harmonie: ecarts,   // écarts sur mesure, comme les moods : [secondaire, tertiaire]
      saturation: analyse.saturationMoyenne,
      ecartAccent: ecartSigne(dominante.teinte, accent.teinte),
      nom: "Image importée",
      id: "image"
    };
  }

  // Traduit le résultat de analyser() en paramètres pour Palette.ficheDepuisParametres().
  function parametresPalette(analyse) {
    // Image noir et blanc : pas de teinte. On fait une palette de gris
    // légèrement réchauffés (teinte 30°, saturation très basse).
    if (analyse.teinteDominante === null) {
      return { teinte: 30, harmonie: "analogue", saturation: 4, ecartAccent: -20,
               nom: "Image importée", id: "image" };
    }

    // 3 ou 4 teintes relevées : chacune a sa place dans la palette.
    if (analyse.teintes.length >= 3) {
      return parametresMulticolore(analyse);
    }

    // 1 ou 2 teintes : dominante + secondaire (qui colore l'accent).
    var ecart = ecartSigne(analyse.teinteDominante, analyse.teinteSecondaire);
    // Image monochrome (secondaire = dominante) : accent voisin plutôt qu'identique.
    // On tourne de 30°, mais pas vers les jaunes (40-80°) : assombris, ils
    // virent au kaki. Dans ce cas, on tourne dans l'autre sens.
    if (Math.abs(ecart) < 15) {
      ecart = estUnJaune(analyse.teinteDominante + 30) ? -30 : 30;
    }

    return {
      teinte: analyse.teinteDominante,
      harmonie: choisirHarmonie(Math.abs(ecart)),
      saturation: analyse.saturationMoyenne,
      ecartAccent: ecart,   // la secondaire de l'image colore l'accent
      nom: "Image importée",
      id: "image"
    };
  }

  return {
    analyser: analyser,
    parametresPalette: parametresPalette,
    ecartDeTeinte: ecartDeTeinte
  };

})();
