/**
 * Génération du Réseau de Soins Conventionné PDF
 * Usage : node scripts/generer-reseau-soins-pdf.js [societeId]
 * Sortie : D:\PROJET MEDASSUR\Reseau-de-Soins-v2.pdf
 */

const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const SORTIE = path.join('D:\\PROJET MEDASSUR', 'Reseau-de-Soins-v2.pdf');

// Ordre des provinces (Estuaire en premier, puis les autres)
const ORDRE_PROVINCES = [
  'Estuaire',
  'Ogooué-Maritime',
  'Haut-Ogooué',
  'Ngounié',
  'Woleu-Ntem',
  'Nyanga',
  'Ogooué-Lolo',
  'Moyen-Ogooué',
  'Ogooué-Ivindo',
  'Autres',
];

// Ordre des capitales provinciales (villes prioritaires = 1ère de leur province)
const CAPITALES = {
  'Estuaire': ['Libreville', 'Akanda', 'Owendo', 'Ntoum', 'Kango', 'Cocobeach'],
  'Ogooué-Maritime': ['Port-Gentil', 'Gamba', 'Omboué'],
  'Haut-Ogooué': ['Franceville', 'Moanda', 'Mounana', 'Okondja', 'Lékoni', 'Bakoumba', 'Akiéni'],
  'Ngounié': ['Mouila', 'Fougamou', 'Ndendé', 'Mbigou'],
  'Woleu-Ntem': ['Oyem', 'Bitam', 'Mitzic', 'Minvoul', 'Médouneu', 'Medouneu'],
  'Nyanga': ['Tchibanga', 'Mayumba', 'Ndindi'],
  'Ogooué-Lolo': ['Koulamoutou', 'Lastoursville'],
  'Moyen-Ogooué': ['Lambaréné', 'Lambarene', 'Ndjolé', 'Ndjole'],
  'Ogooué-Ivindo': ['Makokou', 'Booué', 'Boue', 'Mékambo', 'Mekambo'],
};

// Mapping ville → province (normalisation)
const VILLE_PROVINCE_MAP = {
  // Estuaire
  'libreville': 'Estuaire', 'akanda': 'Estuaire', 'owendo': 'Estuaire',
  'ntoum': 'Estuaire', 'kango': 'Estuaire', 'cocobeach': 'Estuaire', 'nkan': 'Estuaire',
  // Ogooué-Maritime
  'port-gentil': 'Ogooué-Maritime', 'port gentil': 'Ogooué-Maritime',
  'gamba': 'Ogooué-Maritime', 'omboue': 'Ogooué-Maritime', 'omboué': 'Ogooué-Maritime',
  // Haut-Ogooué
  'franceville': 'Haut-Ogooué', 'moanda': 'Haut-Ogooué', 'mounana': 'Haut-Ogooué',
  'okondja': 'Haut-Ogooué', 'lekoni': 'Haut-Ogooué', 'bakoumba': 'Haut-Ogooué',
  'akieni': 'Haut-Ogooué', 'masuku': 'Haut-Ogooué',
  // Ngounié
  'mouila': 'Ngounié', 'fougamou': 'Ngounié', 'ndende': 'Ngounié', 'ndendé': 'Ngounié',
  'mbigou': 'Ngounié', 'mimongo': 'Ngounié',
  // Woleu-Ntem
  'oyem': 'Woleu-Ntem', 'bitam': 'Woleu-Ntem', 'mitzic': 'Woleu-Ntem',
  'minvoul': 'Woleu-Ntem', 'medouneu': 'Woleu-Ntem', 'médouneu': 'Woleu-Ntem',
  'egnieng melen': 'Woleu-Ntem',
  // Nyanga
  'tchibanga': 'Nyanga', 'mayumba': 'Nyanga', 'ndindi': 'Nyanga', 'tsogni': 'Nyanga',
  // Ogooué-Lolo
  'koulamoutou': 'Ogooué-Lolo', 'lastoursville': 'Ogooué-Lolo',
  // Moyen-Ogooué
  'lambarene': 'Moyen-Ogooué', 'lambaréné': 'Moyen-Ogooué', 'ndjole': 'Moyen-Ogooué', 'ndjolé': 'Moyen-Ogooué',
  // Ogooué-Ivindo
  'makokou': 'Ogooué-Ivindo', 'booue': 'Ogooué-Ivindo', 'booué': 'Ogooué-Ivindo',
  'mekambo': 'Ogooué-Ivindo', 'mékambo': 'Ogooué-Ivindo',
};

function provinceDeVille(ville) {
  if (!ville) return 'Autres';
  const v = ville.toLowerCase().trim()
    .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/-/g, ' ');
  // Cherche une correspondance exacte ou partielle
  for (const [k, prov] of Object.entries(VILLE_PROVINCE_MAP)) {
    const kn = k.toLowerCase().replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e').replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o').replace(/[ùûü]/g, 'u').replace(/[ç]/g, 'c').replace(/-/g, ' ');
    if (v === kn || v.startsWith(kn) || kn.startsWith(v)) return prov;
  }
  return 'Autres';
}

function prioriteVille(ville, province) {
  const capitales = CAPITALES[province] || [];
  const v = (ville || '').toLowerCase();
  const idx = capitales.findIndex(c => c.toLowerCase() === v || v.startsWith(c.toLowerCase()));
  return idx === -1 ? 99 : idx;
}

// Couleurs LA RUCHE EXCELLENCE
const COULEUR_PRIMARY = '#1d3557';   // bleu foncé
const COULEUR_PROVINCE = '#e63946';  // rouge/orange
const COULEUR_VILLE = '#457b9d';     // bleu moyen
const COULEUR_LIGNE_PAIR = '#f1f7fb';
const COULEUR_ENTETE = '#1d3557';

// Largeurs des colonnes (sur page A4 = 595pt, marges 40pt = 515pt)
const PAGE_W = 515;
const COL = {
  nom: 185,
  type: 80,
  adresse: 155,
  tel: 95,
};

async function main() {
  const prisma = new PrismaClient();

  console.log('Chargement des prestataires...');
  const prestataires = await prisma.prestataire.findMany({
    select: {
      nom: true,
      type: true,
      ville: true,
      province: true,
      adresse: true,
      telephone: true,
    },
    orderBy: [{ ville: 'asc' }, { nom: 'asc' }],
  });
  await prisma.$disconnect();
  console.log(`${prestataires.length} prestataires chargés.`);

  // Grouper par province → ville
  const groupes = {};
  for (const p of prestataires) {
    // Ignorer les prestataires sans nom valide (données de test)
    if (!p.nom || p.nom.match(/^[0-9A-F]{8,}$/)) continue;
    // Ignorer les hors-Gabon (Rabat, etc.)
    if (p.ville && (p.ville.toLowerCase().includes('rabat') || p.ville.toLowerCase().includes('maroc'))) continue;

    const prov = p.province || provinceDeVille(p.ville);
    const ville = p.ville || 'Libreville';
    if (!groupes[prov]) groupes[prov] = {};
    if (!groupes[prov][ville]) groupes[prov][ville] = [];
    groupes[prov][ville].push(p);
  }

  // Créer le PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
    autoFirstPage: true,
    info: {
      Title: 'Réseau de Soins Conventionné — LA RUCHE EXCELLENCE',
      Author: 'MEDASSUR+',
    },
  });

  const stream = fs.createWriteStream(SORTIE);
  doc.pipe(stream);

  let totalPages = 0;
  const enregistrerPage = () => { totalPages++; };
  doc.on('pageAdded', enregistrerPage);

  // ── Page de titre ───────────────────────────────────────────────────────
  // Logo LA RUCHE EXCELLENCE
  const logoPath = path.join(__dirname, '..', 'uploads', 'logos', 'la-ruche-excellence-logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 40, { height: 70 });
  } else {
    // Texte si logo absent
    doc.fontSize(14).fillColor(COULEUR_PRIMARY).font('Helvetica-Bold').text('LA RUCHE EXCELLENCE', 40, 40);
    doc.fontSize(9).font('Helvetica').fillColor('#666').text('Courtier d\'Assurances', 40, 58);
  }

  // Titre principal
  doc.fontSize(20).fillColor(COULEUR_PRIMARY).font('Helvetica-Bold')
     .text('RÉSEAU DE SOINS CONVENTIONNÉ', 0, 130, { align: 'center' });
  doc.fontSize(11).fillColor(COULEUR_PROVINCE).font('Helvetica')
     .text('LA RUCHE EXCELLENCE — Classement par Province et Ville', 0, 158, { align: 'center' });

  // Ligne décorative
  doc.moveTo(40, 180).lineTo(555, 180).lineWidth(2).strokeColor(COULEUR_PRIMARY).stroke();

  // Statistiques
  const nbProvs = Object.keys(groupes).filter(p => p !== 'Autres').length;
  const nbVilles = Object.values(groupes).reduce((s, v) => s + Object.keys(v).length, 0);
  const total = prestataires.filter(p => p.nom && !p.nom.match(/^[0-9A-F]{8,}$/)).length;

  doc.fontSize(11).fillColor('#333').font('Helvetica')
     .text(`${total} prestataires conventionnés · ${nbVilles} villes · ${nbProvs} provinces`, 0, 195, { align: 'center' });

  // Table des matières simplifiée
  doc.moveDown(1.5);
  let tocY = doc.y;
  doc.fontSize(10).fillColor(COULEUR_PRIMARY).font('Helvetica-Bold').text('SOMMAIRE', 40, tocY);
  tocY += 16;
  let colToc = 0;
  for (const prov of ORDRE_PROVINCES) {
    if (!groupes[prov]) continue;
    const villes = Object.keys(groupes[prov]).sort((a, b) => prioriteVille(a, prov) - prioriteVille(b, prov) || a.localeCompare(b, 'fr'));
    const x = 40 + (colToc % 2) * 260;
    const y = tocY + Math.floor(colToc / 2) * 14;
    doc.fontSize(9).fillColor(COULEUR_PROVINCE).font('Helvetica-Bold').text(`${prov}`, x, y);
    doc.fillColor('#555').font('Helvetica').text(` — ${villes.join(', ')}`, { continued: false });
    colToc++;
  }

  doc.addPage();

  // ── Page de statistiques ───────────────────────────────────────────────
  // Titre
  doc.fontSize(14).fillColor(COULEUR_PRIMARY).font('Helvetica-Bold')
     .text('STATISTIQUES DU RÉSEAU DE SOINS', 40, 50, { align: 'center', width: PAGE_W });
  doc.moveTo(40, 72).lineTo(555, 72).lineWidth(1.5).strokeColor(COULEUR_PRIMARY).stroke();

  // Résumé global
  const statY0 = 85;
  const boxW = 150;
  const boxes = [
    { label: 'PRESTATAIRES', value: total.toString(), x: 40 },
    { label: 'PROVINCES', value: Object.keys(groupes).filter(p => p !== 'Autres' && groupes[p]).length.toString(), x: 205 },
    { label: 'VILLES', value: nbVilles.toString(), x: 370 },
  ];
  for (const b of boxes) {
    doc.rect(b.x, statY0, boxW, 48).fillColor(COULEUR_PRIMARY).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(26)
       .text(b.value, b.x, statY0 + 6, { width: boxW, align: 'center', lineBreak: false });
    doc.fillColor('rgba(255,255,255,0.7)').font('Helvetica').fontSize(8)
       .text(b.label, b.x, statY0 + 33, { width: boxW, align: 'center', lineBreak: false });
  }

  // Tableau par province
  const tblY = statY0 + 62;
  // En-tête
  const TCOL = { prov: 220, villes: 100, prest: 100, pct: 95 };
  doc.rect(40, tblY, PAGE_W, 16).fillColor(COULEUR_ENTETE).fill();
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
  doc.text('PROVINCE', 44, tblY + 4, { width: TCOL.prov, lineBreak: false });
  doc.text('VILLES', 44 + TCOL.prov, tblY + 4, { width: TCOL.villes, align: 'center', lineBreak: false });
  doc.text('PRESTATAIRES', 44 + TCOL.prov + TCOL.villes, tblY + 4, { width: TCOL.prest, align: 'center', lineBreak: false });
  doc.text('% DU TOTAL', 44 + TCOL.prov + TCOL.villes + TCOL.prest, tblY + 4, { width: TCOL.pct - 8, align: 'center', lineBreak: false });

  let rowY = tblY + 18;
  let rowIdx = 0;
  let totalChecksum = 0;
  for (const prov of ORDRE_PROVINCES) {
    if (!groupes[prov]) continue;
    const villesProv = Object.keys(groupes[prov]);
    const nbP = villesProv.reduce((s, v) => s + groupes[prov][v].length, 0);
    totalChecksum += nbP;
    const pct = total > 0 ? ((nbP / total) * 100).toFixed(1) : '0.0';
    const bg = rowIdx % 2 === 0 ? '#f1f7fb' : 'white';
    doc.rect(40, rowY, PAGE_W, 14).fillColor(bg).fill();
    doc.rect(40, rowY, PAGE_W, 14).lineWidth(0.3).strokeColor('#dde').stroke();
    doc.fillColor('#111').font('Helvetica-Bold').fontSize(8)
       .text(prov, 44, rowY + 3, { width: TCOL.prov, lineBreak: false });
    doc.fillColor('#333').font('Helvetica').fontSize(8)
       .text(villesProv.length.toString(), 44 + TCOL.prov, rowY + 3, { width: TCOL.villes, align: 'center', lineBreak: false });
    doc.fillColor(COULEUR_PRIMARY).font('Helvetica-Bold').fontSize(8)
       .text(nbP.toString(), 44 + TCOL.prov + TCOL.villes, rowY + 3, { width: TCOL.prest, align: 'center', lineBreak: false });
    // Barre de progression
    const barMaxW = TCOL.pct - 20;
    const barW = Math.round((nbP / total) * barMaxW);
    const barX = 44 + TCOL.prov + TCOL.villes + TCOL.prest;
    doc.rect(barX, rowY + 4, barMaxW, 6).fillColor('#e0e8f0').fill();
    if (barW > 0) doc.rect(barX, rowY + 4, barW, 6).fillColor(COULEUR_PROVINCE).fill();
    doc.fillColor('#555').font('Helvetica').fontSize(7)
       .text(`${pct}%`, barX + barMaxW + 3, rowY + 3, { width: 28, lineBreak: false });
    rowY += 14;
    rowIdx++;
  }
  // Ligne totale
  doc.rect(40, rowY, PAGE_W, 16).fillColor(COULEUR_PRIMARY).fill();
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8)
     .text('TOTAL', 44, rowY + 4, { width: TCOL.prov, lineBreak: false });
  doc.text(nbVilles.toString(), 44 + TCOL.prov, rowY + 4, { width: TCOL.villes, align: 'center', lineBreak: false });
  doc.text(total.toString(), 44 + TCOL.prov + TCOL.villes, rowY + 4, { width: TCOL.prest, align: 'center', lineBreak: false });
  doc.text('100%', 44 + TCOL.prov + TCOL.villes + TCOL.prest, rowY + 4, { width: TCOL.pct - 8, align: 'center', lineBreak: false });
  rowY += 20;

  // Tableau détail par ville (toutes provinces)
  doc.fontSize(11).fillColor(COULEUR_PRIMARY).font('Helvetica-Bold')
     .text('DÉTAIL PAR VILLE', 40, rowY + 10);
  rowY += 28;

  // On affiche 3 colonnes côte à côte pour optimiser l'espace
  const villeStats = [];
  for (const prov of ORDRE_PROVINCES) {
    if (!groupes[prov]) continue;
    const villesProv = Object.keys(groupes[prov]).sort((a, b) => prioriteVille(a, prov) - prioriteVille(b, prov) || a.localeCompare(b, 'fr'));
    for (const v of villesProv) {
      villeStats.push({ prov, ville: v, nb: groupes[prov][v].length });
    }
  }

  const NCOLS = 3;
  const colW = Math.floor(PAGE_W / NCOLS);
  const ROW_H = 13;
  const startX = 40;

  // En-tête colonnes
  for (let c = 0; c < NCOLS; c++) {
    const cx = startX + c * colW;
    doc.rect(cx, rowY, colW - 2, 14).fillColor(COULEUR_ENTETE).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(7)
       .text('VILLE', cx + 3, rowY + 3, { width: colW - 50, lineBreak: false });
    doc.text('N', cx + colW - 18, rowY + 3, { width: 14, align: 'right', lineBreak: false });
  }
  rowY += 16;

  let curPage = 1;
  const pageH = doc.page.height;
  for (let i = 0; i < villeStats.length; i++) {
    const col = i % NCOLS;
    const row = Math.floor(i / NCOLS);
    const cx = startX + col * colW;
    const cy = rowY + row * ROW_H;

    if (cy + ROW_H > pageH - 50) {
      // Nouvelle page pour la suite
      if (col === 0) {
        doc.addPage();
        rowY = 50;
        // Re-dessiner l'en-tête
        for (let c = 0; c < NCOLS; c++) {
          const cxh = startX + c * colW;
          doc.rect(cxh, 40, colW - 2, 14).fillColor(COULEUR_ENTETE).fill();
          doc.fillColor('white').font('Helvetica-Bold').fontSize(7)
             .text('VILLE', cxh + 3, 43, { width: colW - 50, lineBreak: false });
          doc.text('N', cxh + colW - 18, 43, { width: 14, align: 'right', lineBreak: false });
        }
        rowY = 56;
        curPage++;
      }
      // Recalculer cy
    } else {
      const { prov, ville, nb } = villeStats[i];
      const isEven = Math.floor(i / NCOLS) % 2 === 0;
      const bg = isEven ? '#f1f7fb' : 'white';
      doc.rect(cx, cy, colW - 2, ROW_H - 1).fillColor(bg).fill();
      doc.rect(cx, cy, colW - 2, ROW_H - 1).lineWidth(0.2).strokeColor('#dde').stroke();
      // Pastille province
      const provIdx = ORDRE_PROVINCES.indexOf(prov);
      const pastilleColors = ['#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261','#264653','#a8dadc','#06d6a0','#118ab2'];
      const pastC = pastilleColors[provIdx] || '#888';
      doc.rect(cx + 2, cy + 3, 4, 7).fillColor(pastC).fill();
      doc.fillColor('#222').font('Helvetica').fontSize(7)
         .text(ville, cx + 9, cy + 3, { width: colW - 30, lineBreak: false });
      doc.fillColor(COULEUR_PRIMARY).font('Helvetica-Bold').fontSize(7)
         .text(nb.toString(), cx + colW - 18, cy + 3, { width: 14, align: 'right', lineBreak: false });
    }
  }

  doc.addPage();

  // ── En-tête de tableau ─────────────────────────────────────────────────
  const dessinerEnteteTableau = () => {
    const y = doc.y;
    doc.rect(40, y, PAGE_W, 16).fillColor(COULEUR_ENTETE).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8);
    doc.text('PRESTATAIRE', 44, y + 4, { width: COL.nom, lineBreak: false });
    doc.text('TYPE', 44 + COL.nom + 3, y + 4, { width: COL.type, lineBreak: false });
    doc.text('ADRESSE', 44 + COL.nom + COL.type + 6, y + 4, { width: COL.adresse, lineBreak: false });
    doc.text('TÉLÉPHONE', 44 + COL.nom + COL.type + COL.adresse + 9, y + 4, { width: COL.tel, lineBreak: false });
    doc.y = y + 18;
  };

  // ── En-tête de page (nom page) ─────────────────────────────────────────
  const ENTETE_H = 25;
  const dessinerEntetePage = () => {
    doc.fontSize(7).fillColor('#999').font('Helvetica')
       .text('LA RUCHE EXCELLENCE — Réseau de Soins Conventionné', 40, doc.page.height - 30, { width: 320, lineBreak: false });
    doc.text(`Page ${doc.bufferedPageRange().count}`, 40, doc.page.height - 30, { width: PAGE_W, align: 'right', lineBreak: false });
    doc.moveTo(40, doc.page.height - 36).lineTo(555, doc.page.height - 36).lineWidth(0.5).strokeColor('#ccc').stroke();
  };

  let ligneIndex = 0;

  const ajouterLigne = (p) => {
    const pair = ligneIndex % 2 === 0;
    const nomTxt = (p.nom || '').trim();
    const typeTxt = (p.type || '').trim();
    const adrTxt = (p.adresse || '').trim();
    const telTxt = (p.telephone || '').trim();

    // Calculer la hauteur nécessaire
    const tmpDoc = doc;
    const hNom = doc.heightOfString(nomTxt, { width: COL.nom - 4, fontSize: 8 });
    const hType = doc.heightOfString(typeTxt, { width: COL.type - 4, fontSize: 7 });
    const hAdr = doc.heightOfString(adrTxt, { width: COL.adresse - 4, fontSize: 7 });
    const hTel = doc.heightOfString(telTxt, { width: COL.tel - 4, fontSize: 7 });
    const hLigne = Math.max(hNom, hType, hAdr, hTel, 12) + 5;

    // Nouvelle page si nécessaire (garder 50pt pour le pied de page)
    if (doc.y + hLigne > doc.page.height - 55) {
      dessinerEntetePage();
      doc.addPage();
      dessinerEnteteTableau();
    }

    const y = doc.y;
    if (pair) {
      doc.rect(40, y, PAGE_W, hLigne).fillColor(COULEUR_LIGNE_PAIR).fill();
    }
    doc.rect(40, y, PAGE_W, hLigne).lineWidth(0.3).strokeColor('#dde').stroke();

    doc.fillColor('#111').font('Helvetica-Bold').fontSize(8)
       .text(nomTxt, 44, y + 3, { width: COL.nom - 4, lineBreak: true });
    const yType = y + 3;
    doc.fillColor('#444').font('Helvetica').fontSize(7)
       .text(typeTxt, 44 + COL.nom + 3, yType, { width: COL.type - 4, lineBreak: true });
    doc.fillColor('#555').fontSize(7)
       .text(adrTxt, 44 + COL.nom + COL.type + 6, yType, { width: COL.adresse - 4, lineBreak: true });
    doc.fillColor(COULEUR_VILLE).font('Helvetica-Bold').fontSize(7)
       .text(telTxt, 44 + COL.nom + COL.type + COL.adresse + 9, yType, { width: COL.tel - 4, lineBreak: true });

    doc.y = y + hLigne;
    ligneIndex++;
  };

  // ── Contenu par province ───────────────────────────────────────────────
  for (const prov of ORDRE_PROVINCES) {
    if (!groupes[prov]) continue;

    const villes = Object.keys(groupes[prov]).sort((a, b) => prioriteVille(a, prov) - prioriteVille(b, prov) || a.localeCompare(b, 'fr'));

    // En-tête province — nouvelle page si moins de 80pt disponibles
    if (doc.y > doc.page.height - 100) {
      dessinerEntetePage();
      doc.addPage();
    }

    // Bande province
    const yProv = doc.y;
    doc.rect(40, yProv, PAGE_W, 22).fillColor(COULEUR_PROVINCE).fill();
    doc.fillColor('white').font('Helvetica-Bold').fontSize(12)
       .text(`  ${prov.toUpperCase()}`, 44, yProv + 5, { width: PAGE_W, lineBreak: false });
    const nbPrestProv = villes.reduce((s, v) => s + groupes[prov][v].length, 0);
    doc.fillColor('rgba(255,255,255,0.8)').font('Helvetica').fontSize(8)
       .text(`${nbPrestProv} prestataires — ${villes.length} ville(s)`, 44 + 300, yProv + 7, { width: 200, align: 'right', lineBreak: false });
    doc.y = yProv + 26;

    for (const ville of villes) {
      const lignesVille = groupes[prov][ville];

      // En-tête ville — nouvelle page si moins de 60pt disponibles
      if (doc.y > doc.page.height - 80) {
        dessinerEntetePage();
        doc.addPage();
      }

      // Bande ville
      const yVille = doc.y;
      doc.rect(40, yVille, PAGE_W, 16).fillColor(COULEUR_VILLE).fill();
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9)
         .text(`  ${ville}`, 44, yVille + 3, { width: 300, lineBreak: false });
      doc.fillColor('rgba(255,255,255,0.8)').font('Helvetica').fontSize(7.5)
         .text(`${lignesVille.length} prestataire(s)`, 44 + 300, yVille + 4, { width: 200, align: 'right', lineBreak: false });
      doc.y = yVille + 18;

      // En-tête de tableau
      dessinerEnteteTableau();

      // Trier par type puis nom
      const ordreType = ['Hôpital', 'Clinique', 'Cabinet', 'Cabinet Dentaire', 'Centre d\'Imagerie', 'Centre de Kinésithérapie', 'Laboratoire', 'Pharmacie', 'Dépôt pharmaceutique', 'Opticien'];
      const triees = [...lignesVille].sort((a, b) => {
        const iA = ordreType.indexOf(a.type);
        const iB = ordreType.indexOf(b.type);
        const tA = iA === -1 ? 99 : iA;
        const tB = iB === -1 ? 99 : iB;
        if (tA !== tB) return tA - tB;
        return (a.nom || '').localeCompare(b.nom || '', 'fr');
      });

      ligneIndex = 0;
      for (const p of triees) {
        ajouterLigne(p);
      }

      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
  }

  // Dernière page — pied
  dessinerEntetePage();

  doc.end();

  await new Promise((res, rej) => {
    stream.on('finish', res);
    stream.on('error', rej);
  });

  console.log(`\nPDF généré : ${SORTIE}`);
  console.log(`Total prestataires : ${total}`);
}

main().catch(e => { console.error(e); process.exit(1); });
