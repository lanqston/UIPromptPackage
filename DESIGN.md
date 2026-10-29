# Digivated — Notebook

## Chosen reference
The user's hand-drawn Refero search leads to Tally Forms. The primary visual reference is [Tally's reference screenshot](https://images.refero.design/styles/refero.design/image/2e807183-d98d-4c6f-941f-5ccc3f17c484.jpg); the technical reference is its [Refero DESIGN.md](https://styles.refero.design/style/4e3aa524-b146-416c-907f-382c079ea80c).

## Measured contract
Use Inter Variable, self-hosted from Fontsource 5.3.0 with its OFL license; no runtime font service. Display 64px, approximately 780 weight, tight tracking, centered; section heading 36–40px; subheading 22–28px; body 16–18px; labels 12–14px. Desktop content maximum 1200px. Use an 8px spacing scale, 64px section intervals, 24px card padding, 7px controls, and 10px surfaces.

The reference's centered hero, single prominent action, restrained line illustration, and white browser-style product surface are the structural base. The product panel is a working directory using existing project APIs and search/filter behavior. It contains no invented project data.

## Digivated-specific adaptations
Honor the user's white/gray requirement: charcoal actions replace Tally's blue, gray underline replaces magenta. Canvas #fafaf9, white panels, ink #37352f, body #5c5b57, muted #696863, lines #dededb. Preserve the current Digivated logo. Increase contrast where the reference's muted values would impair readability.

Original generated illustration: monochrome editorial pen drawing of a curious maker examining a browser window at a laptop; transparent background, no words, logos, emojis, color, or decorative sparkles. Built-in image generation; WebP delivery asset is optimized for its small rendered size. Original PNG retained separately from the repository.

## Supporting references
[Navbar Gallery: Supaste](https://www.navbar.gallery/navbar/supaste): small wordmark, quiet text navigation, distinguishable account action. [60fps: Circle menu interaction](https://60fps.design/shots/circle-menu-dropdown-morph-interaction): short scale/fade entrance, anchored to the trigger; honor reduced motion. [CTA Gallery](https://www.cta.gallery/): one explicit primary action and a subordinate helper line. [Posts.design](https://posts.design/): retain clear heading, product, and supporting-copy hierarchy; do not place social graphics or other brands' assets into the site.

## Verification and boundaries
Keep account, submission, moderation, feedback, likes, saves, views, notifications, and email logic intact. Existing script hooks remain unchanged. Verify search, collection filters, menu opening, feedback panels, 390px layout, build, and existing automated checks. Use only temporary public catalogue snapshots for local visual QA; exclude fixtures and review wrappers from commits. This is a separate review branch, not a production release.
