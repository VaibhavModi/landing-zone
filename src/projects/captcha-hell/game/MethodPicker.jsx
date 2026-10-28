import CatArt from './CatArt.jsx';

function Shield() {
  return (
    <svg className="ch-shield" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 8.4 8 11 4.6-2.6 8-6 8-11V5l-8-3z" />
    </svg>
  );
}

function CircleMark() {
  return (
    <svg className="method-card__mark" viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 14 C 78 12, 90 36, 88 54 C 86 78, 66 90, 48 89 C 26 88, 12 72, 13 52 C 14 30, 30 16, 54 17"
        fill="none"
        stroke="#e8467c"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeMark() {
  return (
    <svg className="method-soon__eye" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 5c5 0 9.2 3.1 11 7-1.8 3.9-6 7-11 7S2.8 15.9 1 12C2.8 8.1 7 5 12 5zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    </svg>
  );
}

const METHODS = [
  {
    id: 'circle',
    title: 'Draw a perfect circle',
    meta: 'Precision check · ~10 sec',
  },
  {
    id: 'cat',
    title: 'Pet the cat',
    meta: 'Empathy check · ~10 sec',
  },
];

export default function MethodPicker({
  selected,
  failed,
  inconclusive,
  onSelect,
  onStart,
  onEarly,
  startRef,
}) {
  return (
    <div className="ch-picker">
      {inconclusive ? (
        <p className="ch-alert" aria-hidden="true">Inconclusive. Please try another method.</p>
      ) : null}
      <div className="method-grid">
        {METHODS.map((method) => {
          const isFailed = failed.includes(method.id);
          const isSelected = !isFailed && selected === method.id;
          return (
            <button
              key={method.id}
              type="button"
              className={`method-card${isSelected ? ' is-selected' : ''}${isFailed ? ' is-failed' : ''}`}
              aria-pressed={isSelected}
              aria-disabled={isFailed ? 'true' : undefined}
              onClick={() => {
                if (!isFailed) onSelect(method.id);
              }}
            >
              <span className="method-card__art">
                {method.id === 'circle' ? <CircleMark /> : <CatArt />}
              </span>
              <span className="method-card__title">{method.title}</span>
              <span className="method-card__meta">{method.meta}</span>
              {isFailed ? <span className="method-card__flag">Failed</span> : null}
            </button>
          );
        })}
      </div>
      <div className="method-soon">
        <span className="method-soon__label">
          <EyeMark />
          Retina scan
        </span>
        <span>Coming soon</span>
      </div>
      <div className="ch-widget__ft">
        <span className="ch-protect">
          <Shield />
          Protected by Captcha Hell™
        </span>
        <button
          ref={startRef}
          className="ch-go"
          type="button"
          onClick={onStart}
          disabled={!selected || failed.includes(selected)}
        >
          Start
          <span aria-hidden="true"> →</span>
        </button>
      </div>
      {inconclusive ? (
        <button className="ch-early" type="button" onClick={onEarly}>
          Get your certificate anyway?
        </button>
      ) : null}
    </div>
  );
}

export function ShieldMark() {
  return <Shield />;
}
