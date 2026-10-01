import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';

// oxlint-disable-next-line import/no-unassigned-import -- a stylesheet is imported for its side effect, Vite bundles it
import './index.css';

const root = document.querySelector('#root');
if (root === null) {
  throw new Error('Missing #root element');
}
// oxlint-disable-next-line vitest/require-hook -- the app entry point mounts at module scope, it is not a test file
createRoot(root).render(
  // oxlint-disable-next-line react/react-in-jsx-scope -- the automatic JSX runtime (jsx: react-jsx) needs no React in scope
  <StrictMode>
    {/* oxlint-disable-next-line react/react-in-jsx-scope -- the automatic JSX runtime (jsx: react-jsx) needs no React in scope */}
    <App />
  </StrictMode>,
);
