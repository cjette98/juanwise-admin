import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './ui';

const renderDialog = (over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDialog
      open
      title="Change to Identification?"
      confirmLabel="Change and clear answers"
      cancelLabel="Keep Multiple choice"
      danger
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    >
      Your question, hint, and explanation will stay.
    </ConfirmDialog>,
  );
  return { onConfirm, onCancel };
};

describe('ConfirmDialog', () => {
  it('renders its title and body when open', () => {
    renderDialog();
    expect(screen.getByText('Change to Identification?')).toBeInTheDocument();
    expect(
      screen.getByText('Your question, hint, and explanation will stay.'),
    ).toBeInTheDocument();
  });

  it('renders nothing visible when closed', () => {
    renderDialog({ open: false });
    expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute('open');
  });

  it('labels itself by its heading', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const heading = screen.getByText('Change to Identification?');
    expect(dialog).toHaveAttribute('aria-labelledby', heading.id);
    expect(heading.id).toBeTruthy();
  });

  it('calls onCancel when the safe button is pressed', () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Keep Multiple choice' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm when the destructive button is pressed', () => {
    const { onCancel, onConfirm } = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Change and clear answers' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('treats Escape as cancel without letting the browser close it behind React', () => {
    const { onCancel } = renderDialog();
    const dialog = screen.getByRole('dialog');
    // The native <dialog> fires `cancel` on Escape; the component must handle
    // that event rather than let the element close while `open` stays true.
    const event = new Event('cancel', { bubbles: false, cancelable: true });
    fireEvent(dialog, event);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
