import { fetchAddressUtxos, normalizeUnisatUtxo } from './addressUtxos';

const ADDRESS = 'bc1pexample';

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

const textResponse = (text, status) => ({
  ok: false,
  status,
  text: async () => text,
  json: async () => JSON.parse(text),
});

const unisatPage = (rows, total) =>
  jsonResponse({ code: 0, msg: 'ok', data: { cursor: 0, total, utxo: rows } });

const unisatRow = (overrides = {}) => ({
  txid: 'aa'.repeat(32),
  vout: 0,
  satoshi: 1234,
  scriptPk: '5120abcd',
  height: 900000,
  isSpent: false,
  inscriptionsCount: 0,
  ...overrides,
});

describe('normalizeUnisatUtxo', () => {
  test('maps UniSat fields to the mempool provider shape', () => {
    expect(normalizeUnisatUtxo(unisatRow({ vout: 2 }))).toEqual({
      txid: 'aa'.repeat(32),
      vout: 2,
      value: 1234,
      scriptpubkey: '5120abcd',
      status: { confirmed: true, block_height: 900000 },
      inscriptionsCount: 0,
    });
  });

  test('treats the mempool sentinel height as unconfirmed', () => {
    expect(normalizeUnisatUtxo(unisatRow({ height: 4194303 })).status).toEqual({
      confirmed: false,
    });
  });
});

describe('fetchAddressUtxos', () => {
  test('returns the provider response when it answers', async () => {
    const utxos = [
      { txid: 'ab', vout: 0, value: 5, status: { confirmed: true } },
    ];
    const fetchImpl = jest.fn(async () => jsonResponse(utxos));

    await expect(
      fetchAddressUtxos(ADDRESS, 'mainnet', { fetchImpl })
    ).resolves.toEqual(utxos);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain(`address/${ADDRESS}/utxo`);
  });

  test('pages through UniSat when the address has too many outputs', async () => {
    const firstPage = Array.from({ length: 500 }, (_, i) =>
      unisatRow({ vout: i })
    );
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        textResponse(
          'Too many unspent transaction outputs (>500). Contact support to raise limits.',
          400
        )
      )
      .mockResolvedValueOnce(unisatPage(firstPage, 501))
      .mockResolvedValueOnce(unisatPage([unisatRow({ vout: 500 })], 501));

    const utxos = await fetchAddressUtxos(ADDRESS, 'mainnet', { fetchImpl });

    expect(utxos).toHaveLength(501);
    expect(utxos[0].value).toBe(1234);
    expect(utxos[0].scriptpubkey).toBe('5120abcd');
    expect(fetchImpl.mock.calls[1][0]).toContain('utxo-data');
    expect(fetchImpl.mock.calls[1][0]).toContain('cursor=0');
    expect(fetchImpl.mock.calls[2][0]).toContain('cursor=500');
  });

  test('skips spent rows reported by UniSat', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(textResponse('nope', 429))
      .mockResolvedValueOnce(
        unisatPage([unisatRow(), unisatRow({ vout: 1, isSpent: true })], 2)
      );

    await expect(
      fetchAddressUtxos(ADDRESS, 'mainnet', { fetchImpl })
    ).resolves.toHaveLength(1);
  });

  test('throws with both reasons when neither source answers', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(textResponse('Too many unspent outputs', 400))
      .mockResolvedValueOnce(textResponse('{"msg":"no key"}', 401));

    await expect(
      fetchAddressUtxos(ADDRESS, 'mainnet', { fetchImpl })
    ).rejects.toThrow(/Too many unspent outputs[\s\S]*UniSat utxo-data 401/);
  });

  test('never reports an empty wallet when the provider throws', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('proxy down'));

    await expect(
      fetchAddressUtxos(ADDRESS, 'mainnet', { fetchImpl })
    ).rejects.toThrow(/network down/);
  });
});
