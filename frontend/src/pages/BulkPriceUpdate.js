import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const BulkPriceUpdate = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const prods = Array.isArray(data) ? data : (data.data || []);
        setProducts(prods);
        setUpdates(prods.map(p => ({ product_id: p.id, name: p.name, current_price: p.current_price, new_price: '' })));
      })
      .finally(() => setFetching(false));
  }, [token]);

  const handlePriceChange = (idx, val) => {
    const updated = [...updates];
    updated[idx] = { ...updated[idx], new_price: val };
    setUpdates(updated);
  };

  const handleSelectAll = (pct) => {
    setUpdates(updates.map(u => ({
      ...u,
      new_price: (parseFloat(u.current_price) * (1 + pct / 100)).toFixed(2)
    })));
  };

  const handleSubmit = async () => {
    const toUpdate = updates.filter(u => u.new_price !== '' && !isNaN(parseFloat(u.new_price)));
    if (toUpdate.length === 0) return setError('No valid price updates entered');
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/products/bulk-price-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ updates: toUpdate.map(u => ({ product_id: u.product_id, new_price: parseFloat(u.new_price) })) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (fetching) return <Layout><div className="loading"><div className="spinner" /></div></Layout>;

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Bulk Price Update</h1>
        <p className="page-subtitle">Update multiple product prices at once in a single transaction</p>

        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#888' }}>Quick adjust all by:</span>
            {[-10, -5, -2, +2, +5, +10].map(pct => (
              <button key={pct} className={`btn btn-sm ${pct < 0 ? 'btn-danger' : 'btn-success'}`}
                onClick={() => handleSelectAll(pct)} style={{ minWidth: '60px' }}>
                {pct > 0 ? `+${pct}%` : `${pct}%`}
              </button>
            ))}
            <button className="btn btn-sm btn-secondary" onClick={() => setUpdates(updates.map(u => ({ ...u, new_price: '' })))}>
              Clear All
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {result && (
          <div className="card" style={{ marginBottom: '1rem', border: '1px solid #2a4a2a' }}>
            <h4>{result.message}</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {result.results?.map((r, i) => (
                <span key={i} className={`badge ${r.status === 'updated' ? 'badge-success' : 'badge-danger'}`}>
                  {r.name || `Product ${r.product_id}`}: {r.status === 'updated' ? `$${r.new_price}` : r.status}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Current Price</th>
                  <th>New Price</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {updates.map((u, i) => {
                  const change = u.new_price ? ((parseFloat(u.new_price) - parseFloat(u.current_price)) / parseFloat(u.current_price) * 100).toFixed(1) : null;
                  return (
                    <tr key={u.product_id}>
                      <td>{u.name}</td>
                      <td>${parseFloat(u.current_price).toFixed(2)}</td>
                      <td>
                        <input
                          type="number" step="0.01" min="0"
                          className="form-input" style={{ width: '120px', padding: '0.3rem 0.5rem' }}
                          placeholder={u.current_price}
                          value={u.new_price}
                          onChange={e => handlePriceChange(i, e.target.value)}
                        />
                      </td>
                      <td>
                        {change !== null && (
                          <span style={{ color: parseFloat(change) >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                            {parseFloat(change) >= 0 ? '+' : ''}{change}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Applying...' : `Apply ${updates.filter(u => u.new_price !== '').length} Updates`}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BulkPriceUpdate;
