// MOD-Core limits (RULE-02; architecture.md A1). Test names follow adapters/tests.md.
import { describe, expect, it } from 'vitest';
import { checkLimits, MAX_FILE_BYTES, MAX_PIXELS, MAX_SIDE, scaleDownSize } from '../../src/core';

describe('MOD-Core limits', () => {
  it('RULE-02 limits are 50,000,000 bytes, 16,777,216 pixels and 16,384 per side', () => {
    expect(MAX_FILE_BYTES).toBe(50_000_000);
    expect(MAX_PIXELS).toBe(4096 * 4096);
    expect(MAX_SIDE).toBe(16_384);
  });

  it('RULE-02 accepts sizes at the limits and refuses sizes over them', () => {
    expect(checkLimits(4096, 4096)).toEqual({ ok: true });
    expect(checkLimits(16_384, 1024)).toEqual({ ok: true });
    expect(checkLimits(4097, 4096)).toEqual({ ok: false, reason: 'too_large' });
    expect(checkLimits(16_385, 1)).toEqual({ ok: false, reason: 'too_large' });
  });

  it('RULE-02 an image smaller than 1 × 1 counts as undecodable', () => {
    expect(checkLimits(0, 10)).toEqual({ ok: false, reason: 'too_small' });
    expect(checkLimits(10, 0)).toEqual({ ok: false, reason: 'too_small' });
  });

  it('RULE-02 scale-down keeps the aspect ratio, rounding each side down', () => {
    expect(scaleDownSize(8192, 8192)).toEqual({ width: 4096, height: 4096 });
    expect(scaleDownSize(32_768, 1000)).toEqual({ width: 16_384, height: 500 });
    expect(scaleDownSize(6000, 4000)).toEqual({ width: 5016, height: 3344 });
    expect(scaleDownSize(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });
});
