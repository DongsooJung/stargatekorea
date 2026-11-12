export const book = {
  title: 'Seoul, at your own pace',
  subtitle: 'A practical first-trip guide · 1, 3 & 5 days',
  priceKrw: 9900,
  pages: 24,
  samplePages: 6,
  version: '1.0',
  edition: 'November 12, 2026',
  sample: '/downloads/seoul-at-your-own-pace-sample.pdf',
  cover: '/images/seoul-guide-cover.jpg',
};

export function bookMailto() {
  const body = [
    'Hello Stargate Korea,', '',
    `I would like to enquire about purchasing the English PDF guide "${book.title}", version ${book.version}.`,
    `Listed price: KRW ${book.priceKrw.toLocaleString('en-US')}.`, '',
    'Please confirm the total price, payment method, delivery timing and cancellation/refund terms before accepting my order.',
    'I understand that this is a digital PDF for personal use, not a printed book or travel booking.',
  ].join('\n');
  return `mailto:ceo@stargateedu.co.kr?subject=${encodeURIComponent('Seoul PDF guide purchase enquiry')}&body=${encodeURIComponent(body)}`;
}

export function bookTeaser() {
  return `<section class="wrap section" id="book"><div class="book-panel"><a class="book-cover-link" href="/books/" aria-label="See the Seoul travel book"><img class="book-cover" src="${book.cover}" width="800" height="1200" alt="Cover of Seoul, at your own pace, a Stargate Korea travel guide" loading="lazy"></a><div class="book-copy"><p class="eyebrow">The travel book / Digital edition 01</p><h2>Take a little<br>Seoul with you.</h2><p class="book-title">${book.title}</p><p class="lead">A compact English PDF to keep on your phone or print for your trip. Neighborhood routes, arrival decisions, booking checks and planning worksheets in one place.</p><p class="book-specs">${book.pages} pages · English · PDF · ${book.samplePages}-page free sample</p><p class="book-price">KRW ${book.priceKrw.toLocaleString('en-US')} <span>digital guide</span></p><div class="cta"><a class="btn" href="/books/" data-conversion="book_view">See the book & sample →</a><a class="text-link" href="${book.sample}" data-conversion="book_sample_download">Read the free sample ↗</a></div><p class="small muted">Purchase by email enquiry. Payment and delivery are confirmed before ordering.</p></div></div></section>`;
}

export function booksPage() {
  return `<section class="wrap section"><nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / Travel book</nav><div class="book-panel book-detail"><div><img class="book-cover" src="${book.cover}" width="800" height="1200" alt="Seoul, at your own pace book cover"><p class="small muted">Actual cover · English edition · Version ${book.version}</p></div><div class="book-copy"><p class="eyebrow">Stargate Korea / Original digital guide</p><h1>${book.title}</h1><p class="lead">${book.subtitle}</p><p class="book-specs">${book.pages} pages · English · Downloadable PDF<br>Edition: ${book.edition} · Personal-use copy</p><p>For independent travelers who want a clear starting plan, useful preparation notes and enough room to enjoy the city at their own pace.</p><p class="book-price">KRW ${book.priceKrw.toLocaleString('en-US')}</p><div class="cta"><a class="btn" href="${bookMailto()}" data-conversion="book_purchase_email">Enquire to buy the PDF ↗</a><a class="text-link" href="${book.sample}" data-conversion="book_sample_download">Read the free 6-page sample ↗</a></div><p class="small muted">The sample contains original pages 1, 3, 6, 10, 20 and 23. The full guide is supplied separately after an order and payment are agreed.</p></div></div></section>
  <section class="wrap section book-info"><div><p class="eyebrow">Inside the guide</p><h2>A plan you can actually use.</h2><ul class="scope-list"><li>Seven decisions to make before you go</li><li>Arrival, transport, accommodation and connectivity checks</li><li>Five suggested neighborhood days, usable as 1, 3 or 5-day plans</li><li>Rain alternatives, slower travel and respectful visiting</li><li>Food and paid-experience decision checklists</li><li>Budget and day-plan worksheets, departure checklist and official source links</li></ul><p>The book gathers original editorial advice into an offline reading format, with worksheets and a source desk. Free starter routes remain available on the site.</p><p><a class="text-link" href="/seoul-starter/">Try the free online starter guide →</a></p></div><div><p class="eyebrow">Before you enquire</p><h2>What you are buying.</h2><p>An English PDF information guide for personal use. You can read it on a PDF-capable device or print a personal copy. It is not a printed book, customized itinerary, reservation, ticket or guided trip. No future updates are included in the listed edition.</p><h3>How to purchase</h3><ol class="order-steps"><li>Read the sample and send a purchase enquiry to <a href="mailto:ceo@stargateedu.co.kr">ceo@stargateedu.co.kr</a>.</li><li>Review the total price, payment method, delivery timing and cancellation/refund terms in our email reply before ordering.</li><li>After the order and payment are agreed, receive the full PDF by email.</li></ol><p class="service-note">This page has no instant checkout. Opening an email draft does not send it, place an order or take a payment. Prices, venue access and schedules in Seoul must still be checked with providers.</p><p class="small muted">Seller and publisher: Stargate Corporation (주식회사 별의문), Seoul, Republic of Korea. Contact: ceo@stargateedu.co.kr. <a href="/privacy-policy/">Privacy</a> · <a href="/disclosure/">How we earn</a>.</p></div></section>`;
}
