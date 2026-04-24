import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = 'http://localhost:3001/api';

const DiscountOptimizations = () => {
  const [optimizations, setOptimizations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [aiInsights, setAiInsights] = useState(null);
  const [analyzingItem, setAnalyzingItem] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    current_price: '',
    optimal_discount: '',
    discounted_price: '',
    expected_volume_increase: '',
    expected_revenue_impact: '',
    break_even_volume: '',
    recommendation: 'recommended',
    discount_type: 'percentage',
    valid_period: ''
  });

  useEffect(() => {
    fetchOptimizations();
    fetchProducts();
  }, []);

  const fetchOptimizations = async () => {
    try {
      const response = await axios.get(`${API_URL}/discount-optimizations`);
      setOptimizations(response.data);
    } catch (error) {
      console.error('Error fetching optimizations:', error);
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

  const handleAnalyzeDiscount = async () => {
    if (!selectedItem) return;
    setAnalyzingItem(true);
    setAiInsights(null);
    try {
      const response = await axios.post(`${API_URL}/discount-optimizations/analyze`, {
        optimizationId: selectedItem.id
      });
      if (response.data.analysis) {
        setAiInsights(response.data.analysis);
        setSelectedItem(prev => ({ ...prev, ai_analysis: JSON.stringify(response.data.analysis) }));
      } else if (response.data.aiResponse) {
        setAiInsights({ raw: response.data.aiResponse });
      }
    } catch (error) {
      console.error('Error analyzing discount:', error);
      alert('Error analyzing discount: ' + error.message);
    } finally {
      setAnalyzingItem(false);
    }
  };

  const handleGenerateOptimization = async () => {
    if (!selectedProduct) return;
    setGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/discount-optimizations/generate`, {
        productId: selectedProduct
      });
      if (response.data.optimization) {
        fetchOptimizations();
        setSelectedItem({ ...response.data.optimization, aiResponse: response.data.aiResponse });
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Error generating optimization:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedItem && !showDetailModal) {
        await axios.put(`${API_URL}/discount-optimizations/${selectedItem.id}`, formData);
      } else {
        await axios.post(`${API_URL}/discount-optimizations`, formData);
      }
      fetchOptimizations();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this optimization?')) {
      try {
        await axios.delete(`${API_URL}/discount-optimizations/${id}`);
        fetchOptimizations();
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
      current_price: item.current_price,
      optimal_discount: item.optimal_discount,
      discounted_price: item.discounted_price,
      expected_volume_increase: item.expected_volume_increase,
      expected_revenue_impact: item.expected_revenue_impact,
      break_even_volume: item.break_even_volume,
      recommendation: item.recommendation,
      discount_type: item.discount_type,
      valid_period: item.valid_period || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_name: '',
      current_price: '',
      optimal_discount: '',
      discounted_price: '',
      expected_volume_increase: '',
      expected_revenue_impact: '',
      break_even_volume: '',
      recommendation: 'recommended',
      discount_type: 'percentage',
      valid_period: ''
    });
    setSelectedItem(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getRecommendationBadge = (rec) => {
    const badges = {
      'highly_recommended': 'badge badge-approved',
      'recommended': 'badge badge-pending',
      'optional': 'badge badge-stable',
      'not_recommended': 'badge badge-rejected'
    };
    return badges[rec] || 'badge badge-pending';
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
        <h1>AI Discount Optimizer</h1>
        <button className="btn btn-primary btn-small" onClick={openNewModal}>
          + New Optimization
        </button>
      </div>

      {/* AI Generate Section */}
      <div className="ai-generate-section">
        <h3>Generate AI Discount Optimization</h3>
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
            onClick={handleGenerateOptimization}
            disabled={!selectedProduct || generating}
          >
            {generating ? 'Optimizing...' : 'Calculate Optimal Discount'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-value">{optimizations.filter(o => o.recommendation === 'highly_recommended').length}</div>
          <div className="stat-label">Highly Recommended</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{optimizations.filter(o => o.recommendation === 'recommended').length}</div>
          <div className="stat-label">Recommended</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">
            ${optimizations.reduce((a, b) => a + (parseFloat(b.expected_revenue_impact) || 0), 0).toFixed(0)}
          </div>
          <div className="stat-label">Total Revenue Impact</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">
            {optimizations.length > 0 ? Math.round(optimizations.reduce((a, b) => a + (parseFloat(b.optimal_discount) || 0), 0) / optimizations.length) : 0}%
          </div>
          <div className="stat-label">Avg Discount</div>
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
                <th>Current Price</th>
                <th>Optimal Discount</th>
                <th>Discounted Price</th>
                <th>Volume Increase</th>
                <th>Revenue Impact</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {optimizations.map((item) => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  <td>{item.product_name}</td>
                  <td>${parseFloat(item.current_price).toFixed(2)}</td>
                  <td className="discount-highlight">{parseFloat(item.optimal_discount).toFixed(0)}%</td>
                  <td className="price-down">${parseFloat(item.discounted_price).toFixed(2)}</td>
                  <td className="price-up">+{parseFloat(item.expected_volume_increase).toFixed(0)}%</td>
                  <td className="price-up">${parseFloat(item.expected_revenue_impact).toFixed(0)}</td>
                  <td>
                    <span className={getRecommendationBadge(item.recommendation)}>
                      {item.recommendation?.replace('_', ' ')}
                    </span>
                  </td>
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
            <h2>Discount Optimization Details</h2>

            <div className="discount-summary">
              <div className="discount-visual">
                <div className="price-comparison">
                  <div className="original-price">
                    <span className="label">Current Price</span>
                    <span className="price">${parseFloat(selectedItem.current_price).toFixed(2)}</span>
                  </div>
                  <div className="arrow">→</div>
                  <div className="discount-badge">
                    -{parseFloat(selectedItem.optimal_discount).toFixed(0)}%
                  </div>
                  <div className="arrow">→</div>
                  <div className="new-price">
                    <span className="label">Discounted Price</span>
                    <span className="price">${parseFloat(selectedItem.discounted_price).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-grid" style={{ marginTop: '20px' }}>
              <div className="detail-item">
                <label>Product</label>
                <div className="value">{selectedItem.product_name}</div>
              </div>
              <div className="detail-item">
                <label>Discount Type</label>
                <div className="value">{selectedItem.discount_type}</div>
              </div>
              <div className="detail-item">
                <label>Expected Volume Increase</label>
                <div className="value price-up">+{parseFloat(selectedItem.expected_volume_increase).toFixed(0)}%</div>
              </div>
              <div className="detail-item">
                <label>Expected Revenue Impact</label>
                <div className="value price-up">${parseFloat(selectedItem.expected_revenue_impact).toFixed(0)}</div>
              </div>
              <div className="detail-item">
                <label>Break-even Volume</label>
                <div className="value">{selectedItem.break_even_volume} units</div>
              </div>
              <div className="detail-item">
                <label>Valid Period</label>
                <div className="value">{selectedItem.valid_period || 'Not specified'}</div>
              </div>
              <div className="detail-item">
                <label>Recommendation</label>
                <div className="value">
                  <span className={getRecommendationBadge(selectedItem.recommendation)}>
                    {selectedItem.recommendation?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Insights Section */}
            <div className="ai-insights-section" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#667eea' }}>AI Discount Analysis</h3>
                <button
                  className="btn btn-primary btn-small"
                  onClick={handleAnalyzeDiscount}
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
                  <p>AI is analyzing this discount optimization...</p>
                </div>
              )}

              {!analyzingItem && (aiInsights || selectedItem.ai_analysis || selectedItem.aiResponse) && (
                <div className="ai-analysis-container">
                  <div className="ai-analysis-header">
                    <span className="ai-icon">🏷️</span>
                    <h3>AI Discount Analysis</h3>
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
                                <span className="summary-icon">🏷️</span>
                                <div>
                                  <div className="summary-label">Optimal Discount</div>
                                  <div className="summary-value" style={{ color: '#ff6b6b' }}>
                                    {parseFloat(insights.optimal_discount || selectedItem.optimal_discount).toFixed(0)}%
                                  </div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">📈</span>
                                <div>
                                  <div className="summary-label">Volume Increase</div>
                                  <div className="summary-value" style={{ color: '#00c853' }}>
                                    +{parseFloat(insights.expected_volume_increase || selectedItem.expected_volume_increase).toFixed(0)}%
                                  </div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">💰</span>
                                <div>
                                  <div className="summary-label">Revenue Impact</div>
                                  <div className="summary-value" style={{ color: '#00c853' }}>
                                    ${parseFloat(insights.expected_revenue_impact || selectedItem.expected_revenue_impact).toFixed(0)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Profit Impact */}
                            {da.profit_impact && (
                              <div className="ai-section-card drivers">
                                <div className="section-header">
                                  <span className="section-icon">💵</span>
                                  <h4>Profit Impact</h4>
                                </div>
                                <p className="strategy-text">{da.profit_impact}</p>
                              </div>
                            )}

                            {/* Market Positioning */}
                            {da.market_positioning && (
                              <div className="ai-section-card strategy">
                                <div className="section-header">
                                  <span className="section-icon">🎯</span>
                                  <h4>Market Positioning</h4>
                                </div>
                                <p className="strategy-text">{da.market_positioning}</p>
                              </div>
                            )}

                            {/* Customer Psychology */}
                            {da.customer_psychology && (
                              <div className="ai-section-card opportunities">
                                <div className="section-header">
                                  <span className="section-icon">🧠</span>
                                  <h4>Customer Psychology</h4>
                                </div>
                                <p className="strategy-text">{da.customer_psychology}</p>
                              </div>
                            )}

                            {/* Best Timing */}
                            {da.best_timing && (
                              <div className="ai-section-card seasonality">
                                <div className="section-header">
                                  <span className="section-icon">⏰</span>
                                  <h4>Best Timing</h4>
                                </div>
                                <p className="strategy-text">{da.best_timing}</p>
                              </div>
                            )}

                            {/* Risks */}
                            {da.risks && da.risks.length > 0 && (
                              <div className="ai-section-card risks">
                                <div className="section-header">
                                  <span className="section-icon">⚠️</span>
                                  <h4>Risk Factors</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {da.risks.map((r, i) => (
                                    <li key={i} className="risk-item">
                                      <span className="bullet">▸</span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Alternative Strategies */}
                            {da.alternatives && da.alternatives.length > 0 && (
                              <div className="ai-section-card">
                                <div className="section-header">
                                  <span className="section-icon">💡</span>
                                  <h4>Alternative Strategies</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {da.alternatives.map((a, i) => (
                                    <li key={i} className="opportunity-item">
                                      <span className="bullet">▸</span>
                                      <span>{a}</span>
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
                  <div>Click "Get AI Insights" to analyze this discount with AI</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>
                    Get profit impact analysis, market positioning, and timing recommendations
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
            <h2>{selectedItem ? 'Edit' : 'Add'} Discount Optimization</h2>
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
                  <label>Current Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_price}
                    onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Optimal Discount (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.optimal_discount}
                    onChange={(e) => setFormData({ ...formData, optimal_discount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Discounted Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discounted_price}
                    onChange={(e) => setFormData({ ...formData, discounted_price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Expected Volume Increase (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expected_volume_increase}
                    onChange={(e) => setFormData({ ...formData, expected_volume_increase: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Expected Revenue Impact ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expected_revenue_impact}
                    onChange={(e) => setFormData({ ...formData, expected_revenue_impact: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Break-even Volume</label>
                  <input
                    type="number"
                    value={formData.break_even_volume}
                    onChange={(e) => setFormData({ ...formData, break_even_volume: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Recommendation</label>
                  <select
                    className="form-control"
                    value={formData.recommendation}
                    onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
                  >
                    <option value="highly_recommended">Highly Recommended</option>
                    <option value="recommended">Recommended</option>
                    <option value="optional">Optional</option>
                    <option value="not_recommended">Not Recommended</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Discount Type</label>
                  <select
                    className="form-control"
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="tiered">Tiered</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Valid Period</label>
                <input
                  type="text"
                  placeholder="e.g., 2 weeks"
                  value={formData.valid_period}
                  onChange={(e) => setFormData({ ...formData, valid_period: e.target.value })}
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

export default DiscountOptimizations;
