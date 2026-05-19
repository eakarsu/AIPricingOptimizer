import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const PricingSimulation = () => {
  const { token } = useAuth();
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [scenarios, setScenarios] = useState([{ price: '' }, { price: '' }, { price: '' }]);
  const [marketConditions, setMarketConditions] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/products`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setProducts(Array.isArray(data) ? data : (data.data || [])))
      .catch(() => {});
  }, [token]);

  const handleRun = async () => {
    if (!selectedProduct) return setError('Please select a product');
    const validPrices = scenarios.map(s => parseFloat(s.price)).filter(p => !isNaN(p) && p > 0);
    if (validPrices.length === 0) return setError('Enter at least one scenario price');
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/price-simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: selectedProduct, scenario_prices: validPrices, market_conditions: marketConditions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="page-container">
        <h1 className="page-title">Pricing Simulation Sandbox</h1>
        <p className="page-subtitle">Test multiple price points and let AI predict revenue/volume impact</p>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3>Configure Simulation</h3>
          <div className="form-group">
            <label>Select Product</label>
            <select className="form-select" value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}>
              <option value="">-- Select a product --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (${p.current_price})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Scenario Prices (up to 3)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {scenarios.map((s, i) => (
                <div key={i}>
                  <label style={{ fontSize: '0.8rem', color: '#888' }}>Scenario {i + 1}</label>
                  <input
                    type="number" step="0.01" className="form-input"
                    placeholder="e.g. 29.99"
                    value={s.price}
                    onChange={e => {
                      const updated = [...scenarios];
                      updated[i] = { price: e.target.value };
                      setScenarios(updated);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Market Conditions (optional context)</label>
            <textarea
              className="form-input" rows={2}
              placeholder="e.g. holiday season, high competition, supply shortage..."
              value={marketConditions}
              onChange={e => setMarketConditions(e.target.value)}
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          <button className="btn btn-primary" onClick={handleRun} disabled={loading}>
            {loading ? 'Running AI Simulation...' : 'Run Simulation'}
          </button>
        </div>

        {result && (
          <div>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <h3>Product: {result.product?.name} — Current: ${result.product?.current_price}</h3>
            </div>

            {result.simulation?.scenarios && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {result.simulation.scenarios.map((s, i) => (
                  <div key={i} className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <h4>Scenario {s.scenario}: ${s.price}</h4>
                    <div className="stat-row"><span>Predicted Units/mo:</span> <strong>{s.predicted_units?.toLocaleString()}</strong></div>
                    <div className="stat-row"><span>Predicted Revenue:</span> <strong>${s.predicted_revenue?.toLocaleString()}</strong></div>
                    <div className="stat-row"><span>Margin Impact:</span> <strong>{s.margin_impact}%</strong></div>
                    <div className="stat-row"><span>Risk:</span>
                      <span className={`badge badge-${s.risk === 'low' ? 'success' : s.risk === 'medium' ? 'warning' : 'danger'}`}>{s.risk}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.simulation?.recommendation && (
              <div className="card" style={{ background: '#1a2a1a', border: '1px solid #2a4a2a' }}>
                <h4>AI Recommendation</h4>
                <p><strong>Optimal Price:</strong> ${result.simulation.recommendation.price}</p>
                <p>{result.simulation.recommendation.rationale}</p>
              </div>
            )}

            {!result.simulation && result.aiResponse && (
              <div className="card">
                <h4>AI Analysis</h4>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{result.aiResponse}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PricingSimulation;
