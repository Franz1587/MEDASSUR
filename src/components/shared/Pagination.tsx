import type { UsePaginationResult } from "@/hooks/usePagination";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// Barre de pagination générique (2026-09) — voir usePagination.ts et
// demande utilisateur : "il faut mettre à présent une pagination avec une
// limite de 20 par page, avec l'option afficher plus par page... Tous les
// écrans doivent avoir une pagination." Un seul composant réutilisé par
// tous les écrans de liste, pour un rendu strictement identique partout.
interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions: number[];
  total: number;
  debut: number;
  fin: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({ page, pageCount, pageSize, pageSizeOptions, total, debut, fin, onPageChange, onPageSizeChange }: PaginationProps) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-1 py-2 text-[12px] text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>{debut}–{fin} sur {total}</span>
        <label className="flex items-center gap-1.5">
          Afficher
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-border rounded-md px-1.5 py-0.5 bg-background text-foreground text-[12px]"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>{n === total ? `Tout (${n})` : n}</option>
            ))}
          </select>
          par page
        </label>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button" disabled={page <= 1} onClick={() => onPageChange(1)}
            className="p-1 rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/60"
            title="Première page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}
            className="p-1 rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/60"
            title="Page précédente"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2">Page {page} / {pageCount}</span>
          <button
            type="button" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}
            className="p-1 rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/60"
            title="Page suivante"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button" disabled={page >= pageCount} onClick={() => onPageChange(pageCount)}
            className="p-1 rounded-md border border-border disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/60"
            title="Dernière page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// Raccourci : pagination branchée sur le résultat de usePagination.
export function Pager({ p }: { p: UsePaginationResult<unknown> }) {
  return <Pagination page={p.page} pageCount={p.pageCount} pageSize={p.pageSize} pageSizeOptions={p.pageSizeOptions} total={p.total} debut={p.debut} fin={p.fin} onPageChange={p.setPage} onPageSizeChange={p.setPageSize} />;
}
