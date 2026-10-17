import {
  checkOutpointIsPlain,
  fetchHeldInscriptions,
  fetchInscriptionOutpoints,
  isUnconfirmedPostageSized,
} from './utxoSafety';

const json = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

afterEach(() => {
  delete global.fetch;
});

describe('isUnconfirmedPostageSized', () => {
  it('flags small unconfirmed outputs only', () => {
    const at = (value, confirmed) => ({ value, status: { confirmed } });
    expect(isUnconfirmedPostageSized(at(10000, false))).toBe(true);
    expect(isUnconfirmedPostageSized(at(546, false))).toBe(true);
    expect(isUnconfirmedPostageSized(at(10001, false))).toBe(false);
    expect(isUnconfirmedPostageSized(at(546, true))).toBe(false);
    // No status at all is not evidence of being unconfirmed.
    expect(isUnconfirmedPostageSized({ value: 546 })).toBe(false);
  });
});

describe('fetchHeldInscriptions', () => {
  it('maps every inscription to its outpoint across pages', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        json({
          data: {
            total: 2,
            utxo: [
              { txid: 'AA', vout: 0, inscriptions: [{ inscriptionId: 'i1' }] },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        json({
          data: {
            total: 2,
            utxo: [
              { txid: 'bb', vout: 3, inscriptions: [{ inscriptionId: 'i2' }] },
            ],
          },
        })
      );

    const outpoints = await fetchInscriptionOutpoints('bc1p');
    expect([...outpoints].sort()).toEqual(['aa:0', 'bb:3']);
  });

  it('throws rather than return a partial list', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({}, 429));
    await expect(fetchHeldInscriptions('bc1p')).rejects.toThrow(
      /Could not read the inscriptions held by bc1p/
    );
  });
});

describe('checkOutpointIsPlain', () => {
  const answer = (data) => {
    global.fetch = jest.fn().mockResolvedValue(json({ data }));
  };

  it('passes plain bitcoin', async () => {
    answer({ inscriptionsCount: 0, inscriptions: [], runes: [] });
    await expect(checkOutpointIsPlain('t', 0)).resolves.toBe(true);
  });

  it('refuses inscriptions and runes', async () => {
    answer({ inscriptionsCount: 1 });
    await expect(checkOutpointIsPlain('t', 0)).resolves.toBe(false);
    answer({ inscriptions: [{ inscriptionId: 'x' }] });
    await expect(checkOutpointIsPlain('t', 0)).resolves.toBe(false);
    answer({ runes: [{ rune: 'DOG' }] });
    await expect(checkOutpointIsPlain('t', 0)).resolves.toBe(false);
  });

  it('fails closed when UniSat cannot answer', async () => {
    global.fetch = jest.fn().mockResolvedValue(json({}, 503));
    await expect(checkOutpointIsPlain('t', 0)).rejects.toThrow(/503/);
    global.fetch = jest.fn().mockResolvedValue(json({ data: null }));
    await expect(checkOutpointIsPlain('t', 0)).rejects.toThrow();
  });
});
