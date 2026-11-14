import { normalizeProfile } from './personalization.mjs';

export function tripChecklist(input) {
  const p = normalizeProfile(input);
  const tasks = [
    { id: 'hotel', title: 'Save your hotel address and station exit', note: 'Keep the Korean address and a route back on your phone.', href: '/where-to-stay-first-seoul-trip/' },
    { id: 'arrival', title: 'Check the airport journey for your arrival time', note: 'Confirm the terminal, last service and final hotel connection.', href: 'https://www.airport.kr/ap_en/1511/subview.do' },
    { id: 'connection', title: 'Choose how your phone will connect', note: 'Compare roaming, SIM and eSIM compatibility before paying.', href: '/travel-essentials/' },
    { id: 'calendar', title: 'Check each anchor venue on its own calendar', note: 'Opening days, exhibitions, access and booking rules can change.', href: p.interest === 'culture' || p.party === 'family' ? 'https://www.museum.go.kr/ENG/contents/E0101000000.do' : 'https://english.visitseoul.net/' },
    { id: 'budget', title: 'Set your own food, transport and activity allowances', note: 'Use the calculator below; it uses your figures rather than live prices.', href: '#trip-budget' },
    { id: 'offline', title: 'Keep your outline and an indoor alternative offline', note: 'Download the free PDF; keep the hotel address separately too.', href: '#download-pdf' },
  ];
  if (p.party === 'family') tasks.push({ id: 'family', title: 'Agree on meal pauses, toilet stops and access needs', note: 'Verify lifts, stroller access and the exact entrance for your family.', href: '/seoul-family-trip-plan/' });
  if (p.interest === 'food') tasks.push({ id: 'food', title: 'Ask about ingredients and the complete menu price', note: 'Keep another meal option; a translated dish name is not an ingredient check.', href: '/seoul-food-neighborhood-plan/' });
  if (p.interest === 'design') tasks.push({ id: 'design', title: 'Check shop, pop-up and exhibition dates directly', note: 'Make shopping optional and keep its allowance separate.', href: '/seoul-design-neighborhood-plan/' });
  if (p.season === 'winter' || p.season === 'summer') tasks.push({ id: 'weather', title: 'Recheck the weather and shorten outdoor time if needed', note: 'Keep an indoor anchor and a simple route back for your group.', href: '/seoul-rain-and-weather-plan/' });
  return tasks;
}

const number = (value, max, fallback = 0) => {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return fallback;
  return Math.min(max, Math.max(0, Math.round(Number(value))));
};
export function normalizeBudget(input = {}, days = 3) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  return {
    people: Math.max(1, number(input.people, 20, 1)),
    nights: number(input.nights, 30, Math.max(0, Number(days) - 1)),
    lodging: number(input.lodging, 10000000), food: number(input.food, 1000000),
    transport: number(input.transport, 1000000), activities: number(input.activities, 100000000),
    extra: number(input.extra, 100000000),
  };
}
export function calculateBudget(input, days = 3) {
  const length = [1, 3, 5].includes(Number(days)) ? Number(days) : 3;
  const values = normalizeBudget(input, length);
  const rows = [
    { id: 'lodging', label: 'Accommodation · all rooms per night × nights', value: values.lodging * values.nights },
    { id: 'food', label: 'Food · per person per day × people × days', value: values.food * values.people * length },
    { id: 'transport', label: 'Local transport · per person per day × people × days', value: values.transport * values.people * length },
    { id: 'activities', label: 'Activities · whole group, whole stay', value: values.activities },
    { id: 'extra', label: 'Other / contingency · whole group, whole stay', value: values.extra },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return { values, rows, total, perPerson: Math.round(total / values.people), days: length, hasValues: ['lodging','food','transport','activities','extra'].some(key => values[key] > 0) };
}
export const krw = amount => 'KRW ' + Math.round(amount).toLocaleString('en-US');

export function normalizeWorkspace(input = {}, profile) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const p = normalizeProfile(profile), allowed = new Set(tripChecklist(p).map(task => task.id));
  return { budget: normalizeBudget(input.budget, Number(p.days)), completed: Array.isArray(input.completed) ? [...new Set(input.completed.filter(id => allowed.has(id)))] : [] };
}

export function supportAdvice(kind) {
  const answers = {
    before: { title: 'Before buying', steps: ['Open the free 6-page sample first and confirm that an English standard-edition PDF suits you.', 'The displayed price is KRW 9,900. US$7.07 uses a fixed display rate; the checkout charges KRW.', 'Read the seller, payment and cancellation/refund details in the store before choosing a payment method.'] },
    payment: { title: 'A payment option does not work', steps: ['Check the options currently offered in the store checkout. Card acceptance depends on the payment provider and card.', 'Do not keep submitting payment if the result is unclear. Check your order status and payment account first.', 'If you need help, prepare an email below with your order reference if available. Never include card numbers or passwords.'] },
    download: { title: 'I cannot find the purchased file', steps: ['Open the same store order/account used for the purchase and check its payment status.', 'The PDF becomes available after payment is confirmed. A bank-transfer order needs deposit confirmation first.', 'If payment is confirmed but the file is unavailable, prepare a support email with the order reference and issue. We need to review the order; this helper does not access it.'] },
    file: { title: 'The file will not open', steps: ['Try opening the downloaded file in a PDF reader and check that the download finished.', 'Keep your original order reference. Describe the device, PDF reader and exact error without attaching sensitive documents.', 'Prepare a support email below for a file issue, incorrect product or cancellation/refund enquiry. Requests are reviewed under the store policy and applicable rights.'] },
  };
  return answers[kind] || answers.before;
}
