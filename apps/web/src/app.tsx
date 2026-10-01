import { m } from '@workbox/i18n';

export function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <h1 className="text-4xl font-semibold tracking-tight">{m.app_title()}</h1>
    </main>
  );
}
