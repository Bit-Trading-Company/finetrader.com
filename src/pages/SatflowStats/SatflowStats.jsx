import React, { useState } from 'react';

const SatflowStats = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleFetchStats = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await fetch(
        '/api/satflow-collection-stats?collectionId=nodemonkes'
      );

      const rawText = await response.text();
      console.log('Satflow raw response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        bodyPreview: rawText.slice(0, 500),
      });

      if (!response.ok) {
        throw new Error(
          `Request failed: ${response.status} ${response.statusText} - ${rawText.slice(
            0,
            200
          )}`
        );
      }

      try {
        const json = JSON.parse(rawText);
        setData(json);
      } catch (parseError) {
        console.warn('Failed to parse Satflow JSON, showing raw text:', {
          error: parseError,
          rawTextPreview: rawText.slice(0, 500),
        });
        setData(rawText);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch Satflow stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#e5e7eb',
        padding: '24px',
      }}
    >
      <div
        style={{
          maxWidth: '800px',
          width: '100%',
          background: '#020617',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(148,163,184,0.3)',
        }}
      >
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '8px',
            // Previously inherited from the Splash page's global h1 rule.
            fontFamily: 'var(--font-family-display)',
            color: 'orange',
            textAlign: 'center',
            letterSpacing: '0.4vw',
          }}
        >
          Satflow Collection Stats
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: '#9ca3af',
            marginBottom: '16px',
          }}
        >
          Click the button below to fetch stats for the{' '}
          <code
            style={{
              background: '#020617',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(148,163,184,0.4)',
            }}
          >
            nodemonkes
          </code>{' '}
          collection from the Satflow API.
        </p>

        <button
          onClick={handleFetchStats}
          disabled={loading}
          style={{
            padding: '10px 16px',
            borderRadius: '9999px',
            border: 'none',
            cursor: loading ? 'default' : 'pointer',
            background: 'linear-gradient(135deg, #38bdf8, #6366f1, #a855f7)',
            color: '#0b1120',
            fontWeight: 600,
            fontSize: '14px',
            marginBottom: '16px',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Fetching stats…' : 'Fetch Satflow Stats'}
        </button>

        {error && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.4)',
              color: '#fecaca',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {error}
          </div>
        )}

        {data && (
          <pre
            style={{
              marginTop: '16px',
              maxHeight: '400px',
              overflow: 'auto',
              padding: '12px',
              borderRadius: '8px',
              background: '#020617',
              border: '1px solid rgba(148,163,184,0.3)',
              fontSize: '12px',
              lineHeight: 1.5,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default SatflowStats;
