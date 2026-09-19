import { ChartJSNodeCanvas } from "chartjs-node-canvas";

// Graphiques du rapport Statistiques (2026-09) — voir demande utilisateur :
// "le fichier statistique... doit être exactement comme celui de MedAssur",
// dont le modèle de référence ("Modèle statistiques.pdf") contient de vrais
// graphiques (barres, camemberts), pas seulement des tableaux. PDFKit ne
// dessine pas de graphiques ; chartjs-node-canvas rend une image PNG (via
// une installation précompilée de `canvas`, vérifiée fonctionnelle sur ce
// poste sans compilation native) — RÉUTILISÉE TELLE QUELLE dans le PDF
// (doc.image) et le Word (ImageRun), pour que les deux formats affichent
// exactement le même graphique.

const LARGEUR_BARRES = 900;
const HAUTEUR_BARRES = 480;
const TAILLE_CAMEMBERT = 720;

function creerCanvas(largeur: number, hauteur: number): ChartJSNodeCanvas {
  return new ChartJSNodeCanvas({
    width: largeur,
    height: hauteur,
    backgroundColour: "white",
    chartCallback: (ChartJS) => {
      ChartJS.defaults.font.family = "Helvetica, Arial, sans-serif";
      ChartJS.defaults.font.size = 16;
    },
  });
}

// Palette cyclique pour les camemberts à nombreux segments (Consommation
// par Prestataire peut dépasser 60 prestataires distincts, voir le modèle
// de référence) — couleurs contrastées, jamais toutes identiques.
const PALETTE = [
  "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231", "#911eb4", "#46f0f0", "#f032e6",
  "#bcf60c", "#fabebe", "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000", "#aaffc3",
  "#808000", "#ffd8b1", "#000075", "#808080", "#a9a9a9", "#fa8072", "#00ced1", "#daa520",
];

export async function genererGraphiqueBarres(
  labels: string[], data: number[], titre: string, couleurBarre: string, labelDataset = "Montants",
): Promise<Buffer> {
  const chart = creerCanvas(LARGEUR_BARRES, HAUTEUR_BARRES);
  const buffer = await chart.renderToBuffer({
    type: "bar",
    data: { labels, datasets: [{ label: labelDataset, data, backgroundColor: couleurBarre }] },
    options: {
      plugins: {
        title: { display: !!titre, text: titre, font: { size: 20, weight: "bold" } },
        legend: { display: true, position: "bottom" },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
  return buffer as Buffer;
}

// Barres comparatives avec la valeur affichée À L'INTÉRIEUR de chaque
// barre, en blanc, CENTRÉE verticalement — voir "Évolution du S/P" du
// modèle de référence (Stat CIMAF), qui superpose la valeur en gros, en
// blanc, au centre de la barre. Taille de police calculée pour un rendu
// net quel que soit le format d'insertion final (voir demande
// utilisateur, 2026-09-11 : "augmente la police à 18 ou 20 et mets en
// gras" — mesuré sur le PDF imprimé, le canvas fait 900px de large pour
// une insertion à ~largeur*0.75 d'une page A4 (~390pt), soit un facteur
// d'échelle ~0.43 : 20pt imprimés ≈ 46px canvas, arrondi à 46 ci-dessous
// plutôt que les 22px du premier essai (qui rendaient ~9-10pt à
// l'impression, trop petit).
export async function genererGraphiqueBarresEtiquetees(
  labels: string[], data: number[], titre: string, couleurs: string[], formatValeur: (v: number) => string,
): Promise<Buffer> {
  const chart = creerCanvas(LARGEUR_BARRES, HAUTEUR_BARRES);
  const maxVal = Math.max(...data, 0);
  const plugin = {
    id: "valeursBarres",
    afterDatasetsDraw(c: import("chart.js").Chart) {
      const { ctx } = c;
      c.data.datasets.forEach((_ds, di) => {
        const meta = c.getDatasetMeta(di);
        meta.data.forEach((bar, i) => {
          const v = data[i];
          const barElement = bar as unknown as { y: number; base: number };
          const centreY = (barElement.y + barElement.base) / 2;
          ctx.save();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 46px Helvetica";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(formatValeur(v), bar.x, centreY);
          ctx.restore();
        });
      });
    },
  };
  const buffer = await chart.renderToBuffer({
    type: "bar",
    data: { labels, datasets: [{ label: labelValeurs(titre), data, backgroundColor: couleurs }] },
    options: {
      plugins: { title: { display: !!titre, text: titre, font: { size: 20, weight: "bold" } }, legend: { display: false } },
      scales: { y: { beginAtZero: true, suggestedMax: maxVal * 1.15 } },
    },
    plugins: [plugin],
  });
  return buffer as Buffer;
}
function labelValeurs(_titre: string) { return "Valeurs"; }

export async function genererGraphiqueCamembert(
  labels: string[], data: number[], titre: string, donut = false,
): Promise<Buffer> {
  const chart = creerCanvas(TAILLE_CAMEMBERT, TAILLE_CAMEMBERT);
  const couleurs = labels.map((_l, i) => PALETTE[i % PALETTE.length]);
  const legendeCompacte = labels.length > 12;
  const buffer = await chart.renderToBuffer({
    type: donut ? "doughnut" : "pie",
    data: { labels, datasets: [{ data, backgroundColor: couleurs }] },
    options: {
      plugins: {
        title: { display: !!titre, text: titre, font: { size: 20, weight: "bold" } },
        legend: {
          display: true, position: "bottom",
          labels: { boxWidth: 12, font: { size: legendeCompacte ? 9 : 14 } },
        },
      },
    },
  });
  return buffer as Buffer;
}
