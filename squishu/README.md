# Squishu public website source

Buildless English pages for `https://chushkin.github.io/squishu/`.

- `index.html`: game introduction, selected T icon and four real game screenshots.
- `privacy/index.html`: HTML version of `docs/PRIVACY.md`; keep policy text synchronised.
- `support/index.html`: support details and troubleshooting.
- `styles.css`, `assets/`: self-hosted style, font and images. No third-party scripts, embeds, analytics, cookies, app download files or store badges.

Copy this directory's **contents** into the public GitHub Pages repository's `squishu/` directory. The developer portfolio link is intentionally relative to the public site's root; that root is outside this source subtree. No game bundle is included.

For a local check from the game repository, serve `website/` with a static server and open `/squishu/`, `/squishu/privacy/` and `/squishu/support/`. The parent portfolio link will not resolve in this isolated preview.

Before publishing a later version, review availability text and data-handling claims. Official store links should be added only after the actual listings exist. Use the existing screenshot workflow to refresh gameplay images; do not fabricate gameplay.

Font: Fredoka, self-hosted from the project's dependency; license in `assets/Fredoka-LICENSE.txt`. The app artwork and screenshots come from this project. Selected icon: `docs/review-2026-11/brand-v2/icon-concept-t-v1.png`. Gameplay images: `docs/media/tutorial.jpg`, `combo.jpg`, `impy-shadows.jpg`, `zen.jpg`.
