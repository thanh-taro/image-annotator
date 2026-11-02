// tokens.json (W3C DTCG) → CSS custom properties, typed token names, and the canvas palette constants
// of MOD-Render (ADR-0013, MOD-Build). Copied from DAFV; adds `src/render/palette.gen.ts`: the
// theme-independent annotation palette (RULE-04 order) compiled into code, so the export never
// depends on the theme (INV-05).
// Scheme (same as the portal): dark values on :root, light values under [data-theme="light"],
// and a prefers-color-scheme block for pages where the boot script did not set a theme.
// Style Dictionary does the DTCG → CSS value work; this script only splits the colour themes.
import fs from 'node:fs';
import StyleDictionary from 'style-dictionary';
import { abs, emit, GENERATED_HEADER } from './lib/util.mjs';

const SOURCE = 'specs/30-experience/tokens.json';
const OUT_CSS = abs('src/app/styles/tokens.gen.css');
const OUT_TS = abs('src/app/styles/tokens.gen.ts');
const OUT_PALETTE = abs('src/render/palette.gen.ts');
/** RULE-04 palette order; tokens.json must define exactly these annotation colours. */
const PALETTE_ORDER = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
const THEMES = ['dark', 'light'];
const DEFAULT_THEME = 'dark';
/** Token groups that describe the token set itself, not values for the UI. */
const META_GROUPS = new Set(['contrast']);

async function toCss(tokens, selector) {
  const sd = new StyleDictionary({
    log: { verbosity: 'silent', warnings: 'disabled' },
    tokens,
    platforms: {
      css: {
        prefix: 'tk',
        transforms: ['name/kebab', 'fontFamily/css', 'cubicBezier/css'],
        files: [
          {
            destination: 'tokens.css',
            format: 'css/variables',
            options: { selector, outputReferences: false, showFileHeader: false },
          },
        ],
      },
    },
  });
  const [file] = await sd.formatPlatform('css');
  const { allTokens } = await sd.getPlatformTokens('css');
  return { css: file.output.trim(), vars: allTokens.map((t) => [t.path.join('.'), `--${t.name}`]) };
}

const indent = (s, n) =>
  s
    .split('\n')
    .map((l) => (l ? ' '.repeat(n) + l : l))
    .join('\n');

export async function genTokens({ check }) {
  const all = JSON.parse(fs.readFileSync(abs(SOURCE), 'utf8'));
  const { color, ...rest } = all;
  const base = Object.fromEntries(Object.entries(rest).filter(([k]) => !k.startsWith('$') && !META_GROUPS.has(k)));
  const themeColors = (theme) => ({ color: { $type: color.$type, ...color[theme] } });
  for (const t of THEMES) if (!color[t]) throw new Error(`${SOURCE}: color.${t} missing`);

  const root = await toCss({ ...base, ...themeColors(DEFAULT_THEME) }, ':root');
  const rootCss = root.css;
  const lightCss = (await toCss(themeColors('light'), '[data-theme="light"]')).css;
  const lightSystem = (await toCss(themeColors('light'), ':root:not([data-theme])')).css;

  const css = `/* ${GENERATED_HEADER(SOURCE, 'scripts/gen-tokens.mjs')} */
@layer tokens {
${indent(rootCss, 2)}

${indent(lightCss, 2)}

  /* No theme chosen (boot script did not run): follow the device preference. */
  @media (prefers-color-scheme: light) {
${indent(lightSystem, 4)}
  }

  :root {
    color-scheme: dark;
  }
  [data-theme='light'] {
    color-scheme: light;
  }
  @media (prefers-color-scheme: light) {
    :root:not([data-theme]) {
      color-scheme: light;
    }
  }
}
`;

  const ts = `// ${GENERATED_HEADER(SOURCE, 'scripts/gen-tokens.mjs')}

/** CSS custom property for every design token (theme-independent names). */
export const TOKEN_VARS = {
${root.vars.map(([p, v]) => `  ${JSON.stringify(p)}: ${JSON.stringify(v)},`).join('\n')}
} as const;

export type TokenName = keyof typeof TOKEN_VARS;
export type Theme = ${THEMES.map((t) => JSON.stringify(t)).join(' | ')};
export const THEMES: readonly Theme[] = ${JSON.stringify(THEMES)};
export const DEFAULT_THEME: Theme = ${JSON.stringify(DEFAULT_THEME)};

/** \`var(--tk-…)\` reference for a token, for the rare script needs. */
export const tokenVar = (name: TokenName): string => \`var(\${TOKEN_VARS[name]})\`;
`;
  const palette = all.annotation?.color ?? {};
  const names = Object.keys(palette).filter((k) => !k.startsWith('$'));
  if (names.join() !== PALETTE_ORDER.join()) {
    throw new Error(
      `${SOURCE}: annotation.color must be ${PALETTE_ORDER.join(', ')} (RULE-04), got ${names.join(', ')}`,
    );
  }
  const hex = (name) => {
    const v = palette[name].$value;
    if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v))
      throw new Error(`${SOURCE}: annotation.color.${name} is not #RRGGBB`);
    return v.toUpperCase();
  };
  const paletteTs = `// ${GENERATED_HEADER(SOURCE + ' (annotation.color)', 'scripts/gen-tokens.mjs')}
// Implements: RULE-04 (palette and order), INV-05 (canvas colours never depend on the theme), ADR-0013.

/** The annotation palette in RULE-04 order. */
export const PALETTE = ${JSON.stringify(PALETTE_ORDER)} as const;

export type PaletteColour = (typeof PALETTE)[number];

/** sRGB values of the palette, from tokens.json annotation.color. */
export const PALETTE_HEX: Readonly<Record<PaletteColour, string>> = {
${PALETTE_ORDER.map((n) => `  ${n}: ${JSON.stringify(hex(n))},`).join('\n')}
};
`;
  const okCss = emit(OUT_CSS, css, { check });
  const okTs = emit(OUT_TS, ts, { check });
  const okPalette = emit(OUT_PALETTE, paletteTs, { check });
  return okCss && okTs && okPalette;
}
