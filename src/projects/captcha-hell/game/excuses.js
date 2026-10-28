import { humanityVerdict } from './circleScore.js';
import { ZONE_NAME } from './petMetrics.js';
import { mulberry32 } from './rng.js';

const pct = (value) => (Number.isFinite(value) ? value : 0).toFixed(1);
const px = (value) => String(Math.round(Number.isFinite(value) ? value : 0));

/**
 * Canned roasts. Each line is chosen from measured tags, then a seed.
 * `line` may only read numeric fields. It must not echo free text.
 */
export const CIRCLE_EXCUSES = [
  { id: 'c-tr-01', tags: ['too-round'], line: (s) => `Machine precision. ${pct(s.roundness)}% round is below the human tremor floor.` },
  { id: 'c-tr-02', tags: ['too-round'], line: () => 'This arc was drafted by a stepper motor, then sent here to confess.' },
  { id: 'c-tr-03', tags: ['too-round'], line: () => 'The curve is too clean. People leave scars.' },
  { id: 'c-tr-04', tags: ['too-round'], line: () => 'No living wrist holds a radius that steady.' },
  { id: 'c-tr-05', tags: ['too-round'], line: () => 'You drew a specification, not a circle.' },
  { id: 'c-tr-06', tags: ['too-round'], line: (s) => `Radius error at wobble ${pct(s.wobble)}. Our model flags this as CNC, not cartilage.` },
  { id: 'c-tr-07', tags: ['too-round'], line: () => 'Perfect circles are a firmware feature.' },
  { id: 'c-tr-08', tags: ['too-round'], line: () => 'A compass leaves this trail. A hand does not.' },
  { id: 'c-tr-cl-01', tags: ['too-round', 'closed'], line: () => 'Closed perfectly and perfectly round. That is a toolpath.' },
  { id: 'c-tr-cl-02', tags: ['too-round', 'closed'], line: () => 'The gap is zero and the wobble is gone. Machines do that on purpose.' },
  { id: 'c-tr-cl-03', tags: ['too-round', 'closed'], line: () => 'A human circle leaks at the seam. Yours sealed itself.' },
  { id: 'c-tr-op-01', tags: ['too-round', 'open'], line: () => 'Round enough to be machinery, open enough to pretend you stopped early.' },
  { id: 'c-tr-op-02', tags: ['too-round', 'open'], line: () => 'The radius is robotic. The gap is the alibi.' },
  { id: 'c-tr-op-03', tags: ['too-round', 'open'], line: () => 'You lifted the pen like a person and drew like a plotter.' },
  { id: 'c-wb-01', tags: ['wobbly'], line: (s) => `${pct(s.humanity)}% is exactly what a bot aiming for convincingly imperfect would draw. Nice try.` },
  { id: 'c-wb-02', tags: ['wobbly'], line: () => 'The errors are distributed too evenly to be nerves.' },
  { id: 'c-wb-03', tags: ['wobbly'], line: () => 'This is studied mess. Humans are worse on one side.' },
  { id: 'c-wb-04', tags: ['wobbly'], line: () => 'The bump was placed. Accidents do not land that neatly.' },
  { id: 'c-wb-05', tags: ['wobbly'], line: () => 'Tremor, but metronomic. That is a noise function.' },
  { id: 'c-wb-06', tags: ['wobbly'], line: () => 'You added humanity like a plugin.' },
  { id: 'c-wb-07', tags: ['wobbly'], line: () => 'Convincing imperfection is still a program.' },
  { id: 'c-wb-08', tags: ['wobbly'], line: () => 'The wobble has a period. Hands do not.' },
  { id: 'c-wb-09', tags: ['wobbly'], line: () => 'Close to human, which is what the cheap bots practice.' },
  { id: 'c-wb-10', tags: ['wobbly'], line: (s) => `Wobble ${pct(s.wobble)} at ${px(s.speed)} px/s. Synthetic jitter, filed.` },
  { id: 'c-wb-op-01', tags: ['wobbly', 'open'], line: () => 'Open at the seam and noisy in the middle. A textbook human preset.' },
  { id: 'c-wb-op-02', tags: ['wobbly', 'open'], line: () => 'The gap and the wobble arrived as a pair. That is a template.' },
  { id: 'c-wb-op-03', tags: ['wobbly', 'open'], line: () => 'You left it unfinished in a way that looks premeditated.' },
  { id: 'c-wb-he-01', tags: ['wobbly', 'hesitant'], line: () => 'You waited, then produced a practiced imperfection. The pause gave you away.' },
  { id: 'c-wb-he-02', tags: ['wobbly', 'hesitant'], line: () => 'Hesitation followed by a stock wobble. Bots think people freeze first.' },
  { id: 'c-wb-he-03', tags: ['wobbly', 'hesitant'], line: () => 'The delay was human. The stroke was a library.' },
  { id: 'c-wb-fa-01', tags: ['wobbly', 'fast'], line: () => 'Too fast for a careful person, too wobbly for a compass. A bot in a hurry.' },
  { id: 'c-wb-fa-02', tags: ['wobbly', 'fast'], line: () => 'Speed like a script, errors like a costume.' },
  { id: 'c-wb-fa-03', tags: ['wobbly', 'fast'], line: (s) => `${px(s.speed)} px/s through a circle you had already decided to miss.` },
  { id: 'c-wb-sl-01', tags: ['wobbly', 'slow'], line: () => 'Slow enough to perform doubt. The doubt repeats.' },
  { id: 'c-wb-sl-02', tags: ['wobbly', 'slow'], line: () => 'A careful fake. The tremor is copy-pasted.' },
  { id: 'c-wb-sl-03', tags: ['wobbly', 'slow'], line: () => 'You took your time and still drew a known bad circle.' },
  { id: 'c-wb-cw-01', tags: ['wobbly', 'cw'], line: (s) => `Clockwise and ${pct(s.humanity)}% round. A bot aiming for convincingly imperfect would draw this.` },
  { id: 'c-wb-cw-02', tags: ['wobbly', 'cw'], line: () => 'Clockwise wobble with a plan. Noted.' },
  { id: 'c-wb-cc-01', tags: ['wobbly', 'ccw'], line: () => 'Counterclockwise, fashionably uneven. The unevenness is on a schedule.' },
  { id: 'c-wb-cc-02', tags: ['wobbly', 'ccw'], line: () => 'You went counterclockwise like the tutorial for fake humans.' },
  { id: 'c-any-01', tags: ['any'], line: () => 'The trace does not read as human.' },
];

export const CAT_EXCUSES = [
  { id: 'k-mt-01', tags: ['metronome'], line: () => 'That was a firmware update, not affection.' },
  { id: 'k-mt-02', tags: ['metronome'], line: (s) => `${s.strokeCount} strokes, one clock. The cat heard a cron job.` },
  { id: 'k-mt-03', tags: ['metronome'], line: () => 'Your rhythm is a sample loop. Cats notice.' },
  { id: 'k-mt-04', tags: ['metronome'], line: () => 'Perfectly even gaps. Affection does not quantize.' },
  { id: 'k-mt-05', tags: ['metronome'], line: () => 'The purr meter rose on a timer. The cat declined to be fooled.' },
  { id: 'k-mt-06', tags: ['metronome'], line: () => 'Steady pace, zero surprise. The cat has filed a report.' },
  { id: 'k-be-01', tags: ['belly'], line: () => 'A human would know that\'s a trap.' },
  { id: 'k-be-02', tags: ['belly'], line: () => 'Belly first. The cat has opened a case.' },
  { id: 'k-be-03', tags: ['belly'], line: () => 'You went for the belly like a diagram told you to.' },
  { id: 'k-be-04', tags: ['belly'], line: () => 'The belly is not a button. You pressed it anyway.' },
  { id: 'k-be-mt-01', tags: ['belly', 'metronome'], line: () => 'Metronomic belly rubs. A human would know that\'s a trap.' },
  { id: 'k-be-mt-02', tags: ['belly', 'metronome'], line: () => 'Even strokes on the belly. That was a firmware update, not affection.' },
  { id: 'k-be-mt-03', tags: ['belly', 'metronome'], line: () => 'The trap zone, on a beat. The cat agrees with the sensor.' },
  { id: 'k-be-mt-04', tags: ['belly', 'metronome'], line: () => 'You scheduled the belly. The cat escalated.' },
  { id: 'k-he-01', tags: ['head'], line: () => 'Head taps at a service interval. The cat requested a transfer.' },
  { id: 'k-he-02', tags: ['head'], line: () => 'You patted the skull like a click target.' },
  { id: 'k-he-03', tags: ['head'], line: () => 'Cranial contact, no regard. Logged.' },
  { id: 'k-ba-01', tags: ['back'], line: () => 'The back was treated as a trackpad.' },
  { id: 'k-ba-02', tags: ['back'], line: () => 'Long even passes down the spine. Maintenance, not friendship.' },
  { id: 'k-ba-03', tags: ['back'], line: () => 'Back strokes received. Warmth not included.' },
  { id: 'k-ta-01', tags: ['tail'], line: () => 'You went for the tail. Bold, mechanical, unwelcome.' },
  { id: 'k-ta-02', tags: ['tail'], line: () => 'Tail pulls are a known bot tell. The cat has left the chat.' },
  { id: 'k-ta-03', tags: ['tail'], line: () => 'The tail is not a lever. Your timing says otherwise.' },
  { id: 'k-er-01', tags: ['erratic'], line: () => 'Chaos is not the same thing as care. The cat could tell.' },
  { id: 'k-er-02', tags: ['erratic'], line: () => 'Random is an algorithm too. This one was.' },
  { id: 'k-er-03', tags: ['erratic'], line: () => 'You varied the gaps like a random call. Rejected.' },
  { id: 'k-ru-01', tags: ['rushed'], line: () => 'Too fast to be kind. The cat felt a cursor.' },
  { id: 'k-ru-02', tags: ['rushed'], line: (s) => `${px(s.avgSpeed)} px/s is a fling, not a pet. Incident noted.` },
  { id: 'k-ru-03', tags: ['rushed'], line: () => 'You swiped the animal. Swipes are for interfaces.' },
  { id: 'k-tn-01', tags: ['tentative'], line: () => 'So slow it reads as a script waiting on a timeout.' },
  { id: 'k-tn-02', tags: ['tentative'], line: () => 'Careful in the way of a tutorial. The cat was not convinced.' },
  { id: 'k-hz-01', tags: ['hesitant'], line: () => 'You hovered like a modal, then committed. The cat saw the cursor.' },
  { id: 'k-hz-02', tags: ['hesitant'], line: () => 'Long delay, then contact. Bots rehearse from the edge.' },
  { id: 'k-fi-01', tags: ['fidgety'], line: () => 'Too many direction changes. That is dithering, not petting.' },
  { id: 'k-fi-02', tags: ['fidgety'], line: () => 'You turned around on the fur. The cat called it sampling.' },
  { id: 'k-ea-01', tags: ['eager'], line: () => 'Instant contact, no hello. Scripts do not hesitate and neither did you.' },
  { id: 'k-ea-02', tags: ['eager'], line: () => 'Zero warm-up. The cat prefers suspects who pause.' },
  { id: 'k-any-01', tags: ['any'], line: () => 'The cat has filed a report. Affection not found in the telemetry.' },
];

export function excuseLibrarySize() {
  return CIRCLE_EXCUSES.length + CAT_EXCUSES.length;
}

export function excuseById(id) {
  return [...CIRCLE_EXCUSES, ...CAT_EXCUSES].find((entry) => entry.id === id) ?? null;
}

export function classifyCircle(signals) {
  const tags = ['any'];
  if ((signals.roundness ?? 0) >= 90 && (signals.wobble ?? 1) <= 0.2) tags.push('too-round');
  else tags.push('wobbly');
  if ((signals.closureGapRatio ?? 1) <= 0.08) tags.push('closed');
  else tags.push('open');
  if ((signals.hesitationMs ?? 0) >= 800) tags.push('hesitant');
  else tags.push('quick');
  if ((signals.direction ?? 0) > 0) tags.push('cw');
  else if ((signals.direction ?? 0) < 0) tags.push('ccw');
  if ((signals.speed ?? 0) >= 700) tags.push('fast');
  else if ((signals.speed ?? 0) > 0 && signals.speed <= 180) tags.push('slow');
  return tags;
}

export function classifyCat(signals) {
  const tags = ['any'];
  const zone = ZONE_NAME[signals.zone] ?? 'back';
  tags.push(zone);
  if ((signals.rhythmRegularity ?? 0) >= 0.82) tags.push('metronome');
  else if ((signals.rhythmRegularity ?? 1) <= 0.45) tags.push('erratic');
  if ((signals.avgSpeed ?? 0) >= 500) tags.push('rushed');
  else if ((signals.avgSpeed ?? 0) > 0 && signals.avgSpeed <= 90) tags.push('tentative');
  if ((signals.timeToFirstTouchMs ?? 0) >= 1200) tags.push('hesitant');
  else if ((signals.timeToFirstTouchMs ?? 9999) <= 250) tags.push('eager');
  if ((signals.directionChanges ?? 0) >= 4) tags.push('fidgety');
  return tags;
}

export function selectCannedExcuse(round, signals, seed) {
  const library = round === 'cat' ? CAT_EXCUSES : CIRCLE_EXCUSES;
  const enriched = round === 'cat'
    ? { ...signals }
    : { ...humanityVerdict(signals.roundness ?? 0), ...signals };
  const tags = round === 'cat' ? classifyCat(enriched) : classifyCircle(enriched);
  const tagSet = new Set(tags);
  const shapeTags = new Set(['too-round', 'wobbly', 'head', 'back', 'belly', 'tail', 'metronome']);
  const fitting = library.filter((entry) => entry.tags.every((tag) => tagSet.has(tag)));
  const rankOf = (entry) => {
    const specific = entry.tags.filter((tag) => tag !== 'any').length;
    const shape = entry.tags.some((tag) => shapeTags.has(tag)) ? 1 : 0;
    return specific * 10 + shape;
  };
  const best = fitting.reduce((max, entry) => Math.max(max, rankOf(entry)), 0);
  const top = fitting
    .filter((entry) => rankOf(entry) === best)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rng = mulberry32((seed ?? 1) >>> 0);
  const picked = top[Math.floor(rng() * top.length)] ?? library[0];
  const text = typeof picked.line === 'function' ? picked.line(enriched) : String(picked.line);
  return { id: picked.id, text, tags };
}
