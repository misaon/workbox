import { m } from '@workbox/i18n';

export function App() {
  return (
    // oxlint-disable-next-line react/react-in-jsx-scope -- the automatic JSX runtime (jsx: react-jsx) needs no React in scope
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      {/* oxlint-disable-next-line react/react-in-jsx-scope -- the automatic JSX runtime (jsx: react-jsx) needs no React in scope */}
      <h1 className="text-4xl font-semibold tracking-tight">{m.app_title()}</h1>
    </main>
  );
}
