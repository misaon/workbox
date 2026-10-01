# 0009. React 19 for the web client

- Status: accepted
- Date: 2026-09-30

## Context

The owner knows React and Vue. On 2026-09-30 React 19.3 with React Compiler 1.0 is stable, while Vue 3.6 Vapor and Solid 2.0 are release candidates; the chat rendering ecosystem (Streamdown, Base UI, Motion) is React-first ([R4](../superpowers/research/2026-09-30-R4-frontend-and-pixel-art-sim.md)).

## Decision

React 19.3 with Vite 8, Tailwind 4 (through `@tailwindcss/vite`) and Vitest 5 browser mode for component tests ([ADR 0007](0007-bun-test-for-runtime-packages-vitest-for-the-web-client.md)).

The React Compiler is enabled in `apps/web/vite.config.ts` through the `reactCompilerPreset` that `@vitejs/plugin-react` exports, passed to `@rolldown/plugin-babel` (`babel({ presets: [reactCompilerPreset()] })`). The preset runs `babel-plugin-react-compiler` on `@babel/core` 8. Babel 7 was blocked by the trust policy: every `@babel/core` 7.x release from 7.22.9 on depends on `semver` `^6.3.1`, which can only resolve to 6.3.1, and `trustPolicy: no-downgrade` refuses that release ([ADR 0004](0004-pnpm-and-turborepo-monorepo-with-source-consumed-packages.md)). `@rolldown/plugin-babel` accepts `@babel/core` 8 as a peer, and a Babel 7 build of the same skeleton (with `semver` overridden to get past the policy) produced an identical production bundle.

The web client has its own lint override ([ADR 0005](0005-oxlint-and-oxfmt-with-turborepo-boundaries-instead-of-eslint.md)): the `react` and `jsx-a11y` plugins apply to `apps/web`, `react/react-in-jsx-scope` is off because the project uses the automatic JSX runtime, CSS side-effect imports are allowed, and the `vitest` plugin applies to test files only, with `vitest/no-importing-vitest-globals` off.

## Consequences

The office canvas is a React island around PixiJS (plan 5); the phone client (product plan 6) can share components. `babel-plugin-react-compiler` 1.0 still brings `@babel/types` 7 next to the `@babel/types` 8 of Babel 8, so two major versions of Babel's types coexist in the tree. That works for the current skeleton, whose output matched the Babel 7 build, but the Compiler's output deserves a second look as the client grows. The component tests do not exercise it: `apps/web/vitest.config.ts` runs them without the React Compiler preset, so production builds are compiled and the tests are not.
