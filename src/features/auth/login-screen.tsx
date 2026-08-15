import { useState, type FormEvent } from 'react';
import { API_ORIGIN, errorMessage } from '@/shared/api';
import { images } from '@/shared/assets/images';
import { Banner, Button, Field, Input } from '@/shared/components/ui';
import { useAuth } from './auth-context';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (!username.trim() || !password) {
      setError('Enter the admin username and password.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signIn(username, password);
      // On success the router swaps this screen out — nothing to do here.
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <aside
        className="login__art"
        style={{ backgroundImage: `url(${images.welcomeBackground})` }}
      >
        <img className="login__logo" src={images.appIcon} alt="" />
        <div className="login__headline">JuanWise Admin Console</div>
        <p className="login__blurb">
          Manage teachers and their classes, watch the leaderboards, and author the quiz and jigsaw
          content that every JuanWise player sees.
        </p>
        <div className="login__flag" aria-hidden>
          <span style={{ background: '#0038A8' }} />
          <span style={{ background: '#CE1126' }} />
          <span style={{ background: '#FCD116' }} />
        </div>
      </aside>

      <main className="login__panel">
        <form className="login__form" onSubmit={submit}>
          <div>
            <h1>Sign in</h1>
            <p className="card__hint">Administrator accounts only.</p>
          </div>

          {error && <Banner tone="error">{error}</Banner>}

          <Field label="Username">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              placeholder="admin"
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" block busy={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>

          <p className="field__hint">
            Signing in to <code>{API_ORIGIN}</code>. An account is made an admin with{' '}
            <code>npm run grant-admin</code> in juanwise-be.
          </p>
        </form>
      </main>
    </div>
  );
}
