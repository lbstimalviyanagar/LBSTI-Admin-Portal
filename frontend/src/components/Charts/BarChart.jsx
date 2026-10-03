import React, { useState, useRef } from 'react';
import Icon from '../Icons';

export default function BarChart({
  items = [],
  aria = "Bar chart",
  emptyTitle = "No data for this period",
  emptyMsg = "Try a wider date range.",
  rotateLabels = true,
  scrollable = false,
  unit = " enquiries",
  onClick = null
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
  const svgRef = useRef(null);

  if (!items.length) {
    return (
      <div className="empty">
        <div className="ei"><Icon name="chart" size={24} /></div>
        <b>{emptyTitle}</b>
        <span>{emptyMsg}</span>
      </div>
    );
  }

  const H = 300;
  const l = rotateLabels ? 68 : 40;
  const r = 16;
  const t = 24;
  const b = rotateLabels ? 58 : 44;
  const n = items.length;

  const perItem = scrollable ? 78 : 0;
  const W = scrollable ? Math.max(560, l + r + n * perItem) : 640;
  const iw = W - l - r;
  const ih = H - t - b;

  const maxVal = Math.max(...items.map(i => i.v), 1);
  const step = Math.max(1, Math.ceil(maxVal / 4));
  const topVal = step * 4;

  const getY = (v) => t + ih - (v / topVal) * ih;
  const bw = Math.min(56, (iw / n) * 0.58);
  const getCx = (i) => l + (iw * (i + 0.5)) / n;
  const truncAt = scrollable ? 22 : 13;

  const gridSteps = [0, 1, 2, 3, 4];

  const handleMouseMove = (ev) => {
    if (!svgRef.current) return;
    const rc = svgRef.current.getBoundingClientRect();
    const px = ((ev.clientX - rc.left) / rc.width) * W;
    let idx = Math.round(((px - l) / iw) * n - 0.5);
    idx = Math.max(0, Math.min(n - 1, idx));

    setHoverIndex(idx);
    setTipPos({
      left: (getCx(idx) / W) * rc.width,
      top: (getY(items[idx].v) / H) * rc.height
    });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const handleClick = (ev) => {
    if (typeof onClick !== 'function' || !svgRef.current) return;
    const rc = svgRef.current.getBoundingClientRect();
    const px = ((ev.clientX - rc.left) / rc.width) * W;
    let idx = Math.round(((px - l) / iw) * n - 0.5);
    idx = Math.max(0, Math.min(n - 1, idx));
    onClick(items[idx].name, items[idx]);
  };

  return (
    <div
      className={`chart ${hoverIndex !== null ? 'on' : ''}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={scrollable ? { width: `${W}px`, maxWidth: 'none' } : {}}
        role="img"
        aria-label={aria}
      >
        {/* Grid lines and Y axis */}
        {gridSteps.map((k) => {
          const v = step * k;
          const yy = getY(v);
          return (
            <React.Fragment key={k}>
              <line className="grid" x1={l} x2={W - r} y1={yy} y2={yy} />
              <text className="ax" x={l - 10} y={yy + 4} textAnchor="end">{v}</text>
            </React.Fragment>
          );
        })}

        {/* Bars and labels */}
        {items.map((it, i) => {
          const bh = Math.max((it.v / topVal) * ih, it.v > 0 ? 2 : 0);
          const label = it.name.length > truncAt ? `${it.name.slice(0, truncAt - 1)}…` : it.name;
          const isHi = hoverIndex === i;
          const cx = getCx(i);
          const xPos = cx - bw / 2;
          const yPos = t + ih - bh;

          return (
            <React.Fragment key={i}>
              <rect
                className={`bar ${isHi ? 'hi' : ''}`}
                style={it.color ? { fill: it.color } : {}}
                x={xPos.toFixed(1)}
                y={yPos.toFixed(1)}
                width={bw.toFixed(1)}
                height={bh.toFixed(1)}
                rx="6"
              />
              <text className="val" x={cx} y={yPos - 7}>
                {it.v}
              </text>
              {rotateLabels ? (
                <text
                  className="ax"
                  x={cx}
                  y={H - b + 20}
                  textAnchor="middle"
                  transform={`rotate(-28 ${cx} ${H - b + 20})`}
                >
                  {label}
                </text>
              ) : (
                <text className="ax" x={cx} y={H - 16} textAnchor="middle">
                  {label}
                </text>
              )}
            </React.Fragment>
          );
        })}
      </svg>

      {hoverIndex !== null && (
        <div className="tip" style={{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }}>
          <b>{items[hoverIndex].name}</b>
          {items[hoverIndex].v} {items[hoverIndex].v === 1 && unit.includes('enquiries') ? 'enquiry' : unit}
        </div>
      )}
    </div>
  );
}
