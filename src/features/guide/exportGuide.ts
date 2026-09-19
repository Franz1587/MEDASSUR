import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, HeadingLevel, ImageRun, TextRun, PageBreak } from "docx";
import { saveAs } from "file-saver";
import type { GuideChapitre } from "./guideContent";

// Export du guide en PDF / Word (2026-09) — voir demande utilisateur : "Il
// faut rendre téléchargeable le guide en PDF et en Word." Tout se fait
// CÔTÉ NAVIGATEUR (jsPDF / docx), directement depuis le même contenu que
// l'écran (guideContent.tsx) — une seule source de vérité pour le texte ET
// les captures, jamais un aller-retour serveur ni un contenu dupliqué.

interface ImageChargee { dataUrl: string; arrayBuffer: ArrayBuffer; width: number; height: number }

const cacheImages = new Map<string, Promise<ImageChargee>>();

function chargerImage(url: string): Promise<ImageChargee> {
  if (!url) return Promise.reject(new Error("URL vide"));
  const enCache = cacheImages.get(url);
  if (enCache) return enCache;
  const p = (async () => {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "image/png" });
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, arrayBuffer, width, height };
  })();
  cacheImages.set(url, p);
  return p;
}

// Précharge en parallèle (limité) toutes les images du guide avant de
// générer le document — évite de découvrir un échec de fetch au milieu de
// la construction du PDF/Word.
async function precharger(chapitres: GuideChapitre[], onProgress?: (fait: number, total: number) => void) {
  const urls = new Set<string>();
  for (const c of chapitres) {
    for (const s of c.sections) {
      if (s.image) urls.add(s.image);
      for (const e of s.etapes ?? []) if (e.image) urls.add(e.image);
    }
  }
  const liste = [...urls];
  let fait = 0;
  const CONCURRENCE = 6;
  let index = 0;
  async function worker() {
    while (index < liste.length) {
      const i = index++;
      await chargerImage(liste[i]).catch(() => undefined);
      fait++;
      onProgress?.(fait, liste.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCE }, worker));
}

// ── PDF (jsPDF) ────────────────────────────────────────────────────────
export async function exporterGuidePdf(
  chapitres: GuideChapitre[],
  titre: string,
  onProgress?: (fait: number, total: number) => void,
) {
  await precharger(chapitres, onProgress);

  // Les polices intégrées de jsPDF (Helvetica) sont en WinAnsi et n'ont pas
  // le caractère « → » (rendu "!'" sans ce correctif, repéré en relisant le
  // PDF généré) — substitution ASCII sûre, uniquement pour la sortie PDF
  // (le rendu à l'écran et l'export Word gardent la vraie flèche Unicode).
  const s = (texte: string) => texte.replace(/→/g, "->");

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentW = pageW - margin * 2;
  let y = margin;

  const sautDePageSiNecessaire = (hauteurNecessaire: number) => {
    if (y + hauteurNecessaire > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const ecrireParagraphe = (texte: string, taille = 10, gras = false, couleur: [number, number, number] = [40, 40, 40]) => {
    doc.setFont("helvetica", gras ? "bold" : "normal");
    doc.setFontSize(taille);
    doc.setTextColor(...couleur);
    const lignes = doc.splitTextToSize(s(texte), contentW);
    const hauteurLigne = taille * 1.32;
    sautDePageSiNecessaire(lignes.length * hauteurLigne);
    doc.text(lignes, margin, y);
    y += lignes.length * hauteurLigne;
  };

  // Page de garde
  doc.setFillColor(13, 115, 191);
  doc.rect(0, 0, pageW, 150, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("MedAssur", margin, 70);
  doc.setFontSize(16);
  doc.text(titre, margin, 100);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, margin, 125);
  y = 190;
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Sommaire", margin, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  chapitres.forEach((c, i) => {
    sautDePageSiNecessaire(16);
    doc.text(s(`${i + 1}. ${c.titre}`), margin, y);
    y += 16;
  });

  for (let ci = 0; ci < chapitres.length; ci++) {
    const chapitre = chapitres[ci];
    doc.addPage();
    y = margin;
    doc.setTextColor(13, 115, 191);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(s(`${ci + 1}. ${chapitre.titre}`), margin, y);
    y += 14;
    doc.setDrawColor(13, 115, 191);
    doc.line(margin, y, pageW - margin, y);
    y += 20;

    for (const section of chapitre.sections) {
      sautDePageSiNecessaire(30);
      ecrireParagraphe(section.titre, 13, true, [20, 20, 20]);
      y += 4;
      for (const p of section.texte) {
        ecrireParagraphe(p, 10, false);
        y += 6;
      }

      if (section.image) {
        const chargee = await chargerImage(section.image).catch(() => null);
        if (chargee) {
          const w = contentW;
          const h = (chargee.height / chargee.width) * w;
          sautDePageSiNecessaire(h + 14);
          doc.setDrawColor(210, 210, 210);
          doc.rect(margin, y, w, h);
          doc.addImage(chargee.dataUrl, "PNG", margin, y, w, h, undefined, "FAST");
          y += h + 18;
        }
      }

      if (section.etapes?.length) {
        for (let ei = 0; ei < section.etapes.length; ei++) {
          const etape = section.etapes[ei];
          sautDePageSiNecessaire(24);
          ecrireParagraphe(`Étape ${ei + 1}${etape.titre ? " — " + etape.titre : ""}`, 11, true, [13, 115, 191]);
          y += 2;
          ecrireParagraphe(etape.texte, 10, false);
          if (etape.image) {
            const chargee = await chargerImage(etape.image).catch(() => null);
            if (chargee) {
              const w = contentW * 0.82;
              const h = (chargee.height / chargee.width) * w;
              sautDePageSiNecessaire(h + 14);
              doc.setDrawColor(210, 210, 210);
              doc.rect(margin, y, w, h);
              doc.addImage(chargee.dataUrl, "PNG", margin, y, w, h, undefined, "FAST");
              y += h + 16;
            }
          }
          y += 6;
        }
      }
      y += 10;
    }
  }

  // Numérotation des pages
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text(`MedAssur — Guide d'utilisateur — ${p} / ${total}`, pageW / 2, pageH - 18, { align: "center" });
  }

  doc.save(`MedAssur-${titre.replace(/[^\w-]+/g, "-")}.pdf`);
}

// ── Word (docx) ────────────────────────────────────────────────────────
export async function exporterGuideWord(
  chapitres: GuideChapitre[],
  titre: string,
  onProgress?: (fait: number, total: number) => void,
) {
  await precharger(chapitres, onProgress);

  const enfants: (Paragraph)[] = [
    new Paragraph({ text: "MedAssur", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: titre, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Généré le ${new Date().toLocaleDateString("fr-FR")}`, spacing: { after: 400 } }),
  ];

  const LARGEUR_MAX_PX = 560;

  const imageParagraphe = async (url: string): Promise<Paragraph | null> => {
    const chargee = await chargerImage(url).catch(() => null);
    if (!chargee) return null;
    const ratio = chargee.height / chargee.width;
    const w = Math.min(LARGEUR_MAX_PX, chargee.width);
    const h = w * ratio;
    return new Paragraph({
      children: [
        new ImageRun({
          data: chargee.arrayBuffer,
          transformation: { width: w, height: h },
          type: "png",
        }),
      ],
      spacing: { after: 240 },
    });
  };

  for (let ci = 0; ci < chapitres.length; ci++) {
    const chapitre = chapitres[ci];
    if (ci > 0) enfants.push(new Paragraph({ children: [new PageBreak()] }));
    enfants.push(new Paragraph({ text: `${ci + 1}. ${chapitre.titre}`, heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }));

    for (const section of chapitre.sections) {
      enfants.push(new Paragraph({ text: section.titre, heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }));
      for (const p of section.texte) {
        enfants.push(new Paragraph({ children: [new TextRun(p)], spacing: { after: 120 } }));
      }
      if (section.image) {
        const img = await imageParagraphe(section.image);
        if (img) enfants.push(img);
      }
      if (section.etapes?.length) {
        for (let ei = 0; ei < section.etapes.length; ei++) {
          const etape = section.etapes[ei];
          enfants.push(new Paragraph({
            children: [new TextRun({ text: `Étape ${ei + 1}${etape.titre ? " — " + etape.titre : ""}`, bold: true, color: "0D73BF" })],
            spacing: { before: 160, after: 80 },
          }));
          enfants.push(new Paragraph({ children: [new TextRun(etape.texte)], spacing: { after: 100 } }));
          if (etape.image) {
            const img = await imageParagraphe(etape.image);
            if (img) enfants.push(img);
          }
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children: enfants }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `MedAssur-${titre.replace(/[^\w-]+/g, "-")}.docx`);
}
