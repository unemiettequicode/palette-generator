/* =========================================================
   image.js — lit les couleurs d'une image importée
   ---------------------------------------------------------
   Principe :
   1. On dessine l'image en petit (150 px maximum) dans un canvas
      qui n'est pas affiché : c'est rapide, même pour une grande photo.
   2. On lit un pixel sur PAS_ECHANTILLON et on le convertit en HSL
      (avec colors.js).
   3. On range les teintes par "familles" de 15° sur le cercle
      chromatique (0-15°, 15-30°…) et on compte chaque famille.
   4. On renvoie la teinte dominante, une teinte secondaire et la
      saturation moyenne de l'image.

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
  var ECART_MIN_SECONDAIRE = 30;   // la secondaire doit être au moins à 30° de la dominante…
  var PART_MIN_SECONDAIRE = 0.05;  // … et représenter au moins 5 % des pixels colorés


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
      familles.push({ debut: f * LARGEUR_FAMILLE, nombre: 0, sommeTeintes: 0 });
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
    }

    return {
      familles: familles,
      pixelsUtiles: pixelsUtiles,
      pixelsColores: pixelsColores,
      saturationMoyenne: pixelsUtiles > 0 ? sommeSaturations / pixelsUtiles : 0
    };
  }


  /* ---------- 3. Choisir dominante et secondaire ---------- */

  // Teinte moyenne des pixels d'une famille (plus précise que le début de la tranche).
  function teinteDeFamille(famille) {
    return famille.sommeTeintes / famille.nombre;
  }

  function choisirTeintes(comptage) {
    // Familles triées de la plus fréquente à la moins fréquente
    var triees = comptage.familles
      .filter(function (famille) { return famille.nombre > 0; })
      .sort(function (a, b) { return b.nombre - a.nombre; });

    if (triees.length === 0) {
      // Image en noir et blanc (ou presque) : aucune teinte significative
      return { dominante: null, secondaire: null };
    }

    var dominante = teinteDeFamille(triees[0]);

    // La secondaire : la famille suivante la plus fréquente qui est vraiment
    // DIFFÉRENTE de la dominante (au moins 30° d'écart) et assez présente.
    // Sinon (image presque monochrome), on prend simplement la 2e famille,
    // souvent une voisine : la palette restera analogue.
    var secondaire = null;
    for (var i = 1; i < triees.length; i++) {
      var teinte = teinteDeFamille(triees[i]);
      var part = triees[i].nombre / comptage.pixelsColores;
      if (ecartDeTeinte(teinte, dominante) >= ECART_MIN_SECONDAIRE && part >= PART_MIN_SECONDAIRE) {
        secondaire = teinte;
        break;
      }
    }
    if (secondaire === null) {
      secondaire = triees.length > 1 ? teinteDeFamille(triees[1]) : dominante;
    }

    return { dominante: dominante, secondaire: secondaire, triees: triees };
  }


  /* ---------- Fonction principale ---------- */

  // Analyse un fichier image. Renvoie une promesse de :
  // {
  //   teinteDominante:   0-360, ou null si l'image n'a pas de couleur
  //   teinteSecondaire:  0-360, ou null
  //   saturationMoyenne: 0-100
  //   familles:          les 5 familles les plus fréquentes (pour vérifier)
  // }
  function analyser(fichier) {
    return chargerImage(fichier).then(function (image) {
      var comptage = analyserPixels(lirePixels(image));
      var teintes = choisirTeintes(comptage);

      var principales = (teintes.triees || []).slice(0, 5).map(function (famille) {
        return {
          tranche: famille.debut + "-" + (famille.debut + LARGEUR_FAMILLE) + "°",
          part: Math.round(100 * famille.nombre / comptage.pixelsColores) + " %"
        };
      });

      return {
        teinteDominante: teintes.dominante,
        teinteSecondaire: teintes.secondaire,
        saturationMoyenne: comptage.saturationMoyenne,
        familles: principales
      };
    });
  }

  return {
    analyser: analyser,
    ecartDeTeinte: ecartDeTeinte
  };

})();
