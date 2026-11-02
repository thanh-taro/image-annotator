// ESLint flat config (ADR-0003). Copied from DAFV and adapted: TypeScript, accessibility, the ban on
// network and storage APIs (INV-04, NFR-01; platform-mapping.md "Privacy and policy"), the
// one-owner rules (only MOD-Host reaches the parent and the service worker; only MOD-IO touches the
// clipboard, file input, downloads and `beforeunload`), and the module import boundaries of
// architecture.md "Dependency rule".
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

const NET = 'INV-04 / NFR-01: no network requests from the tool (ADR-0003)';
const STORE = 'INV-04: nothing is persisted (ADR-0003)';

const NETWORK_AND_STORAGE = [
  ['fetch', NET],
  ['XMLHttpRequest', NET],
  ['WebSocket', NET],
  ['EventSource', NET],
  ['localStorage', STORE],
  ['sessionStorage', STORE],
  ['indexedDB', STORE],
  ['caches', `${STORE} (Cache Storage belongs to /sw.js only, ADR-0011)`],
  ['BroadcastChannel', 'INV-04: nothing leaves this page'],
  ['open', 'INV-04: no navigation that could carry content'],
].map(([name, message]) => ({ name, message }));

// Windows outside the tool: only MOD-Host may reach them (ADR-0010).
const OTHER_WINDOWS = ['parent', 'top', 'opener'];
const HOST_ONLY = 'Only MOD-Host may reach other windows or the service worker (ADR-0010, ADR-0011).';
const OTHER_WINDOW_GLOBALS = OTHER_WINDOWS.map((name) => ({ name, message: HOST_ONLY }));
const OTHER_WINDOW_PROPERTIES = ['window', 'self', 'globalThis'].flatMap((object) =>
  OTHER_WINDOWS.map((property) => ({ object, property, message: HOST_ONLY })),
);
const SERVICE_WORKER = [{ object: 'navigator', property: 'serviceWorker', message: HOST_ONLY }];

const NETWORK_PROPERTIES = [
  { object: 'navigator', property: 'sendBeacon', message: NET },
  { object: 'window', property: 'fetch', message: NET },
  { object: 'self', property: 'fetch', message: NET },
  { object: 'globalThis', property: 'fetch', message: NET },
  { object: 'document', property: 'cookie', message: STORE },
  { object: 'window', property: 'localStorage', message: STORE },
  { object: 'window', property: 'sessionStorage', message: STORE },
  { object: 'window', property: 'indexedDB', message: STORE },
  { object: 'self', property: 'importScripts', message: 'INV-04: no remote scripts' },
  { object: 'navigator', property: 'storage', message: STORE },
  { object: 'window', property: 'open', message: 'INV-04: no navigation that could carry content' },
  { object: 'location', property: 'assign', message: 'INV-04: no navigation that could carry content' },
  { object: 'location', property: 'replace', message: 'INV-04: no navigation that could carry content' },
];

// Only MOD-IO: clipboard, downloads (object URLs), the file input and the leave-page warning.
const IO_ONLY = 'Only MOD-IO touches the clipboard, file input, downloads and beforeunload (architecture.md).';
const IO_PROPERTIES = [
  { object: 'navigator', property: 'clipboard', message: IO_ONLY },
  { object: 'URL', property: 'createObjectURL', message: IO_ONLY },
];
const IO_SYNTAX = [
  "NewExpression[callee.name='ClipboardItem']",
  "CallExpression[callee.property.name='addEventListener'][arguments.0.value='beforeunload']",
  "CallExpression[callee.name='addEventListener'][arguments.0.value='beforeunload']",
  "AssignmentExpression[left.property.name='onbeforeunload']",
  "JSXAttribute[name.name='download']",
  "JSXAttribute[name.name='type'][value.value='file']",
  "AssignmentExpression[left.property.name='download']",
].map((selector) => ({ selector, message: IO_ONLY }));

// HTML injection and image loading by URL (ADR-0003), navigation by assignment (CSP has no
// navigate-to), and postMessage to another window.
const BANNED_SYNTAX = [
  ["NewExpression[callee.name='Image']", `${NET}: no new Image()`],
  ['MemberExpression[property.name=/^(innerHTML|outerHTML)$/]', 'ADR-0003: no innerHTML / outerHTML'],
  ["CallExpression[callee.property.name='insertAdjacentHTML']", 'ADR-0003: no insertAdjacentHTML'],
  ["JSXAttribute[name.name='dangerouslySetInnerHTML']", 'ADR-0003: no innerHTML'],
  ["AssignmentExpression[left.type='Identifier'][left.name='location']", 'INV-04: no navigation'],
  ["AssignmentExpression[left.property.name='location']", 'INV-04: no navigation'],
  ["AssignmentExpression[left.object.name='location']", 'INV-04: no navigation'],
  ["AssignmentExpression[left.object.property.name='location']", 'INV-04: no navigation'],
  [
    "CallExpression[callee.object.property.name='location'][callee.property.name=/^(assign|replace)$/]",
    'INV-04: no navigation',
  ],
].map(([selector, message]) => ({ selector, message }));
const OTHER_WINDOW_POST = [
  "CallExpression[callee.property.name='postMessage'][callee.object.name=/^(parent|top|opener)$/]",
  "CallExpression[callee.property.name='postMessage'][callee.object.property.name=/^(parent|top|opener)$/]",
].map((selector) => ({ selector, message: HOST_ONLY }));

/**
 * Import boundary for one module folder: relative imports may reach only its own folder and the
 * listed sibling module folders (architecture.md "Dependency rule"); `dom: false` also bans the
 * DOM-bound UI packages.
 */
function boundary(mod, allowed, { dom = true } = {}) {
  const others = allowed.length ? `(?!(?:${allowed.join('|')})(?:/|$))` : '';
  const patterns = [
    {
      regex: `^\\.\\./${others}`,
      message: `${mod} may import only ${allowed.length ? allowed.map((a) => `src/${a}`).join(', ') : 'its own folder'} (architecture.md "Dependency rule").`,
    },
    { regex: '^\\.\\./\\.\\./', message: `${mod}: import sibling modules as ../<module>, never deeper.` },
  ];
  if (!dom) patterns.push({ group: ['preact', 'preact/*', '@preact/*'], message: `${mod} imports no DOM code.` });
  return { 'no-restricted-imports': ['error', { patterns }] };
}

/** The ban rules for page source; `host` / `io` lift that owner's bans inside its own folder. */
function bans({ host = false, io = false } = {}) {
  return {
    'no-restricted-globals': ['error', ...NETWORK_AND_STORAGE, ...(host ? [] : OTHER_WINDOW_GLOBALS)],
    'no-restricted-properties': [
      'error',
      ...NETWORK_PROPERTIES,
      ...(host ? [] : [...OTHER_WINDOW_PROPERTIES, ...SERVICE_WORKER]),
      ...(io ? [] : IO_PROPERTIES),
    ],
    'no-restricted-syntax': ['error', ...BANNED_SYNTAX, ...(host ? [] : OTHER_WINDOW_POST), ...(io ? [] : IO_SYNTAX)],
  };
}

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dist-e2e/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      '.lighthouseci/',
      '.wrangler/',
      '.claude/',
      '.build-my-app/',
      'design/',
      'tests/fixtures/',
      '**/*.gen.ts',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/**/*.{ts,tsx}'], ...jsxA11y.flatConfigs.recommended },
  { files: ['src/**/*.{ts,tsx,js}'], rules: bans() },
  { files: ['src/host/**'], rules: bans({ host: true }) },
  { files: ['src/io/**'], rules: bans({ io: true }) },
  {
    // The offline service worker (ADR-0011) alone may use Cache Storage and forward the browser's
    // own requests; it never runs in the page.
    files: ['src/host/sw.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...NETWORK_AND_STORAGE.filter(({ name }) => name !== 'fetch' && name !== 'caches'),
      ],
    },
  },
  // Module boundaries (architecture.md "Dependency rule"; module specs' depends_on).
  { files: ['src/core/**'], rules: boundary('MOD-Core', [], { dom: false }) },
  { files: ['src/document/**'], rules: boundary('MOD-Document', ['core'], { dom: false }) },
  { files: ['src/keys/**'], rules: boundary('MOD-Keys', [], { dom: false }) },
  { files: ['src/effects/**'], rules: boundary('MOD-Effects', ['core'], { dom: false }) },
  { files: ['src/render/**'], rules: boundary('MOD-Render', ['core'], { dom: false }) },
  { files: ['src/copy/**'], rules: boundary('MOD-Copy', []) },
  { files: ['src/host/**'], rules: boundary('MOD-Host', ['copy']) },
  { files: ['src/io/**'], rules: boundary('MOD-IO', ['core', 'render', 'effects']) },
  {
    files: ['src/canvas/**'],
    rules: boundary('MOD-Canvas', ['core', 'document', 'render', 'effects', 'keys', 'copy']),
  },
  {
    files: ['src/app/**'],
    rules: boundary('MOD-App', ['core', 'document', 'canvas', 'keys', 'io', 'host', 'copy']),
  },
  {
    // The boot script is a classic inline script (MOD-Host).
    files: ['src/host/boot.js'],
    languageOptions: { sourceType: 'script' },
    rules: { 'no-empty': 'off', 'no-var': 'off', '@typescript-eslint/no-unused-vars': 'off' },
  },
);
