import { useState } from 'react';
import { Link } from 'react-router-dom';
import { images } from '@/shared/assets/images';
import { Card } from '@/shared/components/ui';
import { termsContent, type TermsLanguage } from '@/shared/content/terms-content';

/**
 * The Terms & Conditions (item 10 of Adjustment 3) — the same text the app
 * shows, including the section for main admins, which is the part that is
 * about this console. Reachable signed out from the login screen and signed in
 * from the sidebar.
 */
export function TermsContent() {
  const [language, setLanguage] = useState<TermsLanguage>('en');
  const t = termsContent[language];

  return (
    <article className="terms" lang={language === 'tl' ? 'tl' : 'en'}>
      <div className="pill-tabs" role="tablist" aria-label="Language">
        <button
          role="tab"
          aria-selected={language === 'en'}
          className={`pill-tab ${language === 'en' ? 'pill-tab--active' : ''}`}
          onClick={() => setLanguage('en')}
        >
          English
        </button>
        <button
          role="tab"
          aria-selected={language === 'tl'}
          className={`pill-tab ${language === 'tl' ? 'pill-tab--active' : ''}`}
          onClick={() => setLanguage('tl')}
        >
          Tagalog
        </button>
      </div>

      <section>
        <h2>{t.consentTitle}</h2>
        <Prose text={t.consentBody} />
      </section>

      <section>
        <h2>{t.mechanicsTitle}</h2>
        <Prose text={t.mechanicsBody} />
      </section>

      <section>
        <h2>{t.conductTitle}</h2>
        <h3>{t.playerRulesTitle}</h3>
        <Prose text={t.playerRules} />
        <h3>{t.adminRulesTitle}</h3>
        <Prose text={t.adminRules} />
        <h3>{t.mainAdminRulesTitle}</h3>
        <Prose text={t.mainAdminRules} />
      </section>
    </article>
  );
}

/**
 * The app stores each section as plain text: paragraphs split by blank lines,
 * bullets as lines starting with "•", and a closing "Notice:" line.
 */
function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, index) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        const bullets = lines.filter((line) => line.startsWith('•'));
        const rest = lines.filter((line) => !line.startsWith('•'));
        return (
          <div key={index} className="terms__block">
            {bullets.length > 0 && (
              <ul>
                {bullets.map((line) => (
                  <li key={line}>{line.replace(/^•\s*/, '')}</li>
                ))}
              </ul>
            )}
            {rest.map((line) => (
              <p key={line} className={/^(Notice|Paalala):/.test(line) ? 'terms__notice' : undefined}>
                {line}
              </p>
            ))}
          </div>
        );
      })}
    </>
  );
}

/** Inside the console, under the usual top bar. */
export default function TermsScreen() {
  return (
    <Card title="Terms & Conditions" hint="The same terms every JuanWise player and teacher accepts in the app">
      <TermsContent />
    </Card>
  );
}

/** Signed out, opened from the login screen. */
export function PublicTermsScreen() {
  return (
    <div className="terms-page">
      <header className="terms-page__header">
        <img src={images.appIcon} alt="" width={40} height={40} />
        <div>
          <h1>Terms &amp; Conditions</h1>
          <div className="card__hint">JuanWise</div>
        </div>
        <Link to="/" className="terms-page__back">
          ← Back to sign in
        </Link>
      </header>
      <Card>
        <TermsContent />
      </Card>
    </div>
  );
}
