# Diagnostika v1.0.0

Release date: 2026-09-19

## Status

This release is the first architecture-complete stable release candidate of the Diagnostika web application.

The application is organized around a shared platform core, domain services, module lifecycle management, public API facades, role/access control, a canonical database boundary, and a unified runtime health contract.

## Stable architecture

- CORE platform: 0.2.0
- Database boundary: DB 14D
- Public API registry: API 13D
- Roles/access and module lifecycle: 11D
- Unified runtime contract: FINAL 15A
- Canonical application state schema: version 4
- Current canonical state backend: localStorage
- File/blob backend: IndexedDB
- Production deployment: GitHub Pages

## Domain modules

The stable runtime includes:

- Clients
- Requests
- Diagnosis
- Sessions
- Payments
- AI
- Calendar
- Files
- Export
- Roles/access

## Release acceptance

RELEASE 16A verifies the deployed GitHub Pages application using a clean isolated browser profile.

The production smoke test covers:

1. Application launch and unified runtime health.
2. Client persistence.
3. Request creation and persistence.
4. Session creation and request linkage.
5. Payment settings and payment record persistence.
6. Calendar event persistence.
7. File storage in IndexedDB.
8. Full page reload and restoration of all test data.
9. Absence of unexpected runtime errors.

The release smoke profile is isolated and does not access or modify a real user's browser data.

## Storage safety

The canonical key remains `diagnostika-web-v1`. Production application code accesses canonical state through `DiagnostikaDB`; storage integrations do not bypass that boundary.

RELEASE 16A does not migrate, reset, or delete existing user data.

## Browser and integration notes

- Folder synchronization depends on the browser File System Access API and is intended for supported Chromium-based browsers.
- Google Drive synchronization requires Google OAuth configuration before it can be connected.
- Files attached to sessions are stored separately from canonical JSON state in IndexedDB.

## Release marker

The production page exposes:

`<meta name="diagnostika-release" content="v1.0.0">`

This marker is used by the production release smoke test to make sure the deployed page is the intended release rather than an older cached build.

## Release policy

After v1.0.0, architecture changes should be made only as explicit versioned work. Normal product development should build on the existing DB, API, module, access, and runtime contracts rather than introduce parallel persistence or service paths.
