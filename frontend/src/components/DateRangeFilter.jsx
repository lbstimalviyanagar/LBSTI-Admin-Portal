import React from 'react';

const DATE_RANGE_OPTIONS = [
  ['all', 'All Time'],
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['week', 'This Week'],
  ['month', 'This Month'],
  ['lastmonth', 'Last Month'],
  ['custom', 'Custom Range']
];

export default function DateRangeFilter({
  id,
  value,
  onChange,
  from = '',
  to = '',
  onFromChange,
  onToChange
}) {
  return (
    <div className="date-range-filter">
      <label className="sr-only" htmlFor={id}>Time range</label>
      <select
        className="select"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {DATE_RANGE_OPTIONS.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>{label}</option>
        ))}
      </select>

      {value === 'custom' && (
        <div className="custom-range">
          <input
            className="input"
            type="date"
            value={from}
            onChange={(event) => onFromChange(event.target.value)}
            aria-label="From date"
            title="From date"
          />
          <span className="muted">to</span>
          <input
            className="input"
            type="date"
            value={to}
            onChange={(event) => onToChange(event.target.value)}
            aria-label="To date"
            title="To date"
          />
        </div>
      )}
    </div>
  );
}
