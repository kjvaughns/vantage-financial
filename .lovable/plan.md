# Add Meta (Facebook) Pixel

Add the Meta Pixel snippet provided by the user (Pixel ID `929825575167366`) so it loads site-wide on every page, including the initial server-rendered HTML, and fires a `PageView` event.

## Current state
- `src/routes/__root.tsx` defines the app-wide `head()` (meta/links) and the `RootShell` (`<html><head><HeadContent/></head><body>...`).
- No analytics/pixel is currently installed (confirmed: no `fbq`/`pixel`/`facebook` references in `__root.tsx` or `index.tsx`).
- TanStack Router v1.170 head `scripts` array renders `{ tag: "script", attrs, children }` as inline `<script dangerouslySetInnerHTML>` in `<head>` during SSR, so the pixel runs before hydration.

## Changes

### 1. `src/routes/__root.tsx` — pixel base code (site-wide)
Add a `scripts` entry to the root route's `head()` returning the Meta Pixel base code as an inline `children` string:
- The standard fbq loader IIFE that injects `connect.facebook.net/en_US/fbevents.js`.
- `fbq('init', '929825575167366')`
- `fbq('track', 'PageView')`
- Use `{ tag: "script", attrs: {}, children: PIXEL_CODE }` so it renders as an inline head script on SSR + client.

### 2. `src/routes/__root.tsx` — noscript fallback
Add the `<noscript><img .../></noscript>` PageView fallback (the `<img>` tracking pixel) inside the `RootShell` `<body>` so non-JS visitors also register a PageView. Use `dangerouslySetInnerHTML` to render the raw `<noscript>` block cleanly.

### 3. (Optional, recommended) Conversion events
No extra events beyond `PageView` unless requested. The base code alone enables PageView tracking; additional events (e.g. `Lead`, `CompleteRegistration`) can be wired to the application submit / onboarding flows later if wanted — out of scope here unless the user confirms.

## Verification
- `bunx tsgo` typecheck passes (scripts type is `unknown`, so no type friction).
- Preview `/`: Meta Pixel Helper (or DevTools → Network filter `tr?`) shows `fbevents.js` loading and a PageView request with ID `929825575167366`.
- A second route (e.g. `/apply`) also fires PageView on navigation since the pixel base code is global.

## Notes
- Pixel ID `929825575167366` is a publishable tracking ID, safe in client code (not a secret).
- No cookies/consent banner added — out of scope unless the user requests GDPR/consent handling.
