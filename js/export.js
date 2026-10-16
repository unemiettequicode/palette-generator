/* =========================================================
   export.js — fabrique les fichiers à copier ou télécharger
   ---------------------------------------------------------
   - PNG du moodboard (grille 3x3 avec les HEX visibles)
   - PNG du dégradé en 1080 x 1920
   - Variables CSS (+ une approximation CSS du dégradé)
   - JSON (nom du mood, décalage de teinte, hex / rgb / hsl de chaque couleur)

   Ce fichier ne touche pas à la page : il prépare les contenus,
   et app.js décide quand les copier ou les télécharger.
   ========================================================= */

var Export = (function () {

  /* ---------- Petits outils ---------- */

  // Arrondit les valeurs HSL pour un affichage propre : { h: 312, s: 45, l: 30 }
  function hslArrondi(hsl) {
    return { h: Math.round(hsl.h), s: Math.round(hsl.s), l: Math.round(hsl.l) };
  }

  // "+30°", "-45°" ou "0°"
  function texteDecalage(degres) {
    return (degres > 0 ? "+" : "") + degres + "°";
  }

  // Nom par défaut quand l'utilisateur n'a rien choisi (ou a tout effacé)
  var NOM_PAR_DEFAUT = "noname";

  // Nettoie le nom tapé pour qu'il soit valable comme nom de fichier :
  // accents retirés, espaces → tirets, on ne garde que lettres, chiffres, - et _.
  // Ex : "Projet Lune été" → "Projet-Lune-ete"
  function nettoyerNom(nom) {
    var propre = (nom || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")    // accents
      .trim()
      .replace(/\s+/g, "-")                // espaces → tirets
      .replace(/[^A-Za-z0-9_-]/g, "")       // autres caractères retirés
      .replace(/-{2,}/g, "-")               // "--" → "-"
      .replace(/^[-_]+|[-_]+$/g, "");       // pas de tiret au début ni à la fin
    return propre || NOM_PAR_DEFAUT;
  }

  // Nom de fichier : "mc_" + nom choisi + suffixe éventuel.
  // Ex : nomDeFichier("noname", "degrade", "png") → "mc_noname_degrade.png"
  //      nomDeFichier("projet lune", "", "css")    → "mc_projet-lune.css"
  function nomDeFichier(nomChoisi, suffixe, extension) {
    return "mc_" + nettoyerNom(nomChoisi) + (suffixe ? "_" + suffixe : "") + "." + extension;
  }

  // Dessine un rectangle aux coins arrondis (ctx.roundRect n'existe pas
  // sur les navigateurs un peu anciens, alors on le fait à la main).
  function rectangleArrondi(ctx, x, y, largeur, hauteur, rayon) {
    ctx.beginPath();
    ctx.moveTo(x + rayon, y);
    ctx.arcTo(x + largeur, y, x + largeur, y + hauteur, rayon);
    ctx.arcTo(x + largeur, y + hauteur, x, y + hauteur, rayon);
    ctx.arcTo(x, y + hauteur, x, y, rayon);
    ctx.arcTo(x, y, x + largeur, y, rayon);
    ctx.closePath();
    ctx.fill();
  }

  // Transforme un canvas en fichier PNG. Renvoie une promesse de "Blob"
  // (un Blob, c'est un fichier en mémoire).
  function canvasVersPng(canvas) {
    return new Promise(function (resoudre) {
      canvas.toBlob(resoudre, "image/png");
    });
  }


  /* ---------- 1. PNG du moodboard ---------- */

  var MOODBOARD = {
    largeur: 1080,
    marge: 72,         // marge autour de la grille
    espace: 24,        // espace entre les cases
    rayon: 28,         // coins arrondis des cases
    hautTitre: 120     // hauteur réservée au titre
  };

  // Réglages de la grille selon le nombre de colonnes : en 4x4, les cases sont
  // plus petites, donc l'espace, les coins arrondis et le texte aussi.
  function reglagesGrille(colonnes) {
    if (colonnes === 4) {
      return { espace: 16, rayon: 22, taillePolice: 26, retraitTexte: 20 };
    }
    return { espace: MOODBOARD.espace, rayon: MOODBOARD.rayon, taillePolice: 30, retraitTexte: 26 };
  }

  function pngPalette(couleurs, mood, decalageHue) {
    var m = MOODBOARD;
    // 9 couleurs → grille 3x3, 16 couleurs → grille 4x4
    var colonnes = Math.round(Math.sqrt(couleurs.length));
    var g = reglagesGrille(colonnes);
    var tailleCase = (m.largeur - 2 * m.marge - (colonnes - 1) * g.espace) / colonnes;
    var hauteur = m.hautTitre + colonnes * tailleCase + (colonnes - 1) * g.espace + m.marge;

    var canvas = document.createElement("canvas");
    canvas.width = m.largeur;
    canvas.height = hauteur;
    var ctx = canvas.getContext("2d");

    // Fond neutre (celui de l'interface) : aucune case ne se confond avec lui
    var fond = "#F3F1EE";
    var texte = Couleurs.hslVersHex(couleurs[0].hsl);
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, m.largeur, hauteur);

    // Titre : nom du mood + petite ligne d'infos
    ctx.fillStyle = texte;
    ctx.textBaseline = "alphabetic";
    ctx.font = "56px 'Mistical Spring', Georgia, serif";
    ctx.fillText(mood.nom, m.marge, m.marge + 20);
    ctx.font = "600 22px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("MOOD COLORS · TEINTE " + texteDecalage(decalageHue), m.largeur - m.marge, m.marge + 16);
    ctx.textAlign = "left";

    // Les cases (9 ou 16), avec le HEX en bas à gauche
    couleurs.forEach(function (couleur, index) {
      var colonne = index % colonnes;
      var ligne = Math.floor(index / colonnes);
      var x = m.marge + colonne * (tailleCase + g.espace);
      var y = m.hautTitre + ligne * (tailleCase + g.espace);
      var hex = Couleurs.hslVersHex(couleur.hsl);

      ctx.fillStyle = hex;
      rectangleArrondi(ctx, x, y, tailleCase, tailleCase, g.rayon);
      // Fin contour : les couleurs très claires restent visibles sur le fond
      ctx.strokeStyle = "rgba(38, 35, 42, 0.08)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = Couleurs.couleurTexte(hex);
      ctx.font = "600 " + g.taillePolice + "px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
      ctx.fillText(hex, x + g.retraitTexte, y + tailleCase - g.retraitTexte);
    });

    return canvasVersPng(canvas);
  }


  /* ---------- 2. PNG du dégradé (1080 x 1920) ---------- */

  function pngDegrade(couleurs, mood, intensiteGrain) {
    var canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    Degrade.dessiner(canvas, couleurs, mood, intensiteGrain);
    return canvasVersPng(canvas);
  }


  /* ---------- 3. Variables CSS ---------- */

  // "rgba(12, 34, 56, 0.6)"
  function rgbaCss(hsl, opacite) {
    var rgb = Couleurs.hslVersRgb(hsl);
    return "rgba(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ", " + opacite + ")";
  }

  // Traduit le dégradé du canvas en une pile de radial-gradient CSS.
  // C'est une approximation : le CSS n'a pas de grain.
  function degradeCss(couleurs, mood) {
    var plan = Degrade.calculerTaches(mood);
    var ratio = 16 / 9;   // le cadre est 9:16 : la hauteur vaut 16/9 de la largeur

    var calques = plan.taches.map(function (tache) {
      var hsl = couleurs[tache.couleur].hsl;
      // Rayon de l'ovale en % de la largeur et de la hauteur du bloc
      var rayonX = Math.round(tache.rayon * ratio * 100);
      var rayonY = Math.round(tache.rayon * Degrade.ETIREMENT * 100);
      var x = Math.round(tache.x * 100);
      var y = Math.round(tache.y * 100);
      return "    radial-gradient(" + rayonX + "% " + rayonY + "% at " + x + "% " + y + "%, " +
        rgbaCss(hsl, 0.9) + " 0%, " + rgbaCss(hsl, 0.6) + " 40%, " +
        rgbaCss(hsl, 0.18) + " 75%, " + rgbaCss(hsl, 0) + " 100%)";
    });

    // En CSS, le PREMIER calque est dessus : on inverse l'ordre du canvas.
    calques.reverse();
    calques.push("    " + Couleurs.hslVersHex(couleurs[plan.fond].hsl));
    return calques.join(",\n");
  }

  // couleursDegrade (facultatif) : les 9 couleurs qui servent au dégradé. En grille 4x4,
  // certaines palettes (camaïeu, dégradé) ont 16 couleurs différentes des 9 de la
  // grille 3x3 : le dégradé garde toujours les 9.
  function css(couleurs, mood, decalageHue, couleursDegrade) {
    var lignes = [];
    lignes.push("/* Mood Colors — " + mood.nom + " (teinte " + texteDecalage(decalageHue) + ") */");
    lignes.push(":root {");
    couleurs.forEach(function (couleur, index) {
      lignes.push("  --mood-" + (index + 1) + ": " + Couleurs.hslVersHex(couleur.hsl) + ";  /* " + couleur.libelle + " */");
    });
    lignes.push("");
    lignes.push("  /* Approximation du dégradé (sans le grain) */");
    lignes.push("  --mood-degrade:");
    lignes.push(degradeCss(couleursDegrade || couleurs, mood) + ";");
    lignes.push("}");
    lignes.push("");
    lignes.push("/* Exemple d'utilisation */");
    lignes.push(".mood-degrade {");
    lignes.push("  aspect-ratio: 9 / 16;");
    lignes.push("  background: var(--mood-degrade);");
    lignes.push("}");
    return lignes.join("\n") + "\n";
  }


  /* ---------- 4. JSON ---------- */

  function json(couleurs, mood, moodAccent, decalageHue) {
    var donnees = {
      application: "Mood Colors",
      mood: mood.nom,
      moodAccent: moodAccent ? moodAccent.nom : null,
      decalageTeinte: decalageHue,
      couleurs: couleurs.map(function (couleur) {
        return {
          role: couleur.role,
          libelle: couleur.libelle,
          hex: Couleurs.hslVersHex(couleur.hsl),
          rgb: Couleurs.hslVersRgb(couleur.hsl),
          hsl: hslArrondi(couleur.hsl)
        };
      })
    };
    return JSON.stringify(donnees, null, 2) + "\n";   // indenté de 2 espaces : lisible
  }


  /* ---------- Téléchargement ---------- */

  // Déclenche le téléchargement d'un fichier.
  // contenu : un Blob (PNG) ou un texte (CSS, JSON)
  function telecharger(contenu, nomFichier, typeMime) {
    var fichier = contenu instanceof Blob ? contenu : new Blob([contenu], { type: typeMime });
    var adresse = URL.createObjectURL(fichier);   // une adresse temporaire vers le fichier en mémoire
    var lien = document.createElement("a");
    lien.href = adresse;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    // On libère la mémoire un peu plus tard (le téléchargement doit avoir démarré)
    setTimeout(function () { URL.revokeObjectURL(adresse); }, 1000);
  }

  return {
    pngPalette: pngPalette,
    pngDegrade: pngDegrade,
    css: css,
    json: json,
    telecharger: telecharger,
    nomDeFichier: nomDeFichier,
    NOM_PAR_DEFAUT: NOM_PAR_DEFAUT
  };

})();
