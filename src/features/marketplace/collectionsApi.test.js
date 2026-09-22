import {
  collectionMatchesExchange,
  getCollectionExchange,
  getCollectionSlug,
  tagCollections,
} from './collectionsApi';
import { EXCHANGE_IDS } from '../../trading/exchangeIds';

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

/*
 * Satflow and ord.net both call their identifier a slug and both keep it in
 * `collectionSymbol`, but they are separate namespaces. Sending one to the
 * other is what made range trading on ord.net error once per wallet per
 * cycle, forever, instead of failing fast.
 */
describe('collection exchange tagging', () => {
  it('stamps every collection with the marketplace it came from', () => {
    const tagged = tagCollections(
      [{ collectionSymbol: 'fine_pepes' }, { collectionSymbol: 'nodemonkes' }],
      EXCHANGE_IDS.SATFLOW
    );
    expect(tagged.map((c) => c.exchange)).toEqual(['satflow', 'satflow']);
    // The rest of the collection is carried through untouched.
    expect(tagged[0].collectionSymbol).toBe('fine_pepes');
  });

  it('survives a marketplace answering with something other than an array', () => {
    expect(tagCollections(undefined, EXCHANGE_IDS.ORDNET)).toEqual([]);
    expect(tagCollections(null, EXCHANGE_IDS.ORDNET)).toEqual([]);
    expect(tagCollections({}, EXCHANGE_IDS.ORDNET)).toEqual([]);
  });

  it('reports which marketplace a collection belongs to', () => {
    expect(getCollectionExchange({ exchange: 'ordnet' })).toBe('ordnet');
    expect(getCollectionExchange({ collectionSymbol: 'x' })).toBeNull();
    expect(getCollectionExchange(null)).toBeNull();
  });

  it('matches a collection only against its own marketplace', () => {
    const satflow = { collectionSymbol: 'fine_pepes', exchange: 'satflow' };
    expect(collectionMatchesExchange(satflow, EXCHANGE_IDS.SATFLOW)).toBe(true);
    expect(collectionMatchesExchange(satflow, EXCHANGE_IDS.ORDNET)).toBe(false);
  });

  /*
   * Untagged is the pre-existing shape. Refusing it would break a flow that
   * works today rather than prevent a real mistake, so it is allowed through.
   */
  it('lets an untagged collection trade anywhere', () => {
    const legacy = { collectionSymbol: 'fine_pepes' };
    expect(collectionMatchesExchange(legacy, EXCHANGE_IDS.SATFLOW)).toBe(true);
    expect(collectionMatchesExchange(legacy, EXCHANGE_IDS.ORDNET)).toBe(true);
  });

  it('never matches when nothing is selected', () => {
    expect(collectionMatchesExchange(null, EXCHANGE_IDS.SATFLOW)).toBe(false);
  });
});
