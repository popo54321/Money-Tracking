/* Fantasy (fairy-tale) theme for the calculator: words, colours and the 30 levels with their pictures. */
(function () {
  var O = '#3B2F52', LV = '#8B5CF6', LL = '#E3D6FF', RO = '#FF9FC6', GD = '#F0D58A', GI = '#8E6A10', LF = '#6DBB7A', LFD = '#3E8E5A', WD = '#8A5E36', RD = '#E8574F', W = '#FFFFFF';
  var st = 'stroke="' + O + '" stroke-width="2" stroke-linejoin="round"';
  var G = '<ellipse cx="32" cy="58" rx="18" ry="3" fill="' + O + '" opacity=".13"/>';
  var spark = function (x, y, r, c) {
    var a = +(r * 0.3).toFixed(2), b = +(r * 0.7).toFixed(2);
    return '<path d="M' + x + ' ' + (y - r) + 'l' + a + ' ' + b + ' ' + b + ' ' + a + ' ' + -b + ' ' + a + ' ' + -a + ' ' + b + ' ' + -a + ' ' + -b + ' ' + -b + ' ' + -a + ' ' + b + ' ' + -a + 'z" fill="' + (c || GD) + '"/>';
  };
  var shroom = function (x, y, s, c) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-3 0v8h6V0" fill="#FFF3DD" ' + st + '/><path d="M-10 1a10 9 0 0 1 20 0z" fill="' + (c || RD) + '" ' + st + '/><circle cx="-4" cy="-3" r="1.6" fill="' + W + '"/><circle cx="3" cy="-5" r="1.4" fill="' + W + '"/></g>';
  };
  var pine = function (x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0-20l10 14H5l8 12H-13l8-12h-5z" fill="' + LFD + '" ' + st + '/><path d="M-2 6h4v6h-4z" fill="' + WD + '"/></g>';
  };
  var crown = function (x, y, s) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M-12 5l-2-12 7 6 7-10 7 10 7-6-2 12z" fill="' + GD + '" stroke="' + GI + '" stroke-width="2" stroke-linejoin="round"/><circle cy="0" r="1.8" fill="' + RO + '"/></g>';
  };

  MMA.applyTheme({
    tiers: ['#EFE6FF', '#FFE3EE', '#DFF3E4', '#FFF1C4'], godBg: '#FFF0B5', labourBg: '#EDE4D8',
    words: {
      your: 'your fairy-tale self',
      text: {
        'adv.h': 'Your fairy-tale self', 'adv.next': 'Next quests', 'adv.all': 'See all 30 characters',
        'adv.unknown': 'Your fairy tale awaits', 'adv.tap': 'Tap any character to read about them.',
        'adv.needAll': 'Answer every question in the Calculator to meet your fairy-tale self. {n} to go, starting with: {item}',
        'share.text': 'I’m a Level {n} {name} in my money fairy tale!', 'share.title': 'Share your fairy-tale self',
        sub: 'Every fairy tale starts somewhere. Find out if your gold will last the whole journey, how healthy your everyday money is, and which character you are today.',
        'calc.detail': '“See my result” shows your fairy-tale self and levels. The details show the maths behind it, starting with what happens after you retire.',
        'det.end': 'That’s the maths. Your fairy-tale self and levels are on the Result tab.',
        'quest.ret': 'Retirement quest', 'quest.health': 'Money quest', 'quest.final': 'Final quest'
      }
    },
    levels: [
      ['The Mill Hand', 'Turns the mill wheel to the very last day. Plan for when your hands grow tired.',
        G + '<path d="M22 56V30l10-10 10 10v26z" fill="#F3E3C8" ' + st + '/><path d="M28 56V46h8v10" fill="' + WD + '" ' + st + '/><g transform="translate(32 22)"><path d="M0 0L-4-18h8zM0 0l18-4v8zM0 0l4 18h-8zM0 0l-18 4v-8z" fill="' + W + '" ' + st + '/><circle r="3" fill="' + WD + '" ' + st + '/></g>'],
      ['Lost in the Enchanted Wood', 'No map and no path. Find solid ground first; the journey can wait.',
        pine(18, 34, 1.1) + pine(46, 36, 1.2) + '<path d="M24 58q8-10 16 0" fill="none" stroke="' + WD + '" stroke-width="2" stroke-dasharray="3 3"/><circle cx="30" cy="24" r="1.8" fill="' + GD + '"/><circle cx="35" cy="24" r="1.8" fill="' + GD + '"/><text x="28" y="14" font-size="13" font-weight="900" fill="' + LV + '" font-family="sans-serif">?</text>'],
      ['Cinder Sweeper', 'Sweeping hard, but the purse is empty and there’s no plan yet.',
        G + '<path d="M44 8L26 40" stroke="' + WD + '" stroke-width="3.5" stroke-linecap="round"/><path d="M20 36l12 6-6 14-14-6z" fill="' + GD + '" ' + st + '/><path d="M16 46l10 5M18 41l10 5" stroke="' + GI + '" stroke-width="1.4"/><circle cx="44" cy="50" r="2" fill="#FF8A3D"/><circle cx="50" cy="44" r="1.6" fill="#FFB36B"/><circle cx="48" cy="54" r="1.4" fill="#9A8C80"/>'],
      ['Mushroom Picker', 'Picks just enough to get by, owes the village and has nothing saved.',
        G + '<path d="M14 34h36l-4 20H18z" fill="#D9A866" ' + st + '/><path d="M16 42h32M17 48h30" stroke="' + WD + '" stroke-width="1.5"/><path d="M18 34q14-18 28 0" fill="none" stroke="' + WD + '" stroke-width="3"/>' + shroom(24, 28, 0.8) + shroom(38, 30, 0.7, '#C77DFF')],
      ['Wandering Pixie', 'Gets by on charm and skill, with nothing saved for later.',
        '<path d="M10 52q10-6 16-2t18-10" fill="none" stroke="' + GD + '" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/><ellipse cx="24" cy="26" rx="9" ry="6" fill="' + LL + '" ' + st + ' transform="rotate(-30 24 26)"/><ellipse cx="42" cy="26" rx="9" ry="6" fill="' + LL + '" ' + st + ' transform="rotate(30 42 26)"/><path d="M28 40l5-14 5 14z" fill="' + LF + '" ' + st + '/><circle cx="33" cy="22" r="5" fill="#FFE1C7" ' + st + '/><path d="M29 18l4-8 4 8" fill="' + LF + '" ' + st + '/>' + spark(50, 12, 3.5)],
      ['Tavern Brownie', 'Little to worry about today, but nothing put away for old age.',
        G + '<path d="M18 22h22v30a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="#D9A866" ' + st + '/><path d="M40 28h4a6 6 0 0 1 0 12h-4" fill="none" stroke="' + O + '" stroke-width="3"/><path d="M18 30h22M18 46h22" stroke="' + WD + '" stroke-width="2"/><path d="M16 24c0-6 6-8 9-6 2-4 9-4 11 0 4-2 8 2 6 6z" fill="#FFF8E8" stroke="#C9B48F" stroke-width="2"/>'],
      ['Dancing Sprite', 'Dances happily tonight, but has packed nothing for the road ahead.',
        G + '<circle cx="32" cy="16" r="6" fill="#FFE1C7" ' + st + '/><path d="M32 22l-12 28h24z" fill="' + RO + '" ' + st + '/><path d="M26 30l-10-6M38 30l10-8" stroke="' + O + '" stroke-width="2.5" stroke-linecap="round"/><path d="M48 14v10a3 3 0 1 1-2-3V14l6-2v8a3 3 0 1 1-2-3" fill="' + LV + '" stroke="' + LV + '" stroke-width="1.5"/>'],
      ['Feasting Faun', 'A feast every night, but the stores won’t last the winter.',
        G + '<path d="M20 12h20l-2 14a8 8 0 0 1-16 0z" fill="' + GD + '" stroke="' + GI + '" stroke-width="2"/><path d="M22 18h16" stroke="#9C2A4A" stroke-width="5"/><path d="M30 34v14M22 50h16" stroke="' + GI + '" stroke-width="3" stroke-linecap="round"/>' + [[44, 36], [50, 36], [47, 42], [53, 42], [50, 48]].map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="3.4" fill="' + LV + '" ' + st + '/>'; }).join('') + '<path d="M47 32l3-6" stroke="' + LFD + '" stroke-width="2"/>'],
      ['Goblin in a Leaky Boat', 'Mend the leak and you can still sail home.',
        '<path d="M4 50q28 12 56 0" fill="none" stroke="#7FB8E6" stroke-width="3"/><path d="M10 38h44l-6 12H16z" fill="' + WD + '" ' + st + '/><circle cx="32" cy="28" r="7" fill="' + LF + '" ' + st + '/><path d="M24 26l-6-3M40 26l6-3" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/><circle cx="29" cy="27" r="1.3" fill="' + O + '"/><circle cx="35" cy="27" r="1.3" fill="' + O + '"/><path d="M40 52c2 3 2 5 0 6-2-1-2-3 0-6zM22 50c2 3 2 5 0 6-2-1-2-3 0-6z" fill="#7FB8E6"/>'],
      ['Toadstool Guard', 'A dented shield and few supplies: still possible, but risky.',
        G + '<path d="M32 8l18 6v14c0 14-8 22-18 26-10-4-18-12-18-26V14z" fill="' + LL + '" ' + st + '/>' + shroom(32, 28, 1.1) + '<path d="M44 16l-4 6 3 2" fill="none" stroke="' + O + '" stroke-width="1.6"/>'],
      ['Hard-Working Gnome', 'Many burdens on its back; it works if some come off.',
        G + '<path d="M18 30L32 4l14 26z" fill="' + RD + '" ' + st + '/><circle cx="32" cy="34" r="8" fill="#FFE1C7" ' + st + '/><path d="M22 36q10 22 20 0q-4 4-10 4t-10-4z" fill="' + W + '" ' + st + '/><circle cx="32" cy="36" r="2.4" fill="' + RO + '"/><rect x="44" y="34" width="14" height="18" rx="3" fill="#C9A06A" ' + st + '/><path d="M44 40h14" stroke="' + WD + '" stroke-width="1.5"/>'],
      ['Apprentice Fairy Godmother', 'The spell nearly works, but today is still a little tight.',
        G + '<path d="M14 54L40 22" stroke="' + WD + '" stroke-width="3.5" stroke-linecap="round"/>' + spark(44, 18, 9) + '<path d="M44 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" fill="' + W + '" opacity=".7"/>' + spark(52, 34, 3, RO) + spark(26, 12, 2.5, LV)],
      ['Pedlar of Charms', 'Trades well, but the purse has a few small holes.',
        G + '<path d="M20 52h24l-4-8H24z" fill="' + WD + '" ' + st + '/><circle cx="32" cy="30" r="14" fill="' + LL + '" ' + st + '/><path d="M24 26a9 9 0 0 1 8-6" fill="none" stroke="' + W + '" stroke-width="2.5" stroke-linecap="round"/><path d="M28 34q4 4 8 0" fill="none" stroke="' + LV + '" stroke-width="2"/>' + spark(36, 28, 3, LV)],
      ['The Frog Prince', 'The kingdom is safe once the spell breaks. Get today steady first.',
        G + '<circle cx="23" cy="26" r="6" fill="' + LF + '" ' + st + '/><circle cx="41" cy="26" r="6" fill="' + LF + '" ' + st + '/><path d="M12 44q0-16 20-16t20 16q0 10-20 10t-20-10z" fill="' + LF + '" ' + st + '/><circle cx="23" cy="26" r="2.4" fill="' + O + '"/><circle cx="41" cy="26" r="2.4" fill="' + O + '"/><path d="M24 40q8 6 16 0" fill="none" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/>' + crown(32, 16, 0.6)],
      ['Pilgrim of the Moon Path', 'A hard road, but keep walking and you’ll reach the temple.',
        '<path d="M44 6a16 16 0 1 0 10 26A13 13 0 1 1 44 6z" fill="' + GD + '" stroke="' + GI + '" stroke-width="2"/><path d="M8 58q14-20 26-14t20-8" fill="none" stroke="' + LL + '" stroke-width="5" stroke-linecap="round"/><path d="M20 56l-2-24" stroke="' + WD + '" stroke-width="3" stroke-linecap="round"/><circle cx="18" cy="30" r="3" fill="' + LV + '"/>' + spark(12, 14, 3, LV)],
      ['Potion Brewer', 'The recipe for later is ready, but several cauldrons are boiling over.',
        G + '<path d="M12 32h40l-4 18a6 6 0 0 1-6 4H22a6 6 0 0 1-6-4z" fill="#4A4060" ' + st + '/><path d="M10 30h44" stroke="' + O + '" stroke-width="4" stroke-linecap="round"/><path d="M16 30c2-8 6-6 8-10 3 6 6 2 8-4 3 6 6 4 8 10 2-4 5-4 8 4" fill="' + LF + '" ' + st + '/><circle cx="22" cy="14" r="2.5" fill="' + LF + '"/><circle cx="40" cy="10" r="3" fill="' + LF + '"/><path d="M46 36c2 4 1 8-1 10" fill="none" stroke="' + LF + '" stroke-width="3" stroke-linecap="round"/>'],
      ['Woodland Elf', 'Walks steadily, but a long lean season could still turn you back.',
        G + '<path d="M18 8q22 24 0 48" fill="none" stroke="' + WD + '" stroke-width="3.5" stroke-linecap="round"/><path d="M18 8v48" stroke="' + O + '" stroke-width="1.2"/><path d="M14 32h38" stroke="' + O + '" stroke-width="2"/><path d="M52 32l-8-5v10z" fill="#B0B6C8" ' + st + '/><path d="M14 32l-4-4M14 32l-4 4" stroke="' + LFD + '" stroke-width="2.5" stroke-linecap="round"/><path d="M44 12c6-2 10 2 8 8-6 2-10-2-8-8z" fill="' + LF + '" ' + st + '/>'],
      ['Brave Woodcutter', 'Brave and well fed; a little more gold would make the quest safe.',
        G + '<rect x="10" y="40" width="44" height="14" rx="7" fill="#C9A06A" ' + st + '/><ellipse cx="50" cy="47" rx="5" ry="7" fill="#F3D9B0" ' + st + '/><ellipse cx="50" cy="47" rx="2" ry="3" fill="none" stroke="' + WD + '" stroke-width="1.4"/><path d="M20 38L40 10" stroke="' + WD + '" stroke-width="4" stroke-linecap="round"/><path d="M34 10l10-4 4 10-8 2z" fill="#B0B6C8" ' + st + '/>'],
      ['Tree Spirit', 'Lives simply among old trees: little spare today, deep roots.',
        '<path d="M26 56c2-8 2-16 0-22h12c-2 6-2 14 0 22" fill="' + WD + '" ' + st + '/><path d="M18 58q6-4 10-4M46 58q-6-4-10-4" fill="none" stroke="' + WD + '" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="22" r="18" fill="' + LF + '" ' + st + '/><circle cx="20" cy="30" r="9" fill="' + LF + '" ' + st + '/><circle cx="44" cy="30" r="9" fill="' + LF + '" ' + st + '/><circle cx="27" cy="24" r="2" fill="' + O + '"/><circle cx="37" cy="24" r="2" fill="' + O + '"/><path d="M28 30q4 3 8 0" fill="none" stroke="' + O + '" stroke-width="2" stroke-linecap="round"/>'],
      ['Wise Owl of the Wood', 'Wise and well prepared, with a few loose ends left.',
        G + '<path d="M16 22q0-14 16-14t16 14v18q0 16-16 16T16 40z" fill="#B58A5E" ' + st + '/><path d="M16 14l6 6M48 14l-6 6" stroke="' + O + '" stroke-width="2.5" stroke-linecap="round"/><circle cx="25" cy="26" r="7" fill="' + W + '" ' + st + '/><circle cx="39" cy="26" r="7" fill="' + W + '" ' + st + '/><circle cx="25" cy="26" r="3" fill="' + O + '"/><circle cx="39" cy="26" r="3" fill="' + O + '"/><path d="M30 33l2 4 2-4z" fill="' + GD + '" ' + st + '/><path d="M24 44q8 4 16 0M26 49q6 3 12 0" fill="none" stroke="#7A5A3A" stroke-width="1.6"/>'],
      ['Dragon of the Glen', 'The treasure is safe, but thieves are breaking in. Deal with them first.',
        '<path d="M8 56q24-12 48 0" fill="' + GD + '" stroke="' + GI + '" stroke-width="2"/><circle cx="24" cy="52" r="3" fill="' + GD + '" stroke="' + GI + '" stroke-width="1.4"/><circle cx="40" cy="51" r="3" fill="' + GD + '" stroke="' + GI + '" stroke-width="1.4"/><path d="M18 40q-2-20 14-24 14-2 18 8l6 2-4 6-6-2q-4 10-12 10z" fill="' + LF + '" ' + st + '/><path d="M26 18l-2-10 6 6M36 16l2-10 4 8" fill="' + LFD + '" ' + st + '/><circle cx="40" cy="26" r="2.4" fill="' + O + '"/><path d="M50 34l4 2M50 36l2 4" stroke="#FF8A3D" stroke-width="2" stroke-linecap="round"/>'],
      ['Spellbound Enchantress', 'Great power and the safest future, but under a dangerous spell. Break it first.',
        '<g stroke="#B9AFCC" stroke-width="1.4" fill="none"><path d="M32 4v56M4 32h56M12 12l40 40M52 12L12 52"/><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="26"/></g><circle cx="32" cy="32" r="9" fill="' + LV + '" ' + st + '/><path d="M28 30a4 4 0 1 1 4 4 2 2 0 1 1-2-2" fill="none" stroke="' + W + '" stroke-width="1.8" stroke-linecap="round"/>' + spark(50, 12, 3.5, RO)],
      ['Hermit of the Hollow Hill', 'Patient through hard times; the road ahead is certainly safe.',
        '<path d="M2 56q30-48 60 0z" fill="' + LF + '" ' + st + '/><circle cx="32" cy="44" r="10" fill="' + WD + '" ' + st + '/><path d="M32 34v20M22 44h20" stroke="#5C3D22" stroke-width="1.5"/><circle cx="38" cy="45" r="1.6" fill="' + GD + '"/><path d="M48 22q2-6 0-10" fill="none" stroke="#B9AFCC" stroke-width="2" stroke-linecap="round"/>' + spark(14, 16, 3)],
      ['Keeper of the Fairy Ring', 'Faithful and prepared: the future is safe and today is in order.',
        '<ellipse cx="32" cy="42" rx="24" ry="10" fill="#CDEBD2"/>' + shroom(12, 40, 0.6) + shroom(22, 34, 0.55, RO) + shroom(36, 33, 0.55) + shroom(50, 38, 0.6, RO) + shroom(44, 48, 0.6) + shroom(22, 50, 0.6) + spark(32, 20, 6) + spark(46, 14, 3, LV) + spark(18, 16, 2.5, RO)],
      ['The Elf King', 'Strong today, safe tomorrow; only the fiercest storm could shake the crown.',
        G + crown(32, 30, 1.6) + '<path d="M10 40c4-6 10-4 12 0-6 2-10 2-12 0zM54 40c-4-6-10-4-12 0 6 2 10 2 12 0zM26 44c2-6 10-6 12 0-4 4-8 4-12 0z" fill="' + LF + '" ' + st + '/>'],
      ['Faithful Hob', 'Honest hard work keeps the future safe, but there’s just enough for now.',
        G + '<path d="M12 30L32 12l20 18v24H12z" fill="#F3E3C8" ' + st + '/><path d="M8 32L32 10l24 22" fill="none" stroke="' + RD + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="27" y="38" width="10" height="16" rx="5" fill="' + WD + '" ' + st + '/><rect x="16" y="34" width="8" height="8" fill="' + GD + '" ' + st + '/><rect x="42" y="14" width="6" height="10" fill="' + WD + '" ' + st + '/><path d="M45 12q3-4 0-8" fill="none" stroke="#B9AFCC" stroke-width="2"/>'],
      ['Unicorn Captain', 'Ready for any battle, with a few gaps in the armour to mend.',
        G + '<path d="M18 56c-2-16 2-28 12-34l10-6 8 8-2 10-10 4-4 18z" fill="' + W + '" ' + st + '/><path d="M40 16l6-14 2 16z" fill="' + GD + '" stroke="' + GI + '" stroke-width="1.8" stroke-linejoin="round"/><path d="M30 22c-6 2-10 8-10 16M34 24c-6 4-8 10-8 16" fill="none" stroke="' + RO + '" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="22" r="1.8" fill="' + O + '"/><path d="M28 22c-2-6 2-10 8-10" fill="none" stroke="' + LV + '" stroke-width="4" stroke-linecap="round"/>'],
      ['The Great Wizard', 'A master of long-term magic: today is in order and the future weathers any storm.',
        G + '<path d="M10 48h44l-6-6H16z" fill="#5A3FA0" ' + st + '/><path d="M18 42L34 4l12 38z" fill="' + LV + '" ' + st + '/><path d="M34 4l8 4" stroke="' + O + '" stroke-width="2"/>' + spark(30, 26, 4) + spark(38, 34, 3) + spark(34, 16, 2.5) + '<path d="M20 38h24" stroke="' + GD + '" stroke-width="3"/>'],
      ['High Queen of Faerie', 'Nothing to worry about, today or tomorrow.',
        G + '<rect x="12" y="30" width="40" height="24" fill="' + LL + '" ' + st + '/><path d="M12 30v-12h8v12M44 30v-12h8v12M26 30V14h12v16" fill="' + LL + '" ' + st + '/><path d="M10 18l6-10 6 10zM42 18l6-10 6 10zM24 14l8-12 8 12z" fill="' + RO + '" ' + st + '/><path d="M27 54V42a5 5 0 0 1 10 0v12" fill="' + WD + '" ' + st + '/><path d="M32 2v-4" stroke="' + O + '"/>' + spark(32, 24, 3)],
      ['Keeper of Endless Fairy Dust', 'The fairy dust never runs out, even if you spent five times as much.',
        '<path d="M20 30q12-6 24 0l4 20a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="' + LV + '" ' + st + '/><path d="M20 30q12 6 24 0" fill="none" stroke="' + GD + '" stroke-width="3"/>' + spark(32, 12, 7) + spark(48, 18, 4, RO) + spark(16, 18, 4, W) + spark(52, 6, 2.5) + spark(12, 6, 2.5, RO) + spark(32, 44, 4, GD)]
    ]
  });
})();
