import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const AIUsageStats = () => {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const fetchStats = async (p = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/usage?page=${p}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load usage');
      setData(json);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { fetchStats(page); }, [page]);

  if (loading) return <Layout><div className="loading"><div className="spinner" /></div></Layout>;

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">AI Usage Statistics</h1>
        <p className="page-subtitle">Monitor your AI API consumption and cost estimates</p>

        {error && <div className="alert alert-danger">{error}</div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card stat-card">
                <div className="stat-label">Total Calls</div>
                <div className="stat-value">{data.summary?.total_calls || 0}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Input Tokens</div>
                <div className="stat-value">{parseInt(data.summary?.total_input || 0).toLocaleString()}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Output Tokens</div>
                <div className="stat-value">{parseInt(data.summary?.total_output || 0).toLocaleString()}</div>
              </div>
              <div className="card stat-card">
                <div className="stat-label">Est. Cost</div>
                <div className="stat-value">${parseFloat(data.summary?.total_cost || 0).toFixed(4)}</div>
              </div>
            </div>

            {data.by_endpoint?.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3>Usage by Endpoint</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Endpoint</th>
                        <th>Calls</th>
                        <th>Tokens</th>
                        <th>Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_endpoint.map((row, i) => (
                        <tr key={i}>
                          <td><code style={{ fontSize: '0.85rem' }}>{row.endpoint}</code></td>
                          <td>{row.calls}</td>
                          <td>{parseInt(row.tokens || 0).toLocaleString()}</td>
                          <td>${parseFloat(row.cost || 0).toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.data?.length > 0 && (
              <div className="card">
                <h3>Recent AI Calls</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Endpoint</th>
                        <th>Input Tokens</th>
                        <th>Output Tokens</th>
                        <th>Cost</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map(row => (
                        <tr key={row.id}>
                          <td><code style={{ fontSize: '0.8rem' }}>{row.endpoint}</code></td>
                          <td>{row.tokens_input || 0}</td>
                          <td>{row.tokens_output || 0}</td>
                          <td>${parseFloat(row.cost_usd || 0).toFixed(6)}</td>
                          <td style={{ color: '#888', fontSize: '0.85rem' }}>{new Date(row.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.pagination && data.pagination.totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <span style={{ padding: '0.5rem' }}>Page {page} of {data.pagination.totalPages}</span>
                    <button className="btn btn-secondary" disabled={page >= data.pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AIUsageStats;
