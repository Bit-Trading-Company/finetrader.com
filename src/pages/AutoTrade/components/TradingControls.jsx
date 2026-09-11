/**
 * Step 5 controls: exchange, trading mode, timer, mode-specific settings
 * and the Start/Stop Trading button.
 */
import React from 'react';
import { TRADING_EXCHANGES } from '../../../trading/exchanges';

const TradingControls = ({
  tradingExchange,
  setTradingExchange,
  isTrading,
  tradingMode,
  setTradingMode,
  timerHours,
  setTimerHours,
  timerMinutes,
  setTimerMinutes,
  timerSeconds,
  setTimerSeconds,
  timerIntervalSeconds,
  selectedCollectionSlug,
  setShowCollectionOfferModal,
  usePriceRange,
  setUsePriceRange,
  tradePrice,
  setTradePrice,
  lowerTradePrice,
  setLowerTradePrice,
  upperTradePrice,
  setUpperTradePrice,
  buyXEachAmount,
  setBuyXEachAmount,
  useCustomWalletSubset,
  selectedWalletIndices,
  wallets,
  sellXAmount,
  setSellXAmount,
  useCustomSellPrice,
  setUseCustomSellPrice,
  customSellPrice,
  setCustomSellPrice,
  buyAdditionalItems,
  setBuyAdditionalItems,
  setPurchaseAmount,
  setBuyItemsEveryTick,
  purchaseAmount,
  buyItemsEveryTick,
  handleStartTrading,
  selectedCollection,
}) => (
  <div className="auto-trade-controls">
    <div className="auto-trade-control-group">
      <label>Exchange:</label>
      <div className="auto-trade-radio-group">
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingExchange"
            value={TRADING_EXCHANGES.SATFLOW}
            checked={tradingExchange === TRADING_EXCHANGES.SATFLOW}
            onChange={(e) => setTradingExchange(e.target.value)}
            disabled={isTrading}
          />
          <span>Satflow</span>
        </label>
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingExchange"
            value={TRADING_EXCHANGES.ORDNET}
            checked={tradingExchange === TRADING_EXCHANGES.ORDNET}
            onChange={(e) => setTradingExchange(e.target.value)}
            disabled={isTrading}
          />
          <span>ord.net</span>
        </label>
      </div>
    </div>

    <div className="auto-trade-control-group">
      <label>Trading Mode:</label>
      <div className="auto-trade-radio-group">
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingMode"
            value="auto-buy-sell"
            checked={tradingMode === 'auto-buy-sell'}
            onChange={(e) => setTradingMode(e.target.value)}
            disabled={isTrading}
          />
          <span>Delta neutral trading</span>
        </label>
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingMode"
            value="range-trading"
            checked={tradingMode === 'range-trading'}
            onChange={(e) => setTradingMode(e.target.value)}
            disabled={isTrading}
          />
          <span>Range trading</span>
        </label>
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingMode"
            value="buy-x-each"
            checked={tradingMode === 'buy-x-each'}
            onChange={(e) => setTradingMode(e.target.value)}
            disabled={isTrading}
          />
          <span>Buy X from each wallet</span>
        </label>
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingMode"
            value="sell-x-each"
            checked={tradingMode === 'sell-x-each'}
            onChange={(e) => setTradingMode(e.target.value)}
            disabled={isTrading}
          />
          <span>Sell X from each wallet</span>
        </label>
        <label className="auto-trade-radio-label">
          <input
            type="radio"
            name="tradingMode"
            value="bid-accept-bids"
            checked={tradingMode === 'bid-accept-bids'}
            onChange={(e) => setTradingMode(e.target.value)}
            disabled={isTrading}
          />
          <span>Bid / accept bids</span>
        </label>
        {/* <label className="auto-trade-radio-label disabled">
                    <input
                      type="radio"
                      name="tradingMode"
                      value="delta-neutral"
                      checked={tradingMode === 'delta-neutral'}
                      onChange={(e) => setTradingMode(e.target.value)}
                      disabled={true}
                    />
                    <span>Delta neutral trading</span>
                  </label> */}
        <label className="auto-trade-radio-label disabled">
          <input
            type="radio"
            name="tradingMode"
            value="auto-fill"
            checked={tradingMode === 'auto-fill'}
            onChange={(e) => setTradingMode(e.target.value)}
            disabled={true}
          />
          <span>Auto fill order-book</span>
        </label>
      </div>
    </div>

    {tradingMode !== 'bid-accept-bids' && (
      <div className="auto-trade-control-group">
        <label>Timer:</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <input
              type="number"
              value={timerHours}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setTimerHours(isNaN(value) ? 0 : Math.max(0, value));
              }}
              disabled={isTrading}
              min="0"
              style={{ width: '90px' }}
            />
            <span style={{ color: '#a0aec0' }}>hours</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <input
              type="number"
              value={timerMinutes}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setTimerMinutes(isNaN(value) ? 0 : Math.max(0, value));
              }}
              disabled={isTrading}
              min="0"
              style={{ width: '90px' }}
            />
            <span style={{ color: '#a0aec0' }}>minutes</span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <input
              type="number"
              value={timerSeconds}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setTimerSeconds(isNaN(value) ? 0 : Math.max(0, value));
              }}
              disabled={isTrading}
              min="0"
              style={{ width: '90px' }}
            />
            <span style={{ color: '#a0aec0' }}>seconds</span>
          </div>
        </div>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#a0aec0',
            marginTop: '6px',
          }}
        >
          Tick interval: {timerIntervalSeconds}s
        </p>
      </div>
    )}
    {tradingMode === 'bid-accept-bids' && (
      <div className="auto-trade-control-group">
        <button
          type="button"
          className="auto-trade-button"
          disabled={!selectedCollectionSlug || isTrading}
          onClick={() => setShowCollectionOfferModal(true)}
        >
          Open bids for collection
        </button>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#a0aec0',
            marginTop: '8px',
          }}
        >
          Place collection bids or accept incoming bids (Satflow). Select a
          collection in step 4 first.
        </p>
      </div>
    )}
    {tradingMode === 'range-trading' && (
      <>
        <div className="auto-trade-control-group">
          <label className="auto-trade-checkbox-label">
            <input
              type="checkbox"
              checked={usePriceRange}
              onChange={(e) => setUsePriceRange(e.target.checked)}
              disabled={isTrading}
            />
            <span>Use price range</span>
          </label>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '24px',
            }}
          >
            {usePriceRange
              ? 'Trade at random price between lower and upper bounds'
              : 'Trade at a fixed price'}
          </p>
        </div>
        {!usePriceRange ? (
          <div className="auto-trade-control-group">
            <label>Trade Price (BTC):</label>
            <input
              type="number"
              value={tradePrice}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setTradePrice(isNaN(value) ? 0 : Math.max(0, value));
              }}
              disabled={isTrading}
              min="0"
              step="0.00000001"
            />
            <p
              style={{
                fontSize: '0.85rem',
                color: '#a0aec0',
                marginTop: '4px',
              }}
            >
              Items will be bought and sold at this price (defaults to floor
              price)
            </p>
          </div>
        ) : (
          <div className="auto-trade-control-group">
            <label>Trade Price Range (BTC):</label>
            <div
              style={{
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '0.9rem',
                  }}
                >
                  Lower
                </label>
                <input
                  type="number"
                  value={lowerTradePrice}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    const newLower = isNaN(value) ? 0 : Math.max(0, value);
                    setLowerTradePrice(newLower);
                    // Ensure upper is always higher
                    if (upperTradePrice <= newLower) {
                      setUpperTradePrice(newLower * 1.01); // Set to 1% above if invalid
                    }
                  }}
                  disabled={isTrading}
                  min="0"
                  step="0.00000001"
                  style={{ width: '90%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '0.9rem',
                  }}
                >
                  Upper
                </label>
                <input
                  type="number"
                  value={upperTradePrice}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    const newUpper = isNaN(value) ? 0 : Math.max(0, value);
                    // Ensure upper is always higher than lower
                    if (newUpper > lowerTradePrice) {
                      setUpperTradePrice(newUpper);
                    } else {
                      // If invalid, set to lower + 1%
                      setUpperTradePrice(lowerTradePrice * 1.01);
                    }
                  }}
                  disabled={isTrading}
                  min={lowerTradePrice * 1.00000001} // Ensure it's always higher
                  step="0.00000001"
                  style={{ width: '90%' }}
                />
              </div>
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: '#a0aec0',
                marginTop: '4px',
              }}
            >
              Trade at random price between lower and upper bounds (defaults to
              floor price - floor price + 10%)
            </p>
            {upperTradePrice <= lowerTradePrice && (
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#fc8181',
                  marginTop: '4px',
                }}
              >
                ⚠ Upper price must be higher than lower price
              </p>
            )}
          </div>
        )}
      </>
    )}
    {tradingMode === 'buy-x-each' && (
      <>
        <div className="auto-trade-control-group">
          <label style={{ display: 'block', marginBottom: '4px' }}>
            Floor items to buy per wallet:
          </label>
          <input
            type="number"
            value={buyXEachAmount}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setBuyXEachAmount(isNaN(value) ? 1 : Math.max(1, value));
            }}
            disabled={isTrading}
            min="1"
          />
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
            }}
          >
            Buys the cheapest Satflow listings (same flow as &quot;Buy
            additional items&quot;), up to {buyXEachAmount} per wallet (~
            {buyXEachAmount *
              (useCustomWalletSubset
                ? selectedWalletIndices.size
                : wallets.length)}{' '}
            max if all succeed). Stops when done; does not start auto-trading.
          </p>
        </div>
      </>
    )}
    {tradingMode === 'sell-x-each' && (
      <>
        <div className="auto-trade-control-group">
          <label style={{ display: 'block', marginBottom: '4px' }}>
            Items to list from each wallet:
          </label>
          <input
            type="number"
            value={sellXAmount}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              setSellXAmount(isNaN(value) ? 1 : Math.max(1, value));
            }}
            disabled={isTrading}
            min="1"
          />
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
            }}
          >
            List up to {sellXAmount} item(s) from each wallet (or all available
            if less)
          </p>
        </div>
        <div className="auto-trade-control-group">
          <label className="auto-trade-checkbox-label">
            <input
              type="checkbox"
              checked={useCustomSellPrice}
              onChange={(e) => setUseCustomSellPrice(e.target.checked)}
              disabled={isTrading}
            />
            <span>Use custom listing price</span>
          </label>
          <p
            style={{
              fontSize: '0.85rem',
              color: '#a0aec0',
              marginTop: '4px',
              marginLeft: '24px',
            }}
          >
            {useCustomSellPrice
              ? 'List items at custom price'
              : 'List items at floor price (auto-fetched)'}
          </p>
        </div>
        {useCustomSellPrice && (
          <div className="auto-trade-control-group">
            <label>Custom Listing Price (BTC):</label>
            <input
              type="number"
              value={customSellPrice}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                setCustomSellPrice(isNaN(value) ? 0 : Math.max(0, value));
              }}
              disabled={isTrading}
              min="0"
              step="0.00000001"
            />
            <p
              style={{
                fontSize: '0.85rem',
                color: '#a0aec0',
                marginTop: '4px',
              }}
            >
              Items will be listed at this price (in BTC)
            </p>
          </div>
        )}
      </>
    )}
    {tradingMode !== 'sell-x-each' &&
      tradingMode !== 'buy-x-each' &&
      tradingMode !== 'bid-accept-bids' && (
        <div className="auto-trade-control-group">
          <label className="auto-trade-checkbox-label">
            <input
              type="checkbox"
              checked={buyAdditionalItems}
              onChange={(e) => {
                setBuyAdditionalItems(e.target.checked);
                if (!e.target.checked) {
                  setPurchaseAmount(0);
                  setBuyItemsEveryTick(false);
                }
              }}
              disabled={isTrading}
            />
            <span>Buy additional items</span>
          </label>
          {buyAdditionalItems && (
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>
                Number of items to buy:
              </label>
              <input
                type="number"
                value={purchaseAmount}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setPurchaseAmount(isNaN(value) ? 0 : Math.max(0, value));
                }}
                disabled={isTrading}
                min="0"
              />
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#a0aec0',
                  marginTop: '4px',
                }}
              >
                Total items to trade: {purchaseAmount} + owned items
              </p>

              <label
                className="auto-trade-checkbox-label"
                style={{ marginTop: '12px' }}
              >
                <input
                  type="checkbox"
                  checked={buyItemsEveryTick}
                  onChange={(e) => setBuyItemsEveryTick(e.target.checked)}
                  disabled={isTrading || !buyAdditionalItems}
                />
                <span>Buy items every tick</span>
              </label>
              <p
                style={{
                  fontSize: '0.85rem',
                  color: '#a0aec0',
                  marginTop: '4px',
                  marginLeft: '24px',
                }}
              >
                When enabled, the auto-trader will attempt to buy the above
                amount from floor on every timer tick (instead of only at
                startup).
              </p>
            </div>
          )}
          {!buyAdditionalItems && (
            <p
              style={{
                fontSize: '0.85rem',
                color: '#a0aec0',
                marginTop: '4px',
              }}
            >
              Will only trade items already owned by proxy wallets
            </p>
          )}
        </div>
      )}
    <button
      onClick={handleStartTrading}
      className={`auto-trade-button ${isTrading ? 'stop' : 'start'}`}
      disabled={
        !selectedCollection ||
        wallets.length === 0 ||
        (useCustomWalletSubset && selectedWalletIndices.size === 0) ||
        (tradingMode === 'range-trading' &&
          ((usePriceRange &&
            (lowerTradePrice <= 0 ||
              upperTradePrice <= 0 ||
              upperTradePrice <= lowerTradePrice)) ||
            (!usePriceRange && tradePrice <= 0))) ||
        (tradingMode === 'sell-x-each' &&
          useCustomSellPrice &&
          customSellPrice <= 0) ||
        (tradingMode === 'buy-x-each' && buyXEachAmount < 1) ||
        tradingMode === 'bid-accept-bids'
      }
    >
      {isTrading ? 'Stop Trading' : 'Start Trading'}
    </button>
  </div>
);

export default TradingControls;
