import React, { useState, useRef } from 'react';
import Icon from '../Icons';

export default function DonutChart({
  items = [],
  aria = "Donut chart",
  centerLabel = "leads",
  emptyTitle = "No data for this period",
  emptyMsg = "Try a wider date range.",
  onClick = null
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
  const wrapRef = useRef(null);

  const total = items.reduce((s, i) => s + i.v, 0);

  if (!total) {
    return (
      <div className="empty">
        <div className="ei"><Icon name="chart" size={24} /></div>
        <b>{emptyTitle}</b>
        <span>{emptyMsg}</span>
      </div>
    );
  }

  const R = 64;
  const CX = 90;
  const CY = 90;
  const SW = 24;
  const C = 2 * Math.PI * R;

  let currentOffset = 0;
  const segments = items.map((it) => {
    const len = (it.v / total) * C;
    const s = { off: currentOffset, len };
    currentOffset += len;
    return s;
  });

  const handleMouseMove = (ev) => {
    if (!wrapRef.current) return;
    const rc = wrapRef.current.getBoundingClientRect();
    const px = ((ev.clientX - rc.left) / rc.width) * 180;
    const py = ((ev.clientY - rc.top) / rc.height) * 180;
    const dx = px - CX;
    const dy = py - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < R - SW / 2 - 2 || dist > R + SW / 2 + 2) {
      setHoverIndex(null);
      return;
    }

    const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const frac = (ang / 360) * C;
    let idx = segments.findIndex(s => frac >= s.off && frac < s.off + s.len);
    if (idx === -1) idx = segments.length - 1;

    setHoverIndex(idx);
    setTipPos({
      left: (px / 180) * rc.width,
      top: (py / 180) * rc.height
    });
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const handleClick = () => {
    if (typeof onClick === 'function' && hoverIndex !== null) {
      onClick(items[hoverIndex].name, items[hoverIndex]);
    }
  };

  return (
    <div className="donut-wrap">
      <div
        ref={wrapRef}
        className={`donut-svg-wrap ${hoverIndex !== null ? 'on' : ''}`}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <svg className="donut" viewBox="0 0 180 180" role="img" aria-label={aria}>
          {segments.map((s, i) => {
            const isHi = hoverIndex === i;
            return (
              <circle
                key={i}
                className={`seg ${isHi ? 'hi' : ''}`}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={items[i].color}
                strokeWidth={SW}
                strokeDasharray={`${s.len.toFixed(2)} ${(C - s.len).toFixed(2)}`}
                strokeDashoffset={(-s.off).toFixed(2)}
                transform={`rotate(-90 ${CX} ${CY})`}
              />
            );
          })}

          <text x="90" y="87" textAnchor="middle" fontSize="28" fontWeight="800">
            {total}
          </text>
          <text x="90" y="105" textAnchor="middle" fontSize="11" className="donut-center-label">
            {centerLabel}
          </text>
        </svg>

        {hoverIndex !== null && (
          <div className="tip" style={{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }}>
            <b>{items[hoverIndex].name}</b>
            {items[hoverIndex].v} ({Math.round((items[hoverIndex].v / total) * 100)}%)
          </div>
        )}
      </div>

      <ul className="legend">
        {items.map((it, i) => {
          const isHi = hoverIndex === i;
          return (
            <li
              key={i}
              className={isHi ? 'hi' : ''}
              style={{ cursor: onClick ? 'pointer' : 'default' }}
              onMouseEnter={() => {
                setHoverIndex(i);
                setTipPos({ left: 90, top: 90 });
              }}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => onClick && onClick(it.name, it)}
            >
              <span className="sw" style={{ background: it.color }} />
              <span>{it.name}</span>
              <span className="n">{it.v}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
