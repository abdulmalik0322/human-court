// Numbered pagination with a sliding window of pages.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './ui.css';

// How many numbered buttons to show around the current page.
const WINDOW = 2;

function visiblePages(page, totalPages) {
  const start = Math.max(1, page - WINDOW);
  const end = Math.min(totalPages, page + WINDOW);
  const pages = [];
  for (let n = start; n <= end; n++) pages.push(n);
  return pages;
}

export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="page-btn"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Go to previous page"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </button>

      {visiblePages(page, totalPages).map((n) => (
        <button
          key={n}
          type="button"
          className={`page-btn${n === page ? ' current' : ''}`}
          aria-label={`Go to page ${n}`}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onChange(n)}
          disabled={n === page}
        >
          {n}
        </button>
      ))}

      <button
        type="button"
        className="page-btn"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Go to next page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
