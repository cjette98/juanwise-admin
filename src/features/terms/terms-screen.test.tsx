import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { termsContent } from '@/shared/content/terms-content';
import TermsScreen, { PublicTermsScreen } from './terms-screen';

describe('terms page', () => {
  it("shows the app's terms, including the main admin section", () => {
    render(<TermsScreen />);

    expect(screen.getByRole('heading', { name: termsContent.en.mechanicsTitle })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: termsContent.en.mainAdminRulesTitle })).toBeInTheDocument();
    expect(screen.getByText('Delete unused accounts, packs and classes.')).toBeInTheDocument();
    expect(screen.getByText(/Each activity allows up to 3 attempts/)).toBeInTheDocument();
  });

  it('switches to Tagalog', async () => {
    const user = userEvent.setup();
    render(<TermsScreen />);

    await user.click(screen.getByRole('tab', { name: 'Tagalog' }));

    expect(screen.getByRole('heading', { name: termsContent.tl.mainAdminRulesTitle })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: termsContent.en.mainAdminRulesTitle })).not.toBeInTheDocument();
  });

  it('links back to sign in when opened signed out', () => {
    render(
      <MemoryRouter>
        <PublicTermsScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Back to sign in/ })).toHaveAttribute('href', '/');
  });
});
