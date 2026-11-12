import { selectTrip } from './trip-data.mjs';

const planner = document.getElementById('trip-planner');
if (planner) {
  planner.addEventListener('submit', (event) => {
    event.preventDefault();
    const trip = selectTrip(planner.elements.days.value, planner.elements.pace.value);
    document.getElementById('plan-caption').textContent = `${trip.count} ${trip.count === 1 ? 'day' : 'days'} in Seoul · ${trip.label}`;
    const list = document.getElementById('route-list');
    list.replaceChildren();
    for (const day of trip.days) {
      const li = document.createElement('li');
      li.className = 'route-day';
      const number = document.createElement('span');
      number.className = 'day-number';
      number.textContent = String(day.number).padStart(2, '0');
      const content = document.createElement('div');
      for (const [tag, className, text] of [
        ['p', 'route-area', day.area], ['h3', '', day.title],
        ['p', 'route-stops', day.route], ['p', '', day.detail],
      ]) {
        const element = document.createElement(tag);
        element.className = className;
        element.textContent = text;
        content.append(element);
      }
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = 'Weather & planning note';
      const note = document.createElement('p');
      note.textContent = day.alternative;
      details.append(summary, note);
      content.append(details);
      li.append(number, content);
      list.append(li);
    }
    document.getElementById('personalize-link').href = `/custom-guide/?days=${trip.count}&pace=${trip.pace}`;
    track('route_generated');
  });
}

const enquiry = document.getElementById('guide-enquiry');
if (enquiry) {
  const params = new URLSearchParams(window.location.search);
  if (['1', '3', '5'].includes(params.get('days'))) enquiry.elements.days.value = params.get('days');
  if (['balanced', 'slow'].includes(params.get('pace'))) enquiry.elements.pace.value = params.get('pace');
  enquiry.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = enquiry.elements;
    const message = [
      'Hello Stargate Korea,', '',
      'I would like a quote for a custom digital Seoul travel brief.', '',
      `Days in Seoul: ${form.days.value}`,
      `Preferred pace: ${form.pace.selectedOptions[0].textContent}`,
      `Travel month: ${form.month.value || 'To be confirmed'}`,
      `Main interest: ${form.interests.value}`, '',
      'Please confirm the scope, total fee, delivery date, revisions and cancellation/refund terms before I order.',
      'I understand that this enquiry is for a digital information document, not travel bookings or an in-person tour.',
    ].join('\n');
    document.getElementById('enquiry-text').value = message;
    document.getElementById('enquiry-email').href = `mailto:ceo@stargateedu.co.kr?subject=${encodeURIComponent('Custom digital Seoul guide enquiry')}&body=${encodeURIComponent(message)}`;
    document.getElementById('enquiry-preview').hidden = false;
    document.getElementById('copy-status').textContent = '';
    track('enquiry_prepared');
  });
  document.getElementById('copy-enquiry').addEventListener('click', async () => {
    const text = document.getElementById('enquiry-text');
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(text.value);
      status.textContent = 'Copied. Paste into an email to ceo@stargateedu.co.kr, then send it when ready.';
    } catch {
      text.focus();
      text.select();
      status.textContent = 'Copy access is unavailable. The draft is selected; use your device’s Copy command.';
    }
  });
}

// Event hooks are inert until the owner configures the existing GA integration.
// Never include trip selections, email contents or other visitor-entered values.
function track(name) {
  if (typeof window.gtag === 'function') window.gtag('event', name, { event_category: 'travel' });
}
document.addEventListener('click', (event) => {
  const link = event.target.closest?.('[data-conversion]');
  if (link) track(link.dataset.conversion);
});
