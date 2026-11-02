---
id: ADR-0015
title: Language contract and localized string catalog
status: accepted
date: 2026-11-02
supersedes: []
---

## Context
The portal passes the user's language to embedded tools: the frame address carries `?lang=en-US`
or `?lang=vi-VN` next to `theme`, the answer to `taro:ready` carries
`{ type: "taro:language", value }` next to `taro:theme`, and every switch re-sends
`taro:language` (RULE-16, RULE-17, F-018). The tool must show the right language from first
display, follow live switches without losing the image, annotations, selection, active tool or
view (F-018.R2), keep the single source of strings (ADR-0013) and the startup budget (NFR-05),
render Vietnamese in its own typeface (F-018.R7), and never let the language change the export
(INV-05, F-018.AC5). ADR-0010 (host contract, CSP), ADR-0011 (offline worker) and ADR-0013 (tokens
and copy generation) stay in force; this ADR extends them, following the sibling tools.

## Decision
1. **Address.** The inline, CSP-hashed boot script reads `lang` with `theme`, resolves the
   language per RULE-17 (address → `navigator.languages` → `en-US`) and sets `<html lang>` before
   first paint. The app resolves the same way at start (one pure function in MOD-Host, mirrored in
   the classic boot script and covered by the same unit cases). Strings are rendered only by the
   app, so there is no flash of another language (F-018.R1).
2. **Live switch.** `{ type: "taro:language", value }` is accepted under the exact ADR-0010 rules
   (allow-listed `event.origin`, `event.source === window.parent`); unsupported values are
   ignored; the latest accepted message wins over the address; a repeated identical value is a
   no-op (F-018.R4). No new outbound message.
3. **Catalog.** `copy.md` holds one text column per language (`en-US`, `vi-VN`) before Notes;
   `scripts/gen-copy.mjs` generates one typed catalog with both languages and fails the build if a
   string lacks a language, its placeholders differ between languages, or its plural forms do not
   match the language's categories (F-018.AC8). Both languages ship in the main bundle — no lazy
   loading, no i18n library.
4. **Active language.** MOD-Copy holds the active language as a signal; `t()` reads it, so Preact
   components re-render on a switch with their state intact. Text that outlives a render is kept
   as data, not text: notices, dialogs and live-region messages store a COPY ID plus raw parameters
   (counts and sizes as numbers) and are formatted when shown. The canvas's accessible list of
   annotations (CMP-Canvas) is rebuilt from the document on a switch; the canvas pixels are not
   repainted for language, since MOD-Render never reads it (INV-05). The live region is cleared,
   not re-announced, on a switch.
5. **Formatting.** Zoom, pixel sizes and counts use `Intl.NumberFormat(activeLanguage)` (vi-VN
   `1.920 × 1.080`, F-018.AC6); plural forms use `Intl.PluralRules(activeLanguage)` (F-018.AC9).
   Step numbers on the canvas are plain digits in every language (RULE-07). Download file names
   are the same in every language (RULE-15, F-018.R5).
6. **Fonts.** The `vietnamese` subsets of Manrope (DEP-04) and JetBrains Mono (DEP-05) are extra
   `@font-face` rules with their `unicode-range`, requested at startup in every language
   (`document.fonts.load`), so the offline seed (ADR-0011) caches them and no font request ever
   follows the load (NFR-01, F-018.AC10). No `latin-ext` subset (D-025). Font budget ≤ 90 KB.
7. **Document title** is set from COPY-app.title at start and on every switch.

## Alternatives considered
- **An i18n library (i18next, FormatJS)** — far more weight than 2 languages × ~150 strings need.
- **A build per language** — doubles deploys and cannot switch live.
- **Address only** — cannot follow a live portal switch.
- **Reload on switch** — drops the session, which lives only in memory (INV-04, F-018.R2).

## Consequences
- One inbound message type besides theme; the outbound contract is unchanged (RULE-16).
- Translations are spec changes in `copy.md`, reviewed by the owner.
- Adding a language later = one column in copy.md + one entry in RULE-17's list.

<!-- Accepted ADRs are immutable. Write a new ADR to change a decision. -->
