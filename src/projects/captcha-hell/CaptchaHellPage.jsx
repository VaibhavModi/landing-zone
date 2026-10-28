import VerificationFlow from './game/VerificationFlow.jsx';
import './captcha-hell.css';

function goProjects(event, openView) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  openView('projects');
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
            <p className="hell__by">An experiment by Vaibhav Modi</p>
          </div>
          <VerificationFlow />
          <p className="hell__parody">A parody project by Vaibhav. Not a real product.</p>
        </div>
      </div>
    </section>
  );
}
