import React, { useState, useRef, useMemo } from 'react';
import Icon from '../Icons';

export default function DonutChart({
  items = [],
  aria = "Donut chart",
  centerLabel = "leads",
  emptyTitle = "No data for this period",
  emptyMsg = "Try a wider date range.",
  onClick = null,
  activeItem = null
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tipPos, setTipPos] = useState({ left: 0, top: 0 });
  const wrapRef = useRef(null);

  const total = items.reduce((s, i) => s + i.v, 0);

  const activeItemData = useMemo(() => {
    if (!activeItem) return null;
    const target = String(activeItem).trim().toLowerCase();
    return items.find(it => String(it.name).trim().toLowerCase() === target) || null;
  }, [items, activeItem]);

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

  const getIndexFromCoords = (clientX, clientY) => {
    if (!wrapRef.current) return null;
    const rc = wrapRef.current.getBoundingClientRect();
    const px = ((clientX - rc.left) / rc.width) * 180;
    const py = ((clientY - rc.top) / rc.height) * 180;
    const dx = px - CX;
    const dy = py - CY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Clicked in the center hole
    if (dist < R - SW / 2) {
      return 'center';
    }
    // Clicked outside the donut ring
    if (dist > R + SW / 2 + 8) {
      return null;
    }

    const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
    const frac = (ang / 360) * C;
    let idx = segments.findIndex(s => frac >= s.off && frac < s.off + s.len);
    if (idx === -1) idx = segments.length - 1;
    return idx;
  };

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

  const handleClick = (ev) => {
    if (typeof onClick !== 'function') return;

    if (ev && ev.clientX !== undefined && ev.clientY !== undefined) {
      const idxOrCenter = getIndexFromCoords(ev.clientX, ev.clientY);
      if (idxOrCenter === 'center') {
        if (activeItem) {
          onClick(activeItem, activeItemData);
        }
        return;
      }
      if (typeof idxOrCenter === 'number' && items[idxOrCenter]) {
        onClick(items[idxOrCenter].name, items[idxOrCenter]);
        return;
      }
    }

    if (hoverIndex !== null && items[hoverIndex]) {
      onClick(items[hoverIndex].name, items[hoverIndex]);
    }
  };

  const handleTouch = (ev) => {
    if (ev.touches && ev.touches[0]) {
      handleMouseMove(ev.touches[0]);
    }
  };

  return (
    <div className={`donut-wrap ${activeItem ? 'has-active' : ''}`}>
      <div
        ref={wrapRef}
        className={`donut-svg-wrap ${hoverIndex !== null ? 'on' : ''} ${activeItem ? 'has-active' : ''}`}
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onClick={handleClick}
      >
        <svg className="donut" viewBox="0 0 180 180" role="img" aria-label={aria}>
          {segments.map((s, i) => {
            const it = items[i];
            const isHi = hoverIndex === i;
            const isSelected = activeItem && String(it.name).trim().toLowerCase() === String(activeItem).trim().toLowerCase();
            const isDimmed = activeItem && !isSelected;

            return (
              <circle
                key={i}
                className={`seg ${isHi ? 'hi' : ''} ${isSelected ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`}
                cx={CX}
                cy={CY}
                r={R}
                fill="none"
                stroke={it.color}
                strokeWidth={isSelected ? SW + 4 : isHi ? SW + 2 : SW}
                strokeDasharray={`${s.len.toFixed(2)} ${(C - s.len).toFixed(2)}`}
                strokeDashoffset={(-s.off).toFixed(2)}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{
                  opacity: isDimmed ? 0.22 : 1,
                  transition: 'opacity 0.2s ease, stroke-width 0.2s ease',
                  cursor: onClick ? 'pointer' : 'default'
                }}
                onClick={(e) => {
                  if (onClick) {
                    e.stopPropagation();
                    onClick(it.name, it);
                  }
                }}
              />
            );
          })}

          {activeItem && activeItemData ? (
            <g
              style={{ cursor: onClick ? 'pointer' : 'default' }}
              onClick={(e) => {
                e.stopPropagation();
                if (onClick) onClick(activeItem, activeItemData);
              }}
            >
              <text x="90" y="78" textAnchor="middle" fontSize="26" fontWeight="800" fill={activeItemData.color || '#1e293b'}>
                {activeItemData.v}
              </text>
              <text x="90" y="96" textAnchor="middle" fontSize="11" fontWeight="700" fill="#2563eb">
                {activeItemData.name.length > 13 ? `${activeItemData.name.substring(0, 11)}...` : activeItemData.name}
              </text>
              <text x="90" y="112" textAnchor="middle" fontSize="9.5" fill="#64748b" fontWeight="600">
                Reset ✕
              </text>
            </g>
          ) : (
            <g>
              <text x="90" y="87" textAnchor="middle" fontSize="28" fontWeight="800">
                {total}
              </text>
              <text x="90" y="105" textAnchor="middle" fontSize="11" className="donut-center-label">
                {centerLabel}
              </text>
            </g>
          )}
        </svg>

        {hoverIndex !== null && items[hoverIndex] && (
          <div className="tip" style={{ left: `${tipPos.left}px`, top: `${tipPos.top}px` }}>
            <b>{items[hoverIndex].name}</b>
            <div>{items[hoverIndex].v} ({Math.round((items[hoverIndex].v / total) * 100)}%)</div>
            {onClick && (
              <div style={{ fontSize: '10px', color: '#93c5fa', marginTop: '2px', fontWeight: 600 }}>
                {activeItem && String(items[hoverIndex].name).trim().toLowerCase() === String(activeItem).trim().toLowerCase()
                  ? 'Click to reset filter'
                  : 'Click to filter table'}
              </div>
            )}
          </div>
        )}
      </div>

      <ul className={`legend ${activeItem ? 'has-active' : ''}`}>
        {items.map((it, i) => {
          const isHi = hoverIndex === i;
          const isSelected = activeItem && String(it.name).trim().toLowerCase() === String(activeItem).trim().toLowerCase();
          const isDimmed = activeItem && !isSelected;

          return (
            <li
              key={i}
              className={`${isHi ? 'hi' : ''} ${isSelected ? 'active' : ''}`}
              style={{
                cursor: onClick ? 'pointer' : 'default',
                opacity: isDimmed ? 0.35 : 1,
                backgroundColor: isSelected ? '#eff6ff' : undefined,
                border: isSelected ? '1px solid #93c5fd' : '1px solid transparent',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={() => {
                setHoverIndex(i);
                setTipPos({ left: 90, top: 90 });
              }}
              onMouseLeave={() => setHoverIndex(null)}
              onClick={() => onClick && onClick(it.name, it)}
              title={isSelected ? `Filtering by ${it.name}. Click to reset filter.` : `Click to filter by ${it.name}`}
            >
              <span className="sw" style={{ background: it.color }} />
              <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1d4ed8' : 'inherit' }}>
                {it.name}
              </span>
              <span className="n" style={{ fontWeight: isSelected ? 800 : 500 }}>
                {it.v}
              </span>
              {isSelected && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '11px',
                    color: '#2563eb',
                    fontWeight: 800,
                    padding: '1px 5px',
                    background: '#dbeafe',
                    borderRadius: '999px'
                  }}
                >
                  ✕
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
