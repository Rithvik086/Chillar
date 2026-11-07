# Chillar

Chillar is a Splitwise-inspired expense-sharing application built as an npm
workspaces monorepo.

## Architecture

- `apps/mobile`: Expo, React Native, and TypeScript client
- `apps/backend`: Fastify and TypeScript API server
- `packages/shared`: platform-neutral shared types
- `packages/core`: platform-neutral business logic
- `packages/schemas`: Zod validation schemas

The mobile app is intended to keep permanent local records and calculate
expenses locally. The backend will later provide authentication, group
management, synchronization APIs, and PostgreSQL-backed relay metadata.

## Installation

```bash
npm install
```

## Development commands

```bash
npm run mobile
npm run android
npm run backend
```

`npm run backend` starts the Fastify development server with `tsx`.

## Backend

Build the backend and shared packages:

```bash
npm run build
```

Run the production backend after building:

```bash
npm run build:backend
npm run start --workspace=@chillar/backend
```

The health endpoint is available at `http://localhost:3000/health`.

## Mobile

Start the Expo development server:

```bash
npm run mobile
```

Use `npm run android` when an Android emulator or device is available.
