// MOD-App — inlined lucide-static icons (DEP-06, ADR-0013). Only the icons imported here are bundled
// (the package has no side effects). Each SVG string is turned into elements once — never injected
// as HTML (ADR-0003) — and drawn with the stroke width of the designs.
import type { JSX } from 'preact';
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CodeXml,
  Download,
  Image,
  LoaderCircle,
  Minus,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-static';

const SOURCES = {
  alert: CircleAlert,
  check: CircleCheck,
  download: Download,
  image: Image,
  spinner: LoaderCircle,
  close: X,
  // F-016: the privacy statement and the source link (lucide has no brand marks, so no GitHub logo).
  shieldCheck: ShieldCheck,
  code: CodeXml,
  minus: Minus,
  plus: Plus,
  chevronDown: ChevronDown,
} as const;

export type IconName = keyof typeof SOURCES;

type Shape = readonly [tag: string, attrs: Record<string, string>];

/** The child shapes of a lucide SVG string: simple self-closing elements with quoted attributes. */
function shapes(svg: string): Shape[] {
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'));
  return Array.from(inner.matchAll(/<([a-z]+)\s([^>]*?)\/>/g), (m) => {
    const attrs: Record<string, string> = {};
    for (const a of (m[2] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1] ?? ''] = a[2] ?? '';
    return [m[1] ?? 'path', attrs] as const;
  });
}

const PARSED = Object.fromEntries(
  Object.entries(SOURCES).map(([name, svg]) => [name, shapes(svg)]),
) as unknown as Record<IconName, Shape[]>;

export function Icon({ name, size = 16, class: cls }: { name: IconName; size?: number; class?: string }) {
  return (
    <svg
      class={cls ? `tk-icon ${cls}` : 'tk-icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PARSED[name].map(([Tag, attrs], i) => {
        const El = Tag as unknown as keyof JSX.IntrinsicElements;
        return <El key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}
