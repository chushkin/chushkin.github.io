# Squishu public website source

**2026-11-08:** Android is live on Google Play (https://play.google.com/store/apps/details?id=com.chushkin.squishu): store buttons, FAQ, support and footer link to both stores; a 30-second gameplay video (assets/squishu-gameplay.mp4, made by `npm run promo`, real gameplay) plays muted in the gameplay section.

**2026-11-07:** iOS is publicly available at https://apps.apple.com/app/squishu-block-puzzle/id6831750299 (Apple catalog verified). Landing/support now link to the App Store; the hero CTA, availability/FAQ/footer, social metadata and iOS Smart App Banner are updated. Android remains in preparation. The initial publication note below is historical.

Buildless English pages for `https://chushkin.github.io/squishu/`.

Initial site launch: 2026-11-05 in `chushkin/chushkin.github.io`, commit `3c1f950b832eeced84135b360a28375d453f26b5` (main). At that time the game was in testing. Launch availability and download links were added in commit `7f114db9d557ff30f0b4a04e2d7c1955203d9a20` on 2026-11-07, including the Squishu card on the parent portfolio. Main/support/privacy remain buildless pages.

- `index.html`: game introduction, selected T icon and four real game screenshots.
- `privacy/index.html`: HTML version of `docs/PRIVACY.md`; keep policy text synchronised.
- `support/index.html`: support details and troubleshooting.
- `styles.css`, `assets/`: self-hosted style, font and images. No third-party scripts, embeds, analytics, cookies or app download files. The App Store CTA links directly to Apple's published listing.

Copy this directory's **contents** into the public GitHub Pages repository's `squishu/` directory. The developer portfolio link is intentionally relative to the public site's root; that root is outside this source subtree. No game bundle is included.

For a local check from the game repository, serve `website/` with a static server and open `/squishu/`, `/squishu/privacy/` and `/squishu/support/`. The parent portfolio link will not resolve in this isolated preview.

Before publishing a later version, review availability text and data-handling claims. Official store links should be added only after the actual listings exist. Use the existing screenshot workflow to refresh gameplay images; do not fabricate gameplay.

Font: Fredoka, self-hosted from the project's dependency; license in `assets/Fredoka-LICENSE.txt`. The app artwork and screenshots come from this project. Selected icon: `docs/review-2026-11/brand-v2/icon-concept-t-v1.png`. Gameplay images: `docs/media/tutorial.jpg`, `combo.jpg`, `impy-shadows.jpg`, `zen.jpg`.

Stylesheet cache refresh: public follow-up commit `ec196de` versions the landing CSS URL, so returning browsers receive the new CTA styles immediately.
