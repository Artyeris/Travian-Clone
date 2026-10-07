// SVG icon sprite loader — fetches /img/icons.svg once and injects it into the DOM
// so that <svg class="ic"><use href="#ic-wood"/></svg> works in all browsers.
(function () {
  function useIcons() {
    document.querySelectorAll('svg[data-icon]').forEach(function (svg) {
      var id = svg.getAttribute('data-icon');
      if (!svg.querySelector('use')) {
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#' + id);
        svg.appendChild(use);
      }
    });
  }

  function boot() {
    if (!document.querySelector('svg[data-icon]')) return; // no icons on this page
    fetch('/img/icons.svg')
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var div = document.createElement('div');
        div.style.display = 'none';
        div.innerHTML = txt;
        document.body.insertBefore(div, document.body.firstChild);
        useIcons();
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
