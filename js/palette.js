/* =========================================================
   palette.js — fabrique les 9 couleurs d'un mood
   ---------------------------------------------------------
   Les 9 couleurs ont chacune un RÔLE :
   - 2 sombres teintés   (jamais de noir pur)
   - 3 tons moyens       (dominante, secondaire, tertiaire)
   - 2 accents           (souvent à l'opposé de la dominante)
   - 2 clairs teintés    (jamais de blanc pur)
   + 7 nuances en plus pour la grille 4x4 (voir creerNuances) : elles
     sont calculées À PARTIR des 9 couleurs de base, qui ne changent pas.

   Tout est calculé en HSL à partir de la fiche du mood (moods.js),
   avec un peu d'aléatoire contrôlé : on tire des valeurs DANS les
   plages du mood, donc chaque palette est différente mais reste
   dans l'ambiance.
   ========================================================= */

var Palette = (function () {

  /* ---------- Réglages généraux ---------- */

  // Bornes de sécurité : aucune couleur ne descend sous 4 % ni ne dépasse
  // 96 % de luminosité, et les sombres / clairs gardent au moins 6 % de
  // saturation pour rester "teintés" (pas de gris neutre, pas de #000 / #FFF).
  var LUMINOSITE_MIN = 4;
  var LUMINOSITE_MAX = 96;
  var SATURATION_MIN_TEINTEE = 6;

  // Place des tons secondaire et tertiaire, en degrés autour de la dominante.
  var ECARTS_HARMONIE = {
    "analogue":               [30, -30],    // voisins sur le cercle
    "complementaire":         [25, 180],    // un voisin + l'opposé
    "complementaire-divisee": [150, 210],   // de part et d'autre de l'opposé
    "triadique":              [120, 240]    // triangle équilatéral
  };


  /* ---------- Aléatoire contrôlé ---------- */

  // Un nombre au hasard entre min et max. Ex : tirer([20, 40]) → 31.7
  function tirer(plage) {
    return plage[0] + Math.random() * (plage[1] - plage[0]);
  }

  // Une petite variation autour d'une valeur. Ex : varier(180, 5) → entre 175 et 185
  function varier(valeur, amplitude) {
    return valeur + (Math.random() * 2 - 1) * amplitude;
  }

  // Un point précis d'une plage : 0 = le minimum, 1 = le maximum, 0.5 = le milieu.
  // Ex : dansLaPlage([20, 60], 0.25) → 30
  function dansLaPlage(plage, position) {
    return plage[0] + position * (plage[1] - plage[0]);
  }


  // Vrai si la teinte est dans la zone des jaunes (entre 40° et 80°).
  function estUnJaune(teinte) {
    var h = Couleurs.normaliserTeinte(teinte);
    return h >= 40 && h <= 80;
  }


  /* ---------- Fabrication d'une couleur ---------- */

  // Assemble une couleur HSL "propre" (teinte bouclée, bornes respectées).
  function creerCouleur(role, libelle, h, s, l, estTeintee) {
    var saturationMin = estTeintee ? SATURATION_MIN_TEINTEE : 0;
    return {
      role: role,          // "sombre", "moyen", "accent" ou "clair"
      libelle: libelle,    // ex : "Dominante"
      hsl: {
        h: Couleurs.normaliserTeinte(h),
        s: Couleurs.limiter(s, saturationMin, 100),
        l: Couleurs.limiter(l, LUMINOSITE_MIN, LUMINOSITE_MAX)
      }
    };
  }


  /* ---------- Les 4 familles de couleurs ---------- */

  // 2 sombres, teintés par la dominante (ou décalés, ex : bleu nuit du Nostalgique).
  function creerSombres(mood, teinteDominante) {
    var reglage = mood.sombres;
    var teinte = teinteDominante + reglage.decalage;
    return [
      creerCouleur("sombre", "Sombre profond", varier(teinte, 4),
        tirer(reglage.saturation), varier(dansLaPlage(reglage.luminosite, 0.2), 1.5), true),
      creerCouleur("sombre", "Sombre", varier(teinte + 8, 4),
        tirer(reglage.saturation), varier(dansLaPlage(reglage.luminosite, 0.85), 1.5), true)
    ];
  }

  // 3 tons moyens placés selon l'harmonie du mood.
  function creerTonsMoyens(mood, teinteDominante) {
    // L'harmonie est soit un nom ("triadique"…), soit des écarts sur mesure ([100, -145]).
    var ecarts = Array.isArray(mood.harmonie) ? mood.harmonie : ECARTS_HARMONIE[mood.harmonie];
    var saturation = tirer(mood.saturation);

    // La tertiaire, souvent plus éloignée sur le cercle, est adoucie pour ne
    // pas voler la vedette aux accents. Quand elle est pile à l'opposé
    // (harmonie complémentaire), on la désature nettement : elle devient un
    // contrepoint discret (ex : le gris-vert "Ash Grey" du Mystérieux).
    var douceurTertiaire = mood.harmonie === "complementaire" ? 0.45 : 0.75;

    return [
      creerCouleur("moyen", "Dominante", teinteDominante,
        saturation, varier(dansLaPlage(mood.luminosite, 0.5), 3), false),
      creerCouleur("moyen", "Secondaire", varier(teinteDominante + ecarts[0], 6),
        saturation * 0.9, varier(dansLaPlage(mood.luminosite, 0.15), 3), false),
      creerCouleur("moyen", "Tertiaire", varier(teinteDominante + ecarts[1], 6),
        saturation * douceurTertiaire, varier(dansLaPlage(mood.luminosite, 0.85), 3), false)
    ];
  }

  // 2 accents. Si un second mood est donné ("nostalgique et serein"),
  // c'est sa teinte dominante qui colore l'accent.
  function creerAccents(mood, teinteDominante, moodAccent) {
    var reglage = mood.accent;
    var teinte = teinteDominante + reglage.decalage;
    var saturation = tirer(reglage.saturation);

    if (moodAccent) {
      teinte = tirer(moodAccent.teinte);
      // On mélange la saturation des deux moods : l'accent garde l'énergie
      // du second mood sans casser le calme (ou l'intensité) du premier.
      saturation = (saturation + tirer(moodAccent.saturation)) / 2;
    }

    var luminosite = tirer(reglage.luminosite);
    var teinte2 = varier(teinte + 18, 4);
    // Le 2e accent est une variation du 1er : teinte voisine, luminosité
    // décalée vers le milieu pour qu'on distingue bien les deux…
    var luminosite2 = luminosite > 50 ? luminosite - 14 : luminosite + 14;
    // … sauf dans les jaunes : un jaune assombri vire à l'olive "boueux",
    // alors on l'éclaircit toujours.
    if (estUnJaune(teinte2)) {
      luminosite2 = luminosite + 14;
    }

    return [
      creerCouleur("accent", "Accent", varier(teinte, 4), saturation, luminosite, false),
      creerCouleur("accent", "Accent doux", teinte2, saturation * 0.8, luminosite2, false)
    ];
  }

  // 2 clairs, teintés (jamais de blanc pur).
  function creerClairs(mood, teinteDominante) {
    var reglage = mood.clairs;
    var teinte = teinteDominante + reglage.decalage;
    return [
      creerCouleur("clair", "Clair", varier(teinte, 4),
        tirer(reglage.saturation), varier(dansLaPlage(reglage.luminosite, 0.2), 1.5), true),
      creerCouleur("clair", "Très clair", varier(teinte - 8, 4),
        tirer(reglage.saturation), varier(dansLaPlage(reglage.luminosite, 0.9), 1.5), true)
    ];
  }


  /* ---------- Les 7 nuances en plus (grille 4x4) ---------- */

  // Un jaune assombri vire à l'olive : pour un ton plus foncé, une teinte
  // jaune (40° à 80°) est glissée vers l'ambre (25° à 35°), un brun chaud.
  function teinteSansOlive(teinte) {
    var h = Couleurs.normaliserTeinte(teinte);
    return estUnJaune(h) ? 25 + (h - 40) / 4 : h;
  }

  // 7 nuances déduites des 9 couleurs de base (dans cet ordre) :
  // sombre moyen, dominante / secondaire / tertiaire claires,
  // accent profond, accent pâle, neutre teinté.
  function creerNuances(base) {
    var dominante = base[2].hsl;
    var secondaire = base[3].hsl;
    var tertiaire = base[4].hsl;
    var accent = base[5].hsl;

    // Une version plus claire d'un ton moyen : même teinte, un peu moins saturée.
    // Un jaune reste franchement clair (55 % minimum), sinon il vire au kaki.
    function eclaircir(libelle, hsl) {
      var teinte = varier(hsl.h, 3);
      var luminosite = Math.min(varier(hsl.l + 18, 2), 90);
      if (estUnJaune(teinte)) luminosite = Math.max(luminosite, 55);
      return creerCouleur("moyen", libelle, teinte, hsl.s * 0.8, luminosite, false);
    }

    // Le sombre moyen se place entre le sombre et la dominante DU MOOD (un mood
    // pastel a des "sombres" déjà clairs) : un peu plus clair que le sombre.
    var sombre = base[1].hsl;
    var luminositeSombreMoyen = sombre.l + Math.max((dominante.l - sombre.l) * 0.35, 6);

    return [
      creerCouleur("sombre", "Sombre moyen", teinteSansOlive(varier(dominante.h, 4)),
        dominante.s * 0.6, varier(luminositeSombreMoyen, 1.5), true),
      eclaircir("Dominante claire", dominante),
      eclaircir("Secondaire claire", secondaire),
      eclaircir("Tertiaire claire", tertiaire),
      creerCouleur("accent", "Accent profond", teinteSansOlive(varier(accent.h, 4)),
        accent.s * 0.9, Math.max(varier(accent.l - 20, 2), 22), false),
      creerCouleur("accent", "Accent pâle", varier(accent.h, 3),
        accent.s * 0.6, varier(86, 2), false),
      creerCouleur("moyen", "Neutre teinté", varier(dominante.h, 4),
        10, varier(60, 3), false)
    ];
  }


  /* ---------- Fonction principale ---------- */

  // Génère les 16 couleurs d'un mood : les 9 de base, puis 7 nuances.
  // - mood       : la fiche du mood principal (voir moods.js)
  // - moodAccent : un second mood qui influence l'accent, ou null
  // Renvoie un tableau de 16 couleurs. Les 9 premières, dans l'ordre d'affichage
  // de la grille 3x3 : 2 sombres, 3 moyens, 2 accents, 2 clairs. Les 7 suivantes
  // complètent la grille 4x4. L'appli affiche les 9 premières ou les 16.
  function generer(mood, moodAccent) {
    var teinteDominante = tirer(mood.teinte);

    var base = []
      .concat(creerSombres(mood, teinteDominante))
      .concat(creerTonsMoyens(mood, teinteDominante))
      .concat(creerAccents(mood, teinteDominante, moodAccent))
      .concat(creerClairs(mood, teinteDominante));

    return base.concat(creerNuances(base));
  }

  return {
    generer: generer
  };

})();
