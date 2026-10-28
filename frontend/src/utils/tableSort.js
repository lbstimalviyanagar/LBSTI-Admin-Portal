/**
 * Shared sorting utility for CRM data tables.
 * Handles strings, numbers, dates, and times accurately.
 */

// Parse a date or date-like value into a timestamp
export function parseSortableDate(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();

  const str = String(val).trim();

  // Check for time slot range like "07:00 AM - 08:00 AM" or "7:00 AM"
  const timeSlotMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (timeSlotMatch) {
    let hours = parseInt(timeSlotMatch[1], 10);
    const minutes = parseInt(timeSlotMatch[2], 10);
    const meridiem = timeSlotMatch[3].toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes; // Minute of day
  }

  // Standard date parsing (YYYY-MM-DD or ISO)
  const parsed = Date.parse(str.replace(' ', 'T'));
  if (!isNaN(parsed)) return parsed;

  const direct = new Date(str).getTime();
  return isNaN(direct) ? null : direct;
}

// Extract a clean comparable value
export function extractComparableValue(item, key, customGetter) {
  if (!item) return null;

  if (typeof customGetter === 'function') {
    return customGetter(item);
  }

  if (typeof key === 'function') {
    return key(item);
  }

  // Direct property or nested property (e.g. 'user.name')
  if (typeof key === 'string' && key.includes('.')) {
    return key.split('.').reduce((acc, part) => (acc ? acc[part] : null), item);
  }

  return item[key];
}

/**
 * Compare two values dynamically based on their inferred type.
 */
export function compareValues(valA, valB, direction = 'asc') {
  // Handle null / undefined / empty: always place at the end regardless of direction
  const isAEmpty = valA == null || valA === '';
  const isBEmpty = valB == null || valB === '';

  if (isAEmpty && isBEmpty) return 0;
  if (isAEmpty) return 1;
  if (isBEmpty) return -1;

  const multiplier = direction === 'desc' ? -1 : 1;

  // 1. Numerical comparison (including numbers as strings or currency like "₹2,500")
  const numA = typeof valA === 'number' ? valA : (typeof valA === 'string' && /^₹?\s*[-+]?[0-9,]+(\.[0-9]+)?$/.test(valA.trim()) ? parseFloat(valA.replace(/[₹,\s]/g, '')) : NaN);
  const numB = typeof valB === 'number' ? valB : (typeof valB === 'string' && /^₹?\s*[-+]?[0-9,]+(\.[0-9]+)?$/.test(valB.trim()) ? parseFloat(valB.replace(/[₹,\s]/g, '')) : NaN);

  if (!isNaN(numA) && !isNaN(numB)) {
    return (numA - numB) * multiplier;
  }

  // 2. Date / Time comparison
  // If value is Date object or looks like a date string (YYYY-MM-DD or time slot)
  const isDateCandidate = (v) => v instanceof Date || (typeof v === 'string' && (/^\d{4}-\d{2}-\d{2}/.test(v) || /\d{1,2}:\d{2}\s*(AM|PM)/i.test(v)));
  if (isDateCandidate(valA) && isDateCandidate(valB)) {
    const timeA = parseSortableDate(valA);
    const timeB = parseSortableDate(valB);
    if (timeA !== null && timeB !== null) {
      return (timeA - timeB) * multiplier;
    }
  }

  // 3. String comparison (natural / case-insensitive alphanumeric)
  const strA = String(valA).trim();
  const strB = String(valB).trim();
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
}

/**
 * Sorts an array of items given a sort key, direction, and optional custom getters.
 */
export function sortData(items, sortKey, sortDirection, customGetters = {}) {
  if (!Array.isArray(items) || items.length <= 1 || !sortKey || !sortDirection) {
    return items || [];
  }

  const getter = customGetters[sortKey];

  return [...items].sort((a, b) => {
    const valA = extractComparableValue(a, sortKey, getter);
    const valB = extractComparableValue(b, sortKey, getter);
    return compareValues(valA, valB, sortDirection);
  });
}
