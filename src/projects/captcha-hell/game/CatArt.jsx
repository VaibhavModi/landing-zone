export default function CatArt({ mood = 'calm', trails = [] }) {
  const grumpy = mood === 'grumpy';
  return (
    <svg
      className={grumpy ? 'cat cat--grumpy' : 'cat'}
      viewBox="0 0 240 260"
      role="img"
      aria-hidden="true"
    >
      <ellipse className="cat-shadow" cx="118" cy="244" rx="62" ry="8" />
      <path className="cat-tail" d="M168 158c46-18 62 28 42 62" />
      <ellipse className="cat-fur" cx="112" cy="176" rx="74" ry="58" />
      <ellipse className="cat-belly" cx="112" cy="192" rx="44" ry="36" />
      <path className="cat-fur" d="M78 70 62 18 112 48Z" />
      <path className="cat-fur" d="M148 70 164 18 114 48Z" />
      <path className="cat-inner" d="M84 62 74 30 108 50Z" />
      <path className="cat-inner" d="M142 62 152 30 118 50Z" />
      <circle className="cat-fur" cx="112" cy="86" r="52" />
      {trails.map((points, index) => (
        <polyline key={`${index}-${points.slice(0, 12)}`} className="cat-trail" points={points} />
      ))}
      <g className="eye-happy">
        <ellipse cx="94" cy="84" rx="8" ry="10" className="cat-ink" />
        <ellipse cx="132" cy="84" rx="8" ry="10" className="cat-ink" />
        <circle cx="96" cy="81" r="2.5" className="cat-shine" />
        <circle cx="134" cy="81" r="2.5" className="cat-shine" />
        <path className="cat-line" d="M100 108c8 8 18 8 26 0" />
      </g>
      <g className="eye-grumpy">
        <path className="cat-line" d="M80 70l22 10" />
        <path className="cat-line" d="M146 70l-22 10" />
        <path className="cat-line" d="M84 86h18" />
        <path className="cat-line" d="M124 86h18" />
        <path className="cat-line" d="M98 114c8-8 20-8 28 0" />
      </g>
      <path className="cat-inner" d="M112 96l-7 8h14Z" />
      <path className="cat-line" d="M52 96h28M146 96h28M48 108h30M148 108h30" />
    </svg>
  );
}
