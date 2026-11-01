import InlineArrow from './InlineArrow.jsx';
import './projects.css';

function openProject(event, openView) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  openView('captcha-hell');
}

export default function ProjectsPage({ openView }) {
  return (
    <section className="route-frame route-frame--wide">
      <div className="route-frame__inner route-frame__inner--wide">
        <div className="proj">
          <p className="eyebrow">Projects · AI experiments</p>
          <h1>Things I built to make you smile.</h1>
          <p className="proj__intro">
            Small, playful AI projects. Each one is free to play.
          </p>
          <div className="proj-board">
            <article className="proj-feature">
              <div className="proj-feature__copy">
                <p className="proj-new"><span className="proj-new__dot" aria-hidden="true" /> New</p>
                <h2>Captcha Hell</h2>
                <p>
                  AI-powered human verification for your website. Forget traffic lights.
                  It asks visitors to do things only humans can do.
                </p>
                <a
                  className="proj-cta"
                  href="/projects/captcha-hell"
                  onClick={(event) => openProject(event, openView)}
                >
                  Try it free
                  <InlineArrow />
                </a>
              </div>
              <a
                className="still-link"
                href="/projects/captcha-hell"
                aria-label="Tap to play"
                onClick={(event) => openProject(event, openView)}
              >
                <div className="still">
                  <div className="still__hd">
                    <span>Security check</span>
                    <strong>Draw a perfect circle.</strong>
                    <span>One stroke. No lifting.</span>
                  </div>
                  <div className="still__pad">
                    <svg viewBox="0 0 300 220" aria-hidden="true">
                      <path
                        d="M150 38 C 212 34, 246 82, 240 122 C 234 170, 186 194, 142 190 C 92 186, 58 150, 62 108 C 66 66, 104 40, 156 44"
                        fill="none"
                        stroke="#e8467c"
                        strokeWidth="5"
                        strokeLinecap="round"
                      />
                      <text x="150" y="118" textAnchor="middle" fontSize="30" fontWeight="700" fill="#1b1f24">87.4%</text>
                      <text x="150" y="140" textAnchor="middle" fontSize="11" fill="#5c6775">circle accuracy</text>
                    </svg>
                  </div>
                  <div className="still__ft">
                    <span>Precision check</span>
                    <span className="still__verify">Verify</span>
                  </div>
                  <p className="still__caption">Tap to play</p>
                </div>
              </a>
            </article>
            <div className="proj-ghosts">
              <div className="proj-ghost">More experiments loading…</div>
              <div className="proj-ghost">More experiments loading…</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
