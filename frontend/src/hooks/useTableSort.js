import { useState, useCallback, useMemo } from 'react';
import { sortData } from '../utils/tableSort';

/**
 * Custom hook to manage table column sorting state and behavior.
 * 
 * @param {Object} initialConfig
 * @param {string|null} initialConfig.key Initial column key to sort by
 * @param {'asc'|'desc'|null} initialConfig.direction Initial direction ('asc', 'desc', or null)
 * @param {boolean} initialConfig.allowClear Whether cycling through sorts allows resetting to unsorted (null)
 */
export function useTableSort(initialConfig = {}) {
  const [sortKey, setSortKey] = useState(initialConfig.key || null);
  const [sortDirection, setSortDirection] = useState(initialConfig.direction || null);
  const allowClear = initialConfig.allowClear !== false; // Default true: asc -> desc -> null

  const handleSort = useCallback((key, defaultDirection = 'asc') => {
    if (!key) return;

    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection(defaultDirection);
    } else {
      // Same key: cycle direction
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        if (allowClear) {
          setSortKey(null);
          setSortDirection(null);
        } else {
          setSortDirection('asc');
        }
      } else {
        setSortDirection('asc');
      }
    }
  }, [sortKey, sortDirection, allowClear]);

  const resetSort = useCallback(() => {
    setSortKey(initialConfig.key || null);
    setSortDirection(initialConfig.direction || null);
  }, [initialConfig.key, initialConfig.direction]);

  const setSort = useCallback((key, direction) => {
    setSortKey(key);
    setSortDirection(direction);
  }, []);

  return {
    sortKey,
    sortDirection,
    handleSort,
    resetSort,
    setSort,
    // Convenience helper to sort an array directly with this hook's state
    sortList: useCallback((list, customGetters) => {
      return sortData(list, sortKey, sortDirection, customGetters);
    }, [sortKey, sortDirection])
  };
}

export default useTableSort;
