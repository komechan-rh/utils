import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HomePage } from '@/pages/HomePage';
import { renderWithProviders } from '@/test/render';

describe('HomePage', () => {
  it('updates the status message when the action button is pressed', async () => {
    const user = userEvent.setup();

    renderWithProviders(<HomePage />);

    await user.click(screen.getByRole('button', { name: 'Try action' }));

    expect(screen.getByText('サンプルアクションを実行しました。')).toBeInTheDocument();
  });
});
