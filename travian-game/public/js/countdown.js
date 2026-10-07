// Live countdowns and duration formatting for Travian Universe
(function () {
  function fmtDur(ms) {
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = n => String(n).padStart(2, '0');
    return `${p(h)}:${p(m)}:${p(sec)}`;
  }
  function tick() {
    document.querySelectorAll('.countdown').forEach(el => {
      const target = Number(el.dataset.target);
      const left = target - Date.now();
      el.textContent = left <= 0 ? 'now!' : fmtDur(left);
      el.classList.toggle('done', left <= 0);
    });
    document.querySelectorAll('.dur').forEach(el => {
      if (!el.dataset.rendered) { el.textContent = fmtDur(Number(el.dataset.ms)); el.dataset.rendered = '1'; }
    });
    // live progress bars for constructions/upgrades
    let anyDone = false;
    document.querySelectorAll('.bprogress > div[data-start]').forEach(bar => {
      const start = Number(bar.dataset.start), end = Number(bar.dataset.end);
      const now = Date.now();
      const pct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
      bar.style.width = pct + '%';
      if (now >= end) {
        anyDone = true;
        const cell = bar.closest('.bcell');
        if (cell && !cell.classList.contains('done')) { cell.classList.add('done'); }
      }
    });
    // auto-refresh once when a construction finishes (page is dynamic server-side)
    if (anyDone && !window.__refreshed) { window.__refreshed = true; setTimeout(() => location.reload(), 4000); }
  }
  tick();
  setInterval(tick, 1000);
})();
