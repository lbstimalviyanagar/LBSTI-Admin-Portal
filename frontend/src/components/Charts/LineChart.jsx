import React, { useState, useRef } from 'react';
import Icon from '../Icons';

export default function LineChart({ points = [], aria = "Inquiry trends", emptyTitle = "No enquiries in this period", emptyMsg = "Try a wider date range." }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
  const svgRef = useRef(null);

  if (!points.length || points.every(p => p.v === 0)) {
    return (
      <div className="empty">
        <div className="ei"><Icon name="chart" size={24} /></div>
        <b>{emptyTitle}</b>
        <span>{emptyMsg}</span>
      </div>
    );
  }

  const W = 640;
  const H = 300;
  const l = 44;
  const r = 18;
  const t = 18;
  const b = 36;
  const iw = W - l - r;
  const ih = H - t - b;
  const n = points.length;

  const maxVal = Math.max(...points.map(p => p.v), 1);
  const step = Math.max(1, Math.ceil(maxVal / 4));
  const topVal = step * 4;

  const getX = (i) => (n === 1 ? l + iw / 2 : l + (iw * i) / (n - 1));
  const getY = (v) => t + ih - (v / topVal) * ih;

  const gridSteps = [0, 1, 2, 3, 4];
  const every = Math.ceil(n / 6);

  const pathD = points.map((p, i) => `${i ? 'L' : 'M'}${getX(i).toFixed(1)} ${getY(p.v).toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${getX(n - 1).toFixed(1)} ${(t + ih)} L${getX(0).toFixed(1)} ${(t + ih)} Z`;

  const handleMouseMove = (ev) => {
    if (!svgRef.current) return;
    const rc = svgRef.current.getBoundingClientRect();
    const px = ((ev.clientX - rc.left) / rc.width) * W;
    let idx = n === 1 ? 0 : Math.round(((px - l) / iw) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));

    setHoverIndex(idx);
    setTipPos({
      left: (getX(idx) / W) * rc.width,
      top: (getY(points[idx].v) / H) * rc.height
    });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  return (
    <div
      className={`chart ${hoverIndex !== null ? 'on' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        <defs>
          <linearGradient id="reactLgA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#173a80" stopOpacity="0.16" />
            <stop offset="1" stopColor="#173a80" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines and Y axis labels */}
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

        {/* X axis labels */}
        {points.map((p, i) => {
          if (i % every !== 0) return null;
          return (
            <text key={i} className="ax" x={getX(i)} y={H - 10} textAnchor="middle">
              {p.label}
            </text>
          );
        })}

        {/* Area fill and Line */}
        <path d={areaD} fill="url(#reactLgA)" />
        <path className="ln" d={pathD} />

        {/* Data points dots */}
        {n <= 45 && points.map((p, i) => (
          <circle key={i} className="dot" cx={getX(i).toFixed(1)} cy={getY(p.v).toFixed(1)} r="3.4" />
        ))}

        {/* Hover elements */}
        {hoverIndex !== null && (
          <>
            <line className="guide" x1={getX(hoverIndex)} x2={getX(hoverIndex)} y1={t} y2={t + ih} />
            <circle className="hov" r="5.5" cx={getX(hoverIndex)} cy={getY(points[hoverIndex].v)} />
          </>
        )}
      </svg>

      {hoverIndex !== null && (
        <div className="tip" style={{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }}>
          <b>{points[hoverIndex].full}</b>
          {points[hoverIndex].v} {points[hoverIndex].v === 1 ? 'enquiry' : 'enquiries'}
        </div>
      )}
    </div>
  );
}
