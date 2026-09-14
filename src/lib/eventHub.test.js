import { createEventHub } from './eventHub';

describe('createEventHub', () => {
  it('delivers emitted data to every subscriber until unsubscribed', () => {
    const hub = createEventHub();
    const first = jest.fn();
    const second = jest.fn();

    hub.on('wallet-selected', first);
    hub.on('wallet-selected', second);
    hub.emit('wallet-selected', { index: 1 });

    expect(first).toHaveBeenCalledWith({ index: 1 });
    expect(second).toHaveBeenCalledWith({ index: 1 });

    hub.off('wallet-selected', first);
    hub.emit('wallet-selected', { index: 2 });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it('ignores events without subscribers', () => {
    const hub = createEventHub();
    expect(() => hub.emit('nothing-listening', 1)).not.toThrow();
    expect(() => hub.off('nothing-listening', () => {})).not.toThrow();
  });
});
