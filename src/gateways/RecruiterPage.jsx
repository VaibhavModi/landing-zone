import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';

const focusAreas = [
  {
    id: 'frontend',
    label: 'Frontend dev',
    title: 'Frontend polish',
    body: 'I care about the last 10%: responsive layouts, motion, state flow, and interfaces that feel considered instead of assembled.',
  },
  {
    id: 'mobile',
    label: 'Mobile dev',
    title: 'Mobile instincts',
    body: 'I think in constraints: thumb reach, loading feel, scroll rhythm, and what survives when attention is fragmented.',
  },
  {
    id: 'fullstack',
    label: 'Full-stack',
    title: 'Full-stack range',
    body: 'I can move from product shape to API edges to deployment details without losing the through-line of the experience.',
  },
  {
    id: 'ships',
    label: 'Someone who ships',
    title: 'Bias to shipping',
    body: 'I like momentum. I prototype, tighten, and get things in front of people instead of letting them sit as good intentions.',
  },
  {
    id: 'independent',
    label: 'Independent builder',
    title: 'Solo execution',
    body: 'I have designed, built, and iterated projects end-to-end on my own, including product direction, implementation, and refinement.',
  },
  {
    id: 'team',
    label: 'Team player',
    title: 'Team fit',
    body: 'I enjoy being the person who reduces ambiguity, raises quality, and makes the rest of the team faster and calmer.',
  },
];

const quickContactPrompts = [
  "I'm hiring",
  "Let's collaborate",
  'Just saying hi',
];

const contactFormTestingMode = false;
const submittedChatsStorageKey = 'recruiter-page-submitted-chats';
const contactProfileStorageKey = 'recruiter-page-contact-profile';
const messageReceivedReply = 'Message received. I will get back to you shortly.';

export default function RecruiterPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [senderName, setSenderName] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    try {
      const storedProfile = window.localStorage.getItem(contactProfileStorageKey);
      const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
      return typeof parsedProfile?.name === 'string' ? parsedProfile.name : '';
    } catch {
      return '';
    }
  });
  const [messageDraft, setMessageDraft] = useState('');
  const [replyEmail, setReplyEmail] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    try {
      const storedProfile = window.localStorage.getItem(contactProfileStorageKey);
      const parsedProfile = storedProfile ? JSON.parse(storedProfile) : null;
      return typeof parsedProfile?.email === 'string' ? parsedProfile.email : '';
    } catch {
      return '';
    }
  });
  const [submittedChats, setSubmittedChats] = useState(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const storedChats = window.localStorage.getItem(submittedChatsStorageKey);
      const parsedChats = storedChats ? JSON.parse(storedChats) : [];
      return Array.isArray(parsedChats) ? parsedChats : [];
    } catch {
      return [];
    }
  });
  const [pendingChat, setPendingChat] = useState(null);
  const [sendState, setSendState] = useState('idle');
  const [sendFeedback, setSendFeedback] = useState('');
  const zoneTwoRef = useRef(null);
  const chatThreadRef = useRef(null);
  const fileId = '1Np1j9jwn4O_rdu1i0X74qZV4i9pBFN_w';
  const resumeHref = `https://drive.google.com/file/d/${fileId}/view`;
  const embedSrc = `https://drive.google.com/file/d/${fileId}/preview`;
  const downloadHref = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const modalRoot = typeof document !== 'undefined' ? document.querySelector('.site-shell') : null;
  const web3FormsEndpoint = 'https://api.web3forms.com/submit';
  const web3FormsAccessKey = (import.meta.env.VITE_WEB3FORMS_KEY || '').trim();
  const contactFormConfigured = web3FormsAccessKey.length > 0;
  const contactFormUnavailableMessage = 'The contact form is not available right now. Please email hi@vaibhavmodi.com instead.';

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const chatThreadNode = chatThreadRef.current;

    if (!chatThreadNode) {
      return;
    }

    chatThreadNode.scrollTop = chatThreadNode.scrollHeight;
  }, [submittedChats, pendingChat]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(submittedChatsStorageKey, JSON.stringify(submittedChats));
    } catch {
      // Ignore storage write failures and keep the in-memory chat history working.
    }
  }, [submittedChats]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(
        contactProfileStorageKey,
        JSON.stringify({
          name: senderName,
          email: replyEmail,
        })
      );
    } catch {
      // Ignore storage write failures and keep the form usable.
    }
  }, [senderName, replyEmail]);

  const selectedProofs = useMemo(
    () => focusAreas.filter((area) => selectedAreas.includes(area.id)),
    [selectedAreas]
  );

  const toggleArea = (areaId) => {
    setSelectedAreas((current) => (
      current.includes(areaId)
        ? current.filter((id) => id !== areaId)
        : [...current, areaId]
    ));
  };

  const applyQuickPrompt = (prompt) => {
    setSendFeedback('');
    setSendState('idle');
    setMessageDraft((current) => {
      if (!current.trim()) {
        return `${prompt} — `;
      }

      return current;
    });
  };

  const appendSubmittedChat = ({ name, email, message }) => {
    const chatId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setSubmittedChats((current) => [...current, {
      id: chatId,
      name,
      email,
      message,
      responseText: '',
    }]);

    window.setTimeout(() => {
      setSubmittedChats((current) => current.map((chat) => (
        chat.id === chatId
          ? { ...chat, responseText: messageReceivedReply }
          : chat
      )));
    }, 1000);
  };

  const clearConversation = () => {
    setSenderName('');
    setReplyEmail('');
    setMessageDraft('');
    setSubmittedChats([]);
    setSendState('idle');
    setSendFeedback('');

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.removeItem(submittedChatsStorageKey);
      window.localStorage.removeItem(contactProfileStorageKey);
    } catch {
      // Ignore storage failures and still clear in-memory state.
    }
  };

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;

    if (!contactFormConfigured) {
      setSendState('error');
      setSendFeedback(contactFormUnavailableMessage);
      return;
    }

    const trimmedName = senderName.trim();
    const trimmedMessage = messageDraft.trim();
    const trimmedEmail = replyEmail.trim();
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!trimmedName) {
      setSendState('error');
      setSendFeedback('Add your name so I know who reached out.');
      return;
    }

    if (!trimmedMessage) {
      setSendState('error');
      setSendFeedback('Add a message before sending.');
      return;
    }

    if (!emailIsValid) {
      setSendState('error');
      setSendFeedback('Add a valid reply email so I know where to respond.');
      return;
    }

    setSendState('sending');
    setSendFeedback('');
    setPendingChat({
      name: trimmedName,
      email: trimmedEmail,
      message: trimmedMessage,
    });

    try {
      if (contactFormTestingMode) {
        appendSubmittedChat({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
        });
        setPendingChat(null);
        setSendState('success');
        setSendFeedback('');
        setMessageDraft('');
        return;
      }

      const formData = new FormData(form);
      formData.set('access_key', web3FormsAccessKey);
      formData.set('name', trimmedName);
      formData.set('email', trimmedEmail);
      formData.set('message', trimmedMessage);
      formData.set('subject', 'New recruiter page message');
      formData.set('from_name', 'Recruiter Page Chat');

      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      });

      const result = await response.json();
      const responseMessage = result.message || result?.body?.message;

      if (!response.ok || !result.success) {
        throw new Error(responseMessage || `Request failed with status ${response.status}`);
      }

      appendSubmittedChat({
        name: trimmedName,
        email: trimmedEmail,
        message: trimmedMessage,
      });
      setPendingChat(null);
      setSendState('success');
      setSendFeedback('');
      setMessageDraft('');
    } catch (error) {
      setPendingChat(null);
      setSendState('error');
      setSendFeedback(error.message || 'Something went wrong while sending. Please try again in a moment.');
    }
  };

  const resumeCard = (
    <ResumeCard
      downloadHref={downloadHref}
      onOpen={() => setIsOpen(true)}
    />
  );

  return (
    <>
      <div className="recruiter-page recruiter-story">
        <section className="story-zone story-zone--hook">
          <div className="story-hook-layout">
            <div className="story-hero-copy">
              <div className="story-meta-row" aria-label="Location and work preferences">
                <span className="story-meta-pill">Dallas, TX</span>
              </div>
              <p className="story-kicker">recent experience</p>
              <h1 className="story-headline">
                On AWS - ATX Refactor, I worked on modernizing millions of lines of code and improving performance at scale.
              </h1>
              <p className="story-line story-line--support">
                That meant transformation engines, caching, long-running transactions, and systems built for concurrent users.
              </p>
            </div>

            <div className="story-hook-signals" aria-label="Experience highlights">
              <article className="story-hook-signal">
                <p className="story-hook-value">10M+</p>
                <p className="story-hook-label">lines modernized</p>
              </article>
              <article className="story-hook-signal">
                <p className="story-hook-value">hours {'->'} minutes</p>
                <p className="story-hook-label">transformation time reduced</p>
              </article>
              <article className="story-hook-signal">
                <p className="story-hook-value">AWS</p>
                <p className="story-hook-label">current lead role</p>
              </article>
              <article className="story-hook-signal">
                <p className="story-hook-value">60%</p>
                <p className="story-hook-label">faster code conversion</p>
              </article>
              <article className="story-hook-signal">
                <p className="story-hook-value">70%</p>
                <p className="story-hook-label">faster record processing</p>
              </article>
              <article className="story-hook-signal">
                <p className="story-hook-value">75%</p>
                <p className="story-hook-label">lower API latency</p>
              </article>
            </div>
          </div>
        </section>

        <div className="story-separator" aria-hidden="true" />

        <section className="story-zone story-zone--conversation" ref={zoneTwoRef}>
          <div className="story-conversation-layout">
            <div className="story-conversation-copy">
              <h2 className="story-question">What are you looking for?</h2>
              <p className="story-helper">
                Pick what matters most, and I&apos;ll show the strongest examples behind it.
              </p>
              <p className="story-helper story-helper--count">
                There&apos;s more depth behind each one. Select any that apply — {selectedAreas.length} selected.
              </p>
            </div>

            <div className="story-conversation-stack">
              <div className="story-pill-grid" role="group" aria-label="What are you looking for">
                {focusAreas.map((area) => (
                  <button
                    key={area.id}
                    className={`story-pill${selectedAreas.includes(area.id) ? ' story-pill--active' : ''}`}
                    onClick={() => toggleArea(area.id)}
                    type="button"
                    aria-pressed={selectedAreas.includes(area.id)}
                  >
                    {area.label}
                  </button>
                ))}
              </div>

              <div className={`proof-grid${selectedProofs.length ? ' proof-grid--visible' : ''}`}>
                {selectedProofs.map((proof) => (
                  <article key={proof.id} className="proof-card">
                    <p className="proof-card__title">{proof.title}</p>
                    <p className="proof-card__body">{proof.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="story-separator" aria-hidden="true" />

        <section className="story-zone story-zone--resume">
          <div className="story-resume-layout">
            <div className="story-resume-copyblock">
              <p className="story-kicker">formal version</p>
              <p className="story-resume-copy">Like what you see?</p>
              <p className="story-resume-subcopy">
                Here&apos;s the resume if you want the concise, credentialed version.
              </p>
            </div>
            <div className="story-resume-card">{resumeCard}</div>
          </div>
        </section>

        <div className="story-separator" aria-hidden="true" />

        <section className="story-zone story-zone--contact">
          <div className="story-contact-layout">
            <div className="story-contact-copyblock">
              <p className="story-kicker">contact me</p>
              <h2 className="story-contact-title">Let&apos;s Talk</h2>
              <p className="story-contact-trust">
                No sign-in. No redirects. Just write your note and press send.
              </p>
              <p className="story-contact-subcopy">
                If there&apos;s a role, project, or idea worth talking about, send it here and I&apos;ll reply directly.
              </p>
            </div>

            <div className="contact-chat-shell">
              <div className="contact-chat-card">
                <div className="contact-chat-header">
                  <div className="contact-chat-avatar" aria-hidden="true">VM</div>
                  <div className="contact-chat-meta">
                    <p className="contact-chat-name">Vaibhav Modi</p>
                    <p className="contact-chat-status">
                      <span className="contact-chat-status-dot" aria-hidden="true" />
                      Usually replies within a few hours
                    </p>
                  </div>
                </div>

                <div className="contact-chat-thread-wrap">
                  <div className="contact-chat-thread" ref={chatThreadRef}>
                    <div className="contact-chat-bubble-row">
                      <div className="contact-chat-avatar contact-chat-avatar--small" aria-hidden="true">VM</div>
                      <div className="contact-chat-bubble-wrap">
                        <p className="contact-chat-bubble">
                          Hey, thanks for stopping by. I&apos;m open to new opportunities, collaborations, and thoughtful intros.
                        </p>
                        <p className="contact-chat-time">Just now</p>
                      </div>
                    </div>

                    {submittedChats.map((chat, index) => (
                      <div key={`${chat.email}-${index}`} className="contact-chat-entry">
                        <div className="contact-chat-bubble-row contact-chat-bubble-row--sent">
                          <div className="contact-chat-bubble-wrap contact-chat-bubble-wrap--sent">
                            <p className="contact-chat-bubble contact-chat-bubble--sent">
                              {chat.message}
                            </p>
                            <p className="contact-chat-time contact-chat-time--sent">
                              Sent · From {chat.name}
                            </p>
                          </div>
                        </div>

                        {chat.responseText && (
                          <div className="contact-chat-bubble-row">
                            <div className="contact-chat-avatar contact-chat-avatar--small" aria-hidden="true">VM</div>
                            <div className="contact-chat-bubble-wrap">
                              <p className="contact-chat-bubble">
                                {chat.responseText}
                              </p>
                              <p className="contact-chat-time">Just now</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {pendingChat && (
                      <div className="contact-chat-entry">
                        <div className="contact-chat-bubble-row contact-chat-bubble-row--sent">
                          <div className="contact-chat-bubble-wrap contact-chat-bubble-wrap--sent">
                            <p className="contact-chat-bubble contact-chat-bubble--sent">
                              {pendingChat.message}
                            </p>
                            <p className="contact-chat-time contact-chat-time--sent">
                              Sending...
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {!messageDraft.trim() && !submittedChats.length && (
                    <div className="contact-chat-prompts">
                      <p className="contact-chat-prompts-label">Tap to start a conversation</p>
                      <div className="contact-chat-prompt-list">
                        {quickContactPrompts.map((prompt) => (
                          <button
                            key={prompt}
                            className="contact-chat-prompt"
                            type="button"
                            onClick={() => applyQuickPrompt(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <form
                  className="contact-chat-form"
                  action={web3FormsEndpoint}
                  method="POST"
                  onSubmit={handleContactSubmit}
                >
                  <input type="hidden" name="access_key" value={web3FormsAccessKey} />
                  <input type="hidden" name="subject" value="New recruiter page message" />
                  <input type="hidden" name="from_name" value="Recruiter Page Chat" />
                  <input type="checkbox" name="botcheck" className="contact-chat-botcheck" tabIndex="-1" autoComplete="off" />

                  <label className="contact-chat-field">
                    <span className="contact-chat-label sr-only">Your message</span>
                    <textarea
                      className="contact-chat-input contact-chat-input--message"
                      name="message"
                      placeholder="Or type your own message..."
                      rows="3"
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                    />
                  </label>

                  <div className="contact-chat-identityrow">
                    <label className="contact-chat-field">
                      <span className="contact-chat-label sr-only">Your name</span>
                      <input
                        className="contact-chat-input"
                        name="name"
                        type="text"
                        placeholder="Your name"
                        autoComplete="name"
                        value={senderName}
                        onChange={(event) => setSenderName(event.target.value)}
                      />
                    </label>

                    <label className="contact-chat-replyrow">
                      <span className="contact-chat-replylabel">Reply to:</span>
                      <input
                        className="contact-chat-input"
                        name="email"
                        type="email"
                        placeholder="your@email.com"
                        autoComplete="email"
                        value={replyEmail}
                        onChange={(event) => setReplyEmail(event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="contact-chat-sendrow">
                    <button
                      className="contact-chat-send"
                      type="submit"
                      disabled={sendState === 'sending'}
                    >
                      {sendState === 'sending' ? 'Sending...' : 'Send'}
                    </button>
                  </div>

                  <p
                    className={`contact-chat-feedback${(!contactFormConfigured || sendState === 'error') ? ' contact-chat-feedback--visible' : ''}`}
                    role="status"
                  >
                    {sendState === 'error'
                      ? sendFeedback
                      : (contactFormConfigured ? sendFeedback : contactFormUnavailableMessage)}
                  </p>

                  <a className="contact-chat-email-link" href="mailto:hi@vaibhavmodi.com">
                    Prefer email? Reach me at <span>hi@vaibhavmodi.com</span>
                  </a>

                  <button
                    className="contact-chat-clear"
                    type="button"
                    onClick={clearConversation}
                  >
                    Clear conversation
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </div>

      {isOpen && modalRoot && createPortal(
        <div className="resume-modal" role="dialog" aria-modal="true" aria-label="Resume preview">
          <button
            className="resume-modal__backdrop"
            type="button"
            aria-label="Close resume preview"
            onClick={() => setIsOpen(false)}
          />

          <div className="resume-modal__sheet">
            <div className="resume-modal__topbar">
              <a className="resume-modal__link" href={downloadHref} target="_blank" rel="noreferrer">
                Download Resume
              </a>
              <a className="resume-modal__link" href={resumeHref} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
              <button
                className="resume-modal__close"
                type="button"
                aria-label="Close resume preview"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="resume-modal__viewer">
              <iframe
                src={embedSrc}
                title="Vaibhav Modi resume"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
              />
            </div>
          </div>
        </div>,
        modalRoot
      )}
    </>
  );
}

function ResumeCard({ downloadHref, onOpen }) {
  return (
    <div className="resume-card-wrap">
      <button
        className="resume-card-open"
        type="button"
        onClick={onOpen}
      >
      <span className="doc desk-doc" aria-hidden="true">
        <span className="clip" />

        <span className="doc-head">
          <span className="doc-name">Vaibhav Modi</span>
          <span className="doc-role">Lead Software Engineer</span>
          <span className="doc-sections">Experience / Projects / Skills / Contact</span>
        </span>

        <span className="doc-lines">
          <span className="doc-line doc-line--76" />
          <span className="doc-line doc-line--88" />
          <span className="doc-line doc-line--68" />
          <span className="doc-line doc-sep doc-line--100" />
          <span className="doc-line doc-line--92" />
          <span className="doc-line doc-line--64" />
          <span className="doc-line doc-line--84" />
          <span className="doc-line doc-sep doc-line--100" />
          <span className="doc-line doc-line--72" />
          <span className="doc-line doc-line--90" />
          <span className="doc-line doc-line--58" />
          <span className="doc-line doc-line--81" />
        </span>

        <span className="doc-footer">
          <span className="doc-contact">hi@vaibhavmodi.com</span>
          <span className="doc-pdf">PDF</span>
        </span>
        <span className="coffee-ring" />
      </span>

      <span className="sr-only">Open resume preview</span>
      <span className="resume-card__cta">
        <span>click to open resume</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M3 7H10.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M8.5 5L10.5 7L8.5 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      </button>
      <a
        className="dl-arrow dl-arrow-button"
        href={downloadHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Download resume"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1.5V7.2" stroke="#6b6257" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M3.8 5.5L6 7.7L8.2 5.5" stroke="#6b6257" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2.5 9.5H9.5" stroke="#6b6257" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </a>
    </div>
  );
}
