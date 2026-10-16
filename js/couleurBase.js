/* =========================================================
   couleurBase.js — une palette à partir d'une couleur choisie
   ---------------------------------------------------------
   On part d'une couleur de base (un HEX) et on choisit comment
   calculer le reste, selon 3 modes :

   - "camaieu"  : une seule teinte, du plus foncé au plus clair.
   - "degrade"  : une transition régulière entre 2 couleurs choisies
                  (départ = la base, arrivée = une 2e couleur).
   - "harmonie" : la couleur de base + d'autres teintes tirées au hasard
                  selon une règle d'harmonie (analogue, complémentaire…).
                  C'est le moteur de palette.js qui fait le travail.

   La couleur choisie est TOUJOURS présente telle quelle (même HEX).

   Pour chaque mode, on fabrique DEUX palettes : une de 9 couleurs
   (grille 3x3) et une de 16 couleurs (grille 4x4). Un dégradé de 16
   étapes n'est pas un dégradé de 9 étapes avec 7 en plus : il faut
   deux calculs. Les couleurs sont rangées dans l'ordre d'affichage.
   ========================================================= */

var CouleurBase = (function () {

  /* ---------- Réglages ---------- */

  var LUMINOSITE_CAMAIEU_MIN = 10;   // le camaïeu va de 10 %…
  var LUMINOSITE_CAMAIEU_MAX = 95;   // … à 95 % de luminosité (jamais de noir ni de blanc purs)
  var SATURATION_MIN_TEINTEE = 6;    // en dessous, une nuance ne serait plus "teintée"
  var SATURATION_GRIS = 6;           // en dessous : un gris, sa teinte ne veut rien dire

  // Les 4 harmonies possibles pour le mode "harmonie", et l'écart (en degrés)
  // entre la couleur de base et l'accent pour chacune.
  var HARMONIES = {
    "analogue":               { libelle: "analogue",                ecartAccent: 45 },
    "complementaire":         { libelle: "complémentaire",          ecartAccent: 180 },
    "complementaire-divisee": { libelle: "complémentaire divisée",  ecartAccent: 150 },
    "triadique":              { libelle: "triadique",               ecartAccent: 120 }
  };
  var NOMS_HARMONIES = Object.keys(HARMONIES);


  /* ---------- Petits outils ---------- */

  // Un générateur de hasard "stable" (mulberry32) : avec la même graine (un nombre),
  // il donne toujours la même suite de nombres entre 0 et 1. Une palette calculée avec
  // la même graine est donc toujours la même ; une autre graine donne une autre
  // palette. Les opérations binaires (>>>, imul) gardent les calculs sur 32 bits.
  function creerHasard(graine) {
    var etat = graine >>> 0;
    return function () {
      etat = (etat + 0x6D2B79F5) >>> 0;
      var t = etat;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Une nouvelle graine au hasard.
  function nouvelleGraine() {
    return Math.floor(Math.random() * 4294967296);
  }

  // Vrai si la teinte est dans la zone des jaunes (40° à 80°) : assombris,
  // ils virent à l'olive (comme dans palette.js).
  function estUnJaune(teinte) {
    var h = Couleurs.normaliserTeinte(teinte);
    return h >= 40 && h <= 80;
  }

  // Pareil, avec une marge de 8° de chaque côté (32° à 88°) : palette.js fait varier
  // chaque teinte de quelques degrés au hasard, une teinte pile à côté des jaunes
  // peut donc y entrer. On s'en sert pour DÉCIDER des précautions à prendre.
  function estProcheDuJaune(teinte) {
    var h = Couleurs.normaliserTeinte(teinte);
    return h >= 32 && h <= 88;
  }

  // Assemble une couleur au format de l'appli : { role, libelle, hsl }.
  function creerCouleur(role, libelle, hsl) {
    return {
      role: role,
      libelle: libelle,
      hsl: {
        h: Couleurs.normaliserTeinte(hsl.h),
        s: Couleurs.limiter(hsl.s, 0, 100),
        l: Couleurs.limiter(hsl.l, 0, 100)
      }
    };
  }

  function hexAffichable(hex) {
    return Couleurs.hslVersHex(Couleurs.hexVersHsl(hex));   // "#5b3" → "#5533BB", en majuscules
  }


  /* ---------- Mode 1 : le camaïeu ---------- */

  // Un camaïeu "naturel" : les nuances très foncées ou très claires sont un
  // peu moins saturées que la couleur de base.
  function saturationCamaieu(base, luminosite) {
    var eloignement = Math.min(1, Math.abs(luminosite - base.l) / 50);
    var saturation = base.s * (1 - 0.4 * eloignement);
    return Math.max(saturation, Math.min(base.s, SATURATION_MIN_TEINTEE));
  }

  // Dans les jaunes, une nuance foncée glisse peu à peu vers l'ambre (30°, un brun
  // chaud) au lieu de virer à l'olive : rien en dessus de 60 % de luminosité, puis
  // de plus en plus, jusqu'à l'ambre complet à 45 % et en dessous.
  function teinteCamaieu(teinteBase, luminosite) {
    if (!estUnJaune(teinteBase)) return teinteBase;
    var glissement = Couleurs.limiter((60 - luminosite) / 15, 0, 1);   // 0 = aucun, 1 = complet
    return teinteBase + (30 - teinteBase) * glissement;
  }


  // "nombre" nuances de la même teinte, de la plus foncée à la plus claire.
  // La nuance la plus proche de la couleur de base est remplacée par elle-même, exacte.
  // "variation" (0 = aucune, 1 = normale) ajoute un léger jeu au hasard sur la
  // saturation (±6 points) et la teinte (±2°) des autres nuances : c'est ce que
  // fait « Régénérer ». Sans variation, le résultat est toujours le même.
  function genererCamaieu(hexBase, nombre, variation, hasard) {
    var base = Couleurs.hexVersHsl(hexBase);
    // Un petit écart au hasard, entre -amplitude et +amplitude.
    function ecartAleatoire(amplitude) {
      return (hasard() * 2 - 1) * amplitude;
    }
    var pas = (LUMINOSITE_CAMAIEU_MAX - LUMINOSITE_CAMAIEU_MIN) / (nombre - 1);
    var rangBase = Couleurs.limiter(Math.round((base.l - LUMINOSITE_CAMAIEU_MIN) / pas), 0, nombre - 1);

    var couleurs = [];
    for (var i = 0; i < nombre; i++) {
      if (i === rangBase) {
        couleurs.push(creerCouleur("nuance", "Couleur de base", base));
        continue;
      }
      var luminosite = LUMINOSITE_CAMAIEU_MIN + i * pas;
      couleurs.push(creerCouleur("nuance", "Nuance " + (i + 1), {
        h: teinteCamaieu(base.h, luminosite) + ecartAleatoire(2 * variation),
        s: saturationCamaieu(base, luminosite) + ecartAleatoire(6 * variation),
        l: luminosite
      }));
    }
    return couleurs;
  }


  /* ---------- Mode 2 : le dégradé strict ---------- */

  // "nombre" étapes régulières entre deux couleurs. On avance sur le cercle
  // chromatique par le chemin le plus court (de 350° à 10°, on passe par 0°,
  // pas par 180°). Le départ et l'arrivée sont exacts.
  function genererDegrade(hexDepart, hexArrivee, nombre) {
    var depart = Couleurs.hexVersHsl(hexDepart);
    var arrivee = Couleurs.hexVersHsl(hexArrivee);

    // Un gris n'a pas de teinte : on prend celle de l'autre bout pour ne pas
    // faire un détour par une couleur au hasard.
    var teinteDepart = depart.s < SATURATION_GRIS ? arrivee.h : depart.h;
    var teinteArrivee = arrivee.s < SATURATION_GRIS ? depart.h : arrivee.h;
    var ecartTeinte = ((teinteArrivee - teinteDepart + 540) % 360) - 180;   // entre -180° et +180°

    var couleurs = [];
    for (var i = 0; i < nombre; i++) {
      if (i === 0) {
        couleurs.push(creerCouleur("etape", "Départ", depart));
      } else if (i === nombre - 1) {
        couleurs.push(creerCouleur("etape", "Arrivée", arrivee));
      } else {
        var t = i / (nombre - 1);   // 0 au départ, 1 à l'arrivée
        couleurs.push(creerCouleur("etape", "Étape " + (i + 1), {
          h: teinteDepart + ecartTeinte * t,
          s: depart.s + (arrivee.s - depart.s) * t,
          l: depart.l + (arrivee.l - depart.l) * t
        }));
      }
    }
    return couleurs;
  }


  /* ---------- Mode 3 : l'harmonie ---------- */

  // Les écarts [secondaire, tertiaire] d'une harmonie, comme les calcule palette.js.
  function ecartsDeLHarmonie(nomHarmonie, ecartAccent) {
    if (nomHarmonie === "analogue") return [ecartAccent / 2, -ecartAccent / 3];
    return Palette.ECARTS_HARMONIE[nomHarmonie];
  }

  // La fiche (au format de moods.js) qui décrit la palette à fabriquer :
  // on réutilise le moteur de palette.js, comme pour une image importée.
  function creerFiche(base, nomHarmonie, ecartAccent, titre) {
    var fiche = Palette.ficheDepuisParametres({
      teinte: base.h,
      harmonie: nomHarmonie,
      // Le moteur multiplie cette saturation par 1,25 : on la divise d'avance pour que
      // les tons moyens aient la saturation de la couleur choisie (pas de couleurs fluo).
      saturation: Math.max(base.s / 1.25, SATURATION_MIN_TEINTEE),
      ecartAccent: ecartAccent,
      nom: titre,
      id: "couleur-base"
    });

    // La couleur de base est un ton moyen : on règle la luminosité des tons
    // moyens autour d'elle (une base très sombre ou très claire reste cohérente).
    fiche.luminosite = [Couleurs.limiter(base.l - 18, 20, 60), Couleurs.limiter(base.l + 18, 40, 80)];

    // Le 2e ton moyen est le plus sombre : un jaune y virerait à l'olive.
    // S'il tombe dans les jaunes (et pas le 3e), on les échange.
    var ecarts = ecartsDeLHarmonie(nomHarmonie, ecartAccent);
    if (estProcheDuJaune(base.h + ecarts[0]) && !estProcheDuJaune(base.h + ecarts[1])) {
      ecarts = [ecarts[1], ecarts[0]];
      fiche.harmonie = ecarts;
    }

    // Dès qu'un jaune est en jeu (la base ou l'un des deux autres tons moyens),
    // les tons moyens restent clairs : un jaune foncé virerait à l'olive.
    var unJauneEnJeu = estProcheDuJaune(base.h) || estProcheDuJaune(base.h + ecarts[0]) || estProcheDuJaune(base.h + ecarts[1]);
    if (unJauneEnJeu) {
      fiche.luminosite = [Math.max(fiche.luminosite[0], 50), Math.max(fiche.luminosite[1], 72)];
    }
    // Base jaune : les sombres sont teintés d'ambre (30°) plutôt que de jaune.
    if (estProcheDuJaune(base.h)) {
      fiche.sombres.decalage = 30 - base.h;
    }
    return fiche;
  }

  // 16 couleurs : les 9 de base du moteur, puis ses 7 nuances. La "Dominante"
  // est remplacée par la couleur choisie, exacte. Les 9 premières forment
  // donc la palette 3x3, comme pour un mood.
  function genererHarmonie(hexBase, nomHarmonie, titre, hasard) {
    var base = Couleurs.hexVersHsl(hexBase);
    var signe = hasard() < 0.5 ? -1 : 1;
    var ecartAccent = HARMONIES[nomHarmonie].ecartAccent * signe;

    var fiche = creerFiche(base, nomHarmonie, ecartAccent, titre);
    var palette = Palette.generer(fiche, null, hasard);
    palette[2] = creerCouleur("moyen", "Couleur de base", base);
    return { palette: palette, fiche: fiche };
  }


  /* ---------- Fonction principale ---------- */

  // options :
  // - mode     : "camaieu", "degrade" ou "harmonie"
  // - couleur  : la couleur de base, en HEX ("#5188F5")
  // - arrivee  : (mode "degrade") la couleur d'arrivée, en HEX
  // - harmonie : (mode "harmonie", facultatif) "analogue", "complementaire",
  //              "complementaire-divisee" ou "triadique". Sinon : tirée au hasard.
  // - variation: (mode "camaieu", facultatif) 0 par défaut ; 1 = léger jeu au hasard
  // - graine   : (facultatif) un nombre qui fixe le hasard : même graine, même palette.
  //              Sans graine, une nouvelle est tirée. Elle est renvoyée dans le résultat.
  // Renvoie :
  // {
  //   neuf:  les 9 couleurs de la grille 3x3,
  //   seize: les 16 couleurs de la grille 4x4,
  //   fiche: une fiche au format de moods.js (nom, id, composition du dégradé…),
  //   titre: un titre lisible, ex : "Camaïeu #5188F5",
  //   harmonie: le nom de l'harmonie utilisée (mode "harmonie"), sinon null,
  //   graine: la graine utilisée (à redonner pour retrouver la même palette)
  // }
  function generer(options) {
    var hex = hexAffichable(options.couleur);
    var base = Couleurs.hexVersHsl(hex);
    var graine = options.graine === undefined || options.graine === null ? nouvelleGraine() : options.graine;
    var hasard = creerHasard(graine);

    if (options.mode === "degrade") {
      var arrivee = hexAffichable(options.arrivee);
      var titreDegrade = "Dégradé " + hex + " → " + arrivee;
      return {
        neuf: genererDegrade(hex, arrivee, 9),
        seize: genererDegrade(hex, arrivee, 16),
        fiche: creerFiche(base, "analogue", 30, titreDegrade),
        titre: titreDegrade,
        harmonie: null,
        graine: graine
      };
    }

    if (options.mode === "harmonie") {
      var nomHarmonie = HARMONIES[options.harmonie]
        ? options.harmonie
        : NOMS_HARMONIES[Math.floor(hasard() * NOMS_HARMONIES.length)];
      var titreHarmonie = "Harmonie " + HARMONIES[nomHarmonie].libelle + " " + hex;
      var resultat = genererHarmonie(hex, nomHarmonie, titreHarmonie, hasard);
      return {
        neuf: resultat.palette.slice(0, 9),
        seize: resultat.palette,
        fiche: resultat.fiche,
        titre: titreHarmonie,
        harmonie: nomHarmonie,
        graine: graine
      };
    }

    // Par défaut : le camaïeu
    var titreCamaieu = "Camaïeu " + hex;
    return {
      neuf: genererCamaieu(hex, 9, options.variation || 0, hasard),
      seize: genererCamaieu(hex, 16, options.variation || 0, hasard),
      fiche: creerFiche(base, "analogue", 30, titreCamaieu),
      titre: titreCamaieu,
      harmonie: null,
      graine: graine
    };
  }

  return {
    generer: generer,
    HARMONIES: HARMONIES
  };

})();
