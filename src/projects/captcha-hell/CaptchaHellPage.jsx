import InlineArrow from '../InlineArrow.jsx';
import VerificationFlow from './game/VerificationFlow.jsx';
import './captcha-hell.css';

function goProjects(event, openView) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  openView('projects');
}

function playGame(event) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  document.getElementById('play')?.scrollIntoView({ block: 'center' });
}

export default function CaptchaHellPage({ openView }) {
  return (
    <section className="route-frame route-frame--wide">
      <div className="route-frame__inner route-frame__inner--wide">
        <div className="hell">
          <div className="hell__copy">
            <a className="hell__back" href="/projects" onClick={(event) => goProjects(event, openView)}>
              ← All projects
            </a>
            <p className="eyebrow">Captcha Hell™ · Enterprise edition</p>
            <h1>Human verification, reimagined with AI.</h1>
            <p className="hell__lede">
              Captcha Hell™ asks visitors to do things only humans can do, so only real humans make it through.
            </p>
          </div>
          <VerificationFlow />
          <section className="hell__close" aria-labelledby="hell-close-title">
            <h2 id="hell-close-title">Think you&apos;re human?</h2>
            <p>Prove it. It takes under a minute.</p>
            <div className="hell__close-actions">
              <a className="hell__try" href="#play" onClick={playGame}>
                Try it free
                <InlineArrow />
              </a>
              <a className="hell__next" href="/projects" onClick={(event) => goProjects(event, openView)}>
                Next project
                <InlineArrow />
              </a>
            </div>
          </section>
          <p className="hell__parody">A parody project by Vaibhav. Not a real product.</p>
        </div>
      </div>
    </section>
  );
}
