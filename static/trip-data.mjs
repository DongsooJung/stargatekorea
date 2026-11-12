// Editorial route ideas, not a live routing or availability service.
export const days = [
  { title: 'Palaces, tea & old Seoul', area: 'Jongno · Anguk',
    route: 'Gyeongbokgung → Insadong → Ikseon-dong',
    detail: 'Start with the palace, pause for tea around Insadong and keep the afternoon for the lanes near Ikseon-dong. Stay in one part of the city.',
    alternative: 'Rain plan: a museum visit and a longer tea stop. Check the palace calendar before choosing your day.' },
  { title: 'Markets & the city after dark', area: 'Jongno · Euljiro · Myeongdong',
    route: 'Gwangjang Market → Cheonggyecheon → Myeongdong',
    detail: 'Choose a market lunch, follow a section of the stream and save shopping for the evening. Take transit between areas when you need a break.',
    alternative: 'Rain plan: shorten the stream walk and spend more time in indoor shops. Confirm individual stall opening days.' },
  { title: 'A slower side of Seoul', area: 'Hongdae · Yeonnam',
    route: 'Hongik University Station → Yeonnam-dong → Gyeongui Line Forest Park',
    detail: 'Leave room for independent shops, a cafe stop and an unhurried neighborhood walk. A useful last full day before packing.',
    alternative: 'Rain plan: replace the park walk with cafes and bookshops. These are neighborhood ideas, not reserved venues.' },
  { title: 'Design, shops & a greener pause', area: 'Seongsu · Seoul Forest',
    route: 'Seongsu-dong → Seoul Forest',
    detail: 'Build a day around a single eastern Seoul neighborhood. Explore shops first and choose a park stop if the weather suits.',
    alternative: 'Rain plan: choose indoor design shops and cafes. Pop-ups, opening days and queues change.' },
  { title: 'Choose your own final chapter', area: 'Yongsan or your favorite neighborhood',
    route: 'National Museum of Korea → a relaxed neighborhood meal',
    detail: 'Use this as a flexible museum day or revisit somewhere you enjoyed. Keep the final evening light if your flight leaves the next morning.',
    alternative: 'Check museum opening information and any exhibition reservation requirements directly before you go.' },
];

export function selectTrip(length = '3', pace = 'balanced') {
  const count = ['1', '3', '5'].includes(String(length)) ? Number(length) : 3;
  const slow = pace === 'slow';
  return {
    count,
    pace: slow ? 'slow' : 'balanced',
    label: slow ? 'A little more breathing room' : 'A mix of sights and downtime',
    days: days.slice(0, count).map((day, index) => ({
      ...day,
      number: index + 1,
      route: slow ? day.route.split(' → ').slice(0, 2).join(' → ') : day.route,
      detail: slow ? `${day.detail} Keep only the first two stops; the rest is optional.` : day.detail,
    })),
  };
}
