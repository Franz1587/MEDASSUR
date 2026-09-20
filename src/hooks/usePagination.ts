import { useMemo, useState } from "react";

// Pagination générique côté client (2026-09) — voir demande utilisateur :
// "il faut mettre à présent une pagination avec une limite de 20 par
// page, avec l'option afficher plus par page. En fonction du nombre de
// données mettre une limite logique par page même si on affiche plus.
// Tous les écrans doivent avoir une pagination." Toutes les listes de
// l'application chargent déjà la totalité des lignes (aucune pagination
// côté serveur, aucun paramètre offset/limit dans les endpoints existants)
// — cette pagination reste donc côté client, appliquée au tableau déjà
// filtré/trié par l'écran appelant.
const TAILLE_PAR_DEFAUT = 20;

// Paliers de taille de page proposés, plafonnés au total réel de lignes —
// jamais de "Afficher 500" sur une liste de 12 éléments (voir demande
// utilisateur ci-dessus). "Tout afficher" reste toujours la dernière
// option, pour l'écran qui a besoin d'exporter/parcourir la liste entière
// visuellement sans re-cliquer plusieurs pages.
function optionsTaillePage(total: number): number[] {
  const paliers = [20, 50, 100, 200, 500];
  const options = paliers.filter((p) => p < total);
  if (total > 0) options.push(total);
  return Array.from(new Set(options)).sort((a, b) => a - b);
}

export interface UsePaginationResult<T> {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: number[];
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  pageItems: T[];
  total: number;
  /** Index affiché (1-based) du premier élément de la page courante — 0 si la liste est vide. */
  debut: number;
  /** Index affiché (1-based) du dernier élément de la page courante. */
  fin: number;
}

// `items` = la liste DÉJÀ filtrée/triée par l'écran appelant — ce hook ne
// fait que découper en pages, jamais de filtrage/tri lui-même. La page
// demandée est automatiquement ramenée dans les bornes valides si la
// liste rétrécit (ex. un filtre appliqué pendant qu'on était en page 4).
export function usePagination<T>(items: T[], tailleInitiale = TAILLE_PAR_DEFAUT): UsePaginationResult<T> {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(tailleInitiale);

  const total = items.length;
  const pageSizeOptions = useMemo(() => optionsTaillePage(total), [total]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageActuelle = Math.min(Math.max(1, page), pageCount);

  const pageItems = useMemo(() => {
    const debutIndex = (pageActuelle - 1) * pageSize;
    return items.slice(debutIndex, debutIndex + pageSize);
  }, [items, pageActuelle, pageSize]);

  const setPage = (p: number) => setPageState(Math.min(Math.max(1, p), pageCount));
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPageState(1); // repart de la première page — la numérotation change de sens sinon
  };

  const debut = total === 0 ? 0 : (pageActuelle - 1) * pageSize + 1;
  const fin = Math.min(pageActuelle * pageSize, total);

  return { page: pageActuelle, pageCount, pageSize, pageSizeOptions, setPage, setPageSize, pageItems, total, debut, fin };
}
