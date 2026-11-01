import { useEffect, useRef, useState } from 'react';
import InlineArrow from '../../InlineArrow.jsx';
import CatArt from './CatArt.jsx';
import CatRound from './CatRound.jsx';
import CircleRound, { CircleSketch } from './CircleRound.jsx';
import { humanityVerdict } from './circleScore.js';
import { excuseFromSignals } from './excuseContract.js';
import { ANALYZING_LABEL, requestExcuseLine } from './requestExcuse.js';
import MethodPicker, { ShieldMark } from './MethodPicker.jsx';
import {
  acknowledgeVerdict,
  completeRound,
  createVerificationState,
  retryRound,
  selectMethod,
  skipToCertificate,
  startSelected,
  takeCertificateEarly,
} from './verificationMachine.js';

const ROAST_SESSION_KEY = 'captcha-hell-roast';

export const GAME_CHUNK_MARKER = 'captcha-hell-game-chunk';

function formatSeconds(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

function AnalyzingLine() {
  return (
    <p className="ch-verdict__line">
      Analyzing behavioral signature
      <span className="ch-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
    </p>
  );
}

function Verdict({ round, artwork, line }) {
  const circle = round.method === 'circle';
  const signals = round.signals;
  const analyzing = line?.status === 'analyzing' && line.incident === round.incident;
  const text = line?.incident === round.incident && line.status === 'ready' ? line.text : round.excuse;
  return (
    <div className="ch-round">
      {circle && artwork?.points ? (
        <CircleSketch points={artwork.points} score={artwork.score} />
      ) : (
        <div className="ch-cat ch-cat--verdict">
          <CatArt mood="grumpy" />
          <p className="ch-left">The cat has left the chat.</p>
        </div>
      )}
      {circle ? (
        <p className="ch-metrics">
          {signals.roundness.toFixed(1)}
          % round ·
          {' '}
          {formatSeconds(signals.durationMs)}
          s ·
          {' '}
          {signals.pauseCount}
          {' '}
          pauses
        </p>
      ) : (
        <p className="ch-metrics">
          Strokes
          {' '}
          {signals.strokeCount}
          {' · avg speed '}
          {Math.round(signals.avgSpeed)}
          {' px/s · rhythm '}
          {signals.rhythmRegularity.toFixed(2)}
        </p>
      )}
      <div className="ch-verdict">
        <strong>
          NOT HUMAN · INCIDENT #
          {round.incident}
        </strong>
        <div className="ch-verdict__slot">
          {analyzing ? <AnalyzingLine /> : <p className="ch-verdict__line">{text}</p>}
        </div>
        {circle ? (
          <p className="ch-humanity">
            Humanity:
            {' '}
            {signals.humanity.toFixed(1)}
            % · Required:
            {' '}
            {signals.required.toFixed(1)}
            %
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Certificate({ unlocked, round, titleRef }) {
  return (
    <section id="certificate" className={unlocked ? 'ch-cert' : 'ch-cert ch-cert--locked'} aria-labelledby="certificate-title">
      <p className="ch-cert__kicker">Bureau of Human Verification</p>
      {unlocked && round ? (
        <>
          <h2 id="certificate-title" ref={titleRef} tabIndex={-1}>Officially a Robot</h2>
          <p className="ch-cert__id">
            Incident #
            {round.incident}
          </p>
          <p className="ch-cert__line">Congratulations, you are a robot. Please don&apos;t install this.</p>
          <a
            className="ch-share"
            href={shareUrl(round.incident)}
            target="_blank"
            rel="noreferrer"
          >
            Share on X
          </a>
        </>
      ) : (
        <>
          <h2 id="certificate-title">Your official result</h2>
          <p className="ch-cert__line">Complete verification to receive your certificate.</p>
        </>
      )}
      <p className="ch-seal" aria-hidden="true">{unlocked ? 'Robot' : 'Seal'}</p>
    </section>
  );
}

function shareUrl(incident) {
  const safe = /^\d{4}$/.test(String(incident)) ? String(incident) : '0000';
  const text = `Officially a robot (incident #${safe}). Congratulations, you are a robot. Please don't install this. https://www.vaibhavmodi.com/projects/captcha-hell`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

function Widget({ kicker, title, lede, children, titleRef }) {
  return (
    <div className="ch-widget" data-game-chunk={GAME_CHUNK_MARKER}>
      <div className="ch-widget__hd">
        <p className="ch-widget__kicker">
          <ShieldMark />
          {kicker}
        </p>
        <h2 ref={titleRef} tabIndex={titleRef ? -1 : undefined}>{title}</h2>
        {lede ? <p className="ch-widget__lede">{lede}</p> : null}
      </div>
      {children}
    </div>
  );
}

export default function VerificationFlow() {
  const [state, setState] = useState(createVerificationState);
  const [announcement, setAnnouncement] = useState('');
  const [artwork, setArtwork] = useState(null);
  const [line, setLine] = useState(null);
  const flight = useRef(null);
  const mounted = useRef(true);
  const roastSent = useRef(false);
  const latestIncident = useRef(null);
  const startRef = useRef(null);
  const certTitle = useRef(null);
  const verdictTitle = useRef(null);
  const unlocked = state.phase === 'certificate';
  const last = state.rounds[state.rounds.length - 1] ?? null;

  useEffect(() => {
    if (state.phase === 'choose' && state.failed.length === 1) {
      startRef.current?.focus();
    }
  }, [state.phase, state.failed.length]);

  useEffect(() => {
    if (state.phase === 'verdict') verdictTitle.current?.focus();
  }, [state.phase, last?.incident]);

  useEffect(() => {
    if (unlocked) certTitle.current?.focus();
  }, [unlocked]);

  useEffect(() => () => {
    mounted.current = false;
    flight.current?.controller.abort();
  }, []);

  const publishLine = (incident, text) => {
    if (!mounted.current) return;
    if (latestIncident.current !== incident) return;
    setLine({ status: 'ready', incident, text });
    setAnnouncement(text);
  };

  const roastAlreadySent = () => {
    if (roastSent.current) return true;
    try {
      return sessionStorage.getItem(ROAST_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  };

  const askForLine = (result) => {
    if (roastAlreadySent()) {
      roastSent.current = true;
      setLine({ status: 'ready', incident: result.incident, text: result.text });
      setAnnouncement(result.text);
      return;
    }
    if (flight.current?.incident === result.incident) return;
    roastSent.current = true;
    try {
      sessionStorage.setItem(ROAST_SESSION_KEY, '1');
    } catch {
      // Private mode. This mount still will not ask again.
    }
    const controller = new AbortController();
    flight.current = { incident: result.incident, controller };
    setLine({ status: 'analyzing', incident: result.incident, text: result.text });
    setAnnouncement(ANALYZING_LABEL);
    requestExcuseLine(result.payload, { signal: controller.signal }).then((aiText) => {
      if (controller.signal.aborted) return;
      publishLine(result.incident, aiText || result.text);
    });
  };

  const onStart = () => {
    setAnnouncement(state.selected === 'cat'
      ? 'Empathy check. Pet the cat.'
      : 'Precision check. Draw a perfect circle.');
    setState((current) => startSelected(current));
  };

  const finishRound = (method, result, nextArtwork) => {
    const isFinal = state.failed.length === 1 && !state.failed.includes(method);
    latestIncident.current = result.incident;
    if (method === 'circle') setArtwork(nextArtwork);
    else setArtwork(null);
    setState((current) => completeRound(current, {
      signals: result.payload,
      excuse: result.text,
      incident: result.incident,
    }));
    if (!isFinal) {
      setLine({ status: 'ready', incident: result.incident, text: result.text });
      setAnnouncement(result.text);
      return;
    }
    askForLine(result);
  };

  const finishCircle = (score, points) => {
    const merged = { ...score, ...humanityVerdict(score.roundness) };
    finishRound('circle', excuseFromSignals('circle', merged), { points, score: merged });
  };

  const finishCat = (score) => {
    finishRound('cat', excuseFromSignals('cat', score), null);
  };

  let widget;
  if (state.phase === 'circle') {
    widget = (
      <Widget kicker="Precision check" title="Draw a perfect circle." lede="One stroke. No lifting.">
        <CircleRound onComplete={finishCircle} onAnnounce={setAnnouncement} />
      </Widget>
    );
  } else if (state.phase === 'cat') {
    widget = (
      <Widget kicker="Empathy check" title="Pet the cat." lede="A slow, kind stroke.">
        <CatRound onComplete={finishCat} onAnnounce={setAnnouncement} />
      </Widget>
    );
  } else if ((state.phase === 'verdict' || state.phase === 'certificate') && last) {
    widget = (
      <Widget
        kicker={`Incident #${last.incident}`}
        title={last.method === 'circle' ? 'Analyzing your circle…' : 'The cat has filed a report.'}
        lede={last.method === 'circle' ? 'Suspicious bump marked.' : 'Reviewing your petting technique…'}
        titleRef={state.phase === 'verdict' ? verdictTitle : null}
      >
        <Verdict round={last} artwork={last.method === 'circle' ? artwork : null} line={line} />
        {state.phase === 'verdict' ? (
          <div className="ch-reject">
            <button
              className="ch-go"
              type="button"
              onClick={() => {
                setAnnouncement(last.method === 'cat'
                  ? 'Empathy check. Pet the cat.'
                  : 'Precision check. Draw a perfect circle.');
                setState((current) => retryRound(current));
              }}
            >
              Try again
            </button>
            {state.failed.length >= 2 ? (
              <button
                className="ch-go ch-go--line"
                type="button"
                onClick={() => {
                  setAnnouncement('Officially a robot. Please do not install this.');
                  setState((current) => skipToCertificate(current));
                }}
              >
                Skip to my certificate
                <InlineArrow />
              </button>
            ) : (
              <button
                className="ch-go ch-go--line"
                type="button"
                onClick={() => {
                  setAnnouncement('Inconclusive. Please try another method.');
                  setState((current) => acknowledgeVerdict(current));
                }}
              >
                Try different challenge
                <InlineArrow />
              </button>
            )}
          </div>
        ) : (
          <a className="ch-go ch-go--block" href="#certificate">View certificate</a>
        )}
      </Widget>
    );
  } else {
    widget = (
      <Widget kicker="Security check" title="Verify you're human." lede="Choose a verification method.">
        <MethodPicker
          selected={state.selected}
          failed={state.failed}
          inconclusive={state.failed.length === 1}
          onSelect={(method) => setState((current) => selectMethod(current, method))}
          onStart={onStart}
          onEarly={() => {
            setAnnouncement('Officially a robot. Please do not install this.');
            setState((current) => takeCertificateEarly(current));
          }}
          startRef={startRef}
        />
      </Widget>
    );
  }

  return (
    <>
      <div className="ch-slot" id="play">
        <div className="sr-only" role="status">{announcement}</div>
        {widget}
      </div>
      <Certificate unlocked={unlocked} round={unlocked ? last : null} titleRef={certTitle} />
    </>
  );
}
