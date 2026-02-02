// Pagination Component

// import React from 'react';
import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  prefix?: string; // For unique IDs if multiple paginations on page
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  prefix: _prefix = 'list', // Currently unused but kept for potential future use
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing <span>{start}</span> - <span>{end}</span> of <span>{totalItems}</span> clients
      </div>
      <div className="pagination-controls">
        <button
          className="btn-secondary btn-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </button>
        <div className="pagination-page-info">
          Page {currentPage} of {totalPages || 1}
        </div>
        <button
          className="btn-secondary btn-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
