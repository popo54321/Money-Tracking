/* Queen Bee theme for the calculator: words, colours and the 30 levels with their pictures. */
(function () {
  var O = '#4A1838', P = '#FF5FA8', HP = '#E3368A', LP = '#FFD1E7', GD = '#FFD25E', LI = '#E7D6FF', W = '#FFFFFF';
  var st = 'stroke="' + O + '" stroke-width="2" stroke-linejoin="round"';
  var G = '<ellipse cx="32" cy="58" rx="18" ry="3" fill="' + O + '" opacity=".13"/>';
  var spark = function (x, y, r, c) {
    var a = +(r * 0.3).toFixed(2), b = +(r * 0.7).toFixed(2);
    return '<path d="M' + x + ' ' + (y - r) + 'l' + a + ' ' + b + ' ' + b + ' ' + a + ' ' + -b + ' ' + a + ' ' + -a + ' ' + b + ' ' + -a + ' ' + -b + ' ' + -b + ' ' + -a + ' ' + b + ' ' + -a + 'z" fill="' + (c || GD) + '"/>';
  };
  var heart = function (x, y, s, c) {
    return '<path d="M' + x + ' ' + (y + 5 * s) + 'c' + -7 * s + ' ' + -5 * s + ' ' + -8 * s + ' ' + -11 * s + ' ' + -4 * s + ' ' + -13 * s + 'c' + 2 * s + ' ' + -1 * s + ' ' + 4 * s + ' 0 ' + 4 * s + ' ' + 2 * s + 'c0 ' + -2 * s + ' ' + 2 * s + ' ' + -3 * s + ' ' + 4 * s + ' ' + -2 * s + 'c' + 4 * s + ' ' + 2 * s + ' ' + 3 * s + ' ' + 8 * s + ' ' + -4 * s + ' ' + 13 * s + 'z" fill="' + (c || P) + '" ' + st + '/>';
  };
  var crown = function (x, y, s, tilt) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (tilt || 0) + ') scale(' + s + ')"><path d="M-14 6l-2-14 8 7 8-11 8 11 8-7-2 14z" fill="' + GD + '" stroke="#9A6A00" stroke-width="2" stroke-linejoin="round"/><circle cy="-1" r="2" fill="' + HP + '"/><circle cx="-8" cy="1" r="1.5" fill="' + W + '"/><circle cx="8" cy="1" r="1.5" fill="' + W + '"/></g>';
  };
  var phone = function (x, y, inner) {
    return '<rect x="' + (x - 10) + '" y="' + (y - 17) + '" width="20" height="34" rx="4" fill="' + O + '"/><rect x="' + (x - 8) + '" y="' + (y - 14) + '" width="16" height="27" rx="2" fill="' + LP + '"/>' + (inner || '');
  };
  var bee = function (x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><ellipse cx="-7" cy="-9" rx="7" ry="5" fill="' + W + '" ' + st + ' opacity=".9"/><ellipse cx="7" cy="-9" rx="7" ry="5" fill="' + W + '" ' + st + ' opacity=".9"/><ellipse rx="12" ry="9" fill="' + GD + '" ' + st + '/><path d="M-4-8.5v17M4-8.5v17" stroke="' + O + '" stroke-width="3.5"/><circle cx="-6" cy="-1" r="1.5" fill="' + O + '"/><path d="M8 1l6 2" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/></g>';
  };

  MMA.applyTheme({
    tiers: ['#FFE0EF', '#FFF0C7', '#F1E2FF', '#FFD6E8'], godBg: '#FFE58A', labourBg: '#F0E4EA',
    words: {
      your: 'your era',
      text: {
        'adv.h': 'Your era', 'adv.next': 'Next glow-ups', 'adv.all': 'See all 30 eras',
        'adv.unknown': 'Your era awaits', 'adv.tap': 'Tap any era to read about it.',
        'adv.needAll': 'Answer every question in the Calculator to find your era. {n} to go, starting with: {item}',
        'share.text': 'I’m in my Level {n} {name} era!', 'share.title': 'Share your era',
        sub: 'Every icon starts somewhere. Find out if your money will last the whole way, how healthy your everyday money is, and which era you’re in today.',
        'calc.detail': '“See my result” shows your era and levels. The details show the maths behind it, starting with what happens after you retire.',
        'det.end': 'That’s the maths. Your era and levels are on the Result tab.',
        'quest.ret': 'Retirement glow-up', 'quest.health': 'Money glow-up', 'quest.final': 'Final glow-up'
      }
    },
    levels: [
      ['The Forever Intern', 'Works the front desk to the very last day. Plan for when you’d rather clock out for good.',
        G + '<path d="M14 26h22l-2 26a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" fill="' + W + '" ' + st + '/><path d="M15 34h20" stroke="' + P + '" stroke-width="4"/><path d="M20 22q2-6 0-10M28 22q2-6 0-10" fill="none" stroke="' + LP + '" stroke-width="2" stroke-linecap="round"/><path d="M44 10l4 18" stroke="' + HP + '" stroke-width="2"/><rect x="40" y="28" width="14" height="18" rx="2" fill="' + LP + '" ' + st + '/><circle cx="47" cy="34" r="3" fill="' + P + '"/><path d="M43 41h8" stroke="' + O + '" stroke-width="1.6"/>'],
      ['New Girl, No Map', 'First day, no friends, no plan. Find your footing today first.',
        G + '<rect x="16" y="20" width="28" height="34" rx="8" fill="' + P + '" ' + st + '/><path d="M24 20q6-10 12 0" fill="none" ' + st + '/><rect x="21" y="36" width="18" height="12" rx="3" fill="' + LP + '" ' + st + '/><text x="44" y="18" font-size="16" font-weight="900" fill="' + HP + '" font-family="sans-serif">?</text>'],
      ['Borrowed-Outfit Babe', 'Trying so hard, but the purse is empty and there’s no plan.',
        '<path d="M32 8a3 3 0 1 1 3 3l-3 3" fill="none" ' + st + '/><path d="M32 14L12 24h40z" fill="none" ' + st + '/><path d="M26 24l-8 30h28l-8-30z" fill="' + P + '" ' + st + '/><path d="M26 24q6 6 12 0" fill="none" stroke="' + W + '" stroke-width="2"/><path d="M44 36l8 4-3 6-8-4z" fill="' + GD + '" ' + st + '/><circle cx="46" cy="38" r="1" fill="' + O + '"/>'],
      ['Coupon Clipper', 'Just scraping by, owes a few friends and has nothing saved.',
        G + '<rect x="8" y="22" width="34" height="22" rx="3" fill="' + LP + '" stroke="' + O + '" stroke-width="2" stroke-dasharray="4 3"/><text x="25" y="38" font-size="11" font-weight="900" fill="' + HP + '" text-anchor="middle" font-family="sans-serif">-10%</text><circle cx="48" cy="40" r="5" fill="none" ' + st + '/><circle cx="54" cy="30" r="5" fill="none" ' + st + '/><path d="M44 36l14-16M52 34l-14-8" stroke="' + O + '" stroke-width="2.2" stroke-linecap="round"/>'],
      ['Side-Hustle Hopeful', 'Lives on gigs and charm, with nothing put away for later.',
        G + phone(30, 34, '<text x="30" y="38" font-size="13" font-weight="900" fill="' + HP + '" text-anchor="middle" font-family="sans-serif">$</text>') + spark(48, 16, 5) + spark(14, 18, 3.5, P) + spark(50, 40, 3)],
      ['Café Regular', 'Little to worry about today, but nothing saved for later life.',
        G + '<path d="M20 22h24l-3 32H23z" fill="' + W + '" fill-opacity=".85" ' + st + '/><path d="M21 32h22l-2 20H23z" fill="#C98B5E"/><path d="M18 22h28" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/><path d="M34 22l6-14" stroke="' + P + '" stroke-width="3" stroke-linecap="round"/>' + heart(32, 40, 0.5, W)],
      ['Selfie Enthusiast', 'Living for today’s post, with nothing planned for tomorrow.',
        G + phone(32, 34, '<circle cx="32" cy="30" r="5" fill="' + P + '"/><path d="M24 44a8 6 0 0 1 16 0z" fill="' + P + '"/>') + heart(50, 16, 0.6) + heart(14, 22, 0.45, HP)],
      ['Shopaholic Socialite', 'A party every weekend, but the money won’t last.',
        G + '<rect x="8" y="28" width="22" height="26" rx="2" fill="' + P + '" ' + st + '/><path d="M14 28q5-10 10 0" fill="none" ' + st + '/><rect x="26" y="22" width="22" height="32" rx="2" fill="' + GD + '" ' + st + '/><path d="M32 22q5-10 10 0" fill="none" ' + st + '/><rect x="40" y="34" width="16" height="20" rx="2" fill="' + LI + '" ' + st + '/><path d="M44 34q4-7 8 0" fill="none" ' + st + '/>' + heart(37, 38, 0.45, W)],
      ['Fashion Emergency', 'Today’s look is a disaster; fix it and you can still make the party.',
        G + '<path d="M10 48q12-2 20-16l6-6q4 2 4 8l-4 18H12a2 2 0 0 1-2-4z" fill="' + P + '" ' + st + '/><path d="M40 34l6 20" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/><path d="M48 18l-4 6 5 1-3 6" fill="none" stroke="' + HP + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 44l6 6" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/>'],
      ['Drama Magnet', 'Still in the game, but trouble keeps finding you.',
        '<path d="M8 14h40a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H26l-10 10v-10h-8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z" fill="' + LP + '" ' + st + '/><path d="M30 18l-8 12h7l-4 10 12-14h-7l4-8z" fill="' + GD + '" ' + st + '/>' + spark(54, 10, 4, P)],
      ['Overbooked Bestie', 'Too many plans at once; drop a few and it works.',
        G + '<rect x="10" y="14" width="44" height="40" rx="5" fill="' + W + '" ' + st + '/><rect x="10" y="14" width="44" height="10" rx="5" fill="' + P + '" ' + st + '/><path d="M20 10v8M44 10v8" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/>' + heart(20, 32, 0.35) + heart(32, 32, 0.35, HP) + heart(44, 32, 0.35) + heart(20, 44, 0.35, HP) + heart(32, 44, 0.35) + heart(44, 44, 0.35, HP)],
      ['Junior It-Girl', 'Nearly there, but today is still a little tight.',
        G + crown(32, 18, 0.7) + '<path d="M18 40l10 5-10 5zM46 40l-10 5 10 5z" fill="' + P + '" ' + st + '/><circle cx="32" cy="45" r="4" fill="' + HP + '" ' + st + '/>'],
      ['Boutique Hustler', 'Sells well, but the purse has a few small holes.',
        G + '<path d="M22 24q10-14 20 0" fill="none" stroke="' + O + '" stroke-width="3"/><path d="M12 26h40l-4 26H16z" fill="' + P + '" ' + st + '/><circle cx="22" cy="40" r="2" fill="' + O + '"/><circle cx="40" cy="46" r="2" fill="' + O + '"/><circle cx="24" cy="58" r="3" fill="' + GD + '" stroke="#9A6A00" stroke-width="1.4"/><circle cx="40" cy="60" r="2.5" fill="' + GD + '" stroke="#9A6A00" stroke-width="1.4"/><path d="M28 32h8v6h-8z" fill="' + GD + '"/>'],
      ['Dethroned Queen', 'The crown is still yours if you survive this rough patch. Steady today first.',
        G + crown(36, 48, 0.95, 28) + '<path d="M10 22q6-6 12 0M16 14q4-4 8 0" fill="none" stroke="' + HP + '" stroke-width="2" stroke-linecap="round"/>' + spark(50, 14, 4)],
      ['Glow-Up in Progress', 'Hard work now, but the glow-up is guaranteed.',
        G + '<ellipse cx="32" cy="28" rx="16" ry="20" fill="' + LI + '" stroke="' + GD + '" stroke-width="4"/><path d="M24 22q4-6 8-6" fill="none" stroke="' + W + '" stroke-width="3" stroke-linecap="round"/><path d="M32 48v8M24 56h16" stroke="' + GD + '" stroke-width="4" stroke-linecap="round"/>' + spark(52, 14, 5) + spark(12, 20, 4, P) + spark(50, 40, 3, HP)],
      ['Stressed Event Planner', 'The big plan is set, but several things are on fire today.',
        G + '<rect x="14" y="14" width="30" height="40" rx="3" fill="' + W + '" ' + st + '/><rect x="22" y="10" width="14" height="8" rx="2" fill="' + P + '" ' + st + '/><path d="M20 28h18M20 36h18M20 44h12" stroke="' + LP + '" stroke-width="3" stroke-linecap="round"/><path d="M46 30c-4 6 2 10 4 14 4-4 4-10 0-16 0 4-2 4-4 2z" fill="#FF8A3D" ' + st + '/><path d="M48 44c-1-3 1-5 2-6 1 2 2 4 0 6z" fill="' + GD + '"/>'],
      ['Trendsetter on Thin Ice', 'Looks steady, but one long bad season could knock you off the list.',
        '<path d="M6 46h52l-4 10H10z" fill="#D9F2FF" ' + st + '/><path d="M24 46l4 4-3 4M40 46l-3 5 4 3" fill="none" stroke="' + O + '" stroke-width="1.6"/><path d="M12 26h40l-2 8a8 8 0 0 1-8 6h-2a8 8 0 0 1-8-8 8 8 0 0 1-8 8h-2a8 8 0 0 1-8-6z" fill="' + O + '"/><path d="M14 30l6 4M38 30l6 4" stroke="' + P + '" stroke-width="2" stroke-linecap="round"/>' + spark(54, 14, 4)],
      ['Popular but Underfunded', 'Everyone loves you today; the savings need a bit more glam.',
        G + '<ellipse cx="32" cy="40" rx="20" ry="14" fill="' + LP + '" ' + st + '/><circle cx="44" cy="36" r="2" fill="' + O + '"/><path d="M50 40h4" stroke="' + O + '" stroke-width="2.5" stroke-linecap="round"/><path d="M18 52v4M42 52v4" stroke="' + O + '" stroke-width="4" stroke-linecap="round"/><rect x="28" y="26" width="10" height="3" rx="1.5" fill="' + O + '"/>' + heart(18, 16, 0.55) + heart(32, 10, 0.4, HP) + heart(46, 16, 0.5)],
      ['Low-Key Classy', 'Simple style and little spare, but quietly secure.',
        '<path d="M12 16q20 40 40 0" fill="none" stroke="' + LP + '" stroke-width="1.5"/>' + [[14, 20], [17, 28], [21, 35], [26, 40], [32, 42], [38, 40], [43, 35], [47, 28], [50, 20]].map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="4" fill="' + W + '" stroke="#C9B6C2" stroke-width="1.5"/>'; }).join('') + '<circle cx="32" cy="50" r="6" fill="' + W + '" stroke="#C9B6C2" stroke-width="1.6"/><circle cx="30" cy="48" r="1.6" fill="' + W + '" opacity=".9"/>'],
      ['Honour-Roll Queen', 'Smart and prepared, with a few loose ends.',
        G + '<path d="M6 26l26-12 26 12-26 12z" fill="' + O + '"/><path d="M16 31v12q16 10 32 0V31l-16 7z" fill="' + O + '"/><path d="M50 28v14" stroke="' + GD + '" stroke-width="2.5"/><circle cx="50" cy="44" r="3" fill="' + GD + '"/><path d="M26 22l6 4 6-4-6-2z" fill="' + P + '"/>'],
      ['Heiress with a Leak', 'The trust fund is safe, but someone’s raiding the closet. Deal with it first.',
        G + '<path d="M18 22h28l8 10-22 22-22-22z" fill="#CFF3FF" ' + st + '/><path d="M18 22l6 10h16l6-10M10 32h44M24 32l8 22 8-22" fill="none" stroke="' + O + '" stroke-width="1.6"/><path d="M50 44c3 4 3 7 0 8-3-1-3-4 0-8z" fill="#7FD3F5" ' + st + '/>' + spark(14, 12, 4)],
      ['Cursed Diva', 'Iconic, with the safest future, but one dangerous problem. Fix it first.',
        G + '<rect x="24" y="30" width="16" height="24" rx="3" fill="' + GD + '" ' + st + '/><rect x="26" y="20" width="12" height="12" fill="' + O + '"/><path d="M26 20l2-10q4-4 8 0l2 10z" fill="' + HP + '" ' + st + '/><path d="M44 16a6 6 0 1 1 6 6 3 3 0 1 1-3-3" fill="none" stroke="#8B5CF6" stroke-width="2.5" stroke-linecap="round"/><path d="M14 24a5 5 0 1 0 5-5" fill="none" stroke="#8B5CF6" stroke-width="2.2" stroke-linecap="round"/>'],
      ['Quiet-Luxury Saver', 'Patient through a tight patch; the future is certainly safe.',
        G + '<path d="M22 24q10-12 20 0" fill="none" stroke="#8A6A4E" stroke-width="3"/><rect x="12" y="24" width="40" height="30" rx="6" fill="#E9D8C2" stroke="#8A6A4E" stroke-width="2"/><path d="M12 34h40" stroke="#8A6A4E" stroke-width="1.6"/><rect x="28" y="31" width="8" height="8" rx="2" fill="' + GD + '" stroke="#9A6A00" stroke-width="1.5"/>'],
      ['Student Council President', 'Organised: the future is safe and today is in order.',
        G + '<circle cx="32" cy="26" r="16" fill="' + P + '" ' + st + '/><circle cx="32" cy="26" r="10" fill="' + W + '" ' + st + '/><path d="M24 40l-6 16 8-4 4 6 2-18M40 40l6 16-8-4-4 6-2-18" fill="' + HP + '" ' + st + '/>' + spark(32, 26, 6)],
      ['Prom Queen', 'Strong today, safe tomorrow; only a huge storm could knock the crown off.',
        G + crown(32, 20, 1) + '<circle cx="32" cy="44" r="8" fill="' + HP + '" ' + st + '/><path d="M28 42q4-4 8 0q-4 4-8 0" fill="none" stroke="' + W + '" stroke-width="1.6"/><path d="M32 52v6M26 54l6-2 6 2" stroke="#3E8E5A" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Loyal Best Friend', 'Honest hard work keeps the future safe, but there’s just enough for now.',
        '<circle cx="32" cy="32" r="20" fill="none" stroke="' + O + '" stroke-width="2" stroke-dasharray="1 0"/>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (a, i) { var r = a * Math.PI / 180; return '<circle cx="' + (32 + 20 * Math.cos(r)).toFixed(1) + '" cy="' + (32 + 20 * Math.sin(r)).toFixed(1) + '" r="5" fill="' + [P, GD, LI, LP][i % 4] + '" ' + st + '/>'; }).join('') + heart(32, 30, 0.7, HP)],
      ['Captain of the Squad', 'Ready for anything, with a few gaps to mend.',
        G + '<path d="M12 28l26-12v32L12 36z" fill="' + P + '" ' + st + '/><rect x="6" y="26" width="8" height="12" rx="2" fill="' + HP + '" ' + st + '/><path d="M20 38l4 14h6l-2-12" fill="' + LP + '" ' + st + '/><path d="M44 22l8-4M46 32h8M44 42l8 4" stroke="' + GD + '" stroke-width="3" stroke-linecap="round"/>' + spark(30, 30, 4, W)],
      ['The Mastermind', 'Always three moves ahead: today is in order and the future weathers any storm.',
        G + '<path d="M20 54h24l-3-6H23z" fill="' + O + '"/><path d="M24 48l-2-20h20l-2 20z" fill="' + HP + '" ' + st + '/><path d="M20 28l2-12 5 6 5-10 5 10 5-6 2 12z" fill="' + GD + '" ' + st + '/><circle cx="32" cy="10" r="3" fill="' + P + '" ' + st + '/>'],
      ['The Queen Bee', 'Nothing to worry about, today or tomorrow.',
        bee(32, 38, 1.5) + crown(30, 16, 0.7) + spark(54, 12, 4) + spark(10, 20, 3, P)],
      ['The Icon', 'Legendary. The money grows forever, even at five times the spending.',
        '<path d="M32 4l7 17 18 1-14 11 5 18-16-10-16 10 5-18L7 22l18-1z" fill="' + GD + '" stroke="#9A6A00" stroke-width="2" stroke-linejoin="round"/><path d="M32 16l3 8 8 .5-6 5 2 8-7-4.5-7 4.5 2-8-6-5 8-.5z" fill="' + P + '"/>' + spark(10, 50, 4, P) + spark(54, 50, 4, HP) + spark(32, 58, 3)]
    ]
  });
})();
