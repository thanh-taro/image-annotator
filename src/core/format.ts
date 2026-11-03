// MOD-Core — the RULE-01 format sniff from magic bytes (ADR-0005 decision 1). Promoted from spike
// SP-decode (ADR-0018): MIME type and file extension are never consulted, and this check is the only
// thing that refuses HEIC on WebKit, which can decode it.
// Implements: RULE-01.
import type { SourceType } from './types';

/** How many leading bytes the sniff reads (ADR-0005). */
export const SNIFF_BYTES = 64;

const AVIF_BRANDS = new Set(['avif', 'avis']);

function startsWith(b: Uint8Array, at: number, text: string): boolean {
  if (b.length < at + text.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

/** The brands of an ISO-BMFF `ftyp` box (major brand and compatible brands), within the sniffed bytes. */
function ftypBrands(b: Uint8Array): string[] {
  const size = (((b[0] ?? 0) << 24) | ((b[1] ?? 0) << 16) | ((b[2] ?? 0) << 8) | (b[3] ?? 0)) >>> 0;
  const end = Math.min(size, b.length, SNIFF_BYTES);
  const brands: string[] = [];
  for (let at = 8; at + 4 <= end; at += 4) {
    if (at === 12) continue; // minor_version
    brands.push(String.fromCharCode(b[at] ?? 0, b[at + 1] ?? 0, b[at + 2] ?? 0, b[at + 3] ?? 0));
  }
  return brands;
}

/**
 * The RULE-01 format of a file from its first bytes, or null when it is not a supported format
 * (HEIC/HEIF, TIFF, PDF, SVG and anything else). AVIF still depends on the browser (MOD-IO probe).
 */
export function sniffFormat(bytes: Uint8Array): SourceType | null {
  const b = bytes.subarray(0, SNIFF_BYTES);
  if (startsWith(b, 0, '\x89PNG\r\n\x1a\n')) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (startsWith(b, 0, 'GIF87a') || startsWith(b, 0, 'GIF89a')) return 'gif';
  if (startsWith(b, 0, 'RIFF') && startsWith(b, 8, 'WEBP')) return 'webp';
  if (startsWith(b, 0, 'BM')) return 'bmp';
  if (startsWith(b, 4, 'ftyp') && ftypBrands(b).some((brand) => AVIF_BRANDS.has(brand))) return 'avif';
  return null;
}
