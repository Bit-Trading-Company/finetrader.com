import { getCollectionSlug } from './collectionsApi';

describe('getCollectionSlug', () => {
  it('prefers collectionSymbol, the name the trading APIs use', () => {
    expect(
      getCollectionSlug({
        collectionSymbol: 'fine_pepes',
        symbol: 'other',
        collectionId: 'another',
      })
    ).toBe('fine_pepes');
  });

  it('falls back through symbol to collectionId', () => {
    expect(getCollectionSlug({ symbol: 'nodemonkes' })).toBe('nodemonkes');
    expect(getCollectionSlug({ collectionId: 'bitcoin-frogs' })).toBe(
      'bitcoin-frogs'
    );
  });

  it('returns null when there is no collection or no usable field', () => {
    expect(getCollectionSlug(null)).toBeNull();
    expect(getCollectionSlug({ name: 'Unnamed' })).toBeNull();
  });
});
