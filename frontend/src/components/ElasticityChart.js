import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5100/api';

export default function ElasticityChart() {
  const [sku, setSku] = useState('SKU-1001');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (s) => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_URL}/custom-views/elasticity-chart`, { params: { sku: s } });
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(sku); }, []); // eslint-disable-line

  if (loading) return <div style={{ color: '#9ca3af' }}>Loading elasticity...</div>;
  if (error) return <div style={{ color: '#ef4444' }}>Error: {error}</div>;
  if (!data) return null;

  const W = 560, H = 220, PAD = 32;
  const prices = data.points.map((p) => p.price);
  const profits = data.points.map((p) => p.profit);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minY = Math.min(...profits), maxY = Math.max(...profits);
  const xScale = (v) => PAD + ((v - minP) / (maxP - minP || 1)) * (W - 2 * PAD);
  const yScale = (v) => H - PAD - ((v - minY) / (maxY - minY || 1)) * (H - 2 * PAD);

  const pathD = data.points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.price).toFixed(1)} ${yScale(p.profit).toFixed(1)}`
  ).join(' ');

  return (
    <div data-testid="elasticity-chart" style={{ background: '#111827', padding: 16, borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ color: '#e5e7eb', fontWeight: 600 }}>SKU:</label>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          style={{ padding: '6px 10px', background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        />
        <button
          onClick={() => load(sku)}
          style={{ padding: '6px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Recompute
        </button>
        <span style={{ color: '#9ca3af', marginLeft: 12 }}>
          Elasticity ε = <b style={{ color: '#fbbf24' }}>{data.elasticity}</b>
        </span>
        <span style={{ color: '#9ca3af' }}>
          Optimal price <b style={{ color: '#34d399' }}>${data.optimal.price}</b>
        </span>
      </div>
      <svg width={W} height={H} style={{ background: '#0b1220', borderRadius: 6 }}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#374151" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke="#374151" />
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />
        {data.points.map((p, i) => (
          <circle
            key={i}
            cx={xScale(p.price)}
            cy={yScale(p.profit)}
            r={p.price === data.optimal.price ? 5 : 3}
            fill={p.price === data.optimal.price ? '#34d399' : '#60a5fa'}
          />
        ))}
        <text x={PAD} y={20} fill="#e5e7eb" fontSize="12">Profit vs Price</text>
        <text x={W - PAD - 60} y={H - 8} fill="#9ca3af" fontSize="10">price ($)</text>
      </svg>
    </div>
  );
}
