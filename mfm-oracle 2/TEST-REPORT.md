# MFM Oracle verification

Tested on 24 November 2026 (Europe/Zurich), release 2.0.1.

## Original project

Ran the supplied ZIP application in Chrome at 390 × 844, revealed an answer, registered its service worker, disconnected networking, reloaded and revealed another answer. No JavaScript page errors. The original application and ZIP remain unchanged in the original source location/work baseline.

## Automated checks passed

**8 Node core tests:** all original 30 standard and 3 rare answers retained; exact 5% rare boundary; every answer reachable; no immediate repeats; stationary gravity and missing data ignored; isolated bumps and sustained acceleration ignored; two-peak shake detection; cooldown; stale/noisy sample handling.

**11 Chrome browser checks:**

1. Real rendered reveal, busy protection against repeated taps, French answer, no immediate repeat.
2. All 10 offline assets cached, standalone manifest, disconnected reload with a query string, continued consultation.
3. Installation dialog opens; Escape closes; keyboard focus returns to Installer.
4. No horizontal overflow at 320, 360, 390, 430, 768 and 1280 pixels.
5. Reduced-motion reveal finishes promptly; forced rare answer is announced accessibly.
6. Simulated iOS motion permission comes from a user gesture; two sensor peaks reveal; cooldown, disable/re-enable and listener behavior work.
7. Permission denied: button fallback works.
8. Permission request throws: button fallback works.
9. Motion API missing: button fallback works.
10. WebGL unavailable: Canvas2D fallback renders and reveals without page errors.
11. Two separate application paths retain independent offline caches.

**Additional renderer checks:** WebGL and Canvas2D at narrow widths; all 33 answers measured inside the triangle (no clipping); graphics context loss and recovery; backgrounding settles an in-progress reveal; repeated destroy; no idle animation loop. Screenshots were visually inspected.

**Gift-card checks:** A6 front/back preview rendered using PDFium and Poppler, with French text and margins inspected. QR encoder independently tested by decoding a temporary test QR using macOS Vision. The delivered preview intentionally has no QR; the real application URL is not yet live.

**Build:** 10 static app assets plus `.nojekyll`, no network-dependent app libraries or fonts. Dependency lockfile generated; npm audit reported no vulnerabilities in the development-only dependencies at verification time.

## WebKit attempt

The macOS 14-compatible Playwright WebKit build launched and created a browser context, but could not create a page. A bounded diagnostic timed out before any app request or script execution. This is a test-environment limitation; it provides no Safari pass or fail result. Stalled test processes were stopped.

## Remaining checks

- A live GitHub Pages deployment cannot be verified before GitHub authentication is connected.
- Physical iPhone shaking, real iOS permission prompts, Home Screen installation and Airplane Mode restart have not been tested on an actual phone. Follow the short iPhone checklist in README.md after deployment.
- No final QR code has been generated. The final URL must first return the deployed app, then the printed QR should be scanned on the recipient’s phone.
- Recipient name/dedication remains pending.
