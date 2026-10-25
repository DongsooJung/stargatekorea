// Stargate Korea — site settings shared by the static build and the WordPress export.
export default {
  title: 'Stargate Korea',
  tagline: 'Study, live and travel in Korea — guides from Seoul',
  description:
    'Practical guides for international students, newcomers and travelers in Korea: arrival checklists, transport, neighborhoods, culture and weekend trips.',
  url: 'https://www.stargatekorea.net',
  language: 'en-US',
  author: { name: 'Dongsoo Jung', login: 'dongsoo', email: 'ceo@stargateedu.co.kr' },
  publisher: 'Stargate Corporation (주식회사 별의문)',
  email: 'ceo@stargateedu.co.kr',
  // Set to "ca-pub-XXXXXXXXXXXXXXXX" once AdSense is approved; the build then adds the script and ads.txt.
  adsenseClient: '',
  // Set to a GA4 ID ("G-XXXXXXX") to enable analytics.
  gaId: '',
  categories: [
    { slug: 'study-in-korea', name: 'Study in Korea', icon: '🎓', blurb: 'Arrival, visas and university life' },
    { slug: 'living-in-korea', name: 'Living in Korea', icon: '🏠', blurb: 'Housing, neighborhoods and everyday life' },
    { slug: 'travel-korea', name: 'Travel Korea', icon: '🚄', blurb: 'Transport, day trips and seasons' },
    { slug: 'korean-culture', name: 'Korean Culture', icon: '🏮', blurb: 'Food, etiquette and language' },
    { slug: 'books', name: 'Books & Guides', icon: '📚', blurb: 'Longer guides and our books' },
  ],
  nav: [
    { label: 'Study', href: '/category/study-in-korea/' },
    { label: 'Living', href: '/category/living-in-korea/' },
    { label: 'Travel', href: '/category/travel-korea/' },
    { label: 'Culture', href: '/category/korean-culture/' },
    { label: 'Economy', href: '/economy/' },
    { label: 'Campus Trips', href: '/campus-trips/' },
    { label: 'About', href: '/about/' },
  ],
  // /economy/ — Korea's economy and policy, checked with data. Posts live in content/economy/*.md.
  economy: {
    title: 'Korea Economy, Checked',
    tagline: "Korea's economy and policy, checked with data",
    description:
      "Data-checked reports on Korea's housing policy, household credit, macro trends, industry and regulation — with a verdict, the key numbers, the counter-evidence and sources.",
    sections: [
      { slug: 'policy-check', name: 'Policy Check', icon: '⚖️', blurb: 'Housing and credit policies tested against the data' },
      { slug: 'macro-notes', name: 'Macro Notes', icon: '📈', blurb: 'Rates, the won, household credit and trade' },
      { slug: 'industry-watch', name: 'Industry Watch', icon: '🏭', blurb: 'Chips, AI, robotics and the companies behind them' },
      { slug: 'regulation-watch', name: 'Regulation Watch', icon: '📜', blurb: 'Rules that shape how Korean business works' },
    ],
    // Verdict scale shared with the Korean /regulation/ reports.
    verdicts: {
      effective: { label: 'Effective', tone: 'good' },
      partial: { label: 'Partially effective', tone: 'mid' },
      'too-early': { label: 'Too early to judge', tone: 'neutral' },
      ineffective: { label: 'Not effective', tone: 'bad' },
      backfire: { label: 'Risk of backfiring', tone: 'bad' },
    },
    confidence: {
      verified: 'Verified against the original source',
      reference: 'Reported figure, not independently verified',
      estimate: 'Our estimate — method explained in the text',
    },
  },
  channels: [
    { name: 'Stargate Education', note: 'Korean education site', href: 'https://www.stargateedu.co.kr/' },
    { name: 'Stargate Blog', note: 'Korean research & data blog', href: 'https://blog.stargateedu.co.kr/' },
    { name: 'Korea Economy, Checked', note: 'Data-checked economy and policy reports', href: '/economy/' },
    { name: 'Campus Trips', note: 'Small-group trips for students', href: '/campus-trips/' },
  ],
  footerPages: [
    { label: 'About', href: '/about/' },
    { label: 'Contact', href: '/contact/' },
    { label: 'Privacy Policy', href: '/privacy-policy/' },
  ],
};
