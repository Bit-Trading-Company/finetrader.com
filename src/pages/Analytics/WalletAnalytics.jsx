import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  getMempoolAddressUrl,
  getMempoolAddressTxsUrl,
  getMempoolAddressTxsMempoolUrl,
} from '../../lib/mempoolProvider';
import {
  MEMPOOL_PROVIDERS,
  getMempoolApiProvider,
  setMempoolApiProvider,
} from '../../lib/mempoolProvider';
import { shortenAddress } from '../../lib/format';
import { useEventHub } from '../../lib/eventHub';

// Component to display wallet analytics including transactions and balance history
const WalletAnalytics = ({
  glEventHub: glEventHubProp,
  network = 'mainnet',
}) => {
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [balanceHistory, setBalanceHistory] = useState([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mempoolProvider, setMempoolProviderState] = useState(
    getMempoolApiProvider()
  );

  const getNetworkPrefix = (net) => {
    if (!net || net === 'mainnet') return '';
    return `${net}/`;
  };

  const handleMempoolProviderChange = useCallback((provider) => {
    setMempoolApiProvider(provider);
    setMempoolProviderState(provider);
  }, []);

  // Sync provider from localStorage on mount
  useEffect(() => {
    setMempoolProviderState(getMempoolApiProvider());
  }, []);

  // If using mempool.space, test connectivity and fall back to blockstream.info on failure.
  useEffect(() => {
    const testMempool = async () => {
      if (mempoolProvider !== MEMPOOL_PROVIDERS.MEMPOOL_SPACE) return;
      const prefix = getNetworkPrefix(network);
      const testUrl = `https://mempool.space/${prefix}api/blocks/tip/height`;
      try {
        const response = await fetch(testUrl);
        if (!response.ok) {
          handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
        }
      } catch {
        handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
      }
    };
    testMempool();
  }, [mempoolProvider, network, handleMempoolProviderChange]);

  // Use provided event hub or create a fallback one
  const glEventHub = useEventHub(glEventHubProp);

  // Process transactions and calculate balance history over time
  // Memoized with useCallback since it's a pure function with no dependencies
  const processTransactions = useCallback((txs, address, latestBalance) => {
    // Sort transactions by block time (oldest first) as canonical ordering.
    const sortedTxs = [...txs].sort((a, b) => {
      const timeA =
        a.status?.block_time || (a.status?.confirmed ? 0 : Date.now() / 1000);
      const timeB =
        b.status?.block_time || (b.status?.confirmed ? 0 : Date.now() / 1000);
      return timeA - timeB;
    });

    // Work backwards from current balance so history aligns with real wallet state.
    let runningBalance = latestBalance;
    const history = [];
    const processedTransactions = [];
    const timestampCounts = new Map();

    // Process newest -> oldest, then reverse arrays for chronological display.
    const newestFirstTxs = [...sortedTxs].reverse();
    newestFirstTxs.forEach((tx) => {
      // Calculate net change for this address in this transaction
      let netChange = 0;

      // Sum all outputs sent to this address (incoming)
      if (tx.vout && Array.isArray(tx.vout)) {
        tx.vout.forEach((output) => {
          if (output.scriptpubkey_address === address && output.value) {
            netChange += output.value;
          }
        });
      }

      // Subtract all inputs from this address (outgoing)
      // Note: Some transactions may not have full prevout info in vin
      if (tx.vin && Array.isArray(tx.vin)) {
        tx.vin.forEach((input) => {
          if (
            input.prevout?.scriptpubkey_address === address &&
            input.prevout?.value
          ) {
            netChange -= input.prevout.value;
          }
        });
      }

      // Get transaction timestamp
      const timestamp = tx.status?.block_time
        ? tx.status.block_time * 1000
        : Date.now();
      // Ensure each chart point has a unique x-value even when multiple
      // transactions share the same second.
      const seenCount = timestampCounts.get(timestamp) || 0;
      timestampCounts.set(timestamp, seenCount + 1);
      const chartTime = timestamp + seenCount;
      const date = new Date(timestamp);
      const balanceAfterTx = runningBalance;
      const balanceBeforeTx = runningBalance - netChange;

      // Add to balance history
      history.push({
        time: chartTime,
        date: date.toLocaleDateString(),
        datetime: date.toLocaleString(),
        balance: balanceAfterTx,
        balanceSats: balanceAfterTx,
        balanceBTC: balanceAfterTx / 100000000, // Convert satoshis to BTC
      });

      // Store processed transaction
      processedTransactions.push({
        txid: tx.txid,
        timestamp: timestamp,
        date: date.toLocaleDateString(),
        datetime: date.toLocaleString(),
        confirmed: tx.status?.confirmed || false,
        blockHeight: tx.status?.block_height || null,
        fee: tx.fee || 0,
        size: tx.size || 0,
        netChange: netChange,
        netChangeBTC: netChange / 100000000,
        balance: balanceAfterTx,
        balanceBTC: balanceAfterTx / 100000000,
      });

      runningBalance = balanceBeforeTx;
    });

    // Chronological for chart.
    history.reverse();

    return {
      // Newest first for table readability.
      transactions: processedTransactions,
      balanceHistory: history,
    };
  }, []);

  // Fetch wallet data from configured mempool API provider
  // Memoized with useCallback to prevent unnecessary re-renders
  const fetchWalletData = useCallback(
    async (address) => {
      setLoading(true);
      setError(null);

      try {
        const doFetch = async () => {
          // Fetch address stats to get current balance
          const addressResponse = await fetch(
            getMempoolAddressUrl(address, network)
          );
          if (!addressResponse.ok) {
            throw new Error('Failed to fetch address data');
          }
          const addressData = await addressResponse.json();

          // Calculate current balance (funded - spent)
          const confirmedBalance =
            addressData.chain_stats.funded_txo_sum -
            addressData.chain_stats.spent_txo_sum;
          const mempoolBalance =
            addressData.mempool_stats.funded_txo_sum -
            addressData.mempool_stats.spent_txo_sum;
          const totalBalance = confirmedBalance + mempoolBalance;

          setCurrentBalance(totalBalance);

          // Chain + mempool tx lists (GET /txs is paginated confirmed-only; /txs/mempool adds pending)
          const [txsResponse, mempoolTxsResponse] = await Promise.all([
            fetch(getMempoolAddressTxsUrl(address, network)),
            fetch(getMempoolAddressTxsMempoolUrl(address, network)),
          ]);
          if (!txsResponse.ok) {
            throw new Error('Failed to fetch transaction data');
          }
          const chainTxs = await txsResponse.json();
          const mempoolTxs = mempoolTxsResponse.ok
            ? await mempoolTxsResponse.json()
            : [];
          const seen = new Set();
          const txsData = [];
          for (const tx of [...mempoolTxs, ...chainTxs]) {
            if (tx?.txid && !seen.has(tx.txid)) {
              seen.add(tx.txid);
              txsData.push(tx);
            }
          }

          // Process transactions and build balance history
          const processedTxs = processTransactions(
            txsData,
            address,
            totalBalance
          );
          setTransactions(processedTxs.transactions);
          setBalanceHistory(processedTxs.balanceHistory);
        };

        try {
          await doFetch();
        } catch (e) {
          // If mempool.space fails at runtime, auto-fallback to blockstream and retry once.
          if (mempoolProvider === MEMPOOL_PROVIDERS.MEMPOOL_SPACE) {
            handleMempoolProviderChange(MEMPOOL_PROVIDERS.BLOCKSTREAM);
            await doFetch();
          } else {
            throw e;
          }
        }
      } catch (err) {
        console.error('Error fetching wallet data:', err);
        setError(err.message || 'Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    },
    [processTransactions, network, mempoolProvider, handleMempoolProviderChange]
  );

  // Listen for wallet selection events
  useEffect(() => {
    const handleWalletSelect = (wallet) => {
      const walletAddress = wallet?.addresses?.p2tr || wallet?.address;
      if (walletAddress) {
        setSelectedWallet(wallet);
        setError(null);
        // Fetch data when a wallet is selected
        fetchWalletData(walletAddress);
      } else {
        // Clear data when wallet is deselected
        setSelectedWallet(null);
        setTransactions([]);
        setBalanceHistory([]);
        setCurrentBalance(0);
      }
    };

    if (glEventHub) {
      glEventHub.on('wallet-selected', handleWalletSelect);
    }

    return () => {
      if (glEventHub) {
        glEventHub.off('wallet-selected', handleWalletSelect);
      }
    };
  }, [glEventHub, fetchWalletData]);

  // If a proxy wallet was already selected (e.g. restore), sidebar may have emitted before we subscribed
  useEffect(() => {
    if (glEventHub) {
      glEventHub.emit('request-wallet-state');
    }
  }, [glEventHub]);

  // Format satoshis to BTC
  const formatBTC = (sats) => {
    return (sats / 100000000).toFixed(8);
  };

  // Format large numbers with commas
  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  return (
    <div className="wallet-analytics-container">
      <h2 className="component-header">Wallet Analytics</h2>

      {!selectedWallet ? (
        <div className="wallet-analytics-empty">
          <p className="wallet-analytics-empty-text">
            Pick a Fine Trader wallet to view its analytics
          </p>
        </div>
      ) : loading ? (
        <div className="wallet-analytics-loading">
          <p className="wallet-analytics-loading-text">
            Loading wallet data...
          </p>
        </div>
      ) : error ? (
        <div className="wallet-analytics-error">
          <p className="wallet-analytics-error-text">Error: {error}</p>
        </div>
      ) : (
        <>
          {/* Wallet Info Summary */}
          <div className="wallet-analytics-summary">
            <div className="wallet-analytics-summary-item">
              <span className="wallet-analytics-summary-label">
                Wallet Address:
              </span>
              <span className="wallet-analytics-summary-value">
                {shortenAddress(
                  selectedWallet?.addresses?.p2tr || selectedWallet?.address
                )}
              </span>
            </div>
            <div className="wallet-analytics-summary-item">
              <span className="wallet-analytics-summary-label">
                Current Balance:
              </span>
              <span className="wallet-analytics-summary-value">
                {formatBTC(currentBalance)} BTC ({formatNumber(currentBalance)}{' '}
                sats)
              </span>
            </div>
            <div className="wallet-analytics-summary-item">
              <span className="wallet-analytics-summary-label">
                Total Transactions:
              </span>
              <span className="wallet-analytics-summary-value">
                {transactions.length}
              </span>
            </div>
            {transactions.some((t) => !t.confirmed) && (
              <div className="wallet-analytics-summary-item">
                <span className="wallet-analytics-summary-label">
                  Mempool (pending):
                </span>
                <span className="wallet-analytics-summary-value">
                  {transactions.filter((t) => !t.confirmed).length}
                </span>
              </div>
            )}
          </div>

          {/* Balance History Graph */}
          <div className="wallet-analytics-graph-container">
            <h3 className="wallet-analytics-section-header">Balance History</h3>
            {balanceHistory.length > 0 ? (
              <div style={{ width: '100%', height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={balanceHistory}
                    margin={{ top: 5, right: 30, left: 20, bottom: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                    <XAxis
                      dataKey="time"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      allowDataOverflow={false}
                      padding={{ left: 12, right: 12 }}
                      stroke="#a0aec0"
                      style={{ fontSize: '12px' }}
                      tickCount={7}
                      minTickGap={40}
                      interval="preserveStartEnd"
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString()
                      }
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      stroke="#a0aec0"
                      style={{ fontSize: '12px' }}
                      tickFormatter={(value) => formatBTC(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1a2332',
                        border: '1px solid #4a5568',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                      }}
                      formatter={(value) => [
                        `${formatBTC(value)} BTC (${formatNumber(value)} sats)`,
                        'Balance',
                      ]}
                      labelFormatter={(value) =>
                        new Date(value).toLocaleString()
                      }
                      labelStyle={{ color: '#f7fafc' }}
                    />
                    <Legend
                      wrapperStyle={{ color: '#e2e8f0' }}
                      iconType="line"
                    />
                    <Line
                      type="linear"
                      dataKey="balance"
                      stroke="#ed8936"
                      strokeWidth={2}
                      connectNulls
                      isAnimationActive={false}
                      dot={{ fill: '#ed8936', r: 3 }}
                      activeDot={{ r: 6 }}
                      name="Balance (sats)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="wallet-analytics-no-data">
                <p>No balance history data available</p>
              </div>
            )}
          </div>

          {/* Transactions List */}
          <div className="wallet-analytics-transactions-container">
            <h3 className="wallet-analytics-section-header">
              Transaction History
            </h3>
            {transactions.length > 0 ? (
              <div className="wallet-analytics-transactions-list">
                <table className="wallet-analytics-transactions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>TXID</th>
                      <th>Status</th>
                      <th>Net Change</th>
                      <th>Balance After</th>
                      <th>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, index) => (
                      <tr key={tx.txid || index}>
                        <td>{tx.datetime}</td>
                        <td className="wallet-analytics-txid">
                          {tx.txid.slice(0, 16)}...
                        </td>
                        <td>
                          <span
                            className={
                              tx.confirmed
                                ? 'wallet-analytics-status confirmed'
                                : 'wallet-analytics-status pending'
                            }
                          >
                            {tx.confirmed ? 'Confirmed' : 'Pending'}
                          </span>
                        </td>
                        <td
                          className={
                            tx.netChange >= 0
                              ? 'wallet-analytics-positive'
                              : 'wallet-analytics-negative'
                          }
                        >
                          {tx.netChange >= 0 ? '+' : ''}
                          {formatBTC(tx.netChange)} BTC
                        </td>
                        <td>{formatBTC(tx.balance)} BTC</td>
                        <td>{formatNumber(tx.fee || 0)} sats</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="wallet-analytics-no-data">
                <p>No transactions found</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WalletAnalytics;
