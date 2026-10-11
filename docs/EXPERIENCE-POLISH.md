# Discovery and collections UX polish

The homepage now explains three useful next steps: discover, save, and submit. The requested headline and brand line remain intact. Saved is available in both the header and footer. Project pages keep Projects active in navigation and include its breadcrumb.

Saved uses a responsive folder/content layout with counts, a clear selected collection, compact management controls, and actionable empty/search states. Backup tools use plain-language labels and explain JSON import/export, browser-only storage, and the absence of sync. Existing version-1 collections are retained without migration. Launch pages use clearer type, spacing, screenshot presentation, and creator hierarchy.

The Save dialog identifies the current item, explains multi-folder membership and automatic saving, updates counts, and links to Saved. While a browser storage lock is pending, it shows Saving, prevents premature dismissal, and warns before navigation. Storage events now resolve public item data in an already-open Saved tab; stale failed requests cannot overwrite a newer resolution. No project descriptions or private fields are cached in browser collections.

Validation: 72 Node tests; 16 existing responsive/launch/refinement browser checks; four new beginner navigation and delayed-save/cross-tab tests; final four launch/collection scenarios repeated after save-state changes. Built production assets, checked syntax and whitespace, and inspected desktop/mobile Saved, homepage, picker and launch layouts. CI runs the new navigation tests in the full browser suite. Writable publishing tests use isolated local Redis only.

No database or environment changes are required. Release through the existing main-branch Vercel integration. Check homepage guide, Saved, and anonymous admin denial after deployment. Roll back the application if needed; local collection storage is unchanged. Native operating-system share sheets and real-device browser behavior were not separately tested in this polish pass.
