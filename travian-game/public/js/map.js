// Canvas world map: pan/zoom village viewer with click-to-target (Travian-style)
(function () {
  const cfg = window.MAP_CFG;
  const canvas = document.getElementById('worldmap');
  const tip = document.getElementById('maptip');
  const ctx = canvas.getContext('2d');
  let scale = 24;            // px per tile
  let camX = cfg.startX, camY = cfg.startY; // center coords (float)
  let cache = null, cacheKey = '';

  const COLORS = { own: '#d4a017', ally: '#4caf50', barb: '#8a2f2f', other: '#3f6fb5' };

  function viewBounds() {
    const wTiles = canvas.width / scale, hTiles = canvas.height / scale;
    let x0 = Math.floor(camX - wTiles / 2), y0 = Math.floor(camY - hTiles / 2);
    let w = Math.ceil(wTiles) + 1, h = Math.ceil(hTiles) + 1;
    w = Math.min(50, w); h = Math.min(50, h);
    x0 = Math.max(0, Math.min(cfg.mapW - w, x0));
    y0 = Math.max(0, Math.min(cfg.mapH - h, y0));
    return { x0, y0, w, h };
  }

  function load() {
    const b = viewBounds();
    const key = `${b.x0},${b.y0},${b.w},${b.h}`;
    if (key === cacheKey) { draw(); return; }
    fetch(`${cfg.dataUrl}?x=${b.x0}&y=${b.y0}&w=${b.w}&h=${b.h}`)
      .then(r => r.json())
      .then(d => { cache = d; cacheKey = key; draw(); })
      .catch(() => {});
  }

  function tileToPx(tx, ty) {
    const b = viewBounds();
    return [(tx - b.x0) * scale, (ty - b.y0) * scale];
  }

  function draw() {
    const b = viewBounds();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // terrain background with subtle checker
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#cfe3b8' : '#c6dcab';
      ctx.fillRect((x) * scale, (y) * scale, scale, scale);
    }
    // grid
    ctx.strokeStyle = 'rgba(0,0,0,.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= b.w; x++) { ctx.beginPath(); ctx.moveTo(x*scale,0); ctx.lineTo(x*scale,b.h*scale); ctx.stroke(); }
    for (let y = 0; y <= b.h; y++) { ctx.beginPath(); ctx.moveTo(0,y*scale); ctx.lineTo(b.w*scale,y*scale); ctx.stroke(); }
    // villages
    if (cache) for (const v of cache.villages) {
      const [px, py] = [(v.x - b.x0) * scale, (v.y - b.y0) * scale];
      let color = COLORS.other;
      if (!v.user_id) color = COLORS.barb;
      else if (v.ownerName === window.MY_NAME) color = COLORS.own;
      ctx.fillStyle = color;
      const s = scale * 0.7;
      // little house shape
      ctx.beginPath();
      ctx.moveTo(px + s/2, py + s*0.1);
      ctx.lineTo(px + s*0.9, py + s*0.45);
      ctx.lineTo(px + s*0.75, py + s*0.45);
      ctx.lineTo(px + s*0.75, py + s*0.9);
      ctx.lineTo(px + s*0.25, py + s*0.9);
      ctx.lineTo(px + s*0.25, py + s*0.45);
      ctx.lineTo(px + s*0.1, py + s*0.45);
      ctx.closePath();
      ctx.fill();
      if (v.is_capital) { ctx.fillStyle = '#fff'; ctx.font = `${Math.max(9, scale*0.4)}px serif`; ctx.fillText('★', px + s*0.3, py + s*0.4); }
    }
  }

  // get MY_NAME from resource bar village owner? Use username from account box
  const acc = document.querySelector('.acc-name');
  window.MY_NAME = acc ? acc.textContent.trim() : '';

  // interactions
  let dragging = false, lastX = 0, lastY = 0, moved = 0;
  canvas.addEventListener('mousedown', e => { dragging = true; moved = 0; lastX = e.offsetX; lastY = e.offsetY; });
  window.addEventListener('mouseup', () => dragging = false);
  canvas.addEventListener('mousemove', e => {
    if (dragging) {
      const dx = e.offsetX - lastX, dy = e.offsetY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      camX -= dx / scale; camY -= dy / scale;
      lastX = e.offsetX; lastY = e.offsetY;
      clampCam(); load();
      tip.classList.add('hidden');
      return;
    }
    // hover tooltip
    const b = viewBounds();
    const tx = b.x0 + Math.floor(e.offsetX / scale), ty = b.y0 + Math.floor(e.offsetY / scale);
    const v = cache && cache.villages.find(v => v.x === tx && v.y === ty);
    if (v) {
      tip.classList.remove('hidden');
      tip.style.left = (e.offsetX + 12) + 'px'; tip.style.top = (e.offsetY + 12) + 'px';
      const act = v.user_id ? `<a class="btn btn-small" href="/game/attack/${cfg.homeVillageId}?x=${v.x}&y=${v.y}">Attack</a>` :
        `<a class="btn btn-small btn-gold" href="/game/attack/${cfg.homeVillageId}?x=${v.x}&y=${v.y}">Attack/Settle</a>`;
      tip.innerHTML = `<b>${v.name}</b><br>(${v.x}|${v.y}) · ${v.ownerName}<br>${act}`;
    } else tip.classList.add('hidden');
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    scale = Math.max(8, Math.min(64, scale * (e.deltaY < 0 ? 1.15 : 0.87)));
    document.getElementById('zoom').value = Math.round(scale);
    load();
  }, { passive: false });
  document.getElementById('zoom').addEventListener('input', e => { scale = Number(e.target.value); load(); });
  document.getElementById('goBtn').addEventListener('click', () => {
    camX = Number(document.getElementById('gox').value) || 0;
    camY = Number(document.getElementById('goy').value) || 0;
    clampCam(); load();
  });
  function clampCam() { camX = Math.max(0, Math.min(cfg.mapW, camX)); camY = Math.max(0, Math.min(cfg.mapH, camY)); }

  function resize() {
    const wrap = document.getElementById('mapwrap');
    canvas.width = Math.min(1000, wrap.clientWidth);
    canvas.height = 560;
    load();
  }
  window.addEventListener('resize', resize);
  resize();
})();
