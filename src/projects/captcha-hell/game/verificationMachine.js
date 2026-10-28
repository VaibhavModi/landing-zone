export function createVerificationState() {
  return {
    phase: 'choose',
    failed: [],
    selected: 'circle',
    active: null,
    rounds: [],
    early: false,
  };
}

export function availableMethods(state) {
  return ['circle', 'cat'].filter((method) => !state.failed.includes(method));
}

export function selectMethod(state, method) {
  if (state.phase !== 'choose') return state;
  if (method !== 'circle' && method !== 'cat') return state;
  if (state.failed.includes(method)) return state;
  return { ...state, selected: method };
}

export function startSelected(state) {
  if (state.phase !== 'choose') return state;
  if (state.selected !== 'circle' && state.selected !== 'cat') return state;
  if (state.failed.includes(state.selected)) return state;
  return {
    ...state,
    phase: state.selected,
    active: state.selected,
  };
}

export function completeRound(state, result) {
  if (state.phase !== 'circle' && state.phase !== 'cat') return state;
  const method = state.phase;
  const failed = state.failed.includes(method) ? [...state.failed] : [...state.failed, method];
  const rounds = [
    ...state.rounds,
    {
      method,
      signals: result.signals,
      excuse: result.excuse,
      incident: result.incident,
    },
  ];
  const done = failed.length >= 2;
  return {
    ...state,
    failed,
    rounds,
    active: method,
    selected: null,
    phase: done ? 'certificate' : 'verdict',
    early: false,
  };
}

export function acknowledgeVerdict(state) {
  if (state.phase !== 'verdict') return state;
  const remaining = availableMethods({ ...state, failed: state.failed });
  return {
    ...state,
    phase: 'choose',
    active: null,
    selected: remaining[0] ?? null,
  };
}

export function takeCertificateEarly(state) {
  if (state.phase !== 'choose') return state;
  if (state.failed.length !== 1) return state;
  return {
    ...state,
    phase: 'certificate',
    early: true,
    active: null,
  };
}
