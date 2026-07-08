import { render } from '@testing-library/react';
import type { PropsWithChildren, ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

export function renderWithProviders(
  ui: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {},
) {
  function Wrapper({ children }: PropsWithChildren) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  }

  return render(ui, { wrapper: Wrapper });
}
