# Founding Member Pass launch state

The owner selected permanent access to a defined founding collection. The first 25 passes are $2 USD once. Future collections and the $4 UI/UX Prompt Packet are separate. The $3 project promotion offer is unchanged.

## Implemented

- Public prelaunch page at `/founding-members`, linked from Resources, Products, and the footer.
- Accessible carousel format preview: native horizontal scrolling, previous/next buttons, keyboard navigation, no autoplay, reduced-motion support, and a full text alternative.
- Empty public collection metadata in `src/data/founding-pass.mjs`. It contains no paid slides and no checkout URL.
- Separate unpublished Gumroad digital product, editor ID `auwebc`, slug `founding-member-pass`. Its introductory offer must retain the fixed $2 USD price, a maximum of 25 purchases, and quantity selection disabled.

## Required before sales open

1. Obtain the owner's actual X carousel posts and original images. Do not invent posts or republish the archived site articles as founding content.
2. Produce the full founding carousels, readable text versions, examples, and verified references. List every included title and deliverable publicly.
3. Implement a separate server-verified entitlement for the founding product and a protected content/asset endpoint. Reuse reviewed security patterns, not the packet's product ID or cookie. Never ship paid slides in static HTML, public assets, client bundles, or a browser-only hidden section.
4. Enable Gumroad license keys for the separate product, add delivery instructions, and configure the product ID server-side. Use a distinct encrypted session and verify valid, unrefunded purchases on protected reads. No UI/UX packet license can grant founding access.
5. Verify an anonymous visitor cannot fetch member text or images. Verify wrong-product, refunded, disputed, and expired sessions fail; valid access works. Test restoring purchase access without another payment.
6. Confirm Gumroad's maximum of 25 purchases and fixed price are still saved. The checkout provider, not a client counter, enforces the introductory limit. Do not claim live remaining quantities without verified checkout data.
7. Test the complete purchase-to-reading flow and publish a real, complete collection. Only then open checkout and replace prelaunch messaging.

The founding product is intentionally unpublished. Sales are not open.

The carousel library and a separate founding-member check now exist. Public readers get the title, summary, and first four slides. Later slides stay on the server. `FOUNDING_ACCESS_ENABLED` must stay unset or `false` until the Gumroad product is published and the owner finishes the steps in the README. A Prompt Packet license does not open this collection. See the Educational carousels section of the README for the publish command and environment variables. No database migration is required.
