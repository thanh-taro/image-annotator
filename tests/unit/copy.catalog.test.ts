// MOD-Copy over the generated catalog (ADR-0015 §3/§5; RULE-17; F-018.AC8).
import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, formatNumber, LANGUAGES, translate } from '../../src/copy';
import { CATALOG } from '../../src/copy/messages.gen';

describe('MOD-Copy', () => {
  it('RULE-17 supports en-US (the default) and vi-VN', () => {
    expect(LANGUAGES).toEqual(['en-US', 'vi-VN']);
    expect(DEFAULT_LANGUAGE).toBe('en-US');
  });

  it('F-018.AC8 the generated catalog has every COPY ID in every language', () => {
    expect(Object.keys(CATALOG['vi-VN'])).toEqual(Object.keys(CATALOG['en-US']));
    expect(Object.keys(CATALOG['en-US']).length).toBeGreaterThan(100);
  });

  it('smoke: t() fills placeholders and formats numbers for the language', () => {
    expect(translate('en-US', 'status.image_size', { width: 1920, height: 1080 })).toBe('1,920 × 1,080 px');
    expect(translate('vi-VN', 'status.image_size', { width: 1920, height: 1080 })).toBe('1.920 × 1.080 px');
    expect(formatNumber(1920, 'vi-VN')).toBe('1.920');
  });

  it('smoke: t() picks the plural form by count (Intl.PluralRules)', () => {
    expect(translate('en-US', 'export.redaction_count', { count: 1 })).toBe('1 redaction');
    expect(translate('en-US', 'export.redaction_count', { count: 3 })).toBe('3 redactions');
    expect(translate('vi-VN', 'export.redaction_count', { count: 1 })).toBe('1 vùng che');
    expect(translate('vi-VN', 'export.redaction_count', { count: 3 })).toBe('3 vùng che');
  });
});
