import React from 'react';
import Icon from './Icons';
import DonutChart from './Charts/DonutChart';
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
  MON
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
  const r = rangeOf(dashRangeKind, dashFrom, dashTo);
  const list = enquiries.filter(e => inRange(e, r));
  const today = sod(new Date());

  const total = list.length;
  const openLeads = list.filter(e => OPEN_STATUSES.includes(e.status));
  const active = openLeads.filter(e => e.assignedTo).length;
  const dropped = list.filter(e => e.status === "Dropped").length;
  const confirmed = list.filter(e => e.status === "Confirmed").length;
  const inCounseling = list.filter(e => e.status === "Counseling Scheduled" || e.status === "Counseling done").length;
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
        const d = parseDate(e.createdAt);
        if (d) c[d.getHours()]++;
      });
      return c.map((v, h) => {
        const l = `${h % 12 || 12}${h < 12 ? ' AM' : ' PM'}`;
        return { v, label: l, full: l };
      });
    }

    let start = r.start;
    if (!start) {
      const ds = list.map(e => parseDate(e.createdAt)).filter(Boolean);
      start = ds.length ? sod(new Date(Math.min(...ds))) : addDays(tomorrow, -30);
    }
    let end = r.end && r.end < tomorrow ? r.end : tomorrow;
    if (end <= start) end = addDays(start, 1);

    const span = dayDiff(start, end);
    const weekly = span > 62;
    const n = weekly ? Math.ceil(span / 7) : span;
    const c = Array(n).fill(0);

    list.forEach(e => {
      const d = parseDate(e.createdAt);
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

  // Counselor workload
  const byStaffMap = {};
  list.forEach(e => {
    if (e.assignedTo) byStaffMap[e.assignedTo] = (byStaffMap[e.assignedTo] || 0) + 1;
  });
  const workloadItems = Object.keys(byStaffMap)
    .map(k => ({ name: k, v: byStaffMap[k] }))
    .sort((a, b) => b.v - a.v);

  // Lead status breakdown
  const byStatusMap = {};
  STATUSES.forEach(s => { byStatusMap[s] = 0; });
  list.forEach(e => {
    byStatusMap[e.status] = (byStatusMap[e.status] || 0) + 1;
  });
  const statusItems = STATUSES.map(s => ({
    name: s,
    v: byStatusMap[s] || 0,
    color: SCOL[s]
  }));

  // Leads by source
  const bySourceMap = {};
  list.forEach(e => {
    const s = e.source || "Other";
    bySourceMap[s] = (bySourceMap[s] || 0) + 1;
  });
  const sourceItems = Object.keys(bySourceMap)
    .map((k, i) => ({
      name: k,
      v: bySourceMap[k],
      color: PALETTE[i % PALETTE.length]
    }))
    .sort((a, b) => b.v - a.v);

  // Recent 8 leads
  const recentLeads = enquiries
    .slice()
    .sort((a, b) => (+parseDate(b.createdAt) || 0) - (+parseDate(a.createdAt) || 0))
    .slice(0, 8);

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
      <div className="card section">
        <div className="card-head">
          <div>
            <h3>Recent leads</h3>
            <p>The latest enquiries, newest first.</p>
          </div>
          <button
            className="btn sm"
            type="button"
            onClick={() => onDrillIntoTable({})}
          >
            View all <Icon name="chevR" size={16} />
          </button>
        </div>

        <div className="tbl-scroll">
          {loading ? (
            <div style={{ padding: '18px 22px' }}>
              <div className="skel" style={{ height: '240px' }} />
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="empty">
              <div className="ei"><Icon name="inbox" size={24} /></div>
              <b>No enquiries yet</b>
              <span>New leads will appear here.</span>
              <br />
              <button
                className="btn primary"
                type="button"
                onClick={onGoToNewLead}
              >
                Add an enquiry
              </button>
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
                {recentLeads.map((e) => {
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
                      <td>{e.source || "–"}</td>
                      <td>
                        <span className={`pill s-${slug(e.status)}`}>
                          {e.status}
                        </span>
                      </td>
                      <td>
                        {e.assignedTo ? e.assignedTo : <span className="muted">Unassigned</span>}
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
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getBuckets()} margin={{ top: 20, right: 35, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h3>Enquiries by Course</h3>
            <p>Where the interest is coming from</p>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseItems} margin={{ top: 20, right: 35, left: 0, bottom: 65 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-30} 
                    textAnchor="end" 
                    interval={0} 
                    height={70} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => val.length > 18 ? `${val.substring(0, 16)}...` : val}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#1e3a8a" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h3>Counselor Workload</h3>
            <p>Open leads assigned per counselor</p>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadItems} margin={{ top: 20, right: 35, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h3>Lead Status Overview</h3>
            <p>Where enquiries stand right now</p>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusItems} margin={{ top: 20, right: 35, left: 0, bottom: 65 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis 
                    dataKey="name" 
                    angle={-30} 
                    textAnchor="end" 
                    interval={0} 
                    height={70} 
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(val) => val.length > 14 ? `${val.substring(0, 12)}...` : val}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="v" fill="#047857" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <h3>Leads by Source</h3>
            <p>Where enquiries are coming from</p>
            <DonutChart
              items={sourceItems}
              aria="Leads by source"
              centerLabel="leads"
              onClick={(name) => onDrillIntoTable({ source: name })}
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
