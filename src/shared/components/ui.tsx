import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/**
 * The console's primitives. Deliberately plain: they add class names from
 * `index.css` and nothing else, so a screen reads as markup rather than as a
 * component API to learn.
 */

/* ------------------------------------------------------------------ button */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
  busy?: boolean;
}

export function Button({
  variant = 'primary',
  small,
  block,
  busy,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'primary' ? `btn--${variant}` : '',
    small ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || busy} {...rest}>
      {busy && <span className={`spinner ${variant === 'primary' ? 'spinner--light' : ''}`} />}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------- card */

export function Card({
  title,
  hint,
  actions,
  children,
  bodyless,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Skip the padded body — used when a table should meet the card's edges. */
  bodyless?: boolean;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card__header">
          <div className="card__header-text">
            {title && <h2>{title}</h2>}
            {hint && <div className="card__hint">{hint}</div>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      {bodyless ? children : <div className="card__body">{children}</div>}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- forms */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      {label && <span className="field__label">{label}</span>}
      {children}
      {error ? (
        <span className="field__error">{error}</span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`textarea ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`select ${props.className ?? ''}`} />;
}

/* ------------------------------------------------------------------ status */

export function Badge({
  tone = 'default',
  children,
}: {
  tone?: 'default' | 'blue' | 'gold' | 'red' | 'green' | 'code';
  children: ReactNode;
}) {
  return <span className={`badge ${tone === 'default' ? '' : `badge--${tone}`}`}>{children}</span>;
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success';
  children: ReactNode;
}) {
  const icon = tone === 'error' ? '⚠️' : tone === 'success' ? '✅' : 'ℹ️';
  return (
    <div className={`banner banner--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label}
    </div>
  );
}

export function Empty({
  icon = '📭',
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden>
        {icon}
      </div>
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
    </div>
  );
}

/** 1st/2nd/3rd get the medal colours the game already uses. */
export function Rank({ rank }: { rank: number }) {
  return <span className={`rank ${rank <= 3 ? `rank--${rank}` : ''}`}>{rank}</span>;
}
