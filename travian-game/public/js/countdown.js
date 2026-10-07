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
  }
  tick();
  setInterval(tick, 1000);
})();
