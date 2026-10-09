# Architecture — NFT Marketplace

## Overview
Marketplace de NFTs desenvolvido com React, TypeScript e Vite.

## Main technologies
- React and TypeScript
- TanStack Router for routing
- TanStack Query for server-state management
- Axios for REST API communication
- Tailwind CSS for styling
- MSW for API mocking
- Socket.IO Client for real-time events
- Playwright for end-to-end testing

## Application structure
- src/routes/: pages and route definitions
- src/features/: feature-specific logic
- src/components/: shared UI components
- src/lib/: API client and utilities
- src/mocks/: mock API and data
- src/types/: API and domain types
- scripts/mock-socket-server.mjs: local Socket.IO server
- 	ests/: end-to-end tests

## Data flow
TanStack Query manages API requests and cached server state. Axios communicates with the REST API. Mutations update server state and invalidate relevant queries.

The checkout retrieves a quote, validates the selected wallet, and submits an order through the API. The confirmation page retrieves the order returned by the API.

## Real-time events
Socket.IO receives domain events and invalidates relevant queries. Resource versions help ignore duplicate or outdated events. Order updates are checked against the authenticated session.

## Testing
Run the tests:

px playwright test --workers=1

## Production build
Run:

pm run build

The generated production files are placed in dist/.

## Deployment note
The included mock API and Socket.IO server are intended for development and testing. Real-time updates in production require a separately reachable Socket.IO server and a correctly configured VITE_SOCKET_URL.
