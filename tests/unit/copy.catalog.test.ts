// MOD-Copy over the generated catalog (ADR-0015 §3/§5; RULE-17; F-018.AC8).
import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE, formatNumber, language, LANGUAGES, t, translate } from '../../src/copy';
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

  it('F-018.AC6 the crop size is written the way the active language writes numbers', () => {
    expect(translate('vi-VN', 'crop.size', { width: 1920, height: 1080 })).toBe('1.920 × 1.080 px');
    expect(translate('en-US', 'crop.size', { width: 1920, height: 1080 })).toBe('1,920 × 1,080 px');
  });

  it('F-018.AC9 the redaction count is plural in en-US and has no plural change in vi-VN', () => {
    expect(translate('en-US', 'export.redaction_count', { count: 1 })).toBe('1 redaction');
    expect(translate('en-US', 'export.redaction_count', { count: 3 })).toBe('3 redactions');
    expect(translate('vi-VN', 'export.redaction_count', { count: 1 })).toBe('1 vùng che');
    expect(translate('vi-VN', 'export.redaction_count', { count: 3 })).toBe('3 vùng che');
  });

  it('F-018.R1 t() and the number formatters follow the active language signal', () => {
    try {
      language.value = 'vi-VN';
      expect(t('a11y.canvas')).toBe('Vùng ảnh');
      expect(formatNumber(1920)).toBe('1.920');
      language.value = 'en-US';
      expect(t('a11y.canvas')).toBe('Image canvas');
      expect(formatNumber(1920)).toBe('1,920');
    } finally {
      language.value = DEFAULT_LANGUAGE;
    }
  });
});
