import React, { useState, useMemo } from 'react';
import Icon from './Icons';
import DonutChart from './Charts/DonutChart';
import { useResponsive } from '../hooks/useResponsive';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Bar
} from 'recharts';
import {
  OPEN_STATUSES,
  STATUSES,
  SCOL,
  PALETTE,
  rangeOf,
  inRange,
  isPendingFU,
  dayDiff,
  sod,
  addDays,
  fmtDay,
  fmtShort,
  initials,
  avColor,
  slug,
  parseDate,
  MON,
  STANDARDIZED_SOURCES,
  normalizeLeadSource,
  normalizeStatus,
  canonicalCounselorName
} from '../utils/helpers';

export default function EnquiryDashboard({
  enquiries = [],
  loading = false,
  dashRangeKind = "all",
  dashFrom = "",
  dashTo = "",
  onOpenEdit,
  onConfirmAdmission,
  onDrillIntoTable,
  onGoToNewLead
}) {
  const { width: windowWidth, isMobile, isTablet } = useResponsive();
  const [courseViewMode, setCourseViewMode] = useState('auto'); // 'auto' | 'bars' (horizontal rows) | 'columns' (vertical bars)
  const [activeSourceFilter, setActiveSourceFilter] = useState(null);

  const handleSourceClick = (sourceName) => {
    setActiveSourceFilter(prev => {
      if (prev && String(prev).trim().toLowerCase() === String(sourceName).trim().toLowerCase()) {
        return null;
      }
      return sourceName;
    });
  };

  const r = rangeOf(dashRangeKind, dashFrom, dashTo);
  const list = enquiries.filter(e => inRange(e, r));
  const today = sod(new Date());

  const total = list.length;
  const openLeads = list.filter(e => OPEN_STATUSES.includes(normalizeStatus(e.status)));
  const active = openLeads.filter(e => e.assignedTo).length;
  const dropped = list.filter(e => normalizeStatus(e.status) === "Lost / Closed").length;
  const confirmed = list.filter(e => normalizeStatus(e.status) === "Admission Confirmed").length;
  const inCounseling = list.filter(e => {
    const ns = normalizeStatus(e.status);
    return ns === "In Discussion" || ns === "Campus Visit Booked";
  }).length;
  const pending = openLeads.filter(isPendingFU);
  const overdue = pending.filter(e => {
    const d = parseDate(e.followUpDate);
    return d && sod(d) < today;
  }).length;

  let totalSub = "All enquiries in this period";
  if (r.start && r.end) {
    const len = dayDiff(r.start, r.end);
    const prev = enquiries.filter(e => inRange(e, { start: addDays(r.start, -len), end: r.start })).length;
    if (prev > 0) {
      const pct = Math.round(((total - prev) / prev) * 100);
      totalSub = (
        <>
          <span className={`trend ${pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'}`}>
            {pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : ''}{Math.abs(pct)}%
          </span> vs previous period
        </>
      );
    }
  }

  // Calculate bucket points for the LineChart
  const getBuckets = () => {
    const tomorrow = addDays(today, 1);
    if (dashRangeKind === "today") {
      const c = Array(24).fill(0);
      list.forEach(e => {
        const d = parseDate(e.inquiryDate || e.createdAt);
        if (d) c[d.getHours()]++;
      });
      return c.map((v, h) => {
        const l = `${h % 12 || 12}${h < 12 ? ' AM' : ' PM'}`;
        return { v, label: l, full: l };
      });
    }

    let start = r.start;
    if (!start) {
      const ds = list.map(e => parseDate(e.inquiryDate || e.createdAt)).filter(Boolean);
      start = ds.length ? sod(new Date(Math.min(...ds))) : addDays(tomorrow, -30);
    }
    let end = r.end && r.end < tomorrow ? r.end : tomorrow;
    if (end <= start) end = addDays(start, 1);

    const span = dayDiff(start, end);
    const weekly = span > 62;
    const n = weekly ? Math.ceil(span / 7) : span;
    const c = Array(n).fill(0);

    list.forEach(e => {
      const d = parseDate(e.inquiryDate || e.createdAt);
      if (!d) return;
      const i = Math.floor(dayDiff(start, d) / (weekly ? 7 : 1));
      if (i >= 0 && i < n) c[i]++;
    });

    return c.map((v, i) => {
      const d = addDays(start, i * (weekly ? 7 : 1));
      return {
        v,
        label: fmtShort(d),
        full: weekly ? `Week of ${fmtShort(d)}` : `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`
      };
    });
  };

  // Enquiries by course
  const byCourseMap = {};
  list.forEach(e => {
    const c = e.course || "Other";
    byCourseMap[c] = (byCourseMap[c] || 0) + 1;
  });
  const courseItems = Object.keys(byCourseMap)
    .map(k => ({ name: k, v: byCourseMap[k] }))
    .sort((a, b) => b.v - a.v);

  // Counselor workload (grouped strictly by canonical faculty/counselor name)
  const byStaffMap = {};
  list.forEach(e => {
    const counselor = canonicalCounselorName(e.assignedTo);
    if (counselor) byStaffMap[counselor] = (byStaffMap[counselor] || 0) + 1;
  });
  const workloadItems = Object.keys(byStaffMap)
    .map(k => ({ name: k, v: byStaffMap[k] }))
    .sort((a, b) => b.v - a.v);

  // Lead status breakdown
  const byStatusMap = {};
  STATUSES.forEach(s => { byStatusMap[s] = 0; });
  list.forEach(e => {
    const s = normalizeStatus(e.status);
    byStatusMap[s] = (byStatusMap[s] || 0) + 1;
  });
  const statusItems = STATUSES.map(s => ({
    name: s,
    v: byStatusMap[s] || 0,
    color: SCOL[s]
  }));

  // Leads by source (strictly normalized into standardized categories: Website, Meta Ads, Google Ads, Walk-in, Referral, Phone call, Education fair, Other)
  const bySourceMap = {};
  STANDARDIZED_SOURCES.forEach(s => { bySourceMap[s] = 0; });
  list.forEach(e => {
    const s = normalizeLeadSource(e.source);
    bySourceMap[s] = (bySourceMap[s] || 0) + 1;
  });
  const sourceItems = STANDARDIZED_SOURCES
    .map((k, i) => ({
      name: k,
      v: bySourceMap[k] || 0,
      color: PALETTE[i % PALETTE.length]
    }))
    .filter(it => it.v > 0)
    .sort((a, b) => b.v - a.v);

  // Filtered recent leads (filtered by activeSourceFilter when clicked on chart)
  const displayedLeads = useMemo(() => {
    const pool = list.length > 0 ? list : enquiries;
    let filteredList = pool;

    if (activeSourceFilter) {
      const target = normalizeLeadSource(activeSourceFilter);
      filteredList = pool.filter(e => {
        return normalizeLeadSource(e.source) === target;
      });
    }

    return filteredList
      .slice()
      .sort((a, b) => (+parseDate(b.createdAt) || 0) - (+parseDate(a.createdAt) || 0))
      .slice(0, activeSourceFilter ? 25 : 8);
  }, [enquiries, list, activeSourceFilter]);

  const rangeLabels = {
    all: "All Time",
    today: "Today",
    yesterday: "Yesterday",
    week: "This Week",
    month: "This Month",
    lastmonth: "Last Month",
    custom: "Custom Range"
  };

  return (
    <section>
      {/* Stat KPI Cards */}
      <div className="stats">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="card skel" style={{ height: '128px' }} />
          ))
        ) : (
          <>
            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="users" size={20} /></span>
                <span className="stat-label">Total enquiries</span>
              </div>
              <div className="stat-val">{total}</div>
              <div className="stat-sub">{totalSub}</div>
            </div>

            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="userCheck" size={20} /></span>
                <span className="stat-label">Active / assigned</span>
              </div>
              <div className="stat-val">{active}</div>
              <div className="stat-sub">
                {openLeads.length ? `of ${openLeads.length} open leads` : "No open leads"}
              </div>
            </div>

            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="userX" size={20} /></span>
                <span className="stat-label">Dropped</span>
              </div>
              <div className="stat-val">{dropped}</div>
              <div className="stat-sub">
                {total ? `${Math.round((dropped / total) * 100)}% of enquiries` : "No enquiries yet"}
              </div>
            </div>

            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="award" size={20} /></span>
                <span className="stat-label">Confirmed admissions</span>
              </div>
              <div className="stat-val">{confirmed}</div>
              <div className="stat-sub">
                {inCounseling} in counseling{total ? ` · ${Math.round((confirmed / total) * 1000) / 10}% conversion` : ""}
              </div>
            </div>

            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="clock" size={20} /></span>
                <span className="stat-label">Pending follow-ups</span>
              </div>
              <div className="stat-val">{pending.length}</div>
              <div className="stat-sub">
                {overdue ? <span className="overdue">{overdue} overdue</span> : "None overdue"}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Leads Table Card */}
      <div className="card section" id="dashboard-recent-leads">
        <div className="card-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>
                {activeSourceFilter ? `Leads from "${activeSourceFilter}"` : "Recent leads"}
              </h3>
              {activeSourceFilter && (
                <span
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  Filtered
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0' }}>
              {activeSourceFilter
                ? `Showing enquiries acquired through ${activeSourceFilter} (${displayedLeads.length} ${displayedLeads.length === 1 ? 'record' : 'records'})`
                : "The latest enquiries, newest first."}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeSourceFilter && (
              <button
                className="btn sm"
                type="button"
                onClick={() => setActiveSourceFilter(null)}
                style={{
                  color: '#b91c1c',
                  borderColor: '#fca5a5',
                  background: '#fef2f2',
                  fontWeight: 600
                }}
                title="Reset source filter"
              >
                Clear filter ✕
              </button>
            )}
            <button
              className="btn sm"
              type="button"
              onClick={() => onDrillIntoTable(activeSourceFilter ? { source: activeSourceFilter } : {})}
            >
              View all <Icon name="chevR" size={16} />
            </button>
          </div>
        </div>

        {activeSourceFilter && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '10px 18px',
              borderRadius: '8px',
              margin: '0 20px 14px 20px',
              fontSize: '0.88rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, color: '#1e40af' }}>Active Filter:</span>
              <span style={{ color: '#1e293b' }}>
                Showing only leads from source <b>"{activeSourceFilter}"</b>
              </span>
              <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                ({displayedLeads.length} {displayedLeads.length === 1 ? 'lead' : 'leads'} found)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveSourceFilter(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#2563eb',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.84rem'
              }}
            >
              Reset to all sources ✕
            </button>
          </div>
        )}

        <div className="tbl-scroll">
          {loading ? (
            <div style={{ padding: '18px 22px' }}>
              <div className="skel" style={{ height: '240px' }} />
            </div>
          ) : displayedLeads.length === 0 ? (
            <div className="empty">
              <div className="ei"><Icon name="inbox" size={24} /></div>
              <b>No enquiries found{activeSourceFilter ? ` for "${activeSourceFilter}"` : " yet"}</b>
              <span>{activeSourceFilter ? `There are no leads with source "${activeSourceFilter}" in the selected date range.` : "New leads will appear here."}</span>
              <br />
              {activeSourceFilter ? (
                <button
                  className="btn primary sm"
                  type="button"
                  onClick={() => setActiveSourceFilter(null)}
                >
                  Clear source filter
                </button>
              ) : (
                <button
                  className="btn primary"
                  type="button"
                  onClick={onGoToNewLead}
                >
                  Add an enquiry
                </button>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Course</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Source</th>
                  <th scope="col">Status</th>
                  <th scope="col">Counselor</th>
                  <th scope="col">Follow-up</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedLeads.map((e) => {
                  const d = parseDate(e.followUpDate);
                  const isOverdue = d && dayDiff(new Date(), d) < 0;
                  return (
                    <tr key={e.id}>
                      <td>
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
                      <td>{e.course || "–"}</td>
                      <td>{e.phone}</td>
                      <td>{normalizeLeadSource(e.source)}</td>
                      <td>
                        <span className={`pill s-${slug(e.status)}`}>
                          {e.status}
                        </span>
                      </td>
                      <td>
                        {canonicalCounselorName(e.assignedTo) || <span className="muted">Unassigned</span>}
                      </td>
                      <td>
                        {!OPEN_STATUSES.includes(e.status) ? (
                          <span className="muted">–</span>
                        ) : !d ? (
                          <span className="muted">Not set</span>
                        ) : isOverdue ? (
                          <span className="overdue" title="Overdue">{fmtDay(d)}</span>
                        ) : (
                          fmtDay(d)
                        )}
                      </td>
                      <td>{fmtDay(e.createdAt)}</td>
                      <td>
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
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Analytics Charts Grid */}
      {total > 0 ? (
        <div className="charts-grid">
          <div className="card chart-card">
            <h3>Inquiry Trends</h3>
            <p>New enquiries · {rangeLabels[dashRangeKind]}</p>
            <div style={{ width: '100%', height: isMobile ? 260 : 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getBuckets()} margin={{ top: 20, right: isMobile ? 15 : 35, left: isMobile ? -15 : 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: isMobile ? 11 : 12, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                    }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>Enquiries by Course</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>Where the interest is coming from</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {(courseViewMode === 'columns' || (!isMobile && courseViewMode === 'auto')) && (
                  <span className="chart-swipe-hint">
                    <Icon name="arrowRight" size={13} /> Swipe horizontally
                  </span>
                )}
                <div className="chart-mode-toggle" role="group" aria-label="Course chart view mode">
                  <button
                    type="button"
                    className={`chart-mode-btn ${(courseViewMode === 'bars' || (courseViewMode === 'auto' && (isMobile || courseItems.length > 7))) ? 'active' : ''}`}
                    onClick={() => setCourseViewMode('bars')}
                    title="Horizontal rows (recommended for mobile with long course names)"
                  >
                    Rows
                  </button>
                  <button
                    type="button"
                    className={`chart-mode-btn ${(courseViewMode === 'columns' || (courseViewMode === 'auto' && !isMobile && courseItems.length <= 7)) ? 'active' : ''}`}
                    onClick={() => setCourseViewMode('columns')}
                    title="Vertical columns with swipe scroll"
                  >
                    Columns
                  </button>
                </div>
              </div>
            </div>

            {(courseViewMode === 'bars' || (courseViewMode === 'auto' && (isMobile || courseItems.length > 7))) ? (
              /* Horizontal Bar Chart (Rows) - Ideal for mobile so long course names are completely horizontal, non-overlapping and clean */
              <div style={{ width: '100%', height: Math.max(320, courseItems.length * (isMobile ? 36 : 40)), minHeight: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={courseItems}
                    margin={{ top: 15, right: isMobile ? 25 : 35, left: isMobile ? 5 : 20, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: isMobile ? 11 : 12, fill: '#64748b' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={isMobile ? 125 : 175}
                      interval={0}
                      tick={{ fontSize: isMobile ? 10 : 11, fill: '#334155', fontWeight: 500 }}
                      tickFormatter={(val) => val.length > (isMobile ? 18 : 26) ? `${val.substring(0, isMobile ? 16 : 24)}...` : val}
                    />
                    <Tooltip
                      formatter={(val) => [val, 'Enquiries']}
                      labelFormatter={(label) => `Course: ${label}`}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                      }}
                      itemStyle={{ color: '#60a5fa' }}
                    />
                    <Bar dataKey="v" fill="#1e3a8a" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              /* Vertical Bar Chart (Columns) with Generous Dynamic Spacing and Smooth Horizontal Swipe */
              <div className="chart-scroll-wrapper">
                <div style={{ width: `${Math.max(windowWidth - (isMobile ? 40 : 120), courseItems.length * (isMobile ? 80 : 95))}px`, height: isMobile ? 340 : 360, minWidth: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={courseItems}
                      margin={{ top: 20, right: 35, left: isMobile ? -10 : 0, bottom: isMobile ? 80 : 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                        height={isMobile ? 80 : 70}
                        tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }}
                        tickFormatter={(val) => val.length > (isMobile ? 16 : 20) ? `${val.substring(0, isMobile ? 14 : 18)}...` : val}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip
                        formatter={(val) => [val, 'Enquiries']}
                        labelFormatter={(label) => `Course: ${label}`}
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '12px',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                        }}
                        itemStyle={{ color: '#60a5fa' }}
                      />
                      <Bar dataKey="v" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="card chart-card">
            <h3>Counselor Workload</h3>
            <p>Open leads assigned per counselor</p>
            <div style={{ width: '100%', height: isMobile ? 280 : 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadItems} margin={{ top: 20, right: isMobile ? 20 : 35, left: isMobile ? -15 : 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '12px',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                    }}
                    itemStyle={{ color: '#ea580c' }}
                  />
                  <Bar dataKey="v" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h3>Lead Status Overview</h3>
            <p>Where enquiries stand right now</p>
            <div className="chart-scroll-wrapper">
              <div style={{ width: isMobile ? '460px' : '100%', height: isMobile ? 280 : 320, minWidth: isMobile ? '460px' : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusItems} margin={{ top: 20, right: 25, left: isMobile ? -15 : 0, bottom: isMobile ? 55 : 65 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis
                      dataKey="name"
                      angle={isMobile ? -25 : -30}
                      textAnchor="end"
                      interval={0}
                      height={isMobile ? 55 : 70}
                      tick={{ fontSize: isMobile ? 10 : 11, fill: '#64748b' }}
                      tickFormatter={(val) => val.length > 14 ? `${val.substring(0, 12)}...` : val}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.2)'
                      }}
                      itemStyle={{ color: '#047857' }}
                    />
                    <Bar dataKey="v" fill="#047857" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card chart-card" id="leads-by-source-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>Leads by Source</h3>
                <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                  Where enquiries are coming from
                </p>
              </div>
              {activeSourceFilter && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      const el = document.getElementById('dashboard-recent-leads');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    style={{
                      fontSize: '0.78rem',
                      padding: '3px 8px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      borderColor: '#bfdbfe'
                    }}
                  >
                    View in table ↑
                  </button>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setActiveSourceFilter(null)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '3px 8px',
                      color: '#b91c1c',
                      borderColor: '#fca5a5'
                    }}
                    title="Reset source filter"
                  >
                    Reset ✕
                  </button>
                </div>
              )}
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.78rem', color: '#64748b' }}>
              💡 Click any slice or legend item to filter the table {activeSourceFilter ? `(filtered by "${activeSourceFilter}")` : ''}
            </p>
            <DonutChart
              items={sourceItems}
              aria="Leads by source"
              centerLabel="leads"
              activeItem={activeSourceFilter}
              onClick={handleSourceClick}
            />
          </div>
        </div>
      ) : (
        <div className="card empty-charts">
          <div className="empty" style={{ padding: '40px 20px' }}>
            <div className="ei"><Icon name="dashboard" size={32} /></div>
            <b>No data to visualize</b>
            <span>Adjust the time range filter above, or add new enquiries to see analytics.</span>
          </div>
        </div>
      )}
    </section>
  );
}
