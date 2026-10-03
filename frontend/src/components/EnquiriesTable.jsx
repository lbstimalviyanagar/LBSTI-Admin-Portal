import React, { useState } from 'react';
import Icon from './Icons';
import CsvUploader from './CsvUploader';
import {
  STATUSES,
  rangeOf,
  inRange,
  isPendingFU,
  dayDiff,
  fmtDay,
  initials,
  avColor,
  slug,
  parseDate,
  isoDay
} from '../utils/helpers';

export default function EnquiriesTable({
  enquiries = [],
  loading = false,
  counselorList = [],
  filterParams,
  setFilterParams,
  onOpenEdit,
  onConfirmAdmission,
  onRefresh,
  onGoToNewLead,
  onToast
}) {
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const {
    q,
    course,
    source,
    counselor,
    status,
    dateKind,
    from,
    to,
    sort,
    page,
    size
  } = filterParams;

  // Extract unique courses and sources for filters
  const uniqueCourses = Array.from(new Set(enquiries.map(e => e.course).filter(Boolean))).sort();
  const uniqueSources = Array.from(new Set(enquiries.map(e => e.source).filter(Boolean))).sort();

  // Calculate active filters count
  const activeFiltersCount = (
    (course !== "All" ? 1 : 0) +
    (source !== "All" ? 1 : 0) +
    (counselor !== "All" ? 1 : 0) +
    (status !== "All" ? 1 : 0) +
    (dateKind !== "all" ? 1 : 0)
  );

  // Filter rows
  const queryTerms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const dateRange = rangeOf(dateKind, from, to);

  const filteredRows = enquiries.filter((e) => {
    if (course !== "All" && e.course !== course) return false;
    if (source !== "All" && e.source !== source) return false;
    if (counselor !== "All" && e.assignedTo !== counselor) return false;
    if (status !== "All" && e.status !== status) return false;
    if (!inRange(e, dateRange)) return false;

    if (queryTerms.length > 0) {
      const haystack = `${e.name} ${e.phone} ${e.email || ''} ${e.city || ''}`.toLowerCase();
      if (!queryTerms.every(w => haystack.includes(w))) return false;
    }
    return true;
  });

  // Sort rows
  const sortKey = sort.key;
  const sortDir = sort.dir === "asc" ? 1 : -1;

  const sortedRows = [...filteredRows].sort((a, b) => {
    let x = a[sortKey];
    let y = b[sortKey];

    if (sortKey === "status") {
      x = STATUSES.indexOf(x);
      y = STATUSES.indexOf(y);
    } else if (sortKey === "createdAt" || sortKey === "followUpDate") {
      const inf = sortDir > 0 ? Infinity : -Infinity;
      x = parseDate(x) ? +parseDate(x) : inf;
      y = parseDate(y) ? +parseDate(y) : inf;
    } else {
      x = String(x || "").toLowerCase();
      y = String(y || "").toLowerCase();
    }

    return x < y ? -sortDir : x > y ? sortDir : 0;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / size));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * size;
  const paginatedRows = sortedRows.slice(startIndex, startIndex + size);

  const handleSort = (key) => {
    setFilterParams(prev => ({
      ...prev,
      sort: {
        key,
        dir: prev.sort.key === key && prev.sort.dir === "asc" ? "desc" : "asc"
      },
      page: 1
    }));
  };

  const clearFilters = () => {
    setFilterParams(prev => ({
      ...prev,
      q: "",
      course: "All",
      source: "All",
      counselor: "All",
      status: "All",
      dateKind: "all",
      from: "",
      to: "",
      page: 1
    }));
  };

  const handleExportCSV = () => {
    if (!sortedRows.length) return;
    const headers = ["Name", "Phone", "Locality", "Course", "Batch", "Source", "Status", "Counselor", "Follow-up", "Created", "Remarks"];
    const escapeCsv = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...sortedRows.map(e => [
        e.name,
        e.phone,
        e.city || "",
        e.course || "",
        e.batch || "",
        e.source || "",
        e.status || "",
        e.assignedTo || "",
        parseDate(e.followUpDate) ? isoDay(parseDate(e.followUpDate)) : "",
        parseDate(e.createdAt) ? isoDay(parseDate(e.createdAt)) : "",
        e.notes || ""
      ].map(escapeCsv).join(","))
    ].join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `enquiries-${isoDay(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const columns = [
    { key: "name", label: "Student", sortable: true },
    { key: "course", label: "Course", sortable: true },
    { key: "phone", label: "Phone", sortable: false },
    { key: "source", label: "Source", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "assignedTo", label: "Counselor", sortable: true },
    { key: "followUpDate", label: "Follow-up", sortable: true },
    { key: "createdAt", label: "Created", sortable: true },
    { key: "action", label: "Action", sortable: false }
  ];

  return (
    <section>
      <div className="card">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="search">
            <span className="si"><Icon name="search" size={18} /></span>
            <input
              className="input"
              type="search"
              placeholder="Search name, phone number, or locality"
              value={q}
              onChange={(e) => setFilterParams(prev => ({ ...prev, q: e.target.value, page: 1 }))}
              autoComplete="off"
            />
          </div>

          <button
            className="btn filter-toggle"
            type="button"
            aria-expanded={filterDrawerOpen}
            onClick={() => setFilterDrawerOpen(true)}
          >
            <span className="ic"><Icon name="filter" size={16} /></span>
            Filters
            {activeFiltersCount > 0 && (
              <span className="badge">{activeFiltersCount}</span>
            )}
          </button>

          {/* Filters dropdown / mobile drawer */}
          <div className={`filters ${filterDrawerOpen ? 'open' : ''}`} role="group" aria-label="Filters">
            <div className="filters-head">
              <b>Filters</b>
              <button
                className="icon-btn"
                type="button"
                aria-label="Close filters"
                onClick={() => setFilterDrawerOpen(false)}
              >
                <span className="ic"><Icon name="x" size={18} /></span>
              </button>
            </div>

            {/* Course Filter */}
            <div className="fl">
              <label htmlFor="tCourse">Course</label>
              <select
                className="select"
                id="tCourse"
                value={course}
                onChange={(e) => setFilterParams(prev => ({ ...prev, course: e.target.value, page: 1 }))}
              >
                <option value="All">All courses</option>
                {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Source Filter */}
            <div className="fl">
              <label htmlFor="tSource">Source</label>
              <select
                className="select"
                id="tSource"
                value={source}
                onChange={(e) => setFilterParams(prev => ({ ...prev, source: e.target.value, page: 1 }))}
              >
                <option value="All">All sources</option>
                {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Counselor Filter */}
            <div className="fl">
              <label htmlFor="tCounselor">Counselor</label>
              <select
                className="select"
                id="tCounselor"
                value={counselor}
                onChange={(e) => setFilterParams(prev => ({ ...prev, counselor: e.target.value, page: 1 }))}
              >
                <option value="All">All counselors</option>
                {counselorList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Status Filter */}
            <div className="fl">
              <label htmlFor="tStatus">Status</label>
              <select
                className="select"
                id="tStatus"
                value={status}
                onChange={(e) => setFilterParams(prev => ({ ...prev, status: e.target.value, page: 1 }))}
              >
                <option value="All">All statuses</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Date range Filter */}
            <div className="fl">
              <label htmlFor="tDate">Date range</label>
              <select
                className="select"
                id="tDate"
                value={dateKind}
                onChange={(e) => setFilterParams(prev => ({ ...prev, dateKind: e.target.value, page: 1 }))}
              >
                <option value="all">Any date</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="lastmonth">Last month</option>
                <option value="custom">Custom range</option>
              </select>
            </div>

            {dateKind === "custom" && (
              <div className="fl custom">
                <div>
                  <label htmlFor="tFrom">From</label>
                  <input
                    className="input"
                    type="date"
                    id="tFrom"
                    value={from}
                    onChange={(e) => setFilterParams(prev => ({ ...prev, from: e.target.value, page: 1 }))}
                  />
                </div>
                <div>
                  <label htmlFor="tTo">To</label>
                  <input
                    className="input"
                    type="date"
                    id="tTo"
                    value={to}
                    onChange={(e) => setFilterParams(prev => ({ ...prev, to: e.target.value, page: 1 }))}
                  />
                </div>
              </div>
            )}

            <div className="filters-foot">
              <button className="btn" type="button" onClick={clearFilters}>
                <span className="ic"><Icon name="x" size={16} /></span> Clear filters
              </button>
              <button
                className="btn primary done"
                type="button"
                onClick={() => setFilterDrawerOpen(false)}
              >
                Show results
              </button>
            </div>
          </div>

          <div className="tool-actions">
            <CsvUploader onImportSuccess={onRefresh} onToast={onToast} />
            <button
              className="btn"
              type="button"
              aria-label="Refresh table"
              title="Refresh"
              onClick={onRefresh}
            >
              <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={18} /></span>
            </button>
            <button
              className="btn"
              type="button"
              aria-label="Export CSV"
              title="Export CSV"
              onClick={handleExportCSV}
            >
              <span className="ic"><Icon name="download" size={18} /></span>
            </button>
          </div>
        </div>

        {/* Backdrop for mobile drawer */}
        {filterDrawerOpen && (
          <div className="scrim" onClick={() => setFilterDrawerOpen(false)} />
        )}

        {/* Data Table */}
        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((col) => {
                  const isSorted = sort.key === col.key;
                  return (
                    <th key={col.key} scope="col">
                      {col.sortable ? (
                        <button type="button" onClick={() => handleSort(col.key)}>
                          {col.label}
                          <span className="arr">
                            {isSorted && sort.dir === "asc" ? " ▲" : isSorted ? " ▼" : " ▲"}
                          </span>
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9">
                    <div className="skel" style={{ height: '260px' }} />
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan="9">
                    {enquiries.length === 0 ? (
                      <div className="empty">
                        <div className="ei"><Icon name="inbox" size={24} /></div>
                        <b>No enquiries yet</b>
                        <span>Add your first lead to get started.</span>
                        <br />
                        <button className="btn primary" type="button" onClick={onGoToNewLead}>
                          Add an enquiry
                        </button>
                      </div>
                    ) : (
                      <div className="empty">
                        <div className="ei"><Icon name="search" size={24} /></div>
                        <b>No enquiries match</b>
                        <span>Try a different search or clear the filters.</span>
                        <br />
                        <button className="btn" type="button" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((e) => {
                  const d = parseDate(e.followUpDate);
                  const isOverdue = d && dayDiff(new Date(), d) < 0;
                  return (
                    <tr key={e.id}>
                      <td data-label="Student">
                        <button
                          className="person"
                          type="button"
                          onClick={() => onOpenEdit(e.id)}
                        >
                          <span className="av" style={{ background: avColor(e.name) }}>
                            {initials(e.name)}
                          </span>
                          <span>
                            <b>{e.name || "Unnamed"}</b>
                            <small>{e.city || e.email || ""}</small>
                          </span>
                        </button>
                      </td>
                      <td data-label="Course">{e.course || "–"}</td>
                      <td data-label="Phone">{e.phone}</td>
                      <td data-label="Source">{e.source || "–"}</td>
                      <td data-label="Status">
                        <span className={`pill s-${slug(e.status)}`}>
                          {e.status}
                        </span>
                      </td>
                      <td data-label="Counselor">
                        {e.assignedTo ? e.assignedTo : <span className="muted">Unassigned</span>}
                      </td>
                      <td data-label="Follow-up Date">
                        {e.status === "Confirmed" || e.status === "Dropped" ? (
                          <span className="muted">–</span>
                        ) : !d ? (
                          <span className="muted">Not set</span>
                        ) : isOverdue ? (
                          <span className="overdue" title="Overdue">{fmtDay(d)}</span>
                        ) : (
                          fmtDay(d)
                        )}
                      </td>
                      <td data-label="Created">{fmtDay(e.createdAt)}</td>
                      <td data-label="Actions">
                        <div className="acts">
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => onOpenEdit(e.id)}
                          >
                            <Icon name="edit" size={15} /> Edit lead
                          </button>
                          {isPendingFU(e) && (
                            <button
                              className="btn sm ok icon"
                              type="button"
                              title="Confirm admission"
                              aria-label={`Confirm admission for ${e.name}`}
                              onClick={() => onConfirmAdmission(e.id)}
                            >
                              <Icon name="check" size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="pager">
          <span>
            {sortedRows.length
              ? `Showing ${startIndex + 1}–${Math.min(startIndex + size, sortedRows.length)} of ${sortedRows.length}`
              : '0 results'}
          </span>
          <div className="btns">
            <span className="rows">
              Rows per page
              <select
                className="select"
                value={size}
                onChange={(e) => setFilterParams(prev => ({ ...prev, size: parseInt(e.target.value, 10), page: 1 }))}
                aria-label="Rows per page"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </span>
            <button
              className="btn sm"
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setFilterParams(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              className="btn sm"
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setFilterParams(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
