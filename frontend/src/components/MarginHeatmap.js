import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5100/api';

function color(v) {
  // 0..1 -> red..green
  const r = Math.round(255 * (1 - v));
  const g = Math.round(180 * v + 40);
  return `rgb(${r},${g},80)`;
}

export default function MarginHeatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/custom-views/margin-heatmap`);
        setData(res.data);
      } catch (e) {
        setError(e.response?.data?.error || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div style={{ color: '#9ca3af' }}>Loading heatmap...</div>;
  if (error) return <div style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!data) return null;

  return (
    <div data-testid="margin-heatmap" style={{ background: '#111827', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
      <h3 style={{ color: '#e5e7eb', margin: '0 0 12px 0' }}>Margin Heatmap (SKU x Segment)</h3>
      <table style={{ borderCollapse: 'collapse', color: '#e5e7eb' }}>
        <thead>
          <tr>
            <th style={{ padding: 8, borderBottom: '1px solid #374151', textAlign: 'left' }}>SKU</th>
            {data.segments.map((s) => (
              <th key={s} style={{ padding: 8, borderBottom: '1px solid #374151' }}>{s}</th>
            ))}
            <th style={{ padding: 8, borderBottom: '1px solid #374151' }}>Avg</th>
          </tr>
        </thead>
        <tbody>
          {data.matrix.map((row) => (
            <tr key={row.sku}>
              <td style={{ padding: 8, fontWeight: 600 }}>{row.sku}</td>
              {row.segments.map((c) => (
                <td
                  key={c.segment}
                  style={{
                    padding: '10px 14px',
                    background: color(c.margin),
                    color: c.margin > 0.4 ? '#0b1220' : '#fff',
                    textAlign: 'center',
                    fontVariantNumeric: 'tabular-nums',
                    border: '1px solid #0b1220',
                  }}
                  title={`${row.sku} / ${c.segment}: ${(c.margin * 100).toFixed(1)}%`}
                >
                  {(c.margin * 100).toFixed(1)}%
                </td>
              ))}
              <td style={{ padding: 8, fontWeight: 700, color: '#34d399' }}>
                {(row.avg * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
        Generated: {data.generatedAt}
      </div>
    </div>
  );
}
