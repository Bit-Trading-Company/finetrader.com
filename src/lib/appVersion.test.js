import { formatAppVersion } from './appVersion';

describe('formatAppVersion', () => {
  it('names the version, commit, branch and build time', () => {
    expect(
      formatAppVersion({
        version: '0.1.0',
        commit: 'abc1234',
        branch: 'main',
        builtAt: '2026-10-17T20:00:00.000Z',
      })
    ).toBe(
      'Fine Trader v0.1.0 (abc1234, main, built 2026-10-17T20:00:00.000Z)'
    );
  });

  it('leaves out what the build did not stamp', () => {
    expect(
      formatAppVersion({ version: '0.1.0', commit: 'unknown', branch: '' })
    ).toBe('Fine Trader v0.1.0 (unknown)');
  });
});
