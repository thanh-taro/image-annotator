// MOD-App — inlined lucide-static icons (DEP-06, ADR-0013). Only the icons imported here are bundled
// (the package has no side effects). Each SVG string is turned into elements once — never injected
// as HTML (ADR-0003) — and drawn with the stroke width of the designs.
import type { JSX } from 'preact';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CodeXml,
  Copy,
  Download,
  Ellipsis,
  Grid2x2,
  Highlighter,
  Image,
  ListOrdered,
  LoaderCircle,
  Minus,
  MousePointer2,
  MoveUpRight,
  Pen,
  Plus,
  RectangleEllipsis,
  RectangleHorizontal,
  ShieldCheck,
  Slash,
  TriangleAlert,
  Type,
  Undo2,
  Redo2,
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
  // F-003: CMP-Toolbar tools, the narrow tool row's edge hints and the summary bar's chevron.
  select: MousePointer2,
  rectangle: RectangleHorizontal,
  ellipse: Circle,
  arrow: MoveUpRight,
  line: Slash,
  // F-004: the pen and highlight tools.
  pen: Pen,
  highlight: Highlighter,
  // F-005: the text tool (the designs' "T").
  text: Type,
  // F-006: the step tool (lucide has no numbered circle; the ordered list stands for numbered steps).
  step: ListOrdered,
  // F-007: the redaction tool (a box over a line of text, as in the designs), the kinds — solid with the
  // shield and check (style.md principle 5), blur, pixelate — and the not-secure warning.
  redact: RectangleEllipsis,
  blur: CircleDashed,
  pixelate: Grid2x2,
  warning: TriangleAlert,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronUp: ChevronUp,
  // F-012: CMP-Toolbar's copy and the overflow (COPY-action.more).
  copy: Copy,
  more: Ellipsis,
  // F-009: CMP-Toolbar's undo and redo (the designs' curved arrows).
  undo: Undo2,
  redo: Redo2,
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
