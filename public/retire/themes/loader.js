/* Picks the theme the app is using (?skin=…) and loads its names, words and pictures (themes/<skin>.js)
   before the calculator starts. Without ?skin the calculator keeps its original look and adventurers. */
(function () {
  // the 30 levels in order (level 0 to 29), as app.js names them
  var KEYS = ['labour', 'wanderer', 'smith', 'miner', 'rat', 'innkeeper', 'bard', 'lord', 'pirate', 'hedge', 'mercenary',
    'squire', 'merchant', 'prince', 'pilgrim', 'alchemist', 'ranger', 'knight', 'druid', 'sage', 'dragon', 'sorcerer', 'monk',
    'priest', 'king', 'steward', 'general', 'archmage', 'emperor', 'god'];
  // a theme file calls this with its colours, words and its 30 levels: [name, description, picture (inside a 64×64 svg)]
  window.MMA.applyTheme = function (th) {
    var t = window.MMA.i18n.en, icons = window.MMA.icons;
    var set = function (k, v) { t[k] = v; if (t[k + '.f'] !== undefined) t[k + '.f'] = v; };
    th.levels.forEach(function (lv, i) {
      set('rk.' + KEYS[i], lv[0]);
      set('rk.' + KEYS[i] + '.d', lv[1]);
      icons[KEYS[i]] = '<svg viewBox="0 0 64 64" aria-hidden="true">' + lv[2] + '</svg>';
    });
    var god = th.levels[29][0], top = th.levels[28][0], zero = th.levels[0][0], w = th.words;
    Object.keys(w.text).forEach(function (k) { set(k, w.text[k]); });
    set('quest.godTop', 'You’ve reached the very top. There’s nothing above ' + god + '.');
    set('adv.comboGod', top + ', plus every check Healthy and a pot that never shrinks, even at 5 times the spending.');
    set('m.p10', 'You meet ' + w.your + ' once every question is answered. ' + god + ', level 29, needs ' + top +
      ' first, every check on the Result tab Healthy, and a pot that, with steady growth, never gets smaller in any month of ' +
      'retirement even if you spent 5 times as much, up to 120 and forever after. Ticking “I’ll retire when I die” makes you ' +
      'Level 0, ' + zero + ', whatever else you answer.');
    window.MMA.theme = { tiers: th.tiers, godBg: th.godBg, labourBg: th.labourBg };
  };
  var SKINS = ['financial', 'queenbee', 'fantasy', 'dino', 'wildlife', 'space'];
  var q = new URLSearchParams(location.search);
  var skin = q.get('skin');
  if (q.get('look')) document.documentElement.setAttribute('data-in-app', '');
  if (SKINS.indexOf(skin) < 0) return;
  document.documentElement.setAttribute('data-skin', skin);
  // a classic script written here runs before app.js, which comes next in the page
  document.write('<script src="themes/' + skin + '.js"><\/script>');
  // the level picture pops whenever the level changes
  document.addEventListener('DOMContentLoaded', function () {
    // the leaf at the top becomes the theme's own picture (its level 28)
    var sprout = document.querySelector('.hero svg.sprout'), top = window.MMA.icons && window.MMA.icons.emperor;
    if (sprout && top) {
      sprout.innerHTML = '<circle cx="32" cy="32" r="30" fill="var(--keep-soft)"/><g transform="translate(9 9) scale(.72)">' +
        top.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') + '</g>';
    }
    var name = document.getElementById('rpgName');
    if (!name || !window.MutationObserver) return;
    var last = name.textContent;
    new MutationObserver(function () {
      if (name.textContent === last) return;
      last = name.textContent;
      var icon = document.querySelector('.rpgicon');
      if (!icon) return;
      icon.classList.remove('th-pop');
      void icon.offsetWidth;
      icon.classList.add('th-pop');
    }).observe(name, { childList: true, characterData: true, subtree: true });
  });
})();
