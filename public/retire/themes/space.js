/* Space theme for the calculator: words, colours and the 30 levels with their pictures. */
(function () {
  var G = '<ellipse cx="32" cy="58" rx="18" ry="3" fill="#2B1F7A" opacity=".15"/>';
  var star = function (x, y, r, c) {
    var a = +(r * 0.3).toFixed(2), b = +(r * 0.7).toFixed(2);
    return '<path d="M' + x + ' ' + (y - r) + 'l' + a + ' ' + b + ' ' + b + ' ' + a + ' ' + -b + ' ' + a + ' ' + -a + ' ' + b + ' ' + -a + ' ' + -b + ' ' + -b + ' ' + -a + ' ' + b + ' ' + -a + 'z" fill="' + (c || '#FFD66B') + '"/>';
  };
  var rocket = function (x, y, s, body, extra) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0-22c8 6 10 16 8 28H-8c-2-12 0-22 8-28z" fill="' + (body || '#F4F3FF') + '" stroke="#2B1F7A" stroke-width="2"/><circle cy="-6" r="4" fill="#2FD3E8" stroke="#2B1F7A" stroke-width="1.8"/><path d="M-8 2l-6 8 6-1zM8 2l6 8-6-1z" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M-5 7q5 12 10 0z" fill="#FF9F43"/>' + (extra || '') + '</g>';
  };
  var helmet = '<circle cx="32" cy="24" r="12" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><rect x="24" y="19" width="16" height="10" rx="5" fill="#2FD3E8" stroke="#2B1F7A" stroke-width="1.6"/><path d="M27 21h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>';
  var suit = '<path d="M20 52c0-12 5-17 12-17s12 5 12 17z" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><rect x="28" y="41" width="8" height="6" rx="1.5" fill="#5B4BFF"/>';
  var planet = function (x, y, r, c, ring) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + c + '" stroke="#2B1F7A" stroke-width="2"/>' +
      (ring ? '<ellipse cx="' + x + '" cy="' + y + '" rx="' + r * 1.6 + '" ry="' + r * 0.45 + '" fill="none" stroke="' + ring + '" stroke-width="2.5" transform="rotate(-15 ' + x + ' ' + y + ')"/>' : '');
  };
  var galaxy = '<path d="M32 32m-3 0a3 3 0 1 1 6 0c0 6-10 8-14 2-5-8 4-17 14-15 12 3 13 19 3 24" fill="none" stroke="#5B4BFF" stroke-width="3" stroke-linecap="round"/><path d="M32 32c0-6 10-8 14-2 5 8-4 17-14 15-12-3-13-19-3-24" fill="none" stroke="#2FD3E8" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="3.5" fill="#FFD66B"/>';

  MMA.applyTheme({
    tiers: ['#E4E1FF', '#D6F3F8', '#E9DDFF', '#FFF1C9'], godBg: '#FFE7A1', labourBg: '#E6E6EE',
    words: {
      your: 'your astronaut',
      text: {
        'adv.h': 'Your astronaut', 'adv.next': 'Next missions', 'adv.all': 'See all 30 astronauts',
        'adv.unknown': 'Your astronaut awaits', 'adv.tap': 'Tap any astronaut to read about them.',
        'adv.needAll': 'Answer every question in the Calculator to meet your astronaut. {n} to go, starting with: {item}',
        'share.text': 'I’m a Level {n} {name} on my money mission!', 'share.title': 'Share your astronaut',
        sub: 'Every astronaut starts on the launch pad. Find out if your fuel will last the whole voyage, how healthy your everyday money is, and which astronaut you are today.',
        'calc.detail': '“See my result” shows your astronaut and levels. The details show the maths behind it, starting with what happens after you retire.',
        'det.end': 'That’s the maths. Your astronaut and levels are on the Result tab.',
        'quest.ret': 'Retirement mission', 'quest.health': 'Health mission', 'quest.final': 'Final mission'
      }
    },
    levels: [
      ['Asteroid Miner', 'Mines rocks to the very last shift. Plan for when you want to come home.',
        G + '<path d="M12 44c-2-12 6-22 18-22s22 6 22 16-8 16-20 16-18-3-20-10z" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="2"/><circle cx="24" cy="38" r="3" fill="#8F95B5"/><circle cx="40" cy="44" r="4" fill="#8F95B5"/><path d="M38 12l12 12" stroke="#8A5E36" stroke-width="3" stroke-linecap="round"/><path d="M42 8c6 0 11 4 12 10" fill="none" stroke="#6C7091" stroke-width="4" stroke-linecap="round"/>' + star(16, 14, 4)],
      ['Lost in Orbit', 'Drifting with no map. Get stable today first.',
        '<g transform="rotate(-25 32 34)">' + helmet + suit + '</g><path d="M46 46q8 4 10 12" fill="none" stroke="#625C91" stroke-width="2" stroke-dasharray="3 3"/><text x="50" y="18" font-size="14" font-weight="800" fill="#5B4BFF" font-family="sans-serif">?</text>' + star(12, 12, 3, '#2FD3E8')],
      ['Launch-Pad Sweeper', 'Working hard, but the tank is empty and there’s no plan.',
        G + '<rect x="10" y="48" width="44" height="6" rx="2" fill="#625C91"/><path d="M14 48l4-10h28l4 10" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="2" stroke-linejoin="round"/><path d="M40 14l-10 30" stroke="#8A5E36" stroke-width="3" stroke-linecap="round"/><path d="M24 42l12 4-2 6-14-3z" fill="#FFD66B" stroke="#2B1F7A" stroke-width="1.8" stroke-linejoin="round"/><circle cx="18" cy="30" r="1.6" fill="#B8BDD6"/><circle cx="14" cy="36" r="1.2" fill="#B8BDD6"/>'],
      ['Moon-Dust Scraper', 'Just enough fuel, owes the station and has nothing stored.',
        '<path d="M40 8a24 24 0 1 0 14 40A20 20 0 1 1 40 8z" fill="#E6E3F5" stroke="#2B1F7A" stroke-width="2"/><circle cx="26" cy="22" r="3" fill="#C8C4E0"/><circle cx="20" cy="38" r="4" fill="#C8C4E0"/><path d="M44 30l8 20" stroke="#8A5E36" stroke-width="3" stroke-linecap="round"/><path d="M50 46l6 4-4 6-6-4z" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.6"/><circle cx="40" cy="54" r="1.5" fill="#C8C4E0"/><circle cx="46" cy="58" r="1.2" fill="#C8C4E0"/>'],
      ['Freelance Space Courier', 'Job to job between planets, with nothing stored for later.',
        '<rect x="16" y="22" width="26" height="22" rx="3" fill="#F2B45A" stroke="#2B1F7A" stroke-width="2"/><path d="M16 30h26M29 22v22" stroke="#2B1F7A" stroke-width="1.6"/><path d="M42 30l8-4v14l-8-4" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 30l-8-2M16 36l-10 0M16 42l-8 2" stroke="#FF9F43" stroke-width="3" stroke-linecap="round"/>' + planet(50, 14, 5, '#2FD3E8') + G],
      ['Cosmic Café Owner', 'Fine today, but nothing put away for later life.',
        G + '<path d="M16 28h28v14a10 10 0 0 1-10 10h-8a10 10 0 0 1-10-10z" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><path d="M44 32h4a5 5 0 0 1 0 10h-4" fill="none" stroke="#2B1F7A" stroke-width="2"/><path d="M18 30h24v4H18z" fill="#8A5E36"/>' + planet(30, 16, 6, '#FF9BC9', '#FFD66B') + star(48, 12, 3)],
      ['Stargazing Dreamer', 'Happy watching today’s stars, with no supplies for the trip ahead.',
        G + '<path d="M22 56l8-18 8 18" fill="none" stroke="#2B1F7A" stroke-width="2.5" stroke-linecap="round"/><rect x="18" y="26" width="30" height="10" rx="4" transform="rotate(-28 33 31)" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="2"/><circle cx="45" cy="22" r="4" fill="#2FD3E8" stroke="#2B1F7A" stroke-width="1.6"/>' + star(52, 10, 4) + star(14, 14, 3, '#2FD3E8') + star(36, 8, 2.5)],
      ['Rocket-Fuel Splurger', 'Burns fuel on fireworks every night; the tank won’t last.',
        G + '<rect x="12" y="34" width="18" height="22" rx="3" fill="#FF6B6B" stroke="#2B1F7A" stroke-width="2"/><path d="M16 34v-4h6v4" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.6"/><path d="M15 42h12" stroke="#fff" stroke-width="2"/>' +
        '<g stroke-linecap="round" stroke-width="3"><path d="M44 20v-10" stroke="#FFD66B"/><path d="M44 20l8-6" stroke="#FF9BC9"/><path d="M44 20l9 4" stroke="#2FD3E8"/><path d="M44 20l-8-6" stroke="#5B4BFF"/><path d="M44 20l-2 10" stroke="#FF9F43"/></g><circle cx="44" cy="20" r="3" fill="#fff"/>'],
      ['Ship with a Hull Breach', 'Patch it and you can still make it home.',
        rocket(32, 34, 1.15, '#F4F3FF', '<path d="M2 -2l-4 4 3 2-3 4" fill="none" stroke="#FF6B6B" stroke-width="2"/>') + '<rect x="36" y="22" width="10" height="7" rx="1" fill="#FFD66B" stroke="#2B1F7A" stroke-width="1.5" transform="rotate(20 41 25)"/>' + star(12, 14, 3, '#2FD3E8')],
      ['Rookie in an Asteroid Field', 'Possible, but lots of risks.',
        rocket(32, 36, 0.8) + '<path d="M8 18c0-5 4-8 8-7s6 5 4 9-10 4-12-2z" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.8"/><path d="M46 44c0-4 4-6 7-5s5 4 3 7-9 3-10-2z" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.8"/><path d="M44 10c0-3 3-5 5-4s3 3 2 5-6 2-7-1z" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.6"/><path d="M10 48c0-3 3-4 5-3s3 3 1 5-5 1-6-2z" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.6"/>'],
      ['Overloaded Cargo Hauler', 'Too much cargo; drop some and it works.',
        G + '<path d="M8 44h44l-6 8H14z" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="2" stroke-linejoin="round"/><rect x="12" y="32" width="12" height="12" fill="#F2B45A" stroke="#2B1F7A" stroke-width="1.8"/><rect x="25" y="32" width="12" height="12" fill="#FFD66B" stroke="#2B1F7A" stroke-width="1.8"/><rect x="38" y="32" width="12" height="12" fill="#F2B45A" stroke="#2B1F7A" stroke-width="1.8"/><rect x="18" y="20" width="12" height="12" fill="#FFD66B" stroke="#2B1F7A" stroke-width="1.8"/><rect x="31" y="20" width="12" height="12" fill="#F2B45A" stroke="#2B1F7A" stroke-width="1.8"/><rect x="25" y="8" width="12" height="12" fill="#FFD66B" stroke="#2B1F7A" stroke-width="1.8" transform="rotate(10 31 14)"/>'],
      ['Cadet in Training', 'Nearly ready for launch, but today is tight.',
        G + suit + helmet + '<path d="M22 13l10-6 10 6" fill="none" stroke="#5B4BFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' + star(32, 44, 3.5)],
      ['Space-Market Trader', 'Trades well, but a few leaks in the fuel line.',
        G + '<path d="M10 26h44l-4 8H14z" fill="#FF9BC9" stroke="#2B1F7A" stroke-width="2" stroke-linejoin="round"/><path d="M14 34v20M50 34v20" stroke="#2B1F7A" stroke-width="2.5"/><rect x="14" y="44" width="36" height="6" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="1.6"/>' + planet(24, 40, 4, '#2FD3E8') + planet(34, 40, 4, '#FFD66B') + planet(44, 40, 4, '#5B4BFF') + '<path d="M30 18c2 3 2 5 0 6-2-1-2-3 0-6z" fill="#2FD3E8"/><path d="M38 12c2 3 2 5 0 6-2-1-2-3 0-6z" fill="#2FD3E8"/>'],
      ['Stranded Captain', 'The home planet is safe once you get through this storm.',
        planet(32, 46, 14, '#C8C4E0') + '<path d="M32 32V12" stroke="#2B1F7A" stroke-width="2.5"/><path d="M32 12h14l-4 5 4 5H32z" fill="#FF6B6B" stroke="#2B1F7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 20q6-4 12 0M44 34q6-4 12 0" fill="none" stroke="#625C91" stroke-width="2" stroke-linecap="round"/>' + star(14, 10, 3)],
      ['Voyager Probe', 'A long, slow trip, but you’ll get there.',
        '<path d="M6 54q16-8 22-22" fill="none" stroke="#B8BDD6" stroke-width="2" stroke-dasharray="2 4"/><circle cx="36" cy="26" r="6" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="2"/><path d="M42 20a14 14 0 0 0-14-12" fill="none" stroke="#2B1F7A" stroke-width="2"/><path d="M28 8a14 14 0 0 1 14 12z" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><path d="M36 32l-4 10M36 32l8 8" stroke="#2B1F7A" stroke-width="2"/>' + star(52, 12, 3.5) + star(54, 40, 2.5, '#2FD3E8')],
      ['Overheating Engineer', 'The plan is set, but several systems are overheating today.',
        G + '<circle cx="28" cy="36" r="16" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><path d="M16 36a12 12 0 0 1 24 0" fill="none" stroke="#FFD66B" stroke-width="4"/><path d="M34 32a12 12 0 0 1 6 4" fill="none" stroke="#FF6B6B" stroke-width="4"/><path d="M28 36l8-8" stroke="#2B1F7A" stroke-width="2.5" stroke-linecap="round"/><circle cx="28" cy="36" r="2.5" fill="#2B1F7A"/><path d="M44 16q-3-4 0-8M50 18q-3-4 0-8" fill="none" stroke="#B8BDD6" stroke-width="2" stroke-linecap="round"/><path d="M46 36l10 10" stroke="#625C91" stroke-width="4" stroke-linecap="round"/>'],
      ['Moon-Base Explorer', 'Steady, but a long solar storm could send you back.',
        '<path d="M4 50q28-10 56 0v10H4z" fill="#E6E3F5" stroke="#2B1F7A" stroke-width="2"/><path d="M16 46a12 12 0 0 1 24 0z" fill="#2FD3E8" fill-opacity=".45" stroke="#2B1F7A" stroke-width="2"/><rect x="40" y="38" width="12" height="8" rx="2" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="1.8"/><path d="M46 38V28" stroke="#2B1F7A" stroke-width="1.8"/><circle cx="46" cy="26" r="2.5" fill="#FF6B6B"/><circle cx="14" cy="14" r="7" fill="#FFD66B" opacity=".9"/>'],
      ['Space Hero', 'Brave and well fuelled; the reserve tanks need more.',
        G + '<path d="M18 36l-6 20 10-8M46 36l6 20-10-8" fill="#FF6B6B" stroke="#2B1F7A" stroke-width="1.8" stroke-linejoin="round"/>' + suit + helmet + star(32, 45, 4)],
      ['Quiet Satellite', 'A simple orbit with little spare, but stable for the future.',
        '<ellipse cx="32" cy="34" rx="26" ry="10" fill="none" stroke="#B8BDD6" stroke-width="1.6" stroke-dasharray="3 3"/><rect x="26" y="26" width="12" height="12" rx="2" fill="#FFD66B" stroke="#2B1F7A" stroke-width="2"/><rect x="6" y="28" width="16" height="8" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.6"/><rect x="42" y="28" width="16" height="8" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.6"/><path d="M22 32h4M38 32h4M32 26v-6" stroke="#2B1F7A" stroke-width="1.8"/><circle cx="32" cy="18" r="2.5" fill="#2FD3E8"/>'],
      ['Mission Scientist', 'Well prepared, with a few loose ends.',
        G + '<path d="M26 10h12M28 10v14L16 48a5 5 0 0 0 4 7h24a5 5 0 0 0 4-7L36 24V10" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2" stroke-linejoin="round"/><path d="M20 42h24l4 8a3 3 0 0 1-3 4H19a3 3 0 0 1-3-4z" fill="#2FD3E8"/><ellipse cx="32" cy="30" rx="10" ry="4" fill="none" stroke="#5B4BFF" stroke-width="1.6"/><circle cx="32" cy="30" r="2" fill="#5B4BFF"/>'],
      ['Treasure-Planet Governor', 'The treasure is safe, but pirates are landing. Deal with them first.',
        planet(28, 40, 16, '#FFB86B') + '<rect x="20" y="20" width="16" height="11" rx="2" fill="#8A5E36" stroke="#2B1F7A" stroke-width="1.8"/><path d="M20 24h16" stroke="#FFD66B" stroke-width="2"/><circle cx="28" cy="18" r="2" fill="#FFD66B"/>' + rocket(50, 18, 0.55, '#3A3F55') + '<rect x="47" y="2" width="8" height="5" fill="#2B1F7A"/>'],
      ['Cursed Comet', 'Great power and a safe path, but one dangerous problem. Fix it first.',
        '<path d="M40 24L8 52M44 30L18 58M34 18L4 40" stroke="#A98BFF" stroke-width="4" stroke-linecap="round" opacity=".7"/><circle cx="44" cy="20" r="11" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="2"/><path d="M40 16a5 5 0 1 1 6 6 3 3 0 1 1-3-3" fill="none" stroke="#C3B0FF" stroke-width="2.2" stroke-linecap="round"/><path d="M54 8l4-4M56 16l6-1" stroke="#FF6B6B" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Monk of the Far Station', 'Patient through hard times; the course is certainly safe.',
        '<ellipse cx="32" cy="50" rx="26" ry="7" fill="none" stroke="#B8BDD6" stroke-width="3"/><circle cx="32" cy="18" r="7" fill="#FFD9B5" stroke="#2B1F7A" stroke-width="2"/><path d="M29 18h2M33 18h2" stroke="#2B1F7A" stroke-width="1.6" stroke-linecap="round"/><path d="M18 46c0-12 6-18 14-18s14 6 14 18z" fill="#FF9F43" stroke="#2B1F7A" stroke-width="2"/><path d="M22 44q10 6 20 0" fill="none" stroke="#2B1F7A" stroke-width="1.8"/><circle cx="32" cy="18" r="11" fill="none" stroke="#FFD66B" stroke-width="1.5" opacity=".8"/>'],
      ['Station Commander', 'The future is safe and today is in order.',
        G + '<rect x="26" y="20" width="12" height="24" rx="3" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><rect x="4" y="26" width="18" height="12" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.8"/><rect x="42" y="26" width="18" height="12" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.8"/><path d="M22 32h4M38 32h4" stroke="#2B1F7A" stroke-width="2"/><circle cx="32" cy="28" r="3" fill="#2FD3E8"/><circle cx="32" cy="37" r="3" fill="#2FD3E8"/><path d="M32 20v-8" stroke="#2B1F7A" stroke-width="1.8"/>' + star(32, 9, 3.5)],
      ['Starship Captain', 'Strong today, safe tomorrow; only a supernova could shake it.',
        '<path d="M6 40l40-20c8-4 14 0 12 6L18 46z" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2" stroke-linejoin="round"/><path d="M18 34l10 8" stroke="#2B1F7A" stroke-width="1.6"/><circle cx="46" cy="26" r="3.5" fill="#2FD3E8" stroke="#2B1F7A" stroke-width="1.4"/><path d="M14 44l-6 10 14-4z" fill="#5B4BFF" stroke="#2B1F7A" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 40l-4 2" stroke="#FF9F43" stroke-width="4" stroke-linecap="round"/>' + star(14, 14, 4) + star(52, 50, 3, '#2FD3E8')],
      ['Loyal Ship’s Robot', 'Honest hard work keeps the future safe, but there’s just enough for now.',
        G + '<rect x="18" y="18" width="28" height="22" rx="6" fill="#B8BDD6" stroke="#2B1F7A" stroke-width="2"/><circle cx="26" cy="29" r="4" fill="#2FD3E8" stroke="#2B1F7A" stroke-width="1.6"/><circle cx="38" cy="29" r="4" fill="#2FD3E8" stroke="#2B1F7A" stroke-width="1.6"/><path d="M28 36h8" stroke="#2B1F7A" stroke-width="2" stroke-linecap="round"/><path d="M32 18v-6" stroke="#2B1F7A" stroke-width="2"/><circle cx="32" cy="10" r="3" fill="#FF6B6B"/><rect x="22" y="42" width="20" height="12" rx="3" fill="#8F95B5" stroke="#2B1F7A" stroke-width="2"/><path d="M18 44l-6 4M46 44l6 4" stroke="#2B1F7A" stroke-width="3" stroke-linecap="round"/>'],
      ['Fleet Admiral', 'Ready for anything, with a few gaps in the shields.',
        rocket(32, 26, 0.8) + rocket(14, 42, 0.6) + rocket(50, 42, 0.6) + star(32, 56, 3.5)],
      ['Galactic Navigator', 'A master planner: today is in order and the future weathers any storm.',
        '<circle cx="32" cy="32" r="24" fill="#F4F3FF" stroke="#2B1F7A" stroke-width="2"/><circle cx="32" cy="32" r="19" fill="none" stroke="#DCD8FF" stroke-width="2"/><g transform="translate(32 32) scale(.62) translate(-32 -32)">' + galaxy + '</g><path d="M32 8v6M32 50v6M8 32h6M50 32h6" stroke="#2B1F7A" stroke-width="2.2" stroke-linecap="round"/><path d="M32 18l3 14-3 14-3-14z" fill="#FF6B6B" opacity=".85"/>'],
      ['Ruler of the Galaxy', 'Nothing to worry about, today or tomorrow.',
        '<g transform="translate(0 6)">' + galaxy + '</g><path d="M18 18l4-12 6 8 4-10 4 10 6-8 4 12z" fill="#FFD66B" stroke="#946A10" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="13" r="1.8" fill="#FF6B6B"/>'],
      ['The Ever-Expanding Universe', 'Like the universe, your money keeps expanding forever, even at five times the spending.',
        '<circle cx="32" cy="32" r="26" fill="none" stroke="#C3B0FF" stroke-width="1.5" stroke-dasharray="2 4"/><circle cx="32" cy="32" r="17" fill="none" stroke="#2FD3E8" stroke-width="1.5" stroke-dasharray="2 3"/><circle cx="32" cy="32" r="8" fill="#FFD66B" stroke="#946A10" stroke-width="2"/>' + star(32, 6, 4) + star(56, 30, 3.5, '#2FD3E8') + star(10, 40, 3.5, '#FF9BC9') + star(46, 54, 3) + star(16, 14, 2.5, '#2FD3E8') + '<path d="M32 22v-6M32 42v6M22 32h-6M42 32h6" stroke="#FFD66B" stroke-width="2.5" stroke-linecap="round"/>']
    ]
  });
})();
