// The revenue stage model of the self-improvement loop.
//
// Traffic used to be the yardstick: a page was healthy when it was read and weak
// when it was read and never clicked. Traffic is not the objective. The money path
// of this site is fixed and short:
//
//   read -> free plan -> paid offer considered -> checkout or enquiry -> order
//
// Every conversion label on this site belongs to exactly one of those steps, so a
// click can be read as a step toward money instead of a count. The order itself
// happens in the Korean store and by email, so the last step is never observed
// here: it is marked external and is never counted as a result of this site.
//
// The model is pure. It reads numbers and returns numbers, so the same rule can be
// used by the measurement script, by the audit and by the tests.

// A stage is a place on the money path. The weight is how much money is at stake
// when a visitor is stopped there. Reading is worth nothing on its own.
export const STAGES = [
  { id: 'attention', order: 0, label: 'Read', weight: 0, revenue: false, external: false },
  { id: 'activation', order: 1, label: 'Free plan used', weight: 1, revenue: false, external: false },
  { id: 'consideration', order: 2, label: 'Paid offer considered', weight: 3, revenue: true, external: false },
  { id: 'intent', order: 3, label: 'Purchase intent', weight: 5, revenue: true, external: false },
  { id: 'revenue', order: 4, label: 'Order completed', weight: 10, revenue: true, external: true },
];

export const STAGE_IDS = STAGES.map(stage => stage.id);

// The steps that carry money. Attention sits before them and is not part of it.
export const REVENUE_CHAIN = ['activation', 'consideration', 'intent', 'revenue'];

const BY_ID = new Map(STAGES.map(stage => [stage.id, stage]));

export function stage(id) {
  return BY_ID.get(id) ?? null;
}

export function stageWeight(id) {
  return stage(id)?.weight ?? 0;
}

export function stageOrder(id) {
  return stage(id)?.order ?? -1;
}

export function nextStage(id) {
  const order = stageOrder(id);
  return STAGES.find(item => item.order === order + 1)?.id ?? null;
}

// Every conversion label of this site, and the money step it belongs to. A label
// that is missing here would be invisible to the revenue report, so the tests
// require that this list covers the whole conversion set.
export const LABEL_STAGE = {
  // Reading. The visitor moves, nothing is decided.
  month_guide_open: 'attention',
  weekly_roundup_open: 'attention',
  weekly_archive_open: 'attention',
  personal_reading_open: 'attention',
  essential_airport: 'attention',
  essential_connectivity: 'attention',
  essential_stays: 'attention',
  essential_experiences: 'attention',
  support_answer_view: 'attention',
  // The free plan is used. The visitor becomes reachable but has not paid.
  page_plan_open: 'activation',
  route_generated: 'activation',
  route_edited: 'activation',
  plan_download: 'activation',
  plan_print: 'activation',
  plan_shared: 'activation',
  plan_saved: 'activation',
  plan_pdf_download: 'activation',
  profile_preset: 'activation',
  checklist_download: 'activation',
  checklist_updated: 'activation',
  budget_calculated: 'activation',
  calendar_download: 'activation',
  // The paid offer is looked at. No money has moved yet.
  page_book_open: 'consideration',
  book_view: 'consideration',
  matched_book_open: 'consideration',
  book_sample_download: 'consideration',
  page_custom_open: 'consideration',
  custom_guide_view: 'consideration',
  matched_custom_open: 'consideration',
  planning_desk_open: 'consideration',
  // The visitor asks for money to change hands.
  book_checkout_open: 'intent',
  purchase_help_open: 'intent',
  enquiry_prepared: 'intent',
  enquiry_email_open: 'intent',
  support_draft_prepared: 'intent',
  support_email_open: 'intent',
};

// Some clicks inside one stage are a stronger signal than others. Reading the
// free sample is closer to a purchase than opening the product page.
export const SIGNAL_STRENGTH = {
  book_sample_download: 1.5,
  book_checkout_open: 1.5,
  enquiry_email_open: 1.5,
  matched_book_open: 1.25,
  matched_custom_open: 1.25,
  route_generated: 1.25,
};

export function classifyLabel(label) {
  if (!label) return null;
  return LABEL_STAGE[label] ?? null;
}

export function signalStrength(label) {
  return SIGNAL_STRENGTH[label] ?? 1;
}

// Counts per stage for one path. A label nobody classified is not dropped: it is
// counted as unclassified, so a new label cannot quietly disappear from the report.
export function stageCounts(clicks = {}) {
  const counts = Object.fromEntries(STAGE_IDS.map(id => [id, 0]));
  counts.unclassified = 0;
  const unclassified = {};
  for (const [label, raw] of Object.entries(clicks)) {
    const count = Number(raw) || 0;
    if (!count) continue;
    const id = classifyLabel(label);
    if (!id) {
      counts.unclassified += count;
      unclassified[label] = count;
      continue;
    }
    counts[id] += count;
  }
  counts.unclassifiedLabels = unclassified;
  return counts;
}

// The money distance of a path. Purchase intent is weighted highest, so a single
// checkout click outweighs several reads. The result is an intent score, not a
// turnover figure: the completed order happens outside this site.
export function revenueScore(clicks = {}) {
  let score = 0;
  for (const [label, raw] of Object.entries(clicks)) {
    const count = Number(raw) || 0;
    if (!count) continue;
    const id = classifyLabel(label);
    if (!id) continue;
    score += count * stageWeight(id) * signalStrength(label);
  }
  return Math.round(score * 100) / 100;
}

// The furthest step on the money path that this path actually reached.
export function topStage(clicks = {}) {
  const counts = stageCounts(clicks);
  let best = null;
  for (const id of STAGE_IDS) {
    if (!counts[id]) continue;
    if (!best || stageOrder(id) > stageOrder(best)) best = id;
  }
  return best;
}

// How much money is at stake in a fix. A finding at a later stage always outranks
// an earlier one, and among equal stages the page with more readers wins. The
// logarithm keeps a page with no readers at the end of the list instead of
// dropping it, so a fix is never hidden just because the traffic is not there yet.
export function revenuePriority({ views = 0, stage: stageId = 'attention' } = {}) {
  const reach = 1 + Math.log10(1 + Math.max(0, Number(views) || 0));
  return Math.round(stageWeight(stageId) * reach * 1000) / 1000;
}

// Which money step an in-content offer reaches.
export const OFFER_STAGE = {
  free_plan: 'activation',
  paid_pdf: 'consideration',
  custom_brief: 'consideration',
};

// The pages where money can change hands. Each one has to carry a label of the
// step it owes, otherwise the end of the funnel is invisible.
export const REVENUE_ENDPOINTS = [
  { url: '/', stage: 'activation' },
  { url: '/books/', stage: 'intent' },
  { url: '/custom-guide/', stage: 'intent' },
  { url: '/book-help/', stage: 'intent' },
];

// How many reads are needed before a page is judged. One visit is a coincidence,
// several visits are a pattern.
export const MIN_VIEWS = 3;

// Where a path stands on the money path, read from the clicks it produced.
export function pathVerdict(path) {
  const counts = path.stageClicks ?? stageCounts(path.labels ?? {});
  const views = Number(path.views) || 0;
  const clicks = Number(path.clicks) || 0;
  if (!views && !clicks) return 'no-data';
  if (counts.intent > 0) return 'intent';
  if (counts.consideration > 0) return 'consideration';
  if (counts.activation > 0) return 'activated';
  if (clicks > 0) return 'reading';
  return 'read-not-acting';
}

// The step a path failed to reach. Everything below consideration is free.
export function moneyStep(path) {
  const counts = path.stageClicks ?? stageCounts(path.labels ?? {});
  if (counts.intent > 0) return 'intent';
  if (counts.consideration > 0) return 'consideration';
  if (counts.activation > 0) return 'activation';
  return 'attention';
}

// A guide keeps the code the log and the scheduled prompts already use, so the
// history of the loop stays continuous.
export function findingCode(path) {
  return path.kind === 'funnel' ? 'revenue_no_intent' : 'guide_read_not_acting';
}

// What the revenue rule says about one measured path.
//
//   activated      the free plan was used and the paid offer was never looked at
//   read-not-acting / reading   the page was read and produced no money step
//
// A page with too few reads is not a defect. It is listed as a watch item so it is
// visible without sending the loop into work on a single visit.
export function pathFinding(path, minViews = MIN_VIEWS) {
  const verdict = path.verdict ?? pathVerdict(path);
  const views = Number(path.views) || 0;
  const counts = path.stageClicks ?? stageCounts(path.labels ?? {});
  const base = {
    target: path.path,
    kind: path.kind,
    views,
    stage: 'consideration',
    revenueImpact: revenuePriority({ views, stage: 'consideration' }),
  };
  if (verdict === 'intent' || verdict === 'consideration') return null;
  if (verdict === 'no-data') return null;
  if (verdict === 'activated') {
    return { code: 'revenue_stalled_after_free', ...base, stage: 'consideration', activationClicks: counts.activation };
  }
  if (views >= minViews) {
    return { code: findingCode(path), ...base };
  }
  return null;
}

// The paths that were read but not judged yet. They are reported, not acted on.
export function pathWatch(path, minViews = MIN_VIEWS) {
  const verdict = path.verdict ?? pathVerdict(path);
  const views = Number(path.views) || 0;
  if (verdict === 'no-data' || verdict === 'intent' || verdict === 'consideration') return null;
  if (verdict === 'activated') return null;
  if (views >= minViews) return null;
  return { target: path.path, kind: path.kind, views, stage: 'consideration', reason: `fewer than ${minViews} reads` };
}

// The whole site seen as one funnel. The order step is external, so it stays empty
// and is reported as such instead of being filled with a guess.
export function buildFunnel(paths = []) {
  const stageClicks = Object.fromEntries(STAGE_IDS.map(id => [id, 0]));
  let views = 0;
  let clicks = 0;
  let score = 0;
  for (const path of paths) {
    views += Number(path.views) || 0;
    clicks += Number(path.clicks) || 0;
    score += Number(path.revenueScore) || 0;
    const counts = path.stageClicks ?? stageCounts(path.labels ?? {});
    for (const id of STAGE_IDS) stageClicks[id] += Number(counts[id]) || 0;
  }
  const steps = STAGES.map(item => ({
    id: item.id,
    label: item.label,
    clicks: stageClicks[item.id],
    weight: item.weight,
    external: item.external,
  }));
  const conversion = [];
  for (let index = 1; index < steps.length; index += 1) {
    const from = steps[index - 1];
    const to = steps[index];
    conversion.push({
      from: from.id,
      to: to.id,
      ratio: from.clicks > 0 ? Math.round((to.clicks / from.clicks) * 1000) / 1000 : null,
    });
  }
  return { views, clicks, revenueScore: Math.round(score * 100) / 100, stageClicks, steps, conversion };
}

// What the collected data can actually do right now.
//
// Three different questions used to be packed into one word, and the word was
// read both ways: as "the order of work is settled" and as "the order of work
// cannot be settled yet". They are told apart here:
//
//   canRank           - is there enough traffic to produce an order of work?
//   moneyStepsMeasured - has a click reached a money step (offer or intent)?
//   provisional       - the order may still change once money is measured.
//
// The order of work is final only when moneyStepsMeasured is true. Until then it
// is provisional and says so in words, so no empty ranking is ever presented as
// a settled result.
export function sufficiency(report) {
  const totals = report?.totals ?? {};
  const pathsWithReads = Number(totals.pathsWithReads) || 0;
  const intentClicks = Number(totals.revenueIntentClicks) || 0;
  const offerClicks = Number(totals.considerationClicks) || 0;

  if (!pathsWithReads) {
    return {
      canRank: false,
      moneyStepsMeasured: false,
      provisional: true,
      rankBasis: 'none',
      reason: `Not enough traffic to rank: no path has been read ${MIN_VIEWS} times or more in the window, so no order of work is claimed. The rule stays in place and waits for reads.`,
      nextStep: `Collect reads until a path passes ${MIN_VIEWS} reads, then rank the paths by money.`,
    };
  }
  if (!intentClicks) {
    const basis = offerClicks ? 'the clicks that reached the paid offer' : 'reads only';
    return {
      canRank: true,
      moneyStepsMeasured: false,
      provisional: true,
      rankBasis: offerClicks ? 'early-funnel-clicks' : 'traffic-only',
      reason: `Enough traffic to rank (${pathsWithReads} path${pathsWithReads === 1 ? '' : 's'} read ${MIN_VIEWS} times or more), but no click has reached purchase intent yet, so the order of work is PROVISIONAL: it is built on ${basis}, not on measured money.`,
      nextStep: 'Measure the money steps: send a click to the paid offer (US$7.07 PDF) and to the enquiry, then measure again.',
    };
  }
  return {
    canRank: true,
    moneyStepsMeasured: true,
    provisional: false,
    rankBasis: 'money-steps',
    reason: `${intentClicks} click${intentClicks === 1 ? '' : 's'} reached purchase intent, so the order of work is settled by measured money steps.`,
    nextStep: 'Keep the money steps in view and work on the weakest step of the funnel.',
  };
}
