/* Lightweight SVG charts (no external libraries, keeps the portal fast).
   All chart types share one hover-tooltip pattern: track the mouse over
   the SVG, work out the nearest data point/bar/segment, and float a
   small label box next to it. */
const Charts = (function () {
  "use strict";
  const esc = U.esc;
  const axis = max => { const step = Math.max(1, Math.ceil(max / 4)); return { step, top: step * 4 }; };
  const gridLines = (l, r, t, ih, W, sc, y) => {
    let g = "";
    for (let k = 0; k <= 4; k++) {
      const v = sc.step * k, yy = y(v);
      g += '<line class="grid" x1="' + l + '" x2="' + (W - r) + '" y1="' + yy + '" y2="' + yy + '"/><text class="ax" x="' + (l - 10) + '" y="' + (yy + 4) + '" text-anchor="end">' + v + '</text>';
    }
    return g;
  };
  const emptyMsg = (title, msg) => '<div class="empty"><div class="ei" data-icon="chart"></div><b>' + esc(title) + '</b>' + esc(msg) + '</div>';
  const noop = () => {};

  function line(host, pts, opts) {
    opts = opts || {};
    host.classList.remove("on");
    host.onmousemove = host.onmouseleave = null;
    if (!pts.length || pts.every(p => p.v === 0)) {
      host.innerHTML = emptyMsg(opts.emptyTitle || "No enquiries in this period", opts.emptyMsg || "Try a wider date range.");
      return;
    }
    const W = 640, H = 300, l = 44, r = 18, t = 18, b = 36, iw = W - l - r, ih = H - t - b, n = pts.length;
    const max = Math.max.apply(null, pts.map(p => p.v).concat([1]));
    const sc = axis(max);
    const x = i => n === 1 ? l + iw / 2 : l + iw * i / (n - 1);
    const y = v => t + ih - (v / sc.top) * ih;
    let g = gridLines(l, r, t, ih, W, sc, y);
    const every = Math.ceil(n / 6);
    pts.forEach((p, i) => { if (i % every === 0) g += '<text class="ax" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(p.label) + '</text>'; });
    const d = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.v).toFixed(1)).join(" ");
    const area = d + " L" + x(n - 1).toFixed(1) + " " + (t + ih) + " L" + x(0).toFixed(1) + " " + (t + ih) + " Z";
    const dots = n <= 45 ? pts.map((p, i) => '<circle class="dot" cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="3.4"/>').join("") : "";
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.aria || "Chart") + '"><defs><linearGradient id="lgA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173a80" stop-opacity=".16"/><stop offset="1" stop-color="#173a80" stop-opacity="0"/></linearGradient></defs>' + g +
      '<path d="' + area + '" fill="url(#lgA)"/><path class="ln" d="' + d + '"/>' + dots +
      '<line class="guide" x1="0" x2="0" y1="' + t + '" y2="' + (t + ih) + '"/><circle class="hov" r="5.5" cx="0" cy="0"/></svg><div class="tip"></div>';
    const svg = host.querySelector("svg"), tip = host.querySelector(".tip"), guide = host.querySelector(".guide"), hov = host.querySelector(".hov");
    host.onmousemove = ev => {
      const rc = svg.getBoundingClientRect();
      const px = (ev.clientX - rc.left) / rc.width * W;
      let i = n === 1 ? 0 : Math.round((px - l) / iw * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      guide.setAttribute("x1", x(i)); guide.setAttribute("x2", x(i));
      hov.setAttribute("cx", x(i)); hov.setAttribute("cy", y(pts[i].v));
      tip.innerHTML = "<b>" + esc(pts[i].full) + "</b>" + pts[i].v + (pts[i].v === 1 ? " enquiry" : " enquiries");
      tip.style.left = (x(i) / W * rc.width) + "px"; tip.style.top = (y(pts[i].v) / H * rc.height) + "px";
      host.classList.add("on");
    };
    host.onmouseleave = () => host.classList.remove("on");
  }

  function bar(host, items, opts) {
    opts = opts || {};
    host.classList.remove("on");
    host.onmousemove = host.onmouseleave = null;
    if (!items.length) {
      host.innerHTML = emptyMsg(opts.emptyTitle || "No data for this period", opts.emptyMsg || "Try a wider date range.");
      return;
    }
    const rotate = opts.rotateLabels !== false;
    const scrollable = !!opts.scrollable;
    const H = 300, l = rotate ? 68 : 40, r = 16, t = 24, b = rotate ? 58 : 44, n = items.length;
    const perItem = scrollable ? 78 : 0;
    const W = scrollable ? Math.max(560, l + r + n * perItem) : 640;
    const iw = W - l - r, ih = H - t - b;
    const max = Math.max.apply(null, items.map(i => i.v).concat([1]));
    const sc = axis(max);
    const y = v => t + ih - (v / sc.top) * ih;
    const bw = Math.min(56, iw / n * 0.58);
    const cx = i => l + iw * (i + .5) / n;
    const truncAt = scrollable ? 22 : 13;
    let g = gridLines(l, r, t, ih, W, sc, y);
    items.forEach((it, i) => {
      const bh = Math.max((it.v / sc.top) * ih, it.v > 0 ? 2 : 0);
      const label = it.name.length > truncAt ? it.name.slice(0, truncAt - 1) + "…" : it.name;
      const fill = it.color ? ' style="fill:' + it.color + '"' : "";
      g += '<rect class="bar" data-i="' + i + '"' + fill + ' x="' + (cx(i) - bw / 2).toFixed(1) + '" y="' + (t + ih - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="6"/>';
      g += '<text class="val" x="' + cx(i) + '" y="' + (t + ih - bh - 7) + '">' + it.v + "</text>";
      g += rotate
        ? '<text class="ax" x="' + cx(i) + '" y="' + (H - b + 20) + '" text-anchor="middle" transform="rotate(-28 ' + cx(i) + ' ' + (H - b + 20) + ')">' + esc(label) + "</text>"
        : '<text class="ax" x="' + cx(i) + '" y="' + (H - 16) + '" text-anchor="middle">' + esc(label) + "</text>";
    });
    const wstyle = scrollable ? ' style="width:' + W + 'px;max-width:none"' : "";
    host.innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '"' + wstyle + ' role="img" aria-label="' + esc(opts.aria || "Chart") + '">' + g + "</svg><div class=\"tip\"></div>";
    const svg = host.querySelector("svg"), tip = host.querySelector(".tip"), bars = host.querySelectorAll(".bar");
    host.onmousemove = ev => {
      const rc = svg.getBoundingClientRect();
      const px = (ev.clientX - rc.left) / rc.width * W, py = (ev.clientY - rc.top) / rc.height * H;
      let i = Math.round((px - l) / iw * n - 0.5);
      i = Math.max(0, Math.min(n - 1, i));
      bars.forEach((el, k) => el.classList.toggle("hi", k === i));
      tip.innerHTML = "<b>" + esc(items[i].name) + "</b>" + items[i].v + (opts.unit || (items[i].v === 1 ? " enquiry" : " enquiries"));
      tip.style.left = (cx(i) / W * rc.width) + "px"; tip.style.top = (y(items[i].v) / H * rc.height) + "px";
      host.classList.add("on");
    };
    host.onmouseleave = () => { host.classList.remove("on"); bars.forEach(el => el.classList.remove("hi")); };
    host.onclick = ev => {
      if (typeof opts.onClick !== "function") return;
      const rc = svg.getBoundingClientRect();
      const px = (ev.clientX - rc.left) / rc.width * W;
      let i = Math.round((px - l) / iw * n - 0.5);
      i = Math.max(0, Math.min(n - 1, i));
      opts.onClick(items[i].name, items[i]);
    };
    if (typeof opts.onClick === "function") host.style.cursor = "pointer";
  }

  function donut(host, items, opts) {
    opts = opts || {};
    host.onmousemove = host.onmouseleave = null;
    const total = items.reduce((s, i) => s + i.v, 0);
    if (!total) {
      host.innerHTML = emptyMsg(opts.emptyTitle || "No data for this period", opts.emptyMsg || "Try a wider date range.");
      return;
    }
    const R = 64, CX = 90, CY = 90, SW = 24, C = 2 * Math.PI * R;
    let off = 0;
    const segs = items.map(it => { const len = it.v / total * C; const s = { off, len }; off += len; return s; });
    const arcs = segs.map((s, i) => '<circle class="seg" data-i="' + i + '" cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="none" stroke="' + items[i].color + '" stroke-width="' + SW + '" stroke-dasharray="' + s.len.toFixed(2) + " " + (C - s.len).toFixed(2) + '" stroke-dashoffset="' + (-s.off).toFixed(2) + '" transform="rotate(-90 ' + CX + " " + CY + ')"></circle>').join("");
    host.innerHTML = '<div class="donut-wrap"><div class="donut-svg-wrap"><svg class="donut" viewBox="0 0 180 180" role="img" aria-label="' + esc(opts.aria || "Chart") + '">' + arcs +
      '<text x="90" y="87" text-anchor="middle" font-size="28" font-weight="800">' + total + '</text><text x="90" y="105" text-anchor="middle" font-size="11" class="donut-center-label">' + esc(opts.centerLabel || "total") + '</text></svg><div class="tip"></div></div>' +
      '<ul class="legend">' + items.map((it, i) => '<li data-i="' + i + '"><span class="sw" style="--c:' + it.color + '"></span>' + esc(it.name) + '<span class="n">' + it.v + "</span></li>").join("") + "</ul></div>";
    const wrap = host.querySelector(".donut-svg-wrap"), svg = host.querySelector("svg"), tip = host.querySelector(".tip"), segEls = host.querySelectorAll(".seg"), legEls = host.querySelectorAll(".legend li");
    const highlight = i => { segEls.forEach((e, k) => e.classList.toggle("hi", k === i)); legEls.forEach((e, k) => e.classList.toggle("hi", k === i)); };
    const showTip = (i, px, py, rc) => {
      const it = items[i];
      tip.innerHTML = "<b>" + esc(it.name) + "</b>" + it.v + " (" + Math.round(it.v / total * 100) + "%)";
      tip.style.left = (px / 180 * rc.width) + "px"; tip.style.top = (py / 180 * rc.height) + "px";
      wrap.classList.add("on");
    };
    wrap.onmousemove = ev => {
      const rc = svg.getBoundingClientRect();
      const px = (ev.clientX - rc.left) / rc.width * 180, py = (ev.clientY - rc.top) / rc.height * 180;
      const dx = px - CX, dy = py - CY, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < R - SW / 2 - 2 || dist > R + SW / 2 + 2) { wrap.classList.remove("on"); highlight(-1); return; }
      const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      const frac = ang / 360 * C;
      let idx = segs.findIndex(s => frac >= s.off && frac < s.off + s.len);
      if (idx === -1) idx = segs.length - 1;
      highlight(idx); showTip(idx, px, py, rc);
    };
    wrap.onmouseleave = () => { wrap.classList.remove("on"); highlight(-1); };
    if (typeof opts.onClick === "function") {
      wrap.style.cursor = "pointer";
      wrap.onclick = ev => {
        const rc = svg.getBoundingClientRect();
        const px = (ev.clientX - rc.left) / rc.width * 180, py = (ev.clientY - rc.top) / rc.height * 180;
        const dx = px - CX, dy = py - CY, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < R - SW / 2 - 2 || dist > R + SW / 2 + 2) return;
        const ang = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
        const frac = ang / 360 * C;
        let idx = segs.findIndex(s => frac >= s.off && frac < s.off + s.len);
        if (idx === -1) idx = segs.length - 1;
        opts.onClick(items[idx].name, items[idx]);
      };
    }
    legEls.forEach((li, i) => {
      li.addEventListener("mouseenter", () => { const rc = svg.getBoundingClientRect(); highlight(i); showTip(i, 90, 90, rc); });
      li.addEventListener("mouseleave", () => { wrap.classList.remove("on"); highlight(-1); });
      if (typeof opts.onClick === "function") { li.style.cursor = "pointer"; li.addEventListener("click", () => opts.onClick(items[i].name, items[i])); }
    });
  }

  return { line, bar, donut };
})();
