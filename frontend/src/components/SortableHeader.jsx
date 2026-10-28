import React from 'react';

/**
 * Visual indicator rendering up/down caret arrows.
 * Highlights the active ascending/descending caret or shows muted carets when inactive.
 */
export function SortIndicator({ colKey, sortKey, sortDirection }) {
  const isActive = sortKey === colKey && sortDirection != null;
  const isAsc = isActive && sortDirection === 'asc';
  const isDesc = isActive && sortDirection === 'desc';

  return (
    <span
      className={`sort-arrows ${isActive ? 'active' : 'inactive'}`}
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: '6px',
        verticalAlign: 'middle',
        gap: '2px',
        lineHeight: 1,
        flexShrink: 0
      }}
    >
      {/* Up Arrow / Caret */}
      <svg
        className={`sort-caret sort-caret-up ${isAsc ? 'active' : 'muted'}`}
        width="8"
        height="5"
        viewBox="0 0 8 5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          display: 'block',
          transition: 'transform 0.15s ease, opacity 0.15s ease'
        }}
      >
        <path
          d="M4 0.5L7.5 4.5H0.5L4 0.5Z"
          fill={isAsc ? '#2563eb' : '#94a3b8'}
          opacity={isAsc ? 1 : 0.4}
        />
      </svg>

      {/* Down Arrow / Caret */}
      <svg
        className={`sort-caret sort-caret-down ${isDesc ? 'active' : 'muted'}`}
        width="8"
        height="5"
        viewBox="0 0 8 5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          display: 'block',
          transition: 'transform 0.15s ease, opacity 0.15s ease'
        }}
      >
        <path
          d="M4 4.5L0.5 0.5H7.5L4 4.5Z"
          fill={isDesc ? '#2563eb' : '#94a3b8'}
          opacity={isDesc ? 1 : 0.4}
        />
      </svg>
    </span>
  );
}

/**
 * Interactive <th> component for sortable columns.
 * Adds cursor-pointer hover effect and accessible aria-sort.
 */
export function SortableTh({
  colKey,
  label,
  children,
  sortKey,
  sortDirection,
  onSort,
  className = '',
  style = {},
  scope = 'col',
  align = 'left',
  title
}) {
  const isSorted = sortKey === colKey && sortDirection != null;
  const ariaSort = isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';
  const nextDir = !isSorted ? 'ascending' : sortDirection === 'asc' ? 'descending' : 'natural';
  const computedTitle = title || `Click to sort by ${label || 'this column'} (${nextDir})`;

  return (
    <th
      scope={scope}
      aria-sort={ariaSort}
      title={computedTitle}
      className={`sortable-th ${isSorted ? 'sorted' : ''} ${className}`.trim()}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: align,
        transition: 'background-color 0.15s ease, color 0.15s ease',
        ...style
      }}
      onClick={() => onSort && onSort(colKey)}
    >
      <div
        className="sort-header-content"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
          width: '100%'
        }}
      >
        <span className="sort-header-label">{children || label}</span>
        <SortIndicator colKey={colKey} sortKey={sortKey} sortDirection={sortDirection} />
      </div>
    </th>
  );
}

export default SortableTh;
