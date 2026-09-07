import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginatedTableProps {
  headers: string[];
  rows: string[][];
}

const ROWS_PER_PAGE = 8;

export function PaginatedTable({ headers, rows }: PaginatedTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / ROWS_PER_PAGE);
  const needsPagination = rows.length > ROWS_PER_PAGE;
  const visibleRows = needsPagination
    ? rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)
    : rows;

  return (
    <div className="my-3 rounded-lg border border-border/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold whitespace-nowrap bg-secondary/15 border-b-2 border-secondary/30 text-foreground/80">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr key={ri} className="hover:bg-secondary/[0.06] transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 border-b border-border/30 text-foreground/80 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {needsPagination && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border/30 text-[0.7rem] text-muted-foreground">
          <span>{page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, rows.length)} of {rows.length} rows</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-1 rounded hover:bg-secondary/20 disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 rounded hover:bg-secondary/20 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
