import { describe, expect, it } from 'vitest';
import {
  acknowledgeVerdict,
  availableMethods,
  completeRound,
  createVerificationState,
  selectMethod,
  startSelected,
  takeCertificateEarly,
} from './verificationMachine.js';

const circleResult = { signals: { roundness: 80 }, excuse: 'Too studied.', incident: '0417' };
const catResult = { signals: { zone: 2 }, excuse: 'The belly was a trap.', incident: '0418' };

describe('verification state machine', () => {
  it('goes pick, play, reject, remaining method, play, certificate', () => {
    const start = createVerificationState();
    const picked = selectMethod(start, 'circle');
    const playing = startSelected(picked);
    expect(playing.phase).toBe('circle');
    expect(start.phase).toBe('choose');

    const verdict = completeRound(playing, circleResult);
    expect(verdict.phase).toBe('verdict');
    expect(verdict.failed).toEqual(['circle']);
    expect(verdict.rounds).toHaveLength(1);

    const again = acknowledgeVerdict(verdict);
    expect(again.phase).toBe('choose');
    expect(again.failed).toEqual(['circle']);
    expect(availableMethods(again)).toEqual(['cat']);
    expect(again.selected).toBe('cat');
    expect(selectMethod(again, 'circle')).toBe(again);

    const second = completeRound(startSelected(selectMethod(again, 'cat')), catResult);
    expect(second.phase).toBe('certificate');
    expect(second.early).toBe(false);
    expect(second.failed).toEqual(['circle', 'cat']);
    expect(second.rounds.map((round) => round.method)).toEqual(['circle', 'cat']);
  });

  it('also accepts cat first, then the circle', () => {
    let state = startSelected(selectMethod(createVerificationState(), 'cat'));
    expect(state.phase).toBe('cat');
    state = acknowledgeVerdict(completeRound(state, catResult));
    expect(availableMethods(state)).toEqual(['circle']);
    state = completeRound(startSelected(state), circleResult);
    expect(state.phase).toBe('certificate');
    expect(state.rounds.map((round) => round.incident)).toEqual(['0418', '0417']);
  });

  it('offers an early certificate only after one failure', () => {
    const fresh = createVerificationState();
    expect(takeCertificateEarly(fresh)).toBe(fresh);
    const afterOne = acknowledgeVerdict(
      completeRound(startSelected(selectMethod(fresh, 'circle')), circleResult),
    );
    const early = takeCertificateEarly(afterOne);
    expect(early.phase).toBe('certificate');
    expect(early.early).toBe(true);
    expect(early.failed).toEqual(['circle']);
    expect(takeCertificateEarly(early)).toBe(early);
  });

  it('does not start an unknown method', () => {
    const state = createVerificationState();
    expect(selectMethod(state, 'retina')).toBe(state);
    const forged = { ...state, selected: 'retina' };
    expect(startSelected(forged)).toBe(forged);
  });
});
