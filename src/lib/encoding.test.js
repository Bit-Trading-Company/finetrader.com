import { hexToBase64 } from './encoding';

describe('hexToBase64', () => {
  it('converts hex bytes to base64', () => {
    expect(hexToBase64('70736274ff')).toBe('cHNidP8=');
    expect(hexToBase64('00ff10')).toBe(
      Buffer.from('00ff10', 'hex').toString('base64')
    );
  });
});
