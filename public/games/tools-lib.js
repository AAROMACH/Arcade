// Shared tool library for Tool Drawer and Find the Tool.
// Each tool is drawn in grid units inside a box (w × h). Its footprint on the grid is
// worked out FROM the drawing: a cell belongs to the tool when the art covers enough of it.
// The art is then clipped to that footprint, so what you see is exactly what you place.
(function () {
  // ── Color helpers ──
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (h, t, amt) => { const a = hex(h), b = hex(t); return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * amt)).join(',')})`; };
  const lt = (h, a = .35) => mix(h, '#ffffff', a), dk = (h, a = .35) => mix(h, '#000000', a);

  // ── Drawing helpers (all in grid units) ──
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2))); };
  const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); };
  const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
  const ink = (c, w = .07, a = .6) => { c.strokeStyle = `rgba(12,14,16,${a})`; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(); };
  // Fill the current path with a body color lit from the top-left, then outline it.
  function body(c, col, x0, y0, x1, y1, out = true) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, lt(col, .38)); g.addColorStop(.35, col); g.addColorStop(1, dk(col, .38));
    c.fillStyle = g; c.fill(); if (out) ink(c);
  }
  // Polished steel: banded highlights along the cross-axis.
  function steel(c, x0, y0, x1, y1, out = true) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#7d8792'); g.addColorStop(.18, '#f4f6f8'); g.addColorStop(.4, '#b7bfc8'); g.addColorStop(.62, '#e3e7eb'); g.addColorStop(1, '#6d7680');
    c.fillStyle = g; c.fill(); if (out) ink(c);
  }
  function blackRubber(c, x0, y0, x1, y1) { body(c, '#2b2e33', x0, y0, x1, y1); }
  // A soft highlight stripe along a shape, for a molded look.
  function shine(c, x, y, w, h, a = .35) { rr(c, x, y, w, h, Math.min(w, h) / 2); c.fillStyle = `rgba(255,255,255,${a})`; c.fill(); }
  // Ribbed grip across a vertical handle.
  function ribs(c, x, y, w, h, n, col = 'rgba(0,0,0,.28)') { c.fillStyle = col; const step = h / n; for (let i = 0; i < n; i++) { rr(c, x + w * .12, y + i * step + step * .3, w * .76, step * .32, step * .16); c.fill(); } }
  function screwHead(c, x, y, r) { circ(c, x, y, r); steel(c, x - r, y - r, x + r, y + r); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = r * .25; c.beginPath(); c.moveTo(x - r * .6, y); c.lineTo(x + r * .6, y); c.moveTo(x, y - r * .6); c.lineTo(x, y + r * .6); c.stroke(); }
  // Printed text: drawn at its spot on the tool, but never mirrored and never upside down,
  // whatever way the tool has been turned or flipped.
  function text(c, s, x, y, size, col, weight = 800, family = '"Arial Narrow", Arial, sans-serif', angle = 0) {
    const m = c.getTransform();
    const px = m.a * x + m.c * y + m.e, py = m.b * x + m.d * y + m.f;
    const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    // Direction the text would run in, on screen.
    let dx = m.a * Math.cos(angle) + m.c * Math.sin(angle), dy = m.b * Math.cos(angle) + m.d * Math.sin(angle);
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    // Read left to right, or bottom to top when it runs vertically, never upside down.
    if (dx < -.01 || (Math.abs(dx) <= .01 && dy > 0)) { dx = -dx; dy = -dy; }
    c.save(); c.setTransform(dx * sc, dy * sc, -dy * sc, dx * sc, px, py);
    c.fillStyle = col; c.font = `${weight} ${size}px ${family}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, 0, 0);
    c.restore();
  }

  // ── Shared tool parts ──
  function screwdriver(c, col, tip) {
    // Handle (3 wide), ferrule, shaft down the middle column, tip.
    rr(c, .3, .15, 2.4, 3.9, 1.0); body(c, col, .3, 0, 2.7, 0);
    rr(c, .55, .15, 1.9, 1.1, .55); body(c, '#2b2e33', .55, 0, 2.45, 0, false);
    [.95, 1.5, 2.05].forEach(x => { rr(c, x - .1, 1.3, .2, 2.4, .1); c.fillStyle = dk(col, .3); c.fill(); });
    shine(c, .65, 1.35, .22, 2.3, .4);
    rr(c, 1.05, 3.95, .9, .55, .12); steel(c, 1.05, 0, 1.95, 0);
    rr(c, 1.3, 4.45, .4, 4.8, .06); steel(c, 1.3, 0, 1.7, 0, false); ink(c, .04, .5);
    if (tip === 'flat') { poly(c, [[1.3, 9.2], [1.7, 9.2], [1.78, 9.85], [1.22, 9.85]]); steel(c, 1.22, 0, 1.78, 0); }
    else { poly(c, [[1.3, 9.2], [1.7, 9.2], [1.5, 9.9]]); steel(c, 1.3, 0, 1.7, 0); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = .05; c.beginPath(); c.moveTo(1.5, 9.25); c.lineTo(1.5, 9.8); c.stroke(); }
  }
  function tape(c, col, s, label) {
    c.save(); c.scale(s, s);
    rr(c, .1, .12, 2.75, 2.7, .75); body(c, col, .1, .1, 2.8, 2.8);
    rr(c, .3, .3, 2.35, 2.32, .6); c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = .08; c.stroke();
    circ(c, 1.42, 1.48, .85); body(c, '#2b2e33', .6, .6, 2.2, 2.3);
    circ(c, 1.42, 1.48, .55); c.strokeStyle = lt(col, .2); c.lineWidth = .07; c.stroke();
    text(c, label, 1.42, 1.5, .5, col);
    rr(c, 2.35, 2.05, .6, .75, .15); body(c, '#2b2e33', 2.35, 2, 2.95, 2.8);
    rr(c, 2.55, 2.45, .42, .3, .06); steel(c, 2.55, 2.45, 2.97, 2.75);
    rr(c, 2.68, .55, .25, 1.1, .1); body(c, '#2b2e33', 2.68, 0, 2.93, 0, false);
    shine(c, .45, .4, 1.2, .18, .35);
    c.restore();
  }
  function level(c, len, col) {
    rr(c, .08, .22, len - .16, 1.56, .2); body(c, col, 0, .2, 0, 1.8);
    rr(c, .25, .42, len - .5, .25, .1); c.fillStyle = dk(col, .2); c.fill();
    rr(c, .25, 1.33, len - .5, .25, .1); c.fillStyle = dk(col, .2); c.fill();
    rr(c, .08, .22, .6, 1.56, .2); blackRubber(c, 0, .2, 0, 1.8); rr(c, len - .68, .22, .6, 1.56, .2); blackRubber(c, 0, .2, 0, 1.8);
    const vial = (x, w) => { rr(c, x, .62, w, .76, .3); c.fillStyle = '#1d2a12'; c.fill(); rr(c, x + .07, .69, w - .14, .62, .26); c.fillStyle = 'rgba(160,235,80,.95)'; c.fill(); circ(c, x + w / 2 + .05, 1, .16); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill(); c.strokeStyle = '#1d2a12'; c.lineWidth = .05; c.beginPath(); c.moveTo(x + w / 2 - .28, .69); c.lineTo(x + w / 2 - .28, 1.31); c.moveTo(x + w / 2 + .28, .69); c.lineTo(x + w / 2 + .28, 1.31); c.stroke(); };
    vial(len / 2 - .7, 1.4); if (len > 8) { vial(1.1, 1.0); vial(len - 2.1, 1.0); }
    shine(c, .8, .3, len - 1.6, .1, .4);
  }
  // Two-handled pliers: jaws drawn by the caller; this draws pivot + handles from pivot (px, py) to the bottom.
  function plierHandles(c, col, px, py, bottom, spread, w = .9, col2) {
    const L = [[px - .25, py], [px - spread, bottom - .2]], R = [[px + .25, py], [px + spread, bottom - .2]];
    [[L, col], [R, col2 || col]].forEach(([[a, b], k]) => {
      poly(c, [[a[0] - .22, a[1]], [a[0] + .22, a[1]], [b[0] + .18, b[1] - 3.2], [b[0] - .18, b[1] - 3.2]]); steel(c, a[0] - .3, 0, a[0] + .3, 0);
      const gx = b[0] - w / 2, gy = b[1] - 3.6;
      rr(c, gx, gy, w, 3.75, w / 2); body(c, k, gx, 0, gx + w, 0);
      ribs(c, gx, gy + .3, w, 2.4, 5, 'rgba(0,0,0,.18)'); shine(c, gx + w * .18, gy + .25, w * .18, 3.1, .3);
    });
    circ(c, px, py, .42); steel(c, px - .4, py - .4, px + .4, py + .4); circ(c, px, py, .15); c.fillStyle = '#3b4148'; c.fill();
  }
  // Pistol-grip drill, side view: motor housing on top, grip raked back, battery pack, chuck and bit up front.
  function drillBody(c, col, impact) {
    const L = impact ? 4.2 : 4.8, cy = 1.475, BLK = '#26292e';
    // ── Battery pack: black slab, colored top band, side ribs, fuel gauge, release tab ──
    rr(c, .3, 6.25, 4.6, 1.6, .3); body(c, '#2b2e33', 0, 6.25, 0, 7.85);
    rr(c, .3, 6.25, 4.6, .4, .2); body(c, col, 0, 6.25, 0, 6.65, false);
    for (let i = 0; i < 6; i++) { rr(c, .65 + i * .3, 6.95, .13, .6, .06); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill(); }
    text(c, '20V', 3.0, 7.05, .42, 'rgba(255,255,255,.8)');
    rr(c, 2.55, 7.35, 1.05, .3, .08); c.fillStyle = '#101113'; c.fill();
    [2.66, 2.92, 3.18].forEach((x, i) => { rr(c, x, 7.42, .2, .16, .04); c.fillStyle = i < 2 ? '#7ee08a' : '#2d4a32'; c.fill(); });
    rr(c, 4.4, 6.8, .38, .62, .12); body(c, col, 4.4, 0, 4.78, 0);
    // ── Foot that the battery slides onto, with the LED work light at the front ──
    c.beginPath(); c.moveTo(.55, 6.32); c.lineTo(.72, 5.7); c.quadraticCurveTo(.85, 5.42, 1.2, 5.42); c.lineTo(3.95, 5.42); c.quadraticCurveTo(4.5, 5.42, 4.62, 5.85); c.lineTo(4.75, 6.32); c.closePath(); body(c, BLK, 0, 5.42, 0, 6.32);
    rr(c, 4.25, 5.58, .36, .3, .08); c.fillStyle = '#fff6c8'; c.fill(); ink(c, .04, .5);
    // ── Grip: raked back and waisted for a hand ──
    c.beginPath(); c.moveTo(1.3, 2.3); c.bezierCurveTo(1.0, 3.4, 1.6, 4.45, 1.2, 5.55); c.lineTo(3.45, 5.55); c.bezierCurveTo(3.3, 4.5, 3.1, 3.55, 3.7, 2.4); c.closePath(); body(c, col, 1.0, 0, 3.7, 0);
    // Rubber over-mold on the back of the grip, with a textured pad
    c.beginPath(); c.moveTo(1.3, 2.55); c.bezierCurveTo(1.0, 3.4, 1.6, 4.45, 1.22, 5.5); c.lineTo(2.05, 5.5); c.bezierCurveTo(2.35, 4.4, 1.85, 3.4, 2.15, 2.55); c.closePath(); body(c, BLK, 1.0, 0, 2.35, 0, false);
    for (let i = 0; i < 7; i++) { rr(c, 1.48 + Math.sin(i * .7) * .06, 2.95 + i * .35, .42, .08, .04); c.fillStyle = 'rgba(255,255,255,.1)'; c.fill(); }
    shine(c, 2.55, 2.9, .14, 2.2, .3);
    // Trigger, and the forward/reverse button through the body above it
    c.beginPath(); c.moveTo(3.58, 2.7); c.quadraticCurveTo(4.3, 2.85, 4.12, 3.45); c.quadraticCurveTo(3.95, 3.98, 3.38, 3.98); c.quadraticCurveTo(3.58, 3.3, 3.58, 2.7); c.closePath(); body(c, BLK, 3.38, 0, 4.3, 0);
    rr(c, 3.0, 2.42, .72, .3, .12); body(c, '#3d4249', 0, 2.42, 0, 2.72);
    // ── Motor housing: a rounded shell with a black vented rear cap ──
    const shell = () => { c.beginPath(); c.moveTo(.95, .35); c.lineTo(L - .22, .35); c.quadraticCurveTo(L, .35, L, .62); c.lineTo(L, 2.33); c.quadraticCurveTo(L, 2.6, L - .22, 2.6); c.lineTo(.95, 2.6); c.bezierCurveTo(-.05, 2.6, -.05, .35, .95, .35); c.closePath(); };
    shell(); body(c, col, 0, .35, 0, 2.6);
    c.save(); shell(); c.clip();
    rr(c, -.2, .2, 2.05, 2.6, 0); body(c, BLK, 0, .35, 0, 2.6, false);
    for (let i = 0; i < 5; i++) { poly(c, [[.62 + i * .24, .75], [.76 + i * .24, .75], [.66 + i * .24, 2.2], [.52 + i * .24, 2.2]]); c.fillStyle = '#0b0c0e'; c.fill(); }
    rr(c, 1.85, .35, L, .28, 0); c.fillStyle = BLK; c.fill();                        // rubber top strip
    rr(c, 1.85, 2.28, L, .32, 0); c.fillStyle = dk(col, .3); c.fill();               // shadowed underside
    c.restore(); shell(); ink(c);
    // Side badge and highlight
    rr(c, 2.15, 1.08, L - 2.75, .62, .14); c.fillStyle = BLK; c.fill();
    text(c, impact ? 'IMPACT' : 'BRUSHLESS', 2.15 + (L - 2.75) / 2, 1.4, impact ? .3 : .32, col);
    shine(c, 2.0, .72, L - 2.3, .14, .45);
    if (!impact) { rr(c, 2.75, .1, .85, .32, .12); body(c, BLK, 0, .1, 0, .42); text(c, '1 2', 3.17, .27, .22, '#e9edf2'); }
    if (impact) {
      // ── Impact: metal anvil nose, spring-loaded hex collet, 1/4" hex driver bit ──
      poly(c, [[L, .55], [L + .9, .82], [L + .9, 2.13], [L, 2.4]]); steel(c, 0, .55, 0, 2.4);
      c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = .04; [L + .3, L + .6].forEach(x => { c.beginPath(); c.moveTo(x, .65 + (x - L) * .3); c.lineTo(x, 2.3 - (x - L) * .3); c.stroke(); });
      rr(c, L + .9, cy - .5, .6, 1.0, .14); body(c, BLK, 0, cy - .5, 0, cy + .5);
      rr(c, L + 1.08, cy - .5, .08, 1.0, 0); c.fillStyle = 'rgba(255,255,255,.18)'; c.fill();
      rr(c, L + 1.5, cy - .3, .28, .6, .08); steel(c, 0, cy - .3, 0, cy + .3);
      rr(c, L + 1.58, cy - .12, .14, .24, .03); c.fillStyle = '#15171a'; c.fill();   // empty hex socket
    } else {
      // ── Drill: numbered clutch collar, two-sleeve keyless chuck, twist bit ──
      poly(c, [[L, .45], [L + .72, .62], [L + .72, 2.33], [L, 2.5]]); body(c, BLK, 0, .45, 0, 2.5);
      rr(c, L + .12, .58, .22, 1.8, .06); body(c, col, 0, .58, 0, 2.38, false);
      c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) c.fillRect(L + .42, .78 + i * .27, .2, .05);
      rr(c, L + .72, .8, .35, 1.35, .1); body(c, '#1c1e21', 0, .8, 0, 2.15);
      poly(c, [[L + 1.07, .72], [L + 2.0, .95], [L + 2.0, 2.0], [L + 1.07, 2.23]]); body(c, BLK, 0, .72, 0, 2.23);
      c.fillStyle = 'rgba(255,255,255,.13)'; for (let i = 0; i < 7; i++) c.fillRect(L + 1.15 + i * .12, .85 + i * .03, .05, 1.25 - i * .06);
      poly(c, [[L + 2.0, 1.05], [L + 2.32, 1.2], [L + 2.32, 1.75], [L + 2.0, 1.9]]); steel(c, 0, 1.05, 0, 1.9);
      rr(c, L + 2.24, cy - .1, .08, .2, .02); c.fillStyle = '#15171a'; c.fill();   // open jaws
    }
  }

  const TOOLS = [
    // ── Hand tools ──
    { id: 'hammer', name: 'Claw hammer', box: [5, 10], colors: ['#f2c230', '#d8322a', '#3f8fd9'], draw(c, col) {
      rr(c, 2.05, 1.7, .9, 4.9, .25); body(c, col, 2, 0, 3, 0);
      rr(c, 2.0, 5.9, 1.0, 3.95, .45); blackRubber(c, 2, 0, 3, 0); ribs(c, 2.0, 6.1, 1.0, 3.4, 7, col);
      // Head: face on the right, split claw on the left.
      poly(c, [[1.2, .25], [4.1, .25], [4.1, 1.75], [1.2, 1.75]]); steel(c, 0, .25, 0, 1.75);
      rr(c, 3.8, .05, 1.1, 1.9, .3); steel(c, 0, .05, 0, 1.95);
      poly(c, [[1.25, .3], [.1, .05], [.35, .75], [1.25, .95]]); steel(c, 0, 0, 0, 1);
      poly(c, [[1.25, 1.05], [.35, 1.25], [.1, 1.95], [1.25, 1.7]]); steel(c, 0, 1, 0, 2);
      rr(c, 1.9, .35, 1.2, 1.3, .2); c.fillStyle = 'rgba(0,0,0,.18)'; c.fill();
    } },
    { id: 'screwdriver-ph', name: 'Phillips screwdriver', box: [3, 10], colors: ['#d8322a', '#f2c230', '#2f6fe0', '#2f9a46'], draw(c, col) { screwdriver(c, col, 'ph'); } },
    { id: 'screwdriver-flat', name: 'Flathead screwdriver', box: [3, 10], colors: ['#d8322a', '#f2c230', '#2f6fe0', '#2f9a46'], draw(c, col) { screwdriver(c, col, 'flat'); } },
    { id: 'needlenose', name: 'Needle-nose pliers', box: [3, 11], colors: ['#d8322a', '#2f6fe0', '#f2c230'], draw(c, col) {
      plierHandles(c, col, 1.5, 4.3, 11, .95);
      poly(c, [[1.38, .1], [1.62, .1], [1.95, 4.0], [1.05, 4.0]]); steel(c, 1.05, 0, 1.95, 0);
      c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = .05; c.beginPath(); c.moveTo(1.5, .2); c.lineTo(1.5, 3.9); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 1.2; y < 3.6; y += .25) c.fillRect(1.32, y, .36, .05);
    } },
    { id: 'linesman', name: 'Lineman’s pliers', box: [3, 10], colors: ['#d8322a', '#2f6fe0'], draw(c, col) {
      plierHandles(c, col, 1.5, 3.4, 10, .95);
      poly(c, [[.5, .15], [2.5, .15], [2.4, 3.2], [.6, 3.2]]); steel(c, .5, 0, 2.5, 0);
      c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = .06; c.beginPath(); c.moveTo(1.5, .2); c.lineTo(1.5, 3.1); c.stroke();
      c.fillStyle = 'rgba(0,0,0,.35)'; for (let y = .45; y < 1.6; y += .22) c.fillRect(.7, y, 1.6, .06);
    } },
    { id: 'strippers', name: 'Wire strippers', box: [3, 9], colors: ['#d8322a', '#f2c230', '#2f9a46'], draw(c, col) {
      plierHandles(c, col, 1.5, 3.6, 9, .95, .85, '#2b2e33');
      poly(c, [[1.1, .1], [1.9, .1], [1.85, 3.3], [1.15, 3.3]]); steel(c, 1.1, 0, 1.9, 0);
      c.fillStyle = '#2b2e33'; [.12, .1, .085, .07, .06].forEach((r, i) => { circ(c, 1.5, .6 + i * .5, r + .03); c.fill(); });
      text(c, 'AWG', 1.5, 3.0, .22, '#30353b');
    } },
    { id: 'sidecutters', name: 'Diagonal cutters', box: [3, 8], colors: ['#e2622b', '#2f6fe0'], draw(c, col) {
      plierHandles(c, col, 1.5, 2.6, 8, .95);
      poly(c, [[.55, .9], [1.5, .05], [2.45, .9], [2.0, 2.5], [1.0, 2.5]]); steel(c, .5, 0, 2.5, 0);
      c.strokeStyle = 'rgba(0,0,0,.7)'; c.lineWidth = .06; c.beginPath(); c.moveTo(1.5, .15); c.lineTo(1.5, 2.3); c.stroke();
    } },
    { id: 'channellocks', name: 'Tongue-and-groove pliers', box: [5, 12], colors: ['#2f6fe0', '#d8322a'], draw(c, col) {
      plierHandles(c, col, 2.8, 4.6, 12, 1.0);
      // Angled jaws reaching up-left, with the slip-joint channel.
      poly(c, [[2.6, 4.7], [2.1, 4.0], [.15, 1.1], [.55, .45], [2.45, 2.7], [3.2, 4.1]]); steel(c, 0, .5, 0, 4.7);
      poly(c, [[3.0, 4.4], [3.6, 2.8], [3.35, .3], [2.75, .55], [2.8, 2.8], [2.5, 3.9]]); steel(c, 2.5, 0, 3.6, 0);
      c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = .06;
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(.75 + i * .28, 1.25 + i * .32); c.lineTo(.95 + i * .28, .95 + i * .32); c.stroke(); }
      for (let i = 0; i < 4; i++) { rr(c, 2.95, 1.0 + i * .5, .35, .22, .1); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill(); }
    } },
    { id: 'wrench', name: 'Combination wrench', box: [3, 12], colors: ['#c9cfd6'], draw(c) {
      // Modeled on a standard 3/4" combination wrench: open end offset 15°, tapered I-beam
      // handle, 12-point box end offset 15° the other way.
      // Handle
      poly(c, [[1.05, 2.4], [1.95, 2.4], [1.88, 9.6], [1.12, 9.6]]); steel(c, 1.05, 0, 1.95, 0);
      poly(c, [[1.3, 3.0], [1.7, 3.0], [1.65, 9.0], [1.35, 9.0]]); c.fillStyle = 'rgba(0,0,0,.16)'; c.fill();
      // Open end: rounded head with the jaw cut out of it at 15°
      c.save(); c.translate(1.5, 1.45); c.rotate(-.26);
      c.beginPath(); c.ellipse(0, 0, 1.38, 1.3, 0, 0, Math.PI * 2); steel(c, -1.4, -1.3, 1.4, 1.3);
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.moveTo(-.46, -1.6); c.lineTo(.46, -1.6); c.lineTo(.46, .05); c.arc(0, .05, .46, 0, Math.PI); c.closePath(); c.fill();
      c.globalCompositeOperation = 'source-over';
      c.beginPath(); c.moveTo(-.46, -1.25); c.lineTo(-.46, .05); c.arc(0, .05, .46, Math.PI, 0, true); c.lineTo(.46, -1.25); ink(c, .06, .55);
      c.restore();
      // Box end: ring with a 12-point opening
      c.save(); c.translate(1.5, 10.75); c.rotate(.26);
      c.beginPath(); c.ellipse(0, 0, 1.22, 1.18, 0, 0, Math.PI * 2); steel(c, -1.2, -1.2, 1.2, 1.2);
      c.globalCompositeOperation = 'destination-out'; c.beginPath();
      for (let i = 0; i < 24; i++) { const r = i % 2 ? .6 : .72, t = i * Math.PI / 12; i ? c.lineTo(Math.cos(t) * r, Math.sin(t) * r) : c.moveTo(Math.cos(t) * r, Math.sin(t) * r); }
      c.closePath(); c.fill(); c.globalCompositeOperation = 'source-over';
      c.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? .6 : .72, t = i * Math.PI / 12; i ? c.lineTo(Math.cos(t) * r, Math.sin(t) * r) : c.moveTo(Math.cos(t) * r, Math.sin(t) * r); } c.closePath(); ink(c, .05, .5);
      c.restore();
      text(c, '3/4"', 1.5, 6.2, .38, 'rgba(0,0,0,.5)', 800, undefined, -Math.PI / 2);
    } },
    { id: 'adjustable', name: 'Adjustable wrench', box: [4, 11], colors: ['#c9cfd6'], draw(c) {
      // Fixed jaw and handle as one forging, sliding lower jaw, knurled worm screw, hang hole.
      poly(c, [[1.45, 3.1], [2.6, 3.1], [2.45, 10.3], [1.6, 10.3]]); steel(c, 1.45, 0, 2.6, 0);
      c.beginPath(); c.ellipse(2.02, 10.2, .58, .62, 0, 0, Math.PI * 2); steel(c, 1.4, 9.6, 2.6, 10.8);
      circ(c, 2.02, 10.2, .24); c.globalCompositeOperation = 'destination-out'; c.fill(); c.globalCompositeOperation = 'source-over'; circ(c, 2.02, 10.2, .24); ink(c, .04, .5);
      poly(c, [[1.7, 3.8], [2.35, 3.8], [2.3, 9.4], [1.75, 9.4]]); c.fillStyle = 'rgba(0,0,0,.14)'; c.fill();
      // Head
      c.save(); c.translate(2.1, 1.8); c.rotate(-.26);
      poly(c, [[-1.7, -1.2], [-.45, -1.55], [-.4, -.35], [.55, -.35], [.6, -1.6], [1.75, -1.1], [1.6, .9], [.9, 1.55], [-.9, 1.55], [-1.75, .6]]); steel(c, -1.8, -1.6, 1.8, 1.6);
      rr(c, -.4, -.35, .95, .2, .03); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill();
      // Worm screw
      rr(c, -.55, .3, 1.1, .62, .25); body(c, '#8c949e', 0, .3, 0, .92);
      for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(-.48 + i * .15, .32, .05, .58); }
      c.restore();
      text(c, '8 IN', 2.03, 6.6, .34, 'rgba(0,0,0,.5)', 800, undefined, -Math.PI / 2);
    } },
    { id: 'ratchet', name: '3/8" ratchet', box: [3, 10], colors: ['#c9cfd6'], draw(c) {
      rr(c, 1.08, 2.4, .84, 7.45, .4); steel(c, 1.08, 0, 1.92, 0);
      rr(c, 1.0, 6.6, 1.0, 3.25, .5); blackRubber(c, 1, 0, 2, 0); ribs(c, 1.0, 6.8, 1.0, 2.8, 6, 'rgba(255,255,255,.12)');
      circ(c, 1.5, 1.5, 1.42); steel(c, .1, .1, 2.9, 2.9);
      circ(c, 1.5, 1.5, .95); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = .07; c.stroke();
      rr(c, 1.22, 1.22, .56, .56, .06); c.fillStyle = '#3b4148'; c.fill();
      rr(c, 1.3, .2, .4, .75, .18); body(c, '#5d646d', 1.3, 0, 1.7, 0);
    } },
    { id: 'hexkeys', name: 'Hex key set', box: [4, 5], colors: ['#d8322a', '#2f6fe0'], draw(c, col) {
      c.lineCap = 'round'; c.lineJoin = 'miter';
      for (let i = 0; i < 7; i++) { const o = i * .3; c.strokeStyle = i % 2 ? '#2b2e33' : '#454b52'; c.lineWidth = .2; c.beginPath(); c.moveTo(.55 + o * .4, .25 + o * .8); c.lineTo(.55 + o * .4, 4.35); c.lineTo(3.8 - o * .55, 4.35); c.stroke(); }
      rr(c, .15, 2.4, 1.9, 1.5, .3); body(c, col, .15, 2.4, 2.05, 3.9);
      text(c, 'SAE', 1.1, 3.15, .45, 'rgba(255,255,255,.85)');
    } },
    { id: 'speedsquare', name: 'Speed square', box: [6, 6], colors: ['#3f8fd9', '#c9cfd6'], draw(c, col) {
      poly(c, [[.1, .1], [.1, 5.9], [5.9, 5.9]]); body(c, col, 0, 0, 6, 6);
      poly(c, [[.1, .1], [.1, 5.9], [.55, 5.9], [.55, .75]]); c.fillStyle = dk(col, .3); c.fill();
      poly(c, [[1.25, 2.2], [1.25, 4.85], [3.9, 4.85]]); c.fillStyle = 'rgba(12,14,16,.9)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = .05;
      for (let i = 0; i < 22; i++) { const t = .5 + i * .24; c.beginPath(); c.moveTo(t, 5.9); c.lineTo(t, 5.9 - (i % 4 === 0 ? .45 : .25)); c.stroke(); }
      text(c, 'PIVOT', .9, 5.4, .3, 'rgba(255,255,255,.85)');
    } },
    { id: 'hacksaw', name: 'Hacksaw', box: [11, 4], colors: ['#d8322a', '#2f6fe0'], draw(c, col) {
      rr(c, .65, 1.05, 8.6, .4, .05); steel(c, 0, 1.05, 0, 1.45);
      c.fillStyle = '#5d646d'; for (let x = .7; x < 9.2; x += .2) { poly(c, [[x, 1.45], [x + .1, 1.6], [x + .2, 1.45]]); c.fill(); }
      rr(c, .2, .2, 9.2, .65, .2); body(c, col, 0, .2, 0, .85);
      rr(c, .25, .2, .65, 3.5, .25); body(c, col, .25, 0, .9, 0);
      poly(c, [[8.9, .2], [10.85, .6], [10.9, 3.85], [9.8, 3.9], [9.2, 2.2]]); blackRubber(c, 8.9, 0, 10.9, 0);
      rr(c, 9.75, 1.35, .55, 1.55, .27); c.fillStyle = '#0b0c0d'; c.fill();
      screwHead(c, .58, 1.25, .2); screwHead(c, 9.35, 1.25, .2);
    } },
    { id: 'prybar', name: 'Cat’s paw pry bar', box: [9, 4], colors: ['#2f6fe0', '#2b2e33'], draw(c, col) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(.5, .55); c.lineTo(.5, 2.3); c.quadraticCurveTo(.5, 3.5, 1.7, 3.5); c.lineTo(8.3, 3.5);
      c.strokeStyle = 'rgba(12,14,16,.7)'; c.lineWidth = .78; c.stroke(); c.strokeStyle = col; c.lineWidth = .62; c.stroke();
      c.strokeStyle = lt(col, .35); c.lineWidth = .12; c.beginPath(); c.moveTo(.4, .7); c.lineTo(.4, 2.3); c.quadraticCurveTo(.42, 3.3, 1.7, 3.38); c.lineTo(8.2, 3.38); c.stroke();
      poly(c, [[.1, .7], [.5, .05], [.9, .7]]); steel(c, 0, 0, 1, 0);
      poly(c, [[8.2, 3.12], [8.95, 3.5], [8.2, 3.88]]); steel(c, 8.2, 3.1, 8.9, 3.9);
    } },
    { id: 'punchdown', name: 'Punch-down tool', box: [3, 9], colors: ['#2f6fe0', '#f2c230', '#d8322a'], draw(c, col) {
      rr(c, .35, .15, 2.3, 5.4, 1.0); body(c, col, .35, 0, 2.65, 0);
      rr(c, .35, 2.4, 2.3, 1.0, .1); body(c, '#2b2e33', .35, 0, 2.65, 0, false);
      rr(c, 1.2, .7, .6, 1.2, .3); blackRubber(c, 1.2, 0, 1.8, 0); text(c, 'HI', 1.5, 1.3, .32, '#f2f4f7');
      shine(c, .6, .5, .25, 4.6, .35);
      rr(c, 1.0, 5.45, 1.0, .7, .15); steel(c, 1, 0, 2, 0);
      rr(c, 1.3, 6.1, .4, 2.5, .05); steel(c, 1.3, 0, 1.7, 0);
      poly(c, [[1.18, 8.5], [1.82, 8.5], [1.75, 8.9], [1.25, 8.9]]); steel(c, 1.18, 0, 1.82, 0);
    } },
    // ── Measuring & layout ──
    { id: 'tape-16', name: '16 ft tape measure', box: [3, 3], colors: ['#f2c230', '#d8322a'], draw(c, col) { tape(c, col, 1, "16'"); } },
    { id: 'tape-25', name: '25 ft tape measure', box: [4, 4], colors: ['#f2c230', '#2f9a46'], draw(c, col) { tape(c, col, 4 / 3, "25'"); } },
    { id: 'level-2', name: '2 ft level', box: [10, 2], colors: ['#f2c230', '#2f6fe0'], draw(c, col) { level(c, 10, col); } },
    { id: 'torpedo', name: 'Torpedo level', box: [6, 2], colors: ['#2f6fe0', '#f2c230', '#d8322a'], draw(c, col) { level(c, 6, col); } },
    { id: 'multimeter', name: 'Digital multimeter', box: [4, 6], colors: ['#f2c230', '#d8322a'], draw(c, col) {
      rr(c, .1, .1, 3.8, 5.8, .65); body(c, col, .1, .1, 3.9, 5.9);
      rr(c, .45, .45, 3.1, 5.1, .4); body(c, '#2b2e33', 0, .45, 0, 5.55);
      rr(c, .7, .7, 2.6, 1.3, .12); c.fillStyle = '#b8d4a0'; c.fill(); ink(c, .05, .5);
      text(c, '120.4', 2, 1.38, .75, '#22351a', 700, 'monospace');
      circ(c, 2, 3.25, .95); body(c, '#5d646d', 1.1, 2.3, 2.9, 4.2); circ(c, 2, 3.25, .55); body(c, '#3b4148', 1.5, 2.7, 2.5, 3.8, false);
      c.strokeStyle = '#f2f4f7'; c.lineWidth = .12; c.lineCap = 'round'; c.beginPath(); c.moveTo(2, 3.25); c.lineTo(2.55, 2.6); c.stroke();
      [['#121416', 1.05], ['#121416', 2], ['#d8322a', 2.95]].forEach(([k, x]) => { circ(c, x, 4.95, .26); c.fillStyle = k; c.fill(); c.strokeStyle = '#a3abb5'; c.lineWidth = .07; c.stroke(); });
    } },
    { id: 'labeler', name: 'Label printer', box: [4, 7], colors: ['#7a8899', '#2f6fe0'], draw(c, col) {
      rr(c, 1.3, .1, 1.4, 1.0, .05); c.fillStyle = '#fbfbf8'; c.fill(); ink(c, .04, .3); text(c, 'PP-A14', 2, .55, .32, '#23262a', 700);
      rr(c, .15, .8, 3.7, 6.05, .6); body(c, col, .15, .8, 3.85, 6.85);
      rr(c, .5, 1.25, 3.0, 1.2, .15); c.fillStyle = '#c5d6e2'; c.fill(); ink(c, .04, .5);
      text(c, 'PP-A14', 2, 1.85, .5, '#23262a', 700);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { rr(c, .55 + k * .75, 2.85 + r * .9, .6, .65, .12); body(c, '#eef0f2', 0, 2.85 + r * .9, 0, 3.5 + r * .9, false); }
    } },
    // ── Power tools ──
    { id: 'drill', name: 'Cordless drill', box: [8, 8], colors: ['#f08a1a', '#d8322a', '#2f9a46'], draw(c, col) { drillBody(c, col, false); } },
    { id: 'impact', name: 'Impact driver', box: [6, 8], colors: ['#1aa39a', '#f08a1a'], draw(c, col) { drillBody(c, col, true); } },
    { id: 'staplegun', name: 'Cable staple gun', box: [7, 4], colors: ['#7a8899', '#d8322a'], draw(c, col) {
      // Steel body and magazine underneath, squeeze handle on top hinged at the back.
      poly(c, [[.2, 1.45], [6.8, 1.45], [6.8, 2.45], [4.75, 2.45], [4.75, 3.8], [.25, 3.8]]); steel(c, 0, 1.45, 0, 3.8);
      rr(c, .45, 2.7, 4.1, .55, .1); c.fillStyle = '#2b2e33'; c.fill();
      rr(c, .6, 2.82, 3.8, .3, .06); c.fillStyle = '#c9cfd6'; c.fill();
      for (let x = .75; x < 4.3; x += .18) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x, 2.82, .05, .3); }
      rr(c, 5.0, 1.75, 1.6, .5, .1); body(c, '#2b2e33', 0, 1.75, 0, 2.25);
      text(c, 'T25', 2.5, 2.05, .48, '#2b2e33', 800);
      poly(c, [[.25, 1.3], [.6, .2], [6.6, .45], [6.7, 1.25]]); body(c, col, 0, .2, 0, 1.3);
      for (let x = 1.2; x < 6.2; x += .4) { rr(c, x, .55, .18, .55, .09); c.fillStyle = 'rgba(0,0,0,.25)'; c.fill(); }
      circ(c, .55, 1.25, .28); steel(c, .27, .97, .83, 1.53); circ(c, .55, 1.25, .1); c.fillStyle = '#23262a'; c.fill();
    } },
    { id: 'flashlight', name: 'Flashlight', box: [7, 3], colors: ['#2b2e33', '#d8322a'], draw(c, col) {
      rr(c, .05, 1.1, .45, .8, .15); body(c, '#5d646d', .05, 0, .5, 0);
      rr(c, .35, 1.0, 4.7, 1.0, .35); body(c, col, 0, 1.0, 0, 2.0);
      for (let x = 1.3; x < 4.2; x += .2) { c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x, 1.05, .08, .9); }
      rr(c, .65, .88, .65, .35, .12); body(c, '#d8322a', 0, .88, 0, 1.23);
      poly(c, [[5.0, .95], [6.0, .3], [6.9, .3], [6.9, 2.7], [6.0, 2.7], [5.0, 2.05]]); body(c, '#3b4148', 5, .3, 5, 2.7);
      for (let i = 0; i < 4; i++) { rr(c, 6.05 + i * .2, .35, .08, 2.3, .04); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill(); }
      rr(c, 6.78, .4, .17, 2.2, .08); c.fillStyle = '#fff2b8'; c.fill(); c.fillStyle = 'rgba(255,240,170,.6)'; c.fillRect(6.7, .55, .08, 1.9);
    } },
    { id: 'holesaw', name: 'Hole saw', box: [4, 4], colors: ['#c9cfd6'], draw(c) {
      c.fillStyle = '#6d7680';
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) { poly(c, [[2 + Math.cos(a) * 1.7, 2 + Math.sin(a) * 1.7], [2 + Math.cos(a + .1) * 1.95, 2 + Math.sin(a + .1) * 1.95], [2 + Math.cos(a + .19) * 1.7, 2 + Math.sin(a + .19) * 1.7]]); c.fill(); }
      circ(c, 2, 2, 1.72); steel(c, .3, .3, 3.7, 3.7);
      circ(c, 2, 2, 1.25); body(c, '#3b4148', .8, .8, 3.2, 3.2);
      poly(c, [[2, 1.45], [2.48, 1.72], [2.48, 2.28], [2, 2.55], [1.52, 2.28], [1.52, 1.72]]); steel(c, 1.5, 1.4, 2.5, 2.6);
      circ(c, 2, 2, .14); c.fillStyle = '#121416'; c.fill();
    } },
    { id: 'fishtape', name: 'Fish tape reel', box: [6, 6], colors: ['#f2c230', '#d8322a'], draw(c, col) {
      circ(c, 3, 3, 2.85); body(c, col, .2, .2, 5.8, 5.8);
      circ(c, 3, 3, 2.15); body(c, '#2b2e33', .9, .9, 5.1, 5.1);
      c.strokeStyle = '#8c949e'; c.lineWidth = .08; for (let r = 1.0; r < 2.05; r += .18) { circ(c, 3, 3, r); c.stroke(); }
      rr(c, 2.4, 2.4, 1.2, 1.2, .25); body(c, col, 2.4, 2.4, 3.6, 3.6);
      rr(c, 4.3, .75, .9, 1.4, .45); blackRubber(c, 4.3, 0, 5.2, 0);
      shine(c, 1.0, .9, 1.6, .18, .35);
    } },
    // ── Supplies ──
    { id: 'tape-elec', name: 'Roll of electrical tape', box: [3, 3], colors: ['#2b2e33', '#d8322a', '#2f6fe0', '#2f9a46'], draw(c, col) {
      circ(c, 1.5, 1.5, 1.42); body(c, col, .1, .1, 2.9, 2.9);
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = .05; for (let r = .85; r < 1.4; r += .12) { circ(c, 1.5, 1.5, r); c.stroke(); }
      circ(c, 1.5, 1.5, .72); c.fillStyle = '#e9e2d0'; c.fill(); ink(c, .05, .4);
      circ(c, 1.5, 1.5, .58); c.fillStyle = '#121416'; c.fill();
    } },
    { id: 'knife', name: 'Utility knife', box: [6, 2], colors: ['#f2c230', '#d8322a'], draw(c, col) {
      poly(c, [[.1, .5], [4.6, .3], [5.0, 1.6], [.3, 1.75]]); body(c, col, 0, .3, 0, 1.75);
      poly(c, [[.6, .75], [4.2, .62], [4.45, 1.38], [.7, 1.48]]); body(c, '#5d646d', 0, .6, 0, 1.5, false);
      rr(c, 2.2, .12, .9, .4, .15); blackRubber(c, 2.2, 0, 3.1, 0);
      poly(c, [[4.55, .45], [5.95, .95], [4.85, 1.45]]); steel(c, 4.55, .4, 5.9, 1.5);
      screwHead(c, 1.2, 1.1, .2);
    } },
    { id: 'voltpen', name: 'Voltage tester pen', box: [1, 6], colors: ['#d8322a', '#f2c230'], draw(c, col) {
      rr(c, .2, .1, .6, 4.6, .3); body(c, col, .2, 0, .8, 0);
      rr(c, .2, .1, .6, 1.8, .3); blackRubber(c, .2, 0, .8, 0);
      rr(c, .78, .4, .14, 1.4, .05); blackRubber(c, .78, 0, .92, 0);
      poly(c, [[.24, 4.6], [.76, 4.6], [.5, 5.92]]); body(c, '#e6e8ea', .24, 0, .76, 0);
      circ(c, .5, 3.2, .1); c.fillStyle = '#ffd84d'; c.fill();
    } },
    { id: 'marker', name: 'Permanent marker', box: [1, 5], colors: ['#2b2e33', '#d8322a', '#2f6fe0'], draw(c, col) {
      rr(c, .2, 1.4, .6, 3.5, .25); body(c, '#dde1e5', .2, 0, .8, 0);
      rr(c, .27, 2.0, .46, 2.2, .05); c.fillStyle = col; c.fill();
      rr(c, .15, .1, .7, 1.6, .3); body(c, col, .15, 0, .85, 0);
      rr(c, .8, .3, .12, 1.1, .05); body(c, col, .8, 0, .92, 0, false);
    } },
    { id: 'zipties', name: 'Bundle of zip ties', box: [2, 7], colors: ['#2b2e33', '#f2f2ee'], draw(c, col) {
      for (let i = 0; i < 7; i++) { const x = .3 + i * .2; rr(c, x, .2, .13, 6.6, .06); c.fillStyle = i % 3 === 1 ? '#6d7680' : col; c.fill(); ink(c, .02, .4); }
      rr(c, .15, 2.9, 1.7, .55, .1); body(c, '#d8322a', 0, 2.9, 0, 3.45);
      rr(c, .2, .1, 1.6, .5, .1); body(c, col, 0, .1, 0, .6);
    } },
    { id: 'drillbit', name: 'Drill bit', box: [1, 5], colors: ['#c9cfd6', '#d4a72c'], draw(c, col) {
      rr(c, .32, .1, .36, 1.6, .06); steel(c, .32, 0, .68, 0);
      poly(c, [[.3, 1.6], [.7, 1.6], [.7, 4.6], [.5, 4.95], [.3, 4.6]]); c.fillStyle = col === '#d4a72c' ? '#c9a24a' : '#a3abb5'; c.fill(); ink(c, .04);
      c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = .05; for (let y = 1.75; y < 4.6; y += .3) { c.beginPath(); c.moveTo(.3, y); c.lineTo(.7, y + .22); c.stroke(); }
    } },
    { id: 'hexkey', name: 'Loose hex key', box: [2, 3], colors: ['#2b2e33', '#c9cfd6'], draw(c, col) {
      c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(.5, .2); c.lineTo(.5, 2.5); c.lineTo(1.75, 2.5);
      c.strokeStyle = 'rgba(12,14,16,.7)'; c.lineWidth = .42; c.stroke(); c.strokeStyle = col === '#c9cfd6' ? '#b7bfc8' : '#3b4148'; c.lineWidth = .3; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = .07; c.beginPath(); c.moveTo(.43, .3); c.lineTo(.43, 2.4); c.stroke();
    } },
    { id: 'brace', name: 'Corner brace', box: [3, 3], colors: ['#c9cfd6'], draw(c) {
      poly(c, [[.15, .15], [.95, .15], [.95, 2.05], [2.85, 2.05], [2.85, 2.85], [.15, 2.85]]); steel(c, 0, 0, 3, 3);
      [[.55, .7], [.55, 1.6], [1.5, 2.45], [2.4, 2.45], [.55, 2.45]].forEach(([x, y]) => { circ(c, x, y, .16); c.fillStyle = '#23262a'; c.fill(); });
    } },
    { id: 'cat6scrap', name: 'Scrap of Cat6', box: [3, 2], colors: ['#2f6fe0', '#9aa3ad', '#f2c230'], draw(c, col) {
      c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(.3, .5); c.lineTo(1.3, .5); c.quadraticCurveTo(1.6, .5, 1.6, 1.0); c.quadraticCurveTo(1.6, 1.5, 2.0, 1.5); c.lineTo(2.7, 1.5);
      c.strokeStyle = 'rgba(12,14,16,.6)'; c.lineWidth = .46; c.stroke(); c.strokeStyle = col; c.lineWidth = .36; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = .08; c.beginPath(); c.moveTo(.3, .42); c.lineTo(1.3, .42); c.stroke();
      ['#f08a1a', '#2f9a46', '#2f6fe0', '#7a4a24'].forEach((k, i) => { c.fillStyle = k; c.fillRect(2.7, 1.36 + i * .07, .22, .05); });
    } },
    { id: 'fuse', name: 'Cartridge fuse', box: [2, 1], colors: ['#c9cfd6'], draw(c) {
      rr(c, .35, .28, 1.3, .44, .1); c.fillStyle = 'rgba(220,232,240,.75)'; c.fill(); ink(c, .04);
      c.strokeStyle = '#8c949e'; c.lineWidth = .04; c.beginPath(); c.moveTo(.4, .5); c.lineTo(1.6, .5); c.stroke();
      rr(c, .08, .25, .38, .5, .08); steel(c, 0, .25, 0, .75); rr(c, 1.54, .25, .38, .5, .08); steel(c, 0, .25, 0, .75);
    } },
    { id: 'stubby', name: 'Stubby screwdriver', box: [1, 3], colors: ['#d8322a', '#2f6fe0', '#f2c230'], draw(c, col) {
      rr(c, .1, .1, .8, 1.5, .38); body(c, col, .1, 0, .9, 0); shine(c, .22, .3, .12, 1.0, .35);
      rr(c, .3, 1.55, .4, .25, .06); steel(c, .3, 0, .7, 0);
      rr(c, .43, 1.78, .14, .95, .03); steel(c, .43, 0, .57, 0, false);
      poly(c, [[.42, 2.7], [.58, 2.7], [.5, 2.95]]); steel(c, .42, 0, .58, 0);
    } },
    { id: 'pencil', name: 'Carpenter pencil', box: [1, 4], colors: ['#d8322a', '#f2c230'], draw(c, col) {
      rr(c, .22, .1, .56, 3.1, .08); body(c, col, .22, 0, .78, 0);
      poly(c, [[.22, 3.2], [.78, 3.2], [.6, 3.8], [.4, 3.8]]); c.fillStyle = '#e8cfa0'; c.fill(); ink(c, .03);
      poly(c, [[.44, 3.72], [.56, 3.72], [.52, 3.9], [.48, 3.9]]); c.fillStyle = '#2b2e33'; c.fill();
      text(c, 'HB', .5, 1.6, .26, 'rgba(0,0,0,.6)', 700, undefined, Math.PI / 2);
    } },
    { id: 'screwbox', name: 'Box of screws', box: [2, 2], colors: ['#f2c230', '#2f9a46'], draw(c, col) {
      rr(c, .1, .1, 1.8, 1.8, .2); body(c, col, .1, .1, 1.9, 1.9);
      rr(c, .3, .3, 1.4, 1.4, .1); c.fillStyle = 'rgba(210,225,235,.6)'; c.fill(); ink(c, .03, .4);
      [[.6, .65], [1.05, .55], [1.4, .85], [.75, 1.15], [1.25, 1.3], [.55, 1.45]].forEach(([x, y]) => screwHead(c, x, y, .14));
    } },
    { id: 'wirenut', name: 'Wire nut', box: [1, 1], colors: ['#f08a1a', '#f2c230', '#d8322a', '#2f6fe0'], draw(c, col) {
      circ(c, .5, .5, .42); body(c, col, .1, .1, .9, .9);
      c.strokeStyle = dk(col, .35); c.lineWidth = .04; for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3; c.beginPath(); c.moveTo(.5 + Math.cos(t) * .2, .5 + Math.sin(t) * .2); c.lineTo(.5 + Math.cos(t) * .4, .5 + Math.sin(t) * .4); c.stroke(); }
      circ(c, .5, .5, .13); c.fillStyle = lt(col, .3); c.fill();
    } },
    { id: 'rj45', name: 'RJ45 connector', box: [1, 1], colors: ['#e8eef2'], draw(c) {
      rr(c, .2, .12, .6, .76, .08); c.fillStyle = 'rgba(225,235,242,.9)'; c.fill(); ink(c, .04);
      ['#f08a1a', '#f08a1a', '#2f9a46', '#2f6fe0', '#2f6fe0', '#2f9a46', '#7a4a24', '#7a4a24'].forEach((k, i) => { c.fillStyle = k; c.fillRect(.25 + i * .066, .5, .045, .34); });
      c.fillStyle = '#c9a24a'; for (let i = 0; i < 8; i++) c.fillRect(.25 + i * .066, .16, .045, .14);
      rr(c, .38, .02, .24, .14, .03); c.fillStyle = 'rgba(200,215,225,.9)'; c.fill();
    } },
    { id: 'socket', name: '10 mm socket', box: [1, 1], colors: ['#c9cfd6'], draw(c) {
      circ(c, .5, .5, .44); steel(c, .1, .1, .9, .9);
      poly(c, [...Array(6)].map((_, i) => [.5 + Math.cos(i * Math.PI / 3) * .24, .5 + Math.sin(i * Math.PI / 3) * .24])); c.fillStyle = '#23262a'; c.fill();
    } },
    { id: 'keystone', name: 'Keystone jack', box: [1, 1], colors: ['#f2f2ee', '#2f6fe0'], draw(c, col) {
      rr(c, .14, .1, .72, .8, .08); body(c, col, .14, .1, .86, .9);
      rr(c, .28, .35, .44, .38, .04); c.fillStyle = '#23262a'; c.fill();
      c.fillStyle = '#c9a24a'; for (let i = 0; i < 4; i++) c.fillRect(.32 + i * .1, .38, .04, .1);
    } },
  ];

  const COLOR_NAMES = { '#f2c230': 'yellow', '#d8322a': 'red', '#3f8fd9': 'blue', '#2f6fe0': 'blue', '#2f9a46': 'green', '#f08a1a': 'orange', '#1aa39a': 'teal', '#e2622b': 'orange', '#2b2e33': 'black', '#f2f2ee': 'white', '#7a8899': 'gray', '#c9cfd6': 'chrome', '#e8eef2': 'clear', '#d4a72c': 'gold' };

  // ── Footprints worked out from the art ──
  const PX = 32, COVER = .2;
  function deriveMask(tool) {
    const [w, h] = tool.box, cv = document.createElement('canvas'); cv.width = w * PX; cv.height = h * PX;
    const c = cv.getContext('2d'); c.scale(PX, PX); tool.draw(c, tool.colors[0]);
    const d = c.getImageData(0, 0, cv.width, cv.height).data, rows = [];
    for (let y = 0; y < h; y++) {
      let row = '';
      for (let x = 0; x < w; x++) {
        let n = 0; for (let py = y * PX; py < (y + 1) * PX; py += 2) for (let px = x * PX; px < (x + 1) * PX; px += 2) if (d[(py * cv.width + px) * 4 + 3] > 60) n++;
        row += n / (PX * PX / 4) >= COVER ? '#' : '.';
      }
      rows.push(row);
    }
    return rows;
  }
  TOOLS.forEach(t => { t.mask = deriveMask(t); t.size = t.mask.join('').split('#').length - 1; });

  // ── Geometry: cells, and every distinct turn/flip ──
  const cellsOf = mask => { const o = []; mask.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') o.push([x, y]); })); return o; };
  const mul = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
  function xform(tool, k, f) {
    let W = tool.mask[0].length, H = tool.mask.length, m = f ? [-1, 0, 0, 1, W, 0] : [1, 0, 0, 1, 0, 0];
    for (let i = 0; i < k; i++) { m = mul([0, 1, -1, 0, H, 0], m); [W, H] = [H, W]; }
    return { m, W, H };
  }
  function orient(tool, k, f) {
    const { m, W, H } = xform(tool, k, f);
    const cells = cellsOf(tool.mask).map(([x, y]) => { const px = x + .5, py = y + .5; return [Math.floor(m[0] * px + m[2] * py + m[4]), Math.floor(m[1] * px + m[3] * py + m[5])]; });
    return { cells, W, H, m };
  }
  function orientations(tool) {
    const seen = new Set(), out = [];
    for (let f = 0; f < 2; f++) for (let k = 0; k < 4; k++) { const o = orient(tool, k, f); const key = o.cells.map(c => c.join(',')).sort().join(';'); if (!seen.has(key)) { seen.add(key); out.push({ k, f, ...o }); } }
    return out;
  }
  const turnCW = (k, f) => [(k + 1) % 4, f];
  const mirror = (k, f) => [(4 - k) % 4, f ? 0 : 1];

  // ── Sprites ──
  const cache = new Map();
  // Each turn/flip gets its own render, so printed text can stay readable.
  function sprite(tool, col, px, clip = true, k = 0, f = 0) {
    px = Math.max(8, Math.min(140, px));
    const key = tool.id + col + px + clip + k + f;
    if (cache.has(key)) return cache.get(key);
    const { m, W, H } = xform(tool, k, f), cvs = document.createElement('canvas');
    cvs.width = Math.ceil(W * px); cvs.height = Math.ceil(H * px);
    const c = cvs.getContext('2d'); c.scale(px, px); c.transform(...m);
    if (clip) { c.beginPath(); cellsOf(tool.mask).forEach(([x, y]) => c.rect(x, y, 1, 1)); c.clip(); }
    tool.draw(c, col);
    let alpha = null; try { alpha = c.getImageData(0, 0, cvs.width, cvs.height).data; } catch { }
    const s = { cvs, W, H, px, alpha }; cache.set(key, s); return s;
  }
  function solidAt(sp, u, v) {
    if (u < 0 || v < 0 || u >= sp.W || v >= sp.H) return false;
    if (!sp.alpha) return true;
    const x = Math.floor(u * sp.px), y = Math.floor(v * sp.px);
    return sp.alpha[(y * sp.cvs.width + x) * 4 + 3] > 50;
  }
  function drawOriented(ctx, tool, col, k, f, x, y, s) {
    const sp = sprite(tool, col, Math.round(s * 2), true, k, f);
    ctx.drawImage(sp.cvs, x, y, sp.W * s, sp.H * s);
  }
  window.ToolLib = { TOOLS, COLOR_NAMES, cellsOf, orient, orientations, xform, turnCW, mirror, sprite, solidAt, drawOriented, byId: id => TOOLS.find(t => t.id === id) };
})();
