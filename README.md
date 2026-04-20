# MockMate

A Chrome DevTools extension for intercepting and mocking HTTP requests. Appears as a panel in Chrome DevTools alongside the Network tab.

## Features

- **Rule-based mocking** — match requests by URL pattern (glob, regex, exact), HTTP method, headers, or GraphQL operation name
- **Custom responses** — override status code, response body, headers, and add artificial delays
- **Network inspector** — view all network traffic with request/response details in real time
- **Persistent rules** — rules are saved to Chrome storage and survive tab reloads
- **Priority ordering** — control which rules take precedence when multiple rules match

## Tech Stack

- React 19 + TypeScript + Tailwind CSS
- Zustand for state management
- Chrome Debugger API (Manifest v3)
- Vite + @crxjs/vite-plugin for building
- Vitest for unit tests, Playwright for E2E tests

## Getting Started

### Prerequisites

- Node.js 18+
- Google Chrome

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This runs Vite in watch mode. Every save rebuilds the extension into `dist/`.

### Load the extension in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Open DevTools on any tab → find the **MockMate** panel

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Watch build (rebuilds on save) |
| `npm run build` | Production build to `dist/` |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Build + run E2E tests |
| `npm run test:e2e:ui` | Build + run E2E tests with Playwright UI |
| `npm run lint` | Lint source files |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Check formatting |
| `npm run typecheck` | TypeScript type checking |

## Creating a Mock Rule

1. Open DevTools → MockMate panel
2. Click **Add Rule**
3. Set a URL pattern (e.g. `**/api/users*`)
4. Choose HTTP method (or leave as `ANY`)
5. Set the response: status code, body, headers
6. Save — the rule is now active for all matching requests

## Project Structure

```
src/
├── background/       # Service worker — Chrome Debugger API, request interception
├── panel/            # DevTools panel UI (React)
│   ├── components/   # UI components
│   ├── hooks/        # Custom React hooks
│   └── store/        # Zustand stores
├── devtools/         # DevTools panel registration
├── shared/           # URL matching, GraphQL parsing, utilities
└── types/            # Shared TypeScript types
tests/
├── unit/             # Vitest unit tests
└── e2e/              # Playwright E2E tests
```

## License

MIT
