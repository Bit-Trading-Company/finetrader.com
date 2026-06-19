import React from 'react';

const StockChart = ({ symbol = 'ACI' }) => {
  // Sample data for different stocks
  const stockData = {
    ACI: {
      name: 'Acme, inc.',
      data: [
        34.7, 35.8, 41.1, 40.6, 36.6, 36.3, 37.8, 42.8, 44.4, 40.7, 42.1, 39.2,
        36.9, 31.8, 32.4, 37.5, 34.0, 40.9, 46.1, 44.1, 40.9, 44.9, 46.7, 47.3,
        50.5, 49.7, 50.3, 52.3, 56.0, 55.8, 53.6, 56.8, 54.2, 58.7, 54.1, 58.7,
        56.2, 61.1, 61.5, 61.9, 59.2, 55.5, 53.0, 51.1, 46.3, 46.0, 41.8, 41.6,
        41.9, 37.5, 33.1, 29.2, 32.5, 25.4, 21.2, 16.6, 24.4, 28.1, 23.7, 23.4,
        15.8, 24.7, 30.1, 24.9, 22.1, 22.1, 14.0, 12.8, 19.9, 24.0, 23.5, 20.0,
        17.1, 9.3, 18.5, 15.1, 23.0, 24.3, 32.2, 35.8, 42.2, 41.5, 37.0, 38.6,
        31.9, 34.3, 35.3, 42.1, 35.8, 32.9, 28.2, 24.0, 18.2, 12.9, 8.0, 13.5,
        14.7, 6.1, 10.4, 15.8,
      ],
    },
    LEX: {
      name: 'LexCorp plc.',
      data: [
        195.9, 167.2, 186.6, 172.2, 161.8, 198.7, 162.8, 196.8, 203.0, 225.0,
        248.2, 278.3, 260.8, 292.9, 272.6, 287.9, 267.6, 299.4, 274.4, 301.9,
        274.1, 285.0, 298.8, 288.7, 275.6, 263.6, 252.8, 252.8, 286.3, 293.5,
        280.9, 288.9, 292.8, 294.0, 286.9, 291.1, 275.9, 279.1, 284.1, 253.3,
        220.2, 211.6, 238.7, 257.8, 277.7, 249.8, 251.7, 248.0, 247.5, 231.7,
        217.6, 230.2, 203.5, 170.9, 199.3, 189.5, 216.3, 184.5, 165.2, 165.1,
        151.5, 176.1, 150.2, 128.1, 113.9, 88.3, 61.5, 89.1, 120.3, 160.3,
        158.4, 161.8, 148.9, 147.7, 155.5, 115.4, 140.1, 123.6, 142.7, 129.2,
        123.1, 146.8, 132.7, 167.8, 178.0, 138.2, 155.2, 122.2, 120.3, 84.8,
        127.3, 90.3, 82.6, 121.7, 93.7, 91.2, 116.2, 68.3, 101.4, 58.0,
      ],
    },
    SPR: {
      name: 'Springshield plc.',
      data: [
        36.2, 25.0, 20.5, 19.7, 21.1, 58.3, 22.5, 21.6, 43.8, 23.4, 39.9, 58.7,
        71.2, 80.7, 72.3, 89.4, 94.3, 106.8, 116.5, 110.5, 140.9, 159.3, 148.4,
        146.3, 172.4, 195.8, 221.5, 198.8, 203.9, 218.7, 216.4, 197.5, 219.6,
        223.3, 232.2, 238.4, 244.0, 224.1, 222.6, 227.1, 241.6, 228.3, 213.8,
        190.1, 192.0, 191.5, 198.8, 203.2, 219.2, 218.4, 203.1, 225.6, 227.3,
        217.2, 205.2, 203.6, 213.0, 211.6, 200.7, 181.6, 210.0, 207.0, 187.7,
        198.8, 173.9, 186.0, 174.0, 184.3, 168.8, 170.4, 184.9, 185.4, 203.3,
        219.4, 222.8, 227.0, 248.2, 235.7, 229.0, 241.3, 221.1, 230.1, 236.7,
        219.6, 240.5, 242.7, 239.4, 227.6, 211.7, 218.3, 228.6, 251.0, 270.6,
        274.0, 292.9, 275.3, 282.3, 266.9, 279.0, 290.0,
      ],
    },
  };

  const currentData = stockData[symbol] || stockData['ACI'];
  const maxValue = Math.max(...currentData.data);
  const minValue = Math.min(...currentData.data);
  const range = maxValue - minValue;

  // Generate SVG path for the line chart
  const points = currentData.data
    .map((value, index) => {
      const x = (index / (currentData.data.length - 1)) * 100;
      const y = 100 - ((value - minValue) / range) * 80; // 80% of height for the chart
      return `${x},${y}`;
    })
    .join(' L ');

  return (
    <div className="stock-chart" style={{ height: '100%', padding: '10px' }}>
      <h4 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '14px' }}>
        {currentData.name}
      </h4>
      <svg
        width="100%"
        height="calc(100% - 30px)"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`gradient-${symbol}`}
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#007bff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#007bff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <g stroke="#e0e0e0" strokeWidth="0.5" opacity="0.5">
          {[20, 40, 60, 80].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} />
          ))}
        </g>

        {/* Area under the curve */}
        <path
          d={`M 0,100 L ${points} L 100,100 Z`}
          fill={`url(#gradient-${symbol})`}
        />

        {/* Line chart */}
        <path
          d={`M ${points}`}
          fill="none"
          stroke="#007bff"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {currentData.data.map((value, index) => {
          const x = (index / (currentData.data.length - 1)) * 100;
          const y = 100 - ((value - minValue) / range) * 80;
          return <circle key={index} cx={x} cy={y} r="0.5" fill="#007bff" />;
        })}
      </svg>
    </div>
  );
};

export default StockChart;
