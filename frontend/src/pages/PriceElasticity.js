import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = 'http://localhost:3001/api';

const PriceElasticity = () => {
  const [elasticityData, setElasticityData] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [aiInsights, setAiInsights] = useState(null);
  const [analyzingItem, setAnalyzingItem] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    elasticity_coefficient: '',
    elasticity_type: 'elastic',
    price_sensitivity: 'medium',
    optimal_price_range_min: '',
    optimal_price_range_max: '',
    current_price: '',
    demand_curve_type: 'linear',
    cross_elasticity: ''
  });

  useEffect(() => {
    fetchElasticityData();
    fetchProducts();
  }, []);

  const fetchElasticityData = async () => {
    try {
      const response = await axios.get(`${API_URL}/price-elasticity`);
      setElasticityData(response.data);
    } catch (error) {
      console.error('Error fetching elasticity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setAiInsights(null);
    setShowDetailModal(true);
  };

  const handleAnalyzeItem = async () => {
    if (!selectedItem) return;
    setAnalyzingItem(true);
    setAiInsights(null);
    try {
      const response = await axios.post(`${API_URL}/price-elasticity/analyze-item`, {
        elasticityId: selectedItem.id
      });
      if (response.data.analysis) {
        setAiInsights(response.data.analysis);
        setSelectedItem(prev => ({ ...prev, ai_analysis: JSON.stringify(response.data.analysis) }));
      } else if (response.data.aiResponse) {
        setAiInsights({ raw: response.data.aiResponse });
      }
    } catch (error) {
      console.error('Error analyzing elasticity:', error);
      alert('Error analyzing elasticity: ' + error.message);
    } finally {
      setAnalyzingItem(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedProduct) return;
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/price-elasticity/analyze`, {
        productId: selectedProduct
      });
      if (response.data.elasticity) {
        fetchElasticityData();
        setSelectedItem({ ...response.data.elasticity, aiResponse: response.data.aiResponse });
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error analyzing:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedItem && !showDetailModal) {
        await axios.put(`${API_URL}/price-elasticity/${selectedItem.id}`, formData);
      } else {
        await axios.post(`${API_URL}/price-elasticity`, formData);
      }
      fetchElasticityData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await axios.delete(`${API_URL}/price-elasticity/${id}`);
        fetchElasticityData();
        setShowDetailModal(false);
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      product_name: item.product_name,
      elasticity_coefficient: item.elasticity_coefficient,
      elasticity_type: item.elasticity_type,
      price_sensitivity: item.price_sensitivity,
      optimal_price_range_min: item.optimal_price_range_min,
      optimal_price_range_max: item.optimal_price_range_max,
      current_price: item.current_price,
      demand_curve_type: item.demand_curve_type,
      cross_elasticity: item.cross_elasticity || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_name: '',
      elasticity_coefficient: '',
      elasticity_type: 'elastic',
      price_sensitivity: 'medium',
      optimal_price_range_min: '',
      optimal_price_range_max: '',
      current_price: '',
      demand_curve_type: 'linear',
      cross_elasticity: ''
    });
    setSelectedItem(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getElasticityBadge = (type) => {
    const badges = {
      'elastic': 'badge badge-high',
      'inelastic': 'badge badge-low',
      'unit_elastic': 'badge badge-medium'
    };
    return badges[type] || 'badge badge-medium';
  };

  const getSensitivityBadge = (sens) => {
    const badges = {
      'high': 'badge badge-high',
      'medium': 'badge badge-medium',
      'low': 'badge badge-low'
    };
    return badges[sens] || 'badge badge-medium';
  };

  const getElasticityColor = (coef) => {
    const val = Math.abs(parseFloat(coef));
    if (val > 1.5) return '#ff6b6b';
    if (val > 1) return '#ffc107';
    return '#00c853';
  };

  const parseAIAnalysis = (analysis) => {
    if (!analysis) return null;
    try {
      if (typeof analysis === 'object') return analysis;
      if (typeof analysis === 'string') {
        // Clean markdown code blocks that OpenRouter may wrap responses in
        let cleanedAnalysis = analysis
          .replace(/```json\s*/gi, '')
          .replace(/```javascript\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();
        const jsonMatch = cleanedAnalysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        return JSON.parse(cleanedAnalysis);
      }
    } catch (e) {
      console.log('Error parsing AI analysis:', e.message);
    }
    return null;
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>AI Price Elasticity Analyzer</h1>
        <button className="btn btn-primary btn-small" onClick={openNewModal}>
          + New Analysis
        </button>
      </div>

      {/* AI Analyze Section */}
      <div className="ai-generate-section">
        <h3>Analyze Price Elasticity</h3>
        <div className="generate-controls">
          <select
            className="form-control"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ maxWidth: '300px' }}
          >
            <option value="">Select a product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} - ${p.current_price}</option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-small"
            onClick={handleAnalyze}
            disabled={!selectedProduct || analyzing}
          >
            {analyzing ? 'Analyzing...' : 'Analyze Elasticity'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card red">
          <div className="stat-value">{elasticityData.filter(e => e.elasticity_type === 'elastic').length}</div>
          <div className="stat-label">Elastic Products</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{elasticityData.filter(e => e.elasticity_type === 'inelastic').length}</div>
          <div className="stat-label">Inelastic Products</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{elasticityData.filter(e => e.price_sensitivity === 'high').length}</div>
          <div className="stat-label">High Sensitivity</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">{elasticityData.length}</div>
          <div className="stat-label">Total Analyzed</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Elasticity</th>
                <th>Type</th>
                <th>Sensitivity</th>
                <th>Current Price</th>
                <th>Optimal Range</th>
                <th>Curve Type</th>
              </tr>
            </thead>
            <tbody>
              {elasticityData.map((item) => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  <td>{item.product_name}</td>
                  <td>
                    <span style={{ color: getElasticityColor(item.elasticity_coefficient), fontWeight: 'bold' }}>
                      {parseFloat(item.elasticity_coefficient).toFixed(2)}
                    </span>
                  </td>
                  <td><span className={getElasticityBadge(item.elasticity_type)}>{item.elasticity_type}</span></td>
                  <td><span className={getSensitivityBadge(item.price_sensitivity)}>{item.price_sensitivity}</span></td>
                  <td>${parseFloat(item.current_price).toFixed(2)}</td>
                  <td>
                    ${parseFloat(item.optimal_price_range_min).toFixed(2)} - ${parseFloat(item.optimal_price_range_max).toFixed(2)}
                  </td>
                  <td>{item.demand_curve_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <h2>Price Elasticity Analysis</h2>

            <div className="elasticity-visual">
              <div className="elasticity-meter-large">
                <div className="meter-label">Elasticity Coefficient</div>
                <div
                  className="meter-value"
                  style={{ color: getElasticityColor(selectedItem.elasticity_coefficient) }}
                >
                  {parseFloat(selectedItem.elasticity_coefficient).toFixed(3)}
                </div>
                <div className="meter-scale">
                  <span>Inelastic</span>
                  <span>Unit Elastic</span>
                  <span>Elastic</span>
                </div>
                <div className="meter-bar">
                  <div
                    className="meter-indicator"
                    style={{
                      left: `${Math.min(Math.max((Math.abs(parseFloat(selectedItem.elasticity_coefficient)) / 2) * 100, 5), 95)}%`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="detail-grid" style={{ marginTop: '20px' }}>
              <div className="detail-item">
                <label>Product</label>
                <div className="value">{selectedItem.product_name}</div>
              </div>
              <div className="detail-item">
                <label>Elasticity Type</label>
                <div className="value">
                  <span className={getElasticityBadge(selectedItem.elasticity_type)}>{selectedItem.elasticity_type}</span>
                </div>
              </div>
              <div className="detail-item">
                <label>Price Sensitivity</label>
                <div className="value">
                  <span className={getSensitivityBadge(selectedItem.price_sensitivity)}>{selectedItem.price_sensitivity}</span>
                </div>
              </div>
              <div className="detail-item">
                <label>Demand Curve Type</label>
                <div className="value">{selectedItem.demand_curve_type}</div>
              </div>
              <div className="detail-item">
                <label>Current Price</label>
                <div className="value">${parseFloat(selectedItem.current_price).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <label>Optimal Price Range</label>
                <div className="value price-up">
                  ${parseFloat(selectedItem.optimal_price_range_min).toFixed(2)} - ${parseFloat(selectedItem.optimal_price_range_max).toFixed(2)}
                </div>
              </div>
            </div>

            {selectedItem.cross_elasticity && (
              <div className="detail-item" style={{ marginTop: '20px' }}>
                <label>Cross-Elasticity with Related Products</label>
                <div className="cross-elasticity-list">
                  {selectedItem.cross_elasticity.split(',').map((ce, i) => (
                    <div key={i} className="cross-item">{ce.trim()}</div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights Section */}
            <div className="ai-insights-section" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#667eea' }}>AI Elasticity Analysis</h3>
                <button
                  className="btn btn-primary btn-small"
                  onClick={handleAnalyzeItem}
                  disabled={analyzingItem}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {analyzingItem ? (
                    <>
                      <span className="spinner-small"></span>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <span>🤖</span>
                      Get AI Insights
                    </>
                  )}
                </button>
              </div>

              {analyzingItem && (
                <div className="ai-loading-container">
                  <div className="ai-loading-spinner"></div>
                  <p>AI is analyzing price elasticity...</p>
                </div>
              )}

              {!analyzingItem && (aiInsights || selectedItem.ai_analysis || selectedItem.aiResponse) && (
                <div className="ai-analysis-container">
                  <div className="ai-analysis-header">
                    <span className="ai-icon">📊</span>
                    <h3>AI Elasticity Analysis</h3>
                    <span className="ai-badge">Powered by Claude</span>
                  </div>
                  <div className="ai-output-professional">
                    {(() => {
                      const insights = aiInsights || parseAIAnalysis(selectedItem.aiResponse || selectedItem.ai_analysis);
                      if (insights && !insights.raw) {
                        const da = insights.detailed_analysis || insights;
                        return (
                          <div className="ai-structured-output">
                            {/* AI Summary Card */}
                            <div className="ai-summary-card">
                              <div className="summary-item">
                                <span className="summary-icon">📈</span>
                                <div>
                                  <div className="summary-label">Elasticity</div>
                                  <div className="summary-value" style={{ color: getElasticityColor(insights.elasticity_coefficient || selectedItem.elasticity_coefficient) }}>
                                    {parseFloat(insights.elasticity_coefficient || selectedItem.elasticity_coefficient).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">🎯</span>
                                <div>
                                  <div className="summary-label">Type</div>
                                  <div className="summary-value capitalize">{insights.elasticity_type || selectedItem.elasticity_type}</div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">💰</span>
                                <div>
                                  <div className="summary-label">Optimal Range</div>
                                  <div className="summary-value" style={{ color: '#00c853' }}>
                                    ${parseFloat(insights.optimal_price_range_min || selectedItem.optimal_price_range_min).toFixed(2)} - ${parseFloat(insights.optimal_price_range_max || selectedItem.optimal_price_range_max).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Interpretation */}
                            {da.interpretation && (
                              <div className="ai-section-card strategy">
                                <div className="section-header">
                                  <span className="section-icon">📖</span>
                                  <h4>Interpretation</h4>
                                </div>
                                <p className="strategy-text">{da.interpretation}</p>
                              </div>
                            )}

                            {/* Pricing Power */}
                            {da.pricing_power && (
                              <div className="ai-section-card drivers">
                                <div className="section-header">
                                  <span className="section-icon">💪</span>
                                  <h4>Pricing Power</h4>
                                </div>
                                <p className="strategy-text">{da.pricing_power}</p>
                              </div>
                            )}

                            {/* Volume Sensitivity */}
                            {da.volume_sensitivity && (
                              <div className="ai-section-card opportunities">
                                <div className="section-header">
                                  <span className="section-icon">📊</span>
                                  <h4>Volume Sensitivity</h4>
                                </div>
                                <p className="strategy-text">{da.volume_sensitivity}</p>
                              </div>
                            )}

                            {/* Revenue Optimization */}
                            {da.revenue_optimization && (
                              <div className="ai-section-card" style={{ borderLeftColor: '#00c853' }}>
                                <div className="section-header">
                                  <span className="section-icon">💰</span>
                                  <h4>Revenue Optimization Strategy</h4>
                                </div>
                                <p className="strategy-text">{da.revenue_optimization}</p>
                              </div>
                            )}

                            {/* Competitive Implications */}
                            {da.competitive_implications && (
                              <div className="ai-section-card risks">
                                <div className="section-header">
                                  <span className="section-icon">🏢</span>
                                  <h4>Competitive Implications</h4>
                                </div>
                                <p className="strategy-text">{da.competitive_implications}</p>
                              </div>
                            )}

                            {/* Recommendations */}
                            {da.recommendations && da.recommendations.length > 0 && (
                              <div className="ai-section-card" style={{ borderLeftColor: '#667eea', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)' }}>
                                <div className="section-header">
                                  <span className="section-icon">✅</span>
                                  <h4>Key Recommendations</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {da.recommendations.map((r, i) => (
                                    <li key={i} className="driver-item">
                                      <span className="bullet">▸</span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      }
                      // Handle raw/unparseable response
                      if (insights?.raw) {
                        return (
                          <div className="ai-section-card" style={{ borderLeftColor: '#ffc107' }}>
                            <div className="section-header">
                              <span className="section-icon">⚠️</span>
                              <h4>AI Response</h4>
                            </div>
                            <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                              Response could not be fully parsed. Please try again.
                            </p>
                            <div style={{ background: '#1a1a2e', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
                              {insights.raw}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {!analyzingItem && !aiInsights && !selectedItem.ai_analysis && !selectedItem.aiResponse && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#888', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '12px' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🤖</div>
                  <div>Click "Get AI Insights" to analyze this elasticity data with AI</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>
                    Get interpretation, pricing power analysis, and revenue optimization recommendations
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => handleEdit(selectedItem)}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selectedItem.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedItem ? 'Edit' : 'Add'} Price Elasticity</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Elasticity Coefficient</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.elasticity_coefficient}
                    onChange={(e) => setFormData({ ...formData, elasticity_coefficient: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Current Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_price}
                    onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Elasticity Type</label>
                  <select
                    className="form-control"
                    value={formData.elasticity_type}
                    onChange={(e) => setFormData({ ...formData, elasticity_type: e.target.value })}
                  >
                    <option value="elastic">Elastic</option>
                    <option value="inelastic">Inelastic</option>
                    <option value="unit_elastic">Unit Elastic</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price Sensitivity</label>
                  <select
                    className="form-control"
                    value={formData.price_sensitivity}
                    onChange={(e) => setFormData({ ...formData, price_sensitivity: e.target.value })}
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Optimal Price Min ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.optimal_price_range_min}
                    onChange={(e) => setFormData({ ...formData, optimal_price_range_min: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Optimal Price Max ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.optimal_price_range_max}
                    onChange={(e) => setFormData({ ...formData, optimal_price_range_max: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Demand Curve Type</label>
                <select
                  className="form-control"
                  value={formData.demand_curve_type}
                  onChange={(e) => setFormData({ ...formData, demand_curve_type: e.target.value })}
                >
                  <option value="linear">Linear</option>
                  <option value="convex">Convex</option>
                  <option value="concave">Concave</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cross-Elasticity (Related Products)</label>
                <textarea
                  className="form-control"
                  value={formData.cross_elasticity}
                  onChange={(e) => setFormData({ ...formData, cross_elasticity: e.target.value })}
                  placeholder="e.g., Product A: 0.5, Product B: 0.3"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default PriceElasticity;
