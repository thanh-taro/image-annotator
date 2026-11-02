// MOD-Host — the inline boot script (ADR-0010, ADR-0015 §1). Copied from DAFV and adapted.
// Implements: RULE-16 (initial theme from the address), RULE-17 (language: address → browser → en-US),
// F-015.R1/R2 and F-018.R1 before first paint; the matching mirrors src/host/language.ts.
// Inlined into <head> by vite.config.ts and allowed by its CSP hash (scripts/gen-headers.mjs).
// Classic script, no imports. Comment-only lines are stripped before hashing and inlining.
(function () {
  var q = null;
  try {
    q = new URLSearchParams(location.search);
  } catch (e) {}
  var t = q && q.get('theme');
  if (t !== 'light' && t !== 'dark') {
    t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', t);
  var supported = ['en-US', 'vi-VN'];
  var match = function (v) {
    if (typeof v !== 'string' || !v.trim()) return null;
    v = v.trim().toLowerCase();
    for (var i = 0; i < supported.length; i++) if (supported[i].toLowerCase() === v) return supported[i];
    var p = v.split(/[-_]/)[0];
    for (var j = 0; j < supported.length; j++) if (supported[j].toLowerCase().split('-')[0] === p) return supported[j];
    return null;
  };
  var l = null;
  try {
    l = match(q && q.get('lang'));
    var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var k = 0; !l && k < prefs.length; k++) l = match(prefs[k]);
  } catch (e) {}
  document.documentElement.setAttribute('lang', l || supported[0]);
})();
