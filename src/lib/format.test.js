import {
  formatCompactNumber,
  formatSatsAsBtc,
  shortenAddress,
  truncateMiddle,
} from './format';

describe('truncateMiddle', () => {
  it('keeps strings of 14 characters or fewer', () => {
    expect(truncateMiddle('abcdefghijklmn')).toBe('abcdefghijklmn');
    expect(truncateMiddle('')).toBe('');
    expect(truncateMiddle(undefined)).toBe('');
  });

  it('shortens longer strings to first7...last7', () => {
    expect(truncateMiddle('abcdefghijklmnop')).toBe('abcdefg...jklmnop');
  });
});

describe('shortenAddress', () => {
  it('shortens to first8...last8 and handles missing addresses', () => {
    expect(shortenAddress('bc1p0123456789abcdefghij')).toBe(
      'bc1p0123...cdefghij'
    );
    expect(shortenAddress(null)).toBe('');
  });
});

describe('formatSatsAsBtc', () => {
  it('formats sats as 8-decimal BTC', () => {
    expect(formatSatsAsBtc(123456789)).toBe('1.23456789');
    expect(formatSatsAsBtc(0)).toBe('0.00000000');
  });

  it('returns N/A for missing amounts', () => {
    expect(formatSatsAsBtc(undefined)).toBe('N/A');
    expect(formatSatsAsBtc(null)).toBe('N/A');
  });
});

describe('formatCompactNumber', () => {
  it('uses K/M/B suffixes', () => {
    expect(formatCompactNumber(999)).toBe('999');
    expect(formatCompactNumber(1500)).toBe('1.50K');
    expect(formatCompactNumber(2500000)).toBe('2.50M');
    expect(formatCompactNumber(3000000000)).toBe('3.00B');
    expect(formatCompactNumber(0)).toBe('0');
    expect(formatCompactNumber(undefined)).toBe('N/A');
  });
});
