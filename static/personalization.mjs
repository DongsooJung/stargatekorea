// Editorial recommendations run locally. No visitor input is sent to an AI provider.
export const profileOptions = {
  days: { '1': '1 day', '3': '3 days', '5': '5 days' },
  pace: { balanced: 'Balanced', slow: 'Slow · fewer stops' },
  party: { solo: 'On my own', couple: 'As a couple', family: 'With children / family', friends: 'With friends' },
  interest: { mixed: 'First-visit essentials', culture: 'Culture & history', food: 'Food & neighborhoods', design: 'Shops & design' },
  budget: { lean: 'Keep spending light', balanced: 'A balanced budget', flexible: 'Room for a special experience' },
  season: { unsure: 'Not decided yet', spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
};
export const defaults = { days: '3', pace: 'balanced', party: 'solo', interest: 'mixed', budget: 'balanced', season: 'unsure' };

export function normalizeProfile(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key,
    Object.hasOwn(profileOptions[key], String(input[key] ?? '')) ? String(input[key]) : fallback]));
}
export function profileQuery(profile) { return new URLSearchParams(normalizeProfile(profile)).toString(); }
export function profileFromQuery(query) { return normalizeProfile(Object.fromEntries(new URLSearchParams(query))); }

const routes = {
  old: { area: 'Jongno · Anguk', title: 'Palaces, tea & old Seoul',
    stops: ['Gyeongbokgung', 'Insadong', 'Ikseon-dong'],
    detail: 'Give the palace the first part of your day, then settle into tea and nearby lanes. Choose a single palace visit rather than trying to cover every landmark.',
    alternative: 'If palace access or weather does not suit your date, use a museum or a longer indoor tea stop as your anchor. Check opening days before arranging this day.' },
  market: { area: 'Jongno · Euljiro · Myeongdong', title: 'A market lunch, a stream & an evening stroll',
    stops: ['Gwangjang Market', 'Cheonggyecheon', 'Myeongdong'],
    detail: 'Choose the food you want to try before ordering, then leave space for an unhurried city walk. Use transit when the final neighborhood would turn this into too much walking.',
    alternative: 'For rain, shorten the stream walk and choose indoor shops. Check ingredients and ordering details with the vendor; opening times differ by business.' },
  hongdae: { area: 'Hongdae · Yeonnam', title: 'Small shops & a softer afternoon',
    stops: ['Hongik University Station area', 'Yeonnam-dong', 'Gyeongui Line Forest Park'],
    detail: 'A neighborhood day for independent shops, a cafe break and people-watching. Pick one or two places you care about and let the spaces between them stay flexible.',
    alternative: 'Replace the park with bookshops or cafes if needed. Check your chosen shop opening times and save its Korean address before setting out.' },
  seongsu: { area: 'Seongsu · Seoul Forest', title: 'Design discoveries & a green pause',
    stops: ['Seongsu-dong', 'Seoul Forest'],
    detail: 'Explore the design and cafe neighborhood first, then keep the park as an optional pause. Pick a few shops in one area instead of chasing pop-ups across the city.',
    alternative: 'Pop-ups and queues change. Choose indoor shops when the weather is unhelpful and confirm any event directly with its operator.' },
  museum: { area: 'Yongsan · National Museum area', title: 'One museum, one relaxed meal',
    stops: ['National Museum of Korea', 'A meal near your chosen station'],
    detail: 'Choose a small part of the museum to enjoy rather than making it an endurance visit. Build lunch and the return journey around the needs of your group.',
    alternative: 'Check the museum calendar, exhibition tickets, step-free access and the station exit you will use. A shorter visit is a complete day if that suits your group.' },
  wall: { area: 'Dongdaemun · DDP', title: 'Architecture & contemporary Seoul',
    stops: ['Dongdaemun Design Plaza', 'Nearby design shops', 'A local cafe'],
    detail: 'Use DDP as the anchor and choose one nearby exhibition or shop. Compare any paid exhibition with the time and interests of your group before buying.',
    alternative: 'The buildings and public space are not a promise of exhibition entry. Confirm the program, fees and access with the operator.' },
  mangwon: { area: 'Mangwon · Mapo', title: 'A neighborhood market at your own pace',
    stops: ['Mangwon Market', 'Mangwon-dong cafes', 'A nearby neighborhood walk'],
    detail: 'Try a small number of foods and leave room for a cafe stop. Keep food spending intentional: compare menus, portion sizes and prices before ordering.',
    alternative: 'If rain makes the walk less appealing, shorten it. Check ingredients directly with the vendor and keep a second food choice available for your group.' },
  gangnam: { area: 'Samseong · Bongeunsa', title: 'A temple & an indoor city afternoon',
    stops: ['Bongeunsa', 'COEX area', 'An indoor cafe stop'],
    detail: 'Pair a respectful temple visit with an indoor afternoon in the same part of Seoul. Keep shopping optional so this day works with different spending preferences.',
    alternative: 'Check the exact entrance and venue hours. Temple ceremonies and exhibitions have their own access rules; allow time for the journey from your hotel.' },
};
const themeOrder = {
  mixed: ['old', 'market', 'hongdae', 'seongsu', 'museum'],
  culture: ['old', 'museum', 'wall', 'gangnam', 'hongdae'],
  food: ['market', 'mangwon', 'hongdae', 'seongsu', 'old'],
  design: ['seongsu', 'wall', 'hongdae', 'gangnam', 'museum'],
};
const budgetNotes = {
  lean: 'Set a separate daily food and transport allowance. Keep shopping optional and choose a paid attraction only when it adds something important to your trip.',
  balanced: 'Use one neighborhood as each day’s anchor, then choose a small number of meals or experiences worth paying for. Compare the complete price before booking.',
  flexible: 'Choose a special meal, class or exhibition around an already workable route. A higher budget is a reason to buy a better fit, not to pack in more stops.',
};
const seasonalNotes = {
  unsure: 'Choose your month before booking dated experiences. Recheck venue calendars and your airport journey close to departure.',
  spring: 'Keep park time flexible and check the forecast. Blossom timing varies; do not make a fixed booking depend on a particular bloom date.',
  summer: 'Leave room for indoor breaks and a shorter outdoor route. Check the day’s forecast and local weather notices before leaving.',
  autumn: 'Leave spare time for outdoor stops, but keep an indoor option. Seasonal colors and event dates change each year.',
  winter: 'Put an indoor anchor into each day and shorten exposed walks when needed. Check the forecast and your group’s comfort before setting out.',
};
const partyNotes = {
  solo: 'Choose a cafe or meal stop you would enjoy on your own, and save the route and your hotel address before leaving.',
  couple: 'Agree on one must-do each. Keep one shared meal or cafe break without adding an extra cross-city journey.',
  family: 'The plan keeps at most two core stops per day. Check toilet breaks, station lifts, stroller access and meal choices for your particular family.',
  friends: 'Choose a meeting point and a shared spending range. Keep one optional stop so the group can split and rejoin without losing the day.',
};
const reading = {
  mixed: { title: 'A useful first Seoul plan', href: '/seoul-starter/', reason: 'Arrival decisions and an editable starting structure.' },
  culture: { title: 'A slower culture-focused Seoul trip', href: '/seoul-culture-at-your-pace/', reason: 'How to choose fewer landmarks and spend longer with them.' },
  food: { title: 'Plan a food-first Seoul trip', href: '/seoul-food-neighborhood-plan/', reason: 'Markets, neighborhood meals and choices to make before ordering.' },
  design: { title: 'Seoul for shops, design & small discoveries', href: '/seoul-design-neighborhood-plan/', reason: 'Build shopping around neighborhoods and a clear spending limit.' },
};

export function personalizeTrip(input = {}) {
  const profile = normalizeProfile(input);
  const count = Number(profile.days);
  const slow = profile.pace === 'slow' || profile.party === 'family';
  let ids = [...themeOrder[profile.interest]];
  if (profile.party === 'family' && profile.interest === 'mixed') ids = ['museum', ...ids.filter(id => id !== 'museum')];
  const days = ids.slice(0, count).map((id, index) => {
    const base = routes[id];
    const stops = slow ? base.stops.slice(0, 2) : [...base.stops];
    return { ...base, id, number: index + 1, stops, route: stops.join(' → '),
      detail: base.detail + (slow ? ' Keep any extra stop optional and leave a proper break between the two core stops.' : ''),
      map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0] + ', Seoul, South Korea')}` };
  });
  const complex = profile.party === 'family' || (profile.pace === 'slow' && profile.interest !== 'mixed');
  const resources = [profile.party === 'family'
    ? { title: 'A calmer Seoul trip with children', href: '/seoul-family-trip-plan/', reason: 'Shorter days, meal pauses and access questions for your own family.' }
    : reading[profile.interest],
    profile.party === 'family' && profile.interest !== 'mixed' ? reading[profile.interest]
      : { title: 'Choose your Seoul base first', href: '/where-to-stay-first-seoul-trip/', reason: 'Compare the hotel area with the places you will actually visit.' }];
  return { profile, count, pace: slow ? 'slow' : 'balanced',
    label: `${profileOptions.party[profile.party]} · ${profileOptions.interest[profile.interest]}`,
    summary: `${count} ${count === 1 ? 'day' : 'days'} in Seoul · ${profileOptions.interest[profile.interest]}`,
    why: [partyNotes[profile.party], budgetNotes[profile.budget], seasonalNotes[profile.season]],
    days, resources,
    offer: complex
      ? { kind: 'custom', title: 'Need a brief around your family or particular interests?', reason: 'Your profile may benefit from extra research into access, meal pauses or a specific theme. Start with the free plan; request a quote only for the details you need checked.' }
      : { kind: 'book', title: 'Want the preparation notes in one offline guide?', reason: 'The standard English PDF is a practical next step for an independent 1–5 day Seoul trip. It collects routes, checklists and worksheets; it is a fixed edition rather than a custom itinerary.' },
  };
}

export function planAsText(trip) {
  return [
    '# Your Seoul starting plan', trip.summary, trip.label,
    `Budget style: ${profileOptions.budget[trip.profile.budget]}`,
    `Season: ${profileOptions.season[trip.profile.season]}`, '',
    '## Why this plan', ...trip.why.map(note => '- ' + note), '',
    ...trip.days.flatMap(day => [`## Day ${day.number}: ${day.title}`, day.area, day.route, day.detail, day.alternative, `Map starting point: ${day.map}`, '']),
    '## Read next', ...trip.resources.map(r => `${r.title}: https://www.stargatekorea.net${r.href}`), '',
    'Free editorial outline. Check opening days, current fees, access, weather and the journey from your hotel before booking.',
    'Save or share your settings: https://www.stargatekorea.net/?' + profileQuery(trip.profile) + '#plan',
    'Optional PDF guide: https://www.stargatekorea.net/books/',
    'Custom digital brief enquiry: https://www.stargatekorea.net/custom-guide/?' + profileQuery(trip.profile),
  ].join('\n');
}
