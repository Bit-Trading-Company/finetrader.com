/**
 * The controls that decide what a run does: marketplace, strategy, how often
 * it ticks, and the settings each strategy needs.
 *
 * Only the fields that apply to the chosen strategy are rendered — the old
 * panel showed every field for every mode, which made it hard to tell what
 * would actually happen when you pressed Start.
 */
import React from 'react';
import {
  TRADING_EXCHANGE_OPTIONS,
  getExchangeLabel,
} from '../../../trading/exchanges';
import {
  Button,
  Checkbox,
  ChoiceGroup,
  Field,
  NumberInput,
  Select,
} from '../../../ui';
import { TRADING_MODES } from '../constants';
import { formatSatsAsBtc } from '../../../lib/format';
import styles from './RunControls.module.css';

/** Timer inputs, shown for the strategies that repeat on a cycle. */
const TimerField = ({ settings, disabled }) => {
  const {
    timerHours,
    setTimerHours,
    timerMinutes,
    setTimerMinutes,
    timerSeconds,
    setTimerSeconds,
    timerIntervalSeconds,
  } = settings;

  const parts = [
    { label: 'Hours', value: timerHours, set: setTimerHours, max: 24 },
    { label: 'Minutes', value: timerMinutes, set: setTimerMinutes, max: 59 },
    { label: 'Seconds', value: timerSeconds, set: setTimerSeconds, max: 59 },
  ];

  return (
    <Field
      label="Run every"
      hint={`Each cycle starts ${timerIntervalSeconds}s after the last one finishes (10s minimum).`}
    >
      <div className={styles.timer}>
        {parts.map((part) => (
          <label key={part.label} className={styles.timerPart}>
            <NumberInput
              min="0"
              max={part.max}
              value={part.value}
              disabled={disabled}
              onChange={(e) => part.set(Number(e.target.value) || 0)}
            />
            <span className={styles.timerLabel}>{part.label}</span>
          </label>
        ))}
      </div>
    </Field>
  );
};

/**
 * @param {object} props
 * @param {object} props.settings from useAutoTradeSettings
 * @param {boolean} props.isTrading
 * @param {number|null} props.floorPriceSats
 * @param {() => void} props.applyFloorPrice
 * @param {() => void} props.onOpenBids
 * @param {boolean} [props.compact] hide the strategy descriptions
 */
const RunControls = ({
  settings,
  isTrading,
  floorPriceSats,
  applyFloorPrice,
  onOpenBids,
  compact = false,
}) => {
  const {
    tradingExchange,
    setTradingExchange,
    tradingMode,
    setTradingMode,
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
    sellXAmount,
    setSellXAmount,
    useCustomSellPrice,
    setUseCustomSellPrice,
    customSellPrice,
    setCustomSellPrice,
    buyAdditionalItems,
    setBuyAdditionalItems,
    purchaseAmount,
    setPurchaseAmount,
    buyItemsEveryTick,
    setBuyItemsEveryTick,
  } = settings;

  const mode = TRADING_MODES.find((m) => m.id === tradingMode);
  const isCycle = Boolean(mode?.runs);

  return (
    <div className={styles.controls}>
      <Field label="Marketplace">
        <Select
          value={tradingExchange}
          disabled={isTrading}
          onChange={(e) => setTradingExchange(e.target.value)}
        >
          {TRADING_EXCHANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {getExchangeLabel(option.value)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Strategy">
        <ChoiceGroup
          name="tradingMode"
          value={tradingMode}
          onChange={setTradingMode}
          disabled={isTrading}
          options={TRADING_MODES.map((m) => ({
            value: m.id,
            label: m.label,
            hint: compact ? undefined : m.description,
            disabled: m.disabled,
          }))}
        />
      </Field>

      {isCycle && <TimerField settings={settings} disabled={isTrading} />}

      {tradingMode === 'range-trading' && (
        <div className={styles.group}>
          <Checkbox
            label="Trade across a price range"
            hint="Each cycle picks a random price between the two bounds."
            checked={usePriceRange}
            disabled={isTrading}
            onChange={(e) => setUsePriceRange(e.target.checked)}
          />

          {usePriceRange ? (
            <div className={styles.pair}>
              <Field label="Lower price (BTC)">
                <NumberInput
                  step="0.00000001"
                  min="0"
                  value={lowerTradePrice}
                  disabled={isTrading}
                  onChange={(e) =>
                    setLowerTradePrice(Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Field
                label="Upper price (BTC)"
                error={
                  upperTradePrice > 0 && upperTradePrice <= lowerTradePrice
                    ? 'Must be above the lower price'
                    : undefined
                }
              >
                <NumberInput
                  step="0.00000001"
                  min="0"
                  value={upperTradePrice}
                  disabled={isTrading}
                  onChange={(e) =>
                    setUpperTradePrice(Number(e.target.value) || 0)
                  }
                />
              </Field>
            </div>
          ) : (
            <Field label="Trade price (BTC)">
              <NumberInput
                step="0.00000001"
                min="0"
                value={tradePrice}
                disabled={isTrading}
                onChange={(e) => setTradePrice(Number(e.target.value) || 0)}
              />
            </Field>
          )}

          {floorPriceSats ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isTrading}
              onClick={applyFloorPrice}
            >
              Use floor ({formatSatsAsBtc(floorPriceSats)})
            </Button>
          ) : null}
        </div>
      )}

      {tradingMode === 'buy-x-each' && (
        <Field
          label="Items per wallet"
          hint="Each selected wallet buys this many of the cheapest listings, once."
        >
          <NumberInput
            min="1"
            value={buyXEachAmount}
            disabled={isTrading}
            onChange={(e) => setBuyXEachAmount(Number(e.target.value) || 1)}
          />
        </Field>
      )}

      {tradingMode === 'sell-x-each' && (
        <div className={styles.group}>
          <Field
            label="Items per wallet"
            hint="Lists this many items held by each wallet, once."
          >
            <NumberInput
              min="1"
              value={sellXAmount}
              disabled={isTrading}
              onChange={(e) => setSellXAmount(Number(e.target.value) || 1)}
            />
          </Field>
          <Checkbox
            label="Set my own price"
            hint="Otherwise items are listed at the current floor."
            checked={useCustomSellPrice}
            disabled={isTrading}
            onChange={(e) => setUseCustomSellPrice(e.target.checked)}
          />
          {useCustomSellPrice && (
            <Field label="List price (BTC)">
              <NumberInput
                step="0.00000001"
                min="0"
                value={customSellPrice}
                disabled={isTrading}
                onChange={(e) =>
                  setCustomSellPrice(Number(e.target.value) || 0)
                }
              />
            </Field>
          )}
        </div>
      )}

      {tradingMode === 'bid-accept-bids' && (
        <div className={styles.group}>
          <p className={styles.note}>
            Bidding is driven by hand — the auto-trader does not run in this
            mode.
          </p>
          <Button variant="secondary" onClick={onOpenBids}>
            Open bids for collection
          </Button>
        </div>
      )}

      {isCycle && (
        <div className={styles.group}>
          <Checkbox
            label="Buy extra items from the floor"
            hint="Tops up wallet inventory before trading begins."
            checked={buyAdditionalItems}
            disabled={isTrading}
            onChange={(e) => setBuyAdditionalItems(e.target.checked)}
          />
          {buyAdditionalItems && (
            <>
              <Field label="How many">
                <NumberInput
                  min="0"
                  value={purchaseAmount}
                  disabled={isTrading}
                  onChange={(e) =>
                    setPurchaseAmount(Number(e.target.value) || 0)
                  }
                />
              </Field>
              <Checkbox
                label="Buy again on every cycle"
                hint="Otherwise the extra items are bought once, at the start."
                checked={buyItemsEveryTick}
                disabled={isTrading}
                onChange={(e) => setBuyItemsEveryTick(e.target.checked)}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RunControls;
