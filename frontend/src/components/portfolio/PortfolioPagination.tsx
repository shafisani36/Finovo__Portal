import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PortfolioPaginationProps {
  page: number;
  perPage?: number;
  totalCount: number;
  currentCount: number;
  onPageChange: (newPage: number) => void;
}

export const PortfolioPagination: React.FC<PortfolioPaginationProps> = ({
  page,
  perPage = 15,
  totalCount,
  currentCount,
  onPageChange,
}) => {
  const totalSafe = totalCount || currentCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalSafe / perPage));
  const startItem = totalSafe === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(page * perPage, totalSafe);

  return (
    <div className="px-5 py-3 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
      <div>
        Showing {startItem}–{endItem} of {totalSafe} entries
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-600 transition-colors"
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {Array.from({ length: totalPages }, (_, idx) => idx + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .map((p, idx, arr) => {
            const prevP = arr[idx - 1];
            const showEllipsis = prevP && p - prevP > 1;

            return (
              <React.Fragment key={p}>
                {showEllipsis && <span className="text-slate-400 text-xs px-1 select-none">...</span>}
                <button
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium flex items-center justify-center transition-colors cursor-pointer ${
                    page === p
                      ? 'bg-[#F95716] text-white font-bold shadow-xs'
                      : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {p}
                </button>
              </React.Fragment>
            );
          })}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer text-slate-600 transition-colors"
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
