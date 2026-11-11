# Deployed UI audit

Headless Edge captured the running Docker web build before editing. Screenshots cover Workbench in light and dark, the multi-file editor, the stored Gemini chat, review dialog, live console-only progress, completed and failed evidence, the recorded 10-second timeout, Insights, Host Activity, Settings, Help, and Limits at desktop, tablet and mobile sizes. Capability evidence JSON export was visible in the completed run.

- Workbench repeats its title in an eyebrow and draws a second frame around the permission summary. The editable script title clips at a fixed width. File tabs resemble separate buttons.
- Assistant embeds a tinted review card and repeats the permission explanation beside the proposal. Provider and role labels are already useful.
- Evidence repeats the selected-run label, frames capability usage, and explains outcome/advisory separation in several places. Insights adds a collection tooltip to every row.
- Settings puts each field inside a tinted tile beneath a duplicate context callout. Host Activity uses two large framed sections and repeats its introductory description.
- Native selects are functional. Desktop filters give Period disproportionate width and use a full surrounding frame. Keep the native widgets and compact the surrounding layout.
- Help and Limits use distinct overlay radii. Limits wraps the heading tightly on mobile. Empty states use an ornamental glyph and centered dashed boxes.
- Existing navigation and semantic status indicators give useful orientation. Keep them, the editor syntax colors, warning markers, and keyboard focus.
