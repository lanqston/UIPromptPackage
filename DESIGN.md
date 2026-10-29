# Digivated — Independent Project Index

## Direction
A digital catalogue for work made by independent people. Show the work before selling the platform. Keep the interface in white, mist gray, and carbon; project imagery supplies the color.

## References used
- [Refero: teenage engineering DESIGN.md](https://styles.refero.design/style/aecf9dda-5cba-4dc7-9e73-59b65d895cdf): adapted its edge-to-edge product imagery, square geometry, fine rules, neutral surfaces, and open catalogue structure. Body type is intentionally heavier for legibility.
- [Refero: OpenAI DESIGN.md](https://styles.refero.design/style/dc541737-8bf2-4b31-b729-0352f696e82f): adapted the separation between editorial headings, understated labels, and low-emphasis controls.
- [Navbar Gallery](https://www.navbar.gallery/): shared header with visible primary destinations and one accessible overflow menu.
- [Supahero](https://supahero.io/hero/linear): keep the product visible near the first screen; avoid adding unrelated decorative imagery.
- [60fps](https://60fps.design/): interaction feedback belongs on the control the visitor operates. Preserve existing pressed states and keyboard behavior; avoid ambient tilt.
- [loadmo.re](https://loadmo.re/): mobile is a composed single-column catalogue, with full-width images and controls that remain reachable.

## Implementation contract
Palette: canvas #f6f8f7, paper #fff, carbon #0f0e12, ink #171717, muted #595959, rule #dedede. System sans for prose; system monospace for index labels. Fluid 42–92px home headline; 28–40px section headings; 16px prose; 11–12px metadata. No proprietary fonts copied.

Content max-width 1320px, desktop gutters 40px, mobile gutters 20px. Square images and surfaces; no decorative gradients, glow, or card tilt. Use a large featured project followed by a three-column index. Keep card actions separate from image navigation. All images preserve aspect ratio with contain behavior for screenshots.

Retain existing authentication, API endpoints, validation, moderation, likes, feedback, saves, view tracking, and notification logic. Never replace live project data with sample projects. The review remains separate from production until the direction is accepted.
