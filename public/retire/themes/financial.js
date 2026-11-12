/* Financial theme for the calculator: words, colours and the 30 levels with clean line pictures. */
(function () {
  var N = '#1E2A38', T = '#1F8A70', LT = '#CBEDE2', A = '#E8A33D', LA = '#F7E3BE', R = '#C0504D', W = '#FFFFFF', GL = '#DCE3EA';
  var ln = 'fill="none" stroke="' + N + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  var lt = 'fill="none" stroke="' + T + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
  var st = 'stroke="' + N + '" stroke-width="2.5" stroke-linejoin="round"';
  var coin = function (x, y, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + LA + '" stroke="' + A + '" stroke-width="2"/>'; };
  var shield = function (fill) { return '<path d="M32 8l18 6v14c0 13-8 21-18 26-10-5-18-13-18-26V14z" fill="' + fill + '" ' + st + '/>'; };

  MMA.applyTheme({
    tiers: ['#E4EAF0', '#E9F0F5', '#DCEFE8', '#F5EBD3'], godBg: '#F3E3B0', labourBg: '#E6E9ED',
    words: {
      your: 'your money profile',
      text: {
        'adv.h': 'Your money profile', 'adv.next': 'Next steps', 'adv.all': 'See all 30 profiles',
        'adv.unknown': 'Your money profile appears here', 'adv.tap': 'Tap any profile to read about it.',
        'adv.needAll': 'Answer every question in the Calculator to see your money profile. {n} to go, starting with: {item}',
        'share.text': 'My money profile: Level {n}, {name}.', 'share.title': 'Share your money profile',
        sub: 'Everyone starts somewhere. Find out if your money will last through retirement, how healthy your everyday money is, and which money profile fits you today.',
        'calc.detail': '“See my result” shows your money profile and levels. The details show the maths behind it, starting with what happens after you retire.',
        'det.end': 'That’s the maths. Your money profile and levels are on the Result tab.',
        'quest.ret': 'Retirement step', 'quest.health': 'Money step', 'quest.final': 'Final step'
      }
    },
    levels: [
      ['Working for Life', 'Earning until the end. Plan for the day you can no longer work.',
        '<rect x="10" y="22" width="44" height="30" rx="4" fill="' + W + '" ' + st + '/><path d="M24 22v-6h16v6M10 34h44" ' + ln + '/><path d="M24 43c3-5 7-5 8 0s5 5 8 0-5-5-8 0-5 5-8 0z" ' + lt + '/>'],
      ['Rebuilding', 'Not enough today and no plan for later. Steady today first.',
        '<path d="M10 54h44M14 54V18M50 54V18M14 26h36M14 40h36M14 26l36 14M50 26L14 40" ' + ln + '/><rect x="22" y="44" width="10" height="10" fill="' + LA + '" stroke="' + A + '" stroke-width="2"/><rect x="34" y="47" width="8" height="7" fill="' + LA + '" stroke="' + A + '" stroke-width="2"/>'],
      ['First Steps', 'Working hard, with nothing saved yet and no plan.',
        '<path d="M18 50c-4 0-6-4-5-9s4-8 7-7 4 6 3 10-2 6-5 6z" fill="' + LT + '" ' + st + '/><path d="M40 34c-4 0-6-4-5-9s4-8 7-7 4 6 3 10-2 6-5 6z" fill="' + LT + '" ' + st + '/><path d="M14 56h10M36 40h10" ' + ln + '/><path d="M46 14l6 0M49 11v6" ' + lt + '/>'],
      ['Getting By', 'Just enough to live on, some debts and no savings.',
        '<path d="M12 22h36a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H12z" fill="' + W + '" ' + st + '/><path d="M12 22l28-8 2 8" ' + ln + '/><path d="M40 32h12v10H40a5 5 0 0 1 0-10z" fill="' + GL + '" ' + st + '/><circle cx="42" cy="37" r="1.8" fill="' + N + '"/>'],
      ['Freelance, No Buffer', 'Income from skill alone, with nothing set aside.',
        '<rect x="14" y="16" width="36" height="24" rx="3" fill="' + W + '" ' + st + '/><path d="M8 46h48l-4 6H12z" fill="' + GL + '" ' + st + '/><path d="M22 32l6-6 5 4 9-8" ' + lt + '/>'],
      ['Comfortable Today', 'Fine for now, but nothing saved for retirement.',
        '<path d="M14 30V22a6 6 0 0 1 6-6h24a6 6 0 0 1 6 6v8" fill="' + LT + '" ' + st + '/><path d="M8 34a5 5 0 0 1 10 0v6h28v-6a5 5 0 0 1 10 0v14H8z" fill="' + W + '" ' + st + '/><path d="M12 48v6M52 48v6" ' + ln + '/>'],
      ['Living for Now', 'Steady today, but no plan for the years ahead.',
        '<rect x="12" y="14" width="40" height="38" rx="4" fill="' + W + '" ' + st + '/><path d="M12 24h40M22 10v8M42 10v8" ' + ln + '/><rect x="20" y="30" width="10" height="9" rx="2" fill="' + T + '"/><path d="M36 34h8M36 42h8M20 45h10" stroke="' + GL + '" stroke-width="2.5" stroke-linecap="round"/>'],
      ['Big Spender', 'Strong income spent freely; it won’t last into retirement.',
        '<rect x="8" y="18" width="40" height="26" rx="4" fill="' + W + '" ' + st + '/><path d="M8 26h40" stroke="' + N + '" stroke-width="5"/><path d="M14 36h12" ' + ln + '/><path d="M52 30l4-4M54 40h6M52 50l4 4" stroke="' + R + '" stroke-width="2.5" stroke-linecap="round"/>' + coin(46, 50, 5)],
      ['Course Correction', 'An urgent problem today; fix it and the plan can still work.',
        '<circle cx="32" cy="32" r="20" fill="' + W + '" ' + st + '/><path d="M32 18l5 14-5 14-5-14z" fill="' + R + '" stroke="' + N + '" stroke-width="1.5"/><path d="M32 32l5 14-5 0z" fill="' + GL + '"/><path d="M50 12a24 24 0 0 1 6 14" ' + lt + '/><path d="M56 26l-4-2M56 26l2-4" ' + lt + '/>'],
      ['Under Pressure', 'The plan is possible, but with many risks.',
        '<path d="M12 44a20 20 0 1 1 40 0" fill="' + W + '" ' + st + '/><path d="M16 44a16 16 0 0 1 8-14" stroke="' + T + '" stroke-width="4" fill="none"/><path d="M40 30a16 16 0 0 1 8 14" stroke="' + R + '" stroke-width="4" fill="none"/><path d="M32 44l10-12" ' + ln + '/><circle cx="32" cy="44" r="3" fill="' + N + '"/><path d="M10 50h44" ' + ln + '/>'],
      ['Carrying Burdens', 'Several problems at once; ease some and the plan works.',
        '<rect x="14" y="40" width="36" height="12" rx="2" fill="' + GL + '" ' + st + '/><rect x="18" y="28" width="28" height="12" rx="2" fill="' + W + '" ' + st + '/><rect x="22" y="16" width="20" height="12" rx="2" fill="' + LA + '" stroke="' + A + '" stroke-width="2.5"/><path d="M8 56h48" ' + ln + '/>'],
      ['Almost on Track', 'The plan nearly works, but today is a little tight.',
        '<rect x="8" y="26" width="48" height="12" rx="6" fill="' + W + '" ' + st + '/><rect x="10" y="28" width="34" height="8" rx="4" fill="' + T + '"/><path d="M28 46l4 6 4-6M32 52V40" ' + ln + '/><path d="M48 16l4 4 6-8" ' + lt + '/>'],
      ['Minor Leaks', 'Doing well, with a few small leaks to fix.',
        '<path d="M14 24h22a8 8 0 0 1 8 8v4" fill="none" stroke="' + N + '" stroke-width="7" stroke-linecap="round"/><path d="M14 24h22a8 8 0 0 1 8 8v4" fill="none" stroke="' + GL + '" stroke-width="3" stroke-linecap="round"/><path d="M28 30c2 3 2 5 0 6-2-1-2-3 0-6zM44 42c2 3 2 5 0 6-2-1-2-3 0-6z" fill="' + T + '"/><path d="M34 52h20l-2 6H36z" fill="' + W + '" ' + st + '/>'],
      ['Temporary Setback', 'The future is safe if you get through today’s crisis.',
        '<path d="M8 54h48M8 54V10" ' + ln + '/><path d="M12 22l10 6 8 18 10-8 14-22" ' + lt + '/><circle cx="30" cy="46" r="3" fill="' + R + '"/><path d="M48 16h6v6" ' + lt + '/>'],
      ['Disciplined Saver', 'Hard going now, but you’ll get there.',
        '<path d="M14 36c0-10 8-16 18-16s18 6 18 16-8 14-18 14-18-4-18-14z" fill="' + LT + '" ' + st + '/><path d="M20 48v6M42 48v6M50 34h4M26 20l-2-6 6 4" ' + ln + '/><circle cx="40" cy="32" r="1.8" fill="' + N + '"/><path d="M28 18h8" stroke="' + N + '" stroke-width="3" stroke-linecap="round"/>' + coin(32, 10, 4)],
      ['Juggling Priorities', 'The long-term plan works, but several issues need sorting today.',
        '<path d="M16 52q16-14 32 0" ' + ln + '/>' + coin(16, 30, 6) + '<circle cx="32" cy="16" r="6" fill="' + LT + '" stroke="' + T + '" stroke-width="2"/><circle cx="48" cy="30" r="6" fill="#F3C9C8" stroke="' + R + '" stroke-width="2"/><path d="M20 24q6-8 10-10M44 24q-6-8-10-10" fill="none" stroke="' + GL + '" stroke-width="2" stroke-dasharray="2 3"/>'],
      ['Steady but Exposed', 'On course, but a long market slump could knock it off.',
        '<path d="M8 54h48M8 54V10" ' + ln + '/><path d="M12 40l10-8 8 4 10-10 14-6" ' + lt + '/><path d="M40 26l14 20" stroke="' + R + '" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>'],
      ['Comfortable, Underfunded', 'Doing well today; the retirement fund needs a bit more.',
        '<path d="M20 14h24v6l4 6v24a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V26l4-6z" fill="' + W + '" ' + st + '/><path d="M18 40h28v10a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2z" fill="' + LA + '"/>' + coin(26, 46, 3.5) + coin(36, 47, 3.5) + '<path d="M18 30h28" stroke="' + GL + '" stroke-width="2" stroke-dasharray="3 3"/>'],
      ['Lean and Secure', 'Little spare today, but the future is solid.',
        shield(LT) + '<path d="M24 32l6 6 12-12" ' + ln + '/>'],
      ['Well Prepared', 'A secure future, with a few loose ends.',
        '<rect x="14" y="10" width="36" height="46" rx="4" fill="' + W + '" ' + st + '/><path d="M20 22l3 3 5-5M20 34l3 3 5-5" ' + lt + '/><path d="M32 23h12M32 35h12M32 47h12" stroke="' + GL + '" stroke-width="2.5" stroke-linecap="round"/><rect x="20" y="44" width="6" height="6" rx="1" fill="none" stroke="' + N + '" stroke-width="2"/>'],
      ['Asset-Rich, Cash-Poor', 'Long-term money is safe, but an urgent problem today needs attention.',
        '<path d="M8 30L28 14l20 16v24H8z" fill="' + LT + '" ' + st + '/><rect x="22" y="38" width="12" height="16" fill="' + W + '" ' + st + '/><path d="M42 40h14v14H42z" fill="' + W + '" ' + st + '/><path d="M42 40l7-6 7 6" ' + ln + '/><path d="M49 45v4" stroke="' + R + '" stroke-width="2.5" stroke-linecap="round"/><circle cx="49" cy="52" r="1.3" fill="' + R + '"/>'],
      ['Secure with One Serious Risk', 'The safest future, but one dangerous gap. Close it first.',
        shield(W) + '<path d="M32 20v14" stroke="' + R + '" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="42" r="2.6" fill="' + R + '"/>'],
      ['Patient Builder', 'Tight today, but the future is certain.',
        '<path d="M10 54h44" ' + ln + '/><rect x="12" y="44" width="12" height="10" fill="' + W + '" ' + st + '/><rect x="24" y="44" width="12" height="10" fill="' + W + '" ' + st + '/><rect x="36" y="44" width="12" height="10" fill="' + W + '" ' + st + '/><rect x="18" y="34" width="12" height="10" fill="' + W + '" ' + st + '/><rect x="30" y="34" width="12" height="10" fill="' + LT + '" ' + st + '/><rect x="24" y="24" width="12" height="10" fill="' + LT + '" stroke="' + T + '" stroke-width="2.5" stroke-dasharray="3 2"/>'],
      ['Financially Sound', 'The future is safe and today is in order.',
        '<path d="M32 10v40M18 54h28M12 20h40" ' + ln + '/><path d="M12 20l-6 14h12zM52 20l-6 14h12z" fill="' + LT + '" ' + st + '/><circle cx="32" cy="10" r="3" fill="' + T + '"/>'],
      ['Financially Strong', 'Strong now and safe later; only an extreme shock could shake it.',
        '<path d="M8 24L32 10l24 14z" fill="' + LT + '" ' + st + '/><path d="M14 28v20M24 28v20M40 28v20M50 28v20M10 52h44M8 56h48" ' + ln + '/>' + coin(32, 38, 5)],
      ['Secure Future, Tight Present', 'The future is certain, but for now there’s just enough.',
        '<rect x="16" y="28" width="32" height="26" rx="4" fill="' + LT + '" ' + st + '/><path d="M22 28v-6a10 10 0 0 1 20 0v6" ' + ln + '/><circle cx="32" cy="40" r="3" fill="' + N + '"/><path d="M32 42v5" stroke="' + N + '" stroke-width="2.5" stroke-linecap="round"/>' + coin(54, 54, 4)],
      ['Nearly Bulletproof', 'Ready for almost anything, with a few gaps to close.',
        shield(LT) + '<path d="M24 32l6 6 12-12" ' + ln + '/><path d="M44 14l-3 5 3 2" fill="none" stroke="' + R + '" stroke-width="2" stroke-linecap="round"/>'],
      ['Master Planner', 'Today is in order and the future can weather any storm.',
        '<rect x="8" y="10" width="48" height="44" rx="4" fill="' + LT + '" ' + st + '/><path d="M8 22h48M20 10v44" stroke="' + W + '" stroke-width="2"/><path d="M26 44l8-12 6 6 10-14" ' + ln + '/><circle cx="50" cy="24" r="3" fill="' + A + '"/><path d="M12 30h4M12 38h4M12 46h4" ' + ln + '/>'],
      ['Financially Independent', 'Nothing to worry about, today or tomorrow.',
        '<path d="M4 56l20-30 10 12 8-10 18 28z" fill="' + GL + '" ' + st + '/><path d="M42 28V8" ' + ln + '/><path d="M42 8h14l-4 5 4 5H42z" fill="' + T + '" stroke="' + N + '" stroke-width="2" stroke-linejoin="round"/>'],
      ['Generational Wealth', 'Grows forever, even at five times your spending.',
        '<path d="M32 56V30M32 40l-10-8M32 36l10-8" ' + ln + '/><circle cx="32" cy="22" r="14" fill="' + LT + '" ' + st + '/><circle cx="18" cy="30" r="8" fill="' + LT + '" ' + st + '/><circle cx="46" cy="30" r="8" fill="' + LT + '" ' + st + '/>' + coin(28, 18, 3.5) + coin(38, 24, 3.5) + coin(18, 30, 3) + coin(46, 30, 3) + '<path d="M22 56h20" ' + ln + '/>']
    ]
  });
})();
