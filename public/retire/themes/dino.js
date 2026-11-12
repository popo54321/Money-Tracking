/* Dinosaur theme for the calculator: words, colours and the 30 levels with their pictures. */
(function () {
  var O = '#26392B', B = '#5FBF93', BD = '#3F9A70', OR = '#F2A65A', SD = '#E9D8A6', ST = '#A9A39A', EG = '#FFF1C4', LV = '#FF7043', LF = '#6DBB7A', WA = '#7FB8E6', GD = '#F5D36B', W = '#FFFFFF';
  var st = 'stroke="' + O + '" stroke-width="2" stroke-linejoin="round"';
  var G = '<ellipse cx="32" cy="58" rx="18" ry="3" fill="' + O + '" opacity=".13"/>';
  var spark = function (x, y, r, c) {
    var a = +(r * 0.3).toFixed(2), b = +(r * 0.7).toFixed(2);
    return '<path d="M' + x + ' ' + (y - r) + 'l' + a + ' ' + b + ' ' + b + ' ' + a + ' ' + -b + ' ' + a + ' ' + -a + ' ' + b + ' ' + -a + ' ' + -b + ' ' + -b + ' ' + -a + ' ' + b + ' ' + -a + 'z" fill="' + (c || GD) + '"/>';
  };
  var at = function (x, y, s, body, flip) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')">' + body + '</g>'; };
  var eye = function (x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="1.8" fill="' + O + '"/><circle cx="' + (x + 0.6) + '" cy="' + (y - 0.6) + '" r=".6" fill="' + W + '"/>'; };
  // a chubby dino facing right, about 40 wide, standing on y=0
  var chubby = function (c) {
    return '<path d="M-20-6q-6 0-8 4 6 2 10-1z" fill="' + (c || B) + '" ' + st + '/><ellipse cx="-4" cy="-10" rx="16" ry="11" fill="' + (c || B) + '" ' + st + '/><ellipse cx="12" cy="-22" rx="9" ry="8" fill="' + (c || B) + '" ' + st + '/><path d="M-12-2v4M2-1v3" stroke="' + O + '" stroke-width="4" stroke-linecap="round"/>' + eye(15, -24) + '<path d="M16-18q3 1 4-1" fill="none" stroke="' + O + '" stroke-width="1.5" stroke-linecap="round"/>';
  };
  var longneck = function (c) {
    return '<path d="M-22-10q-10 2-12 8 8 0 14-4z" fill="' + (c || B) + '" ' + st + '/><ellipse cx="-8" cy="-12" rx="16" ry="10" fill="' + (c || B) + '" ' + st + '/><path d="M4-16q8-14 8-28h8q0 18-10 32z" fill="' + (c || B) + '" ' + st + '/><ellipse cx="18" cy="-46" rx="7" ry="5" fill="' + (c || B) + '" ' + st + '/><path d="M-16-3v5M-2-3v5" stroke="' + O + '" stroke-width="4.5" stroke-linecap="round"/>' + eye(20, -47);
  };
  var trex = function (c) {
    return '<path d="M-20-12q-12 2-14 10 10-2 16-6z" fill="' + (c || B) + '" ' + st + '/><ellipse cx="-6" cy="-14" rx="13" ry="11" fill="' + (c || B) + '" ' + st + '/><path d="M2-22q2-12 14-12 10 0 10 8v6H10q-4 4-8 2z" fill="' + (c || B) + '" ' + st + '/><path d="M12-20h12" stroke="' + O + '" stroke-width="1.5"/><path d="M14-20l1 2 1-2 1 2 1-2 1 2" fill="none" stroke="' + W + '" stroke-width="1"/><path d="M4-12l5 2" stroke="' + O + '" stroke-width="2.5" stroke-linecap="round"/><path d="M-10-4v6M0-4v6" stroke="' + O + '" stroke-width="4.5" stroke-linecap="round"/>' + eye(17, -28);
  };
  var trike = function (c) {
    return '<path d="M-20-6q-6 0-8 4 6 2 10-1z" fill="' + (c || B) + '" ' + st + '/><ellipse cx="-4" cy="-10" rx="15" ry="10" fill="' + (c || B) + '" ' + st + '/><path d="M6-26q10-4 12 4l-2 8H6z" fill="' + OR + '" ' + st + '/><ellipse cx="14" cy="-14" rx="8" ry="7" fill="' + (c || B) + '" ' + st + '/><path d="M18-20l8-6M14-22l4-8M22-12l6-1" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/><path d="M-12-2v4M2-2v4" stroke="' + O + '" stroke-width="4" stroke-linecap="round"/>' + eye(15, -16);
  };
  var egg = function (x, y, s, c) { return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + 6 * s + '" ry="' + 8 * s + '" fill="' + (c || EG) + '" ' + st + '/>'; };
  var nest = '<path d="M10 46q22 16 44 0" fill="#C9A06A" ' + st + '/><path d="M12 46q20 6 40 0M14 50l10-4M28 52l10-5M42 50l-8-4" fill="none" stroke="#8A5E36" stroke-width="1.6"/>';
  var crown = function (x, y, s) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-12 5l-2-12 7 6 7-10 7 10 7-6-2 12z" fill="' + GD + '" stroke="#86690B" stroke-width="2" stroke-linejoin="round"/><circle r="1.8" fill="' + LV + '"/></g>'; };

  MMA.applyTheme({
    tiers: ['#DDF3E5', '#FFEFCB', '#E3EEDD', '#FFE3D2'], godBg: '#FFE9A8', labourBg: '#ECE4D6',
    words: {
      your: 'your dino',
      text: {
        'adv.h': 'Your dino', 'adv.next': 'Next stomps', 'adv.all': 'See all 30 dinos',
        'adv.unknown': 'Your dino is about to hatch', 'adv.tap': 'Tap any dino to read about it.',
        'adv.needAll': 'Answer every question in the Calculator to hatch your dino. {n} to go, starting with: {item}',
        'share.text': 'I’m a Level {n} {name} on my prehistoric money trek!', 'share.title': 'Share your dino',
        sub: 'Every dino starts as a hatchling. Find out if your food store will last the whole trek, how healthy your everyday money is, and which dino you are today.',
        'calc.detail': '“See my result” shows your dino and levels. The details show the maths behind it, starting with what happens after you retire.',
        'det.end': 'That’s the maths. Your dino and levels are on the Result tab.',
        'quest.ret': 'Retirement stomp', 'quest.health': 'Money stomp', 'quest.final': 'Final stomp'
      }
    },
    levels: [
      ['Rock Hauler', 'Hauls rocks to the very last day. Plan for when the legs get tired.',
        G + at(22, 56, 0.85, chubby()) + '<path d="M36 56c-4-14 4-24 14-22s10 14 6 22z" fill="' + ST + '" ' + st + '/><path d="M42 42l4 2M48 50l3-1" stroke="#7E786F" stroke-width="2" stroke-linecap="round"/>'],
      ['Lost Hatchling', 'Just hatched and lost in the jungle. Find safe ground first.',
        G + '<path d="M18 40q0 16 14 16t14-16" fill="' + EG + '" ' + st + '/><path d="M18 40l5-4 4 4 5-4 4 4 5-4 5 4" fill="none" ' + st + '/><ellipse cx="32" cy="30" rx="10" ry="9" fill="' + B + '" ' + st + '/>' + eye(29, 28) + eye(36, 28) + '<path d="M22 22l-4-12 8 8z" fill="' + EG + '" ' + st + '/><text x="44" y="18" font-size="14" font-weight="900" fill="' + BD + '" font-family="sans-serif">?</text>'],
      ['Nest Builder', 'Working hard, but the nest is empty and there’s no plan.',
        G + nest + '<path d="M44 14l-4 18M40 14l6 6" stroke="#8A5E36" stroke-width="3" stroke-linecap="round"/><path d="M14 26q6-6 12 0" fill="none" stroke="' + LF + '" stroke-width="3" stroke-linecap="round"/>'],
      ['Pebble Digger', 'Digs every day for just enough, owes the herd and has nothing stored.',
        G + '<path d="M8 50q24-8 48 0v6H8z" fill="' + SD + '" ' + st + '/><circle cx="18" cy="48" r="3" fill="' + ST + '" ' + st + '/><circle cx="28" cy="46" r="2.5" fill="' + ST + '" ' + st + '/><path d="M40 12l-6 30" stroke="#8A5E36" stroke-width="3.5" stroke-linecap="round"/><path d="M28 14q12-8 22 2" fill="none" stroke="#6E7178" stroke-width="4" stroke-linecap="round"/>'],
      ['Scavenging Raptor', 'Grabs what it can on skill alone, with nothing stored for later.',
        G + at(30, 56, 0.85, trex('#C98B5E')) + '<path d="M44 46l10-4M44 46a2 2 0 1 1-2-2M54 42a2 2 0 1 1 2 2" fill="none" stroke="' + O + '" stroke-width="2"/><rect x="43" y="42" width="12" height="4" rx="2" fill="' + W + '" transform="rotate(-20 49 44)" ' + st + '/>'],
      ['Watering-Hole Host', 'Little to worry about today, but nothing stored for old age.',
        '<ellipse cx="32" cy="48" rx="26" ry="9" fill="' + WA + '" ' + st + '/><path d="M18 48q6-3 12 0M34 50q6-3 12 0" fill="none" stroke="' + W + '" stroke-width="2" stroke-linecap="round"/><path d="M12 40q-2-14 4-24M52 40q2-14-4-24" fill="none" stroke="' + LF + '" stroke-width="3" stroke-linecap="round"/><path d="M16 16q4 2 6 6M48 16q-4 2-6 6" fill="none" stroke="' + LF + '" stroke-width="3" stroke-linecap="round"/><path d="M32 22c4 6 4 10 0 12-4-2-4-6 0-12z" fill="' + WA + '" ' + st + '/>'],
      ['Honking Parasaurolophus', 'Honks happily about today, but hasn’t stored food for the trek.',
        G + '<path d="M16 56V38q0-12 12-14l4-1" fill="none" stroke="' + O + '" stroke-width="2"/><path d="M14 56q0-20 10-26 8-6 16-2l6 4-2 6-8-2q-6 2-8 8v12z" fill="' + B + '" ' + st + '/><path d="M28 26q-8-12-20-14 2 4 10 8z" fill="' + OR + '" ' + st + '/>' + eye(36, 30) + '<path d="M48 26q4 4 0 8M52 22q6 8 0 16" fill="none" stroke="' + BD + '" stroke-width="2.2" stroke-linecap="round"/>'],
      ['Big-Eating Brontosaurus', 'Eats the whole forest every night, but the trees won’t last the winter.',
        at(26, 58, 0.9, longneck()) + '<path d="M50 58V30" stroke="#8A5E36" stroke-width="4"/><circle cx="50" cy="22" r="10" fill="' + LF + '" ' + st + '/><path d="M44 18l4 2" stroke="' + O + '" stroke-width="1.5"/>'],
      ['Stranded Plesiosaur', 'Washed up on the beach. Get back in the water and you can still swim home.',
        '<path d="M4 54q28-10 56 0v6H4z" fill="' + SD + '" ' + st + '/><path d="M38 46q12-6 22 0" fill="none" stroke="' + WA + '" stroke-width="3" stroke-linecap="round"/><ellipse cx="22" cy="46" rx="14" ry="7" fill="#6FB7C9" ' + st + '/><path d="M30 42q8-10 8-24h6q0 16-10 28z" fill="#6FB7C9" ' + st + '/><ellipse cx="42" cy="16" rx="6" ry="4" fill="#6FB7C9" ' + st + '/>' + eye(44, 15) + '<path d="M14 50l-6 4M26 52l2 4" stroke="' + O + '" stroke-width="3" stroke-linecap="round"/>'],
      ['Bruised Stegosaurus', 'A few cracked plates and little food: possible, but risky.',
        G + '<path d="M10 40l5-12 6 8 6-14 7 12 6-12 6 12 5-8 3 12z" fill="' + OR + '" ' + st + '/>' + at(32, 56, 0.95, chubby()) + '<rect x="18" y="40" width="12" height="5" rx="2" fill="' + W + '" ' + st + ' transform="rotate(-15 24 42)"/><path d="M34 22l-2 4 3 1" fill="none" stroke="' + O + '" stroke-width="1.5"/>'],
      ['Weighed-Down Iguanodon', 'Heavy loads; the trek works if some weight comes off.',
        G + at(28, 56, 0.9, chubby('#7CC7A8')) + '<rect x="10" y="20" width="22" height="18" rx="4" fill="#C9A06A" ' + st + '/><rect x="14" y="8" width="16" height="13" rx="3" fill="#D9B27A" ' + st + '/><path d="M10 28h22M14 14h16" stroke="#8A5E36" stroke-width="1.5"/>'],
      ['Young Triceratops', 'Nearly grown and the plan almost works, but today is still tight.',
        G + at(30, 56, 0.85, trike('#8FD1B2')) + spark(50, 14, 3.5) + '<path d="M44 46q6 0 6 6" fill="none" stroke="' + LF + '" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Egg-Trading Oviraptor', 'Trades well, but the basket has a few small holes.',
        G + '<path d="M12 34h40l-5 20H17z" fill="#D9A866" ' + st + '/><path d="M14 42h36M15 48h34" stroke="#8A5E36" stroke-width="1.5"/>' + egg(22, 30, 0.8, '#CDEBF5') + egg(32, 28, 0.9) + egg(42, 30, 0.8, '#FFD6C2') + '<circle cx="26" cy="51" r="1.8" fill="' + O + '"/><circle cx="40" cy="45" r="1.6" fill="' + O + '"/>'],
      ['Exiled Herd Leader', 'Pushed out of the valley for now, but the herd’s land is safe once you get back.',
        '<path d="M2 56L22 18l12 18 8-10 20 30z" fill="#B7C7B0" ' + st + '/><path d="M22 18l-5 10 5-3 5 4z" fill="' + W + '"/>' + at(46, 58, 0.45, chubby()) + '<path d="M8 12q6-4 12 0" fill="none" stroke="' + ST + '" stroke-width="2" stroke-linecap="round"/>'],
      ['Long-Neck on the Great Trek', 'The migration is long and hard, but keep walking and you’ll arrive.',
        '<path d="M2 58q30-8 60 0" fill="none" stroke="#C9A06A" stroke-width="3" stroke-dasharray="4 4"/>' + at(30, 56, 0.8, longneck('#8FC7A6')) + '<circle cx="52" cy="14" r="6" fill="' + GD + '" stroke="#86690B" stroke-width="1.6"/>'],
      ['Hot-Spring Keeper', 'The plan is set, but several geysers are bubbling over today.',
        '<path d="M4 54q28-8 56 0v6H4z" fill="' + SD + '" ' + st + '/><ellipse cx="18" cy="52" rx="8" ry="3" fill="' + WA + '" ' + st + '/><ellipse cx="44" cy="52" rx="9" ry="3" fill="' + WA + '" ' + st + '/><path d="M18 50c-4-10 4-12 0-22M44 50c4-12-4-16 2-30" fill="none" stroke="' + WA + '" stroke-width="5" stroke-linecap="round"/><circle cx="18" cy="24" r="3" fill="' + W + '" ' + st + '/><circle cx="46" cy="16" r="4" fill="' + W + '" ' + st + '/><circle cx="30" cy="34" r="2" fill="' + W + '" ' + st + '/>'],
      ['Swift Gallimimus', 'Runs steady trails, but a long dry season could still turn it back.',
        G + at(34, 56, 0.85, trex('#B9D98A')) + '<path d="M4 36h12M2 44h14M6 52h10" stroke="' + BD + '" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Hero Pachycephalosaurus', 'Brave and well fed; a bigger food store would make the trek safe.',
        G + '<path d="M14 40l-6 18 12-8z" fill="' + LV + '" ' + st + '/>' + at(32, 56, 0.95, chubby()) + '<path d="M36 26q2-12 10-12t10 10z" fill="#E0C9A0" ' + st + '/>' + spark(18, 14, 4)],
      ['Fern Grazer', 'Little spare today, but the roots of the future run deep.',
        G + '<path d="M32 58V20" stroke="' + BD + '" stroke-width="3" stroke-linecap="round"/>' + [20, 28, 36, 44].map(function (y, i) { var w = 16 - i * 3; return '<path d="M32 ' + y + 'q-' + w + ' -2 -' + (w + 4) + ' 6M32 ' + y + 'q' + w + ' -2 ' + (w + 4) + ' 6" fill="none" stroke="' + LF + '" stroke-width="4" stroke-linecap="round"/>'; }).join('') + '<path d="M26 58q-6-4-8 0M38 58q6-4 8 0" fill="none" stroke="#8A5E36" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Clever Troodon', 'The smartest dino in the valley, with a few loose ends to tie up.',
        G + at(28, 56, 0.85, trex('#7CC7A8')) + '<circle cx="40" cy="31" r="4" fill="none" stroke="' + O + '" stroke-width="1.8"/><path d="M50 8a8 8 0 0 1 4 14v4h-8v-4a8 8 0 0 1 4-14z" fill="' + GD + '" ' + st + '/><path d="M47 30h6" stroke="' + O + '" stroke-width="2"/>'],
      ['T. rex Guarding the Nest', 'The hoard is safe, but raiders are sneaking in. Chase them off first.',
        nest + egg(30, 42, 0.7) + egg(40, 42, 0.7, '#CDEBF5') + at(22, 52, 0.75, trex()) + '<path d="M52 14l2 6M56 18l-6 0" stroke="' + LV + '" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Scorched Spinosaurus', 'Mighty, with the safest future, but one burning problem needs putting out now.',
        G + '<path d="M12 36q10-24 30 0z" fill="' + OR + '" ' + st + '/><path d="M18 34v-10M24 30v-14M30 30v-12M36 34v-8" stroke="#C97A3A" stroke-width="1.5"/>' + at(30, 56, 0.9, trex('#6FB7A0')) + '<path d="M50 22c-4 6 2 8 2 12 4-4 4-8 0-14 0 3-1 3-2 2z" fill="' + LV + '" ' + st + '/>'],
      ['Slow-and-Steady Ankylosaurus', 'Patient through hard seasons; the road ahead is certainly safe.',
        G + '<path d="M8 44q2-20 24-20t24 16" fill="#B49A72" ' + st + '/><path d="M14 36l4-6M24 30l2-6M34 30l2-6M44 32l4-5" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/><ellipse cx="50" cy="44" rx="8" ry="6" fill="#C9B08A" ' + st + '/>' + eye(52, 42) + '<path d="M8 44q-6-2-6 4 4 2 8 0" fill="#B49A72" ' + st + '/><circle cx="4" cy="46" r="3" fill="#7E6A4E"/><path d="M18 50v6M40 50v6" stroke="' + O + '" stroke-width="4.5" stroke-linecap="round"/>'],
      ['Herd Elder', 'Well prepared: the future is safe and today is in order.',
        G + at(28, 56, 0.85, longneck('#9CC9AE')) + '<path d="M50 56l-4-30" stroke="#8A5E36" stroke-width="3" stroke-linecap="round"/><path d="M44 26q4-6 8 0" fill="none" stroke="#8A5E36" stroke-width="3" stroke-linecap="round"/>'],
      ['Tyrannosaurus King', 'Strong today, safe tomorrow; only the fiercest storm could shake it.',
        G + at(30, 58, 1.05, trex()) + crown(44, 18, 0.65)],
      ['Faithful Nest Guard', 'Honest hard work keeps the future safe, but there’s just enough for now.',
        nest + egg(34, 42, 0.7) + egg(44, 43, 0.65, '#FFD6C2') + at(20, 50, 0.6, chubby('#7CC7A8')) + '<path d="M14 24h8l-4 8z" fill="' + GD + '" ' + st + '/>'],
      ['Raptor Pack General', 'Ready for anything, with a few gaps in the armour to mend.',
        G + at(30, 56, 0.95, trex('#C98B5E')) + '<path d="M36 22q4-10 12-8l2 8z" fill="#B0B6C8" ' + st + '/><path d="M44 12l2-6" stroke="' + LV + '" stroke-width="3" stroke-linecap="round"/>' + at(10, 56, 0.4, trex('#D9A77E'))],
      ['Ancient Brachiosaurus', 'Head above the clouds: today is in order and the future weathers any storm.',
        at(22, 60, 1, longneck('#8FC7A6')) + '<path d="M28 22c-2-6 6-8 8-4 2-4 10-2 9 3 4 0 5 5 1 6H30c-4 0-5-4-2-5z" fill="' + W + '" stroke="#B9C7C0" stroke-width="2"/>'],
      ['Emperor of the Jurassic', 'Nothing to worry about, today or tomorrow.',
        '<path d="M6 58l14-30h24l14 30z" fill="#8A6E5A" ' + st + '/><path d="M20 28q12 6 24 0" fill="' + LV + '" ' + st + '/>' + at(32, 30, 0.6, trex()) + crown(40, 6, 0.5) + spark(10, 14, 3.5) + spark(54, 16, 3.5)],
      ['The Meteor-Proof Dino', 'Even a meteor couldn’t stop it. The hoard grows forever, even at five times the spending.',
        G + at(24, 56, 0.9, chubby()) + '<path d="M40 22l14-4-2 14-12 6z" fill="#B0B6C8" ' + st + '/><path d="M44 26l6-2-1 6-6 3z" fill="' + GD + '"/><circle cx="12" cy="10" r="6" fill="' + LV + '" ' + st + '/><path d="M16 14l12 10M10 16l6 12M18 8l14 4" stroke="' + OR + '" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>' + spark(56, 8, 4)]
    ]
  });
})();
