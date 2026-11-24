# MFM Oracle

A personalised graduation gift for a newly qualified maternal–fetal medicine specialist. A polished French Magic 8 Ball experience in black, midnight navy and gold.

**Exclusively humorous. No clinical use. No patient inputs, medical decision support, backend, analytics or external runtime dependencies.** The original 30 French jokes and 3 rare answers are preserved.

## Run

Requires Python 3 for the local static server. From this directory:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. Use a web server, not a `file://` URL. A phone needs the deployed HTTPS site for motion permissions and offline installation.

## Experience

- Real WebGL sphere with studio reflections, warm rim lighting, a shadow, an ivory 8 and a blue triangular answer window.
- A 1.55-second rotation reveals an answer; taps and shakes cannot overlap.
- Rare answers have a 5% selection probability. No immediate repeat within either answer pool.
- Reduced-motion preference reveals immediately. Keyboard and screen-reader controls work. Canvas2D fallback covers unsupported or interrupted graphics contexts.
- Motion access is requested only when the recipient taps **Activer le mode secousse**. Two deliberate acceleration peaks reveal an answer; isolated bumps and stationary gravity do not. Denied permission, absent sensors and unsupported browsers retain tap controls.
- All runtime assets are local and precached. The app indicates **Prêt hors ligne** only after checking the cache. First use requires Internet; browser storage can be evicted, so check readiness before gifting.
- No sound or vibration is required; an optional short vibration is used only where supported.

## iPhone installation

1. Open the live HTTPS site in Safari.
2. Tap Share (possibly inside the `…` menu), then **Add to Home Screen / Sur l’écran d’accueil**.
3. Enable **Open as Web App / Ouvrir comme app web** if offered, then Add.
4. Open the installed app once online and wait for **Prêt hors ligne**.
5. Enable motion, grant access, and shake gently twice. The button always works.
6. Turn on Airplane Mode, reopen the installed app and reveal an answer to confirm offline use.

The app also includes these instructions under **Installer**. iOS does not provide a universal programmatic installation prompt. Installation and physical motion must be confirmed on the recipient’s actual iPhone; browser automation only simulates sensor events.

Apple reference: https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios
Motion permission reference: https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static

## Tests and build

Requires Node.js 22+ for development tools. Runtime has no npm dependencies.

```sh
npm test
npm run build
```

The build copies only the 10 required app files plus `.nojekyll` to `dist/`. The full source includes tests and the gift-card generator, which are not part of the app bundle.

For browser checks, install the development-only Playwright dependency and browsers:

```sh
npm install
npx playwright install chromium webkit
npm run test:browser
BROWSER_ENGINE=webkit npm run test:browser
```

`BROWSER_CHANNEL=chrome` uses an installed Google Chrome. `PLAYWRIGHT_MODULE` can point to a preinstalled Playwright ES module. `TEST_OUTPUT` changes the screenshot directory. Each run starts its own local server and isolated browser profiles. Tests cover real service-worker offline navigation, query-string launches, independent app scopes, fast repeated taps, answer accessibility, reduced motion, permission outcomes, shake detection, installer focus and narrow layouts.

See `TEST-REPORT.md` for the checks actually performed and remaining real-device checks.

## Publish free on GitHub Pages

Chosen repository: https://github.com/jsichitiu-tech/magic8ballmfm

The repository was reachable and empty when inspected. It has not been deployed by this handoff unless `DEPLOYMENT.md` records a verified live URL.

### Automated workflow (recommended)

1. Put this project’s contents at the repository root, including `.github/workflows/pages.yml`, and push to `main`.
2. In the repository, open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → Test and publish MFM Oracle → Run workflow** if the initial push ran before Pages was enabled.
4. The workflow runs the core tests, builds `dist/`, and publishes the static artifact using GitHub’s Pages actions. Its deployment environment provides the real URL.
5. Open that URL and check the app, motion permissions, installation and offline restart before making the final QR card.

GitHub Free supports Pages for public repositories. No domain, server, payment or App Store membership is needed for this static gift app. Keep the repository public for the free option.

Official configuration: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Plan availability: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

### Browser-upload alternative

Upload the **contents** of the prepared `MFM-Oracle-Pages.zip` to the repository root, commit to `main`, and set **Settings → Pages → Deploy from a branch → main → / (root)**. Do not upload the ZIP itself. This option publishes the static files without the source tests/workflow. Use one publishing mode consistently.

## Personalisation

The original unnamed dedication is retained until the sender supplies the recipient’s exact name and wording. Edit `#dedication` in `index.html` and the two arrays in `oracle-core.js` only as desired. Answer text is fitted to the triangle; unusually long new wording should be checked at 320px width.

## Printable gift card and QR

`scripts/gift-card.py` creates an elegant two-page A6 card (front/back). Without `--url` it produces a clearly labelled preview with no QR.

Requires Python packages `reportlab` and `Pillow`; `pypdfium2` optionally renders a PNG preview. Pass only the actual verified deployment URL:

```sh
python3 scripts/gift-card.py --url "$DEPLOYED_APP_URL" --name "$RECIPIENT_NAME" --output-dir ./gift-output
```

Optional: `--dedication 'Your exact French wording'`. The generator verifies the HTTPS response contains MFM Oracle before encoding the URL. Print at 100% actual size on A6 stock, or place each A6 page on A4 and trim. Confirm duplex orientation with a draft print before using heavier stock. The preview is not the final gift card.

## Updates and offline cache

Whenever a shipped asset changes, increment `VERSION` in `sw.js`, run tests and rebuild. A new worker precaches the complete release and waits for old tabs/app windows to close. Reopen the app online after closing every instance to activate the update. Caches are scoped to the app URL so another project on the same GitHub Pages domain is not removed. No offline cache is promised before the first successful online load.
