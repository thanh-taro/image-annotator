# Design adapter — Claude Design canvas

Tool: a Claude Design artifact (live `.dc.html` artboards on a canvas), decision D-013 — same tool
and conventions as the taro-kit siblings (json-formatter, data-analysts-file-viewer). The canvas is
a **derived** artifact: the specs stay the source of truth. Canvas URL: recorded in
`.build-my-app/state.json` as `design_canvas_url`; source files are kept in `design/canvas/`.

## Naming
- Screen artboards: one per screen state (or flow step) and viewport, file
  `SCR-Annotator_<state>_<viewport>.dc.html`, titled `SCR-Annotator / <state> / <viewport>`.
  Theme is shown as two framed panels in each artboard (`.tk-dark` / `.tk-light`), so each artboard
  covers both themes.
- Components: one artboard per component, `CMP-<Name>.dc.html`, holding every row of its
  "Variants & states" table in both themes, each cell labeled `<CMP-ID> / <variant> / <theme>`.
- Flows: `FLOW-<nn>_step<n>.dc.html`.
- Entry artboard: `Main.dc.html` — SCR-Annotator default (annotated screenshot), embedded.
- Viewports: **embedded** 1200 × 760 (portal tool area on desktop), **narrow** 390 × 760 (portal
  phone layout; NFR-07 minimum 320).

## Tokens
- Values come from `specs/30-experience/tokens.json`. In the app they become CSS custom properties
  `--tk-color-<role>`, `--tk-space-<n>`, `--tk-radius-<name>`, `--tk-font-<role>`, `--tk-size-<name>`
  (dark on `:root`, light under `[data-theme="light"]`), per `adapters/codegen.md`.
- Artboards declare colour roles as short custom properties scoped to `.tk-dark` / `.tk-light`
  (`--bg`, `--fg`, `--accent`, `--workArea`, `--checkerA`, `--selectionOutline`, …) and the
  annotation palette as `--ann-red` … `--ann-white`. **Every value must equal tokens.json.**
  A value with no token is a design-auditor finding.

## Copy
- Every visible UI string comes from `specs/30-experience/copy.md` (en-US); each text element
  carries `data-copy="<COPY-ID>"`. Sample content (the screenshot under annotation, the user's
  text annotations such as "Wrong total") is the only text without a COPY ID and is marked
  `data-sample`.
- On an element whose name is an `aria-label` (icon buttons, regions, radiogroups, dialogs),
  `data-copy` names the COPY ID of that label, not of the visible text inside it.
  Visually hidden text (`.sr`) carries its own `data-copy`.
- At least one artboard per region shows vi-VN text (`lang="vi"`) to check length (F-018.R7).

## Sample image
A neutral, made-up app screenshot (a fake checkout form with an email, an order total and a
token string) drawn in HTML/CSS inside the artboard — no real product, person or brand.

## Review
Each artboard's title links its spec ID. The design-auditor checks coverage (state × viewport ×
theme), COPY IDs and tokens; the ui-critic reviews screenshots; the a11y-auditor checks contrast,
targets and reading order. Token pairs are already validated (`tools/token_contrast.py`).
