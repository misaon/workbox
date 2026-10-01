import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './app.tsx';

describe('the app', () => {
  // oxlint-disable-next-line jest/no-hooks, vitest/no-hooks -- the cleanup must also run when the assertion fails
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders the product title', async () => {
    expect.assertions(1);
    const container = document.createElement('div');
    document.body.append(container);
    // oxlint-disable-next-line require-await, typescript/require-await -- act() needs an async callback to flush effects and microtasks
    await act(async () => {
      createRoot(container).render(<App />);
    });
    expect(container.querySelector('h1')?.textContent).toBe('Workbox');
  });
});
