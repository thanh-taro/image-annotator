# Change request for the taro-kit portal: a tool in more than one category

Requested by the Image Annotator (image-annotator.tarokit.app), decision D-042 (2026-11-10).
Not sent anywhere. Apply it in the taro-kit project with `/build-my-app:change`, which puts it
through the portal's own spec process first.

## Why
The owner wants the Image Annotator listed under both **Developer** and **Media**.
- **Developer:** screenshots for bug reports and docs are its main use, and it lives in
  `developer-tools`.
- **Media:** it is an image tool, next to clip-maker.

The portal allows only one category: INV-07 ("Every tool belongs to exactly one category") in
`specs/10-domain/model.md`, with the matching `$comment` in `specs/10-domain/project.schema.json`.
Until this change is live, the catalog entry uses `category: developer`, so the tool's release
doesn't wait on it.

## Proposed spec change (taro-kit)
- **INV-07 reworded:** *Every tool belongs to one or more categories, each of which exists. Category
  ids are unique, stable slugs, like entry ids (INV-01).*
- **Content format:** keep `category: <id>` valid and add `categories: [<id>, …]`. An entry has
  exactly one of the two, `categories` has no duplicates, and the first listed is the tool's main
  category. Existing entries don't change.
- **Pages and counts:**
  - a tool shows on the page of every category it lists;
  - a category tile's count (RULE-14) counts it once per category;
  - search, the palette and the home page show it once, with its main category's tint.
- **New ACs:**
  - *Given a tool listing `developer` and `media`, when each category page is shown, then the tool
    appears on both, once each.*
  - *Given that tool, when the catalog search finds it, then it appears once, tinted with its first
    category.*
  - *Given an entry with both `category` and `categories`, or a duplicate in `categories`, when the
    site builds, then the build fails and names the file and the rule (F-001.R2).*

## Code likely touched (for the portal's impact analysis)
- `specs/10-domain/project.schema.json` and `content/schemas/tool.json`
- `src/modules/content/registry.ts` and `src/modules/content/derive.ts`
- `src/pages/tools/[category].astro`
- `src/modules/pages/catalog/CatalogSearch.tsx`

## After it is live
In `content/tools/image-annotator.yaml`, replace `category: developer` with
`categories: [developer, media]`. This is a portal content change and needs no new release of the
tool.
