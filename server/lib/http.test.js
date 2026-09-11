/**
 * @jest-environment node
 */
const { buildQueryString, parseJsonBody, safeSubpath } = require('./http');

describe('safeSubpath', () => {
  it.each([
    [
      'address/bc1pxyz/inscription-utxo-data',
      'address/bc1pxyz/inscription-utxo-data',
    ],
    ['/utxo/abc/0', 'utxo/abc/0'],
    ['/collection/fine%20pepes/listings', 'collection/fine%20pepes/listings'],
  ])('accepts %s', (input, expected) => {
    expect(safeSubpath(input)).toBe(expected);
  });

  it.each([
    '',
    '/',
    '../admin',
    'a/../../b',
    'a/%2e%2e/b',
    'a/%252e%252e/b',
    'https://evil.example/x',
    'a\\b',
    'a?b=1',
    'a#b',
    '%E0%A4%A',
  ])('rejects %p', (input) => {
    expect(safeSubpath(input)).toBeNull();
  });
});

describe('buildQueryString', () => {
  it('skips empty values and omitted keys, and repeats array values', () => {
    expect(
      buildQueryString(
        { op: 'item', a: '1', empty: '', none: null, list: ['x', 'y'] },
        ['op']
      )
    ).toBe('a=1&list=x&list=y');
  });
});

describe('parseJsonBody', () => {
  it('returns objects as-is and parses JSON strings', () => {
    const body = { a: 1 };
    expect(parseJsonBody(body)).toBe(body);
    expect(parseJsonBody('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonBody('')).toEqual({});
  });

  it('returns null for invalid or non-object JSON', () => {
    expect(parseJsonBody('{oops')).toBeNull();
    expect(parseJsonBody('"text"')).toBeNull();
  });
});
