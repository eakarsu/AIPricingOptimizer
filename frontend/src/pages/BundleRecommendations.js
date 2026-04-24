import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = 'http://localhost:3001/api';

const BundleRecommendations = () => {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({
    bundle_name: '',
    products: '',
    individual_total: '',
    bundle_price: '',
    discount_percentage: '',
    expected_margin: '',
    affinity_score: '',
    recommendation_reason: '',
    status: 'suggested'
  });

  useEffect(() => {
    fetchBundles();
  }, []);

  const fetchBundles = async () => {
    try {
      const response = await axios.get(`${API_URL}/bundle-recommendations`);
      setBundles(response.data);
    } catch (error) {
      console.error('Error fetching bundles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setAiInsights(null); // Reset AI insights when opening new item
    setShowDetailModal(true);
  };

  const [generatedBundles, setGeneratedBundles] = useState([]);
  const [showGeneratedModal, setShowGeneratedModal] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);
  const [analyzingBundle, setAnalyzingBundle] = useState(false);

  const handleAnalyzeBundle = async () => {
    if (!selectedItem) return;
    setAnalyzingBundle(true);
    setAiInsights(null);
    try {
      console.log('=== Analyzing bundle:', selectedItem.id, '===');
      const response = await axios.post(`${API_URL}/bundle-recommendations/analyze`, {
        bundleId: selectedItem.id
      });
      console.log('=== AI ANALYZE BUNDLE RESPONSE ===', response.data);
      if (response.data.analysis) {
        setAiInsights(response.data.analysis);
        // Update the selected item with new analysis
        setSelectedItem(prev => ({ ...prev, ai_analysis: JSON.stringify(response.data.analysis) }));
      } else if (response.data.aiResponse) {
        // Show raw response if parsing failed
        setAiInsights({ raw: response.data.aiResponse });
      }
    } catch (error) {
      console.error('Error analyzing bundle:', error);
      alert('Error analyzing bundle: ' + error.message);
    } finally {
      setAnalyzingBundle(false);
    }
  };

  const handleGenerateBundles = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/bundle-recommendations/generate`);
      console.log('=== AI GENERATE BUNDLES RESPONSE ===', response.data);
      if (response.data.bundles && response.data.bundles.length > 0) {
        setGeneratedBundles(response.data.bundles);
        setShowGeneratedModal(true);
        fetchBundles();
      } else if (response.data.aiResponse) {
        // Show raw AI response if no bundles parsed
        alert('AI Response received but could not parse bundles. Check console.');
        console.log('Raw AI Response:', response.data.aiResponse);
      }
    } catch (error) {
      console.error('Error generating bundles:', error);
      alert('Error generating bundles: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedItem && !showDetailModal) {
        await axios.put(`${API_URL}/bundle-recommendations/${selectedItem.id}`, formData);
      } else {
        await axios.post(`${API_URL}/bundle-recommendations`, formData);
      }
      fetchBundles();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this bundle?')) {
      try {
        await axios.delete(`${API_URL}/bundle-recommendations/${id}`);
        fetchBundles();
        setShowDetailModal(false);
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      bundle_name: item.bundle_name,
      products: item.products,
      individual_total: item.individual_total,
      bundle_price: item.bundle_price,
      discount_percentage: item.discount_percentage,
      expected_margin: item.expected_margin,
      affinity_score: item.affinity_score,
      recommendation_reason: item.recommendation_reason,
      status: item.status
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      await axios.put(`${API_URL}/bundle-recommendations/${item.id}`, {
        ...item,
        status: newStatus
      });
      fetchBundles();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      bundle_name: '',
      products: '',
      individual_total: '',
      bundle_price: '',
      discount_percentage: '',
      expected_margin: '',
      affinity_score: '',
      recommendation_reason: '',
      status: 'suggested'
    });
    setSelectedItem(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': 'badge badge-approved',
      'suggested': 'badge badge-pending',
      'rejected': 'badge badge-rejected'
    };
    return badges[status] || 'badge badge-pending';
  };

  const getAffinityColor = (score) => {
    if (score >= 85) return '#00c853';
    if (score >= 70) return '#ffc107';
    return '#ff6b6b';
  };

  const parseAIAnalysis = (analysis) => {
    if (!analysis) return null;
    try {
      // If it's already an object, return it
      if (typeof analysis === 'object') {
        return analysis;
      }

      // If it's a string, try to extract JSON
      if (typeof analysis === 'string') {
        // Remove markdown code blocks if present
        let cleanedAnalysis = analysis
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim();

        // Try to find JSON object in the string
        const jsonMatch = cleanedAnalysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }

        // Try direct parse
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
        <h1>AI Bundle Recommender</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-success btn-small"
            onClick={handleGenerateBundles}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'AI Generate Bundles'}
          </button>
          <button className="btn btn-primary btn-small" onClick={openNewModal}>
            + New Bundle
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-value">{bundles.filter(b => b.status === 'active').length}</div>
          <div className="stat-label">Active Bundles</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{bundles.filter(b => b.status === 'suggested').length}</div>
          <div className="stat-label">Suggested</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">
            {bundles.length > 0 ? Math.round(bundles.reduce((a, b) => a + (b.affinity_score || 0), 0) / bundles.length) : 0}
          </div>
          <div className="stat-label">Avg Affinity Score</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">
            ${bundles.reduce((a, b) => a + (parseFloat(b.individual_total) - parseFloat(b.bundle_price) || 0), 0).toFixed(0)}
          </div>
          <div className="stat-label">Total Savings</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bundle Name</th>
                <th>Products</th>
                <th>Individual Total</th>
                <th>Bundle Price</th>
                <th>Discount</th>
                <th>Margin</th>
                <th>Affinity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((item) => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  <td><strong>{item.bundle_name}</strong></td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.products}
                  </td>
                  <td>${parseFloat(item.individual_total).toFixed(2)}</td>
                  <td className="price-up">${parseFloat(item.bundle_price).toFixed(2)}</td>
                  <td>{parseFloat(item.discount_percentage).toFixed(1)}%</td>
                  <td>{parseFloat(item.expected_margin).toFixed(1)}%</td>
                  <td>
                    <div className="affinity-score" style={{ color: getAffinityColor(item.affinity_score) }}>
                      {item.affinity_score}/100
                    </div>
                  </td>
                  <td><span className={getStatusBadge(item.status)}>{item.status}</span></td>
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
            <h2>{selectedItem.bundle_name}</h2>

            <div className="bundle-products">
              <h4>Included Products</h4>
              <div className="product-tags">
                {selectedItem.products.split(',').map((p, i) => (
                  <span key={i} className="product-tag">{p.trim()}</span>
                ))}
              </div>
            </div>

            <div className="detail-grid" style={{ marginTop: '20px' }}>
              <div className="detail-item">
                <label>Individual Total</label>
                <div className="value">${parseFloat(selectedItem.individual_total).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <label>Bundle Price</label>
                <div className="value price-up">${parseFloat(selectedItem.bundle_price).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <label>Customer Savings</label>
                <div className="value" style={{ color: '#00c853' }}>
                  ${(parseFloat(selectedItem.individual_total) - parseFloat(selectedItem.bundle_price)).toFixed(2)}
                  ({parseFloat(selectedItem.discount_percentage).toFixed(1)}%)
                </div>
              </div>
              <div className="detail-item">
                <label>Expected Margin</label>
                <div className="value">{parseFloat(selectedItem.expected_margin).toFixed(1)}%</div>
              </div>
              <div className="detail-item">
                <label>Affinity Score</label>
                <div className="value">
                  <div className="affinity-meter">
                    <div
                      className="affinity-fill"
                      style={{
                        width: `${selectedItem.affinity_score}%`,
                        backgroundColor: getAffinityColor(selectedItem.affinity_score)
                      }}
                    />
                  </div>
                  <span style={{ color: getAffinityColor(selectedItem.affinity_score) }}>
                    {selectedItem.affinity_score}/100
                  </span>
                </div>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <div className="value">
                  <span className={getStatusBadge(selectedItem.status)}>{selectedItem.status}</span>
                </div>
              </div>
            </div>

            <div className="detail-item" style={{ marginTop: '20px' }}>
              <label>Recommendation Reason</label>
              <div className="value">{selectedItem.recommendation_reason}</div>
            </div>

            {/* AI Insights Section */}
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(102, 126, 234, 0.1)', borderRadius: '12px', border: '1px solid rgba(102, 126, 234, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#667eea' }}>🤖 AI Bundle Insights</h3>
                <button
                  className="btn btn-primary btn-small"
                  onClick={handleAnalyzeBundle}
                  disabled={analyzingBundle}
                  style={{ minWidth: '180px' }}
                >
                  {analyzingBundle ? '🔄 Analyzing...' : '✨ Get AI Insights'}
                </button>
              </div>

              {analyzingBundle && (
                <div className="ai-output-professional">
                  <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', marginBottom: '12px' }}>🤖</div>
                    <div>Analyzing bundle with AI...</div>
                    <div style={{ color: '#888', fontSize: '13px', marginTop: '8px' }}>This may take a few seconds</div>
                  </div>
                </div>
              )}

              {!analyzingBundle && (aiInsights || selectedItem.ai_analysis) && (
                <div className="ai-analysis-container">
                  <div className="ai-analysis-header">
                    <span className="ai-icon">🎁</span>
                    <h3>Bundle Analysis</h3>
                    <span className="ai-badge">Powered by Claude</span>
                  </div>
                  <div className="ai-output-professional">
                    {(() => {
                      const insights = aiInsights || parseAIAnalysis(selectedItem.ai_analysis);
                      if (insights && !insights.raw) {
                        return (
                          <div className="ai-structured-output">
                            {/* Target Customer */}
                            {insights.target_customer && (
                              <div className="ai-section-card drivers">
                                <div className="section-header">
                                  <span className="section-icon">👥</span>
                                  <h4>Target Customer</h4>
                                </div>
                                <p className="strategy-text">{insights.target_customer}</p>
                              </div>
                            )}

                            {/* Cross-Sell Potential */}
                            {insights.cross_sell_potential && (
                              <div className="ai-section-card opportunities">
                                <div className="section-header">
                                  <span className="section-icon">📈</span>
                                  <h4>Cross-Sell Potential</h4>
                                </div>
                                <p className="strategy-text">{insights.cross_sell_potential}</p>
                              </div>
                            )}

                            {/* Seasonal Relevance */}
                            {insights.seasonal_relevance && (
                              <div className="ai-section-card seasonality">
                                <div className="section-header">
                                  <span className="section-icon">🗓️</span>
                                  <h4>Seasonal Relevance</h4>
                                </div>
                                <p className="strategy-text">{insights.seasonal_relevance}</p>
                              </div>
                            )}

                            {/* Marketing Angle */}
                            {insights.marketing_angle && (
                              <div className="ai-section-card strategy">
                                <div className="section-header">
                                  <span className="section-icon">📣</span>
                                  <h4>Marketing Angle</h4>
                                </div>
                                <p className="strategy-text">{insights.marketing_angle}</p>
                              </div>
                            )}

                            {/* Price Optimization */}
                            {insights.price_optimization && (
                              <div className="ai-section-card" style={{ borderLeftColor: '#00c853' }}>
                                <div className="section-header">
                                  <span className="section-icon">💰</span>
                                  <h4>Price Optimization</h4>
                                </div>
                                <div className="ai-summary-card" style={{ marginBottom: '12px' }}>
                                  <div className="summary-item">
                                    <span className="summary-icon">🎯</span>
                                    <div>
                                      <div className="summary-label">Recommended Price</div>
                                      <div className="summary-value" style={{ color: '#00c853' }}>
                                        ${insights.price_optimization.recommended_price}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <p className="strategy-text">
                                  <strong>Assessment:</strong> {insights.price_optimization.current_assessment}
                                </p>
                                <p className="strategy-text">
                                  <strong>Reasoning:</strong> {insights.price_optimization.reasoning}
                                </p>
                              </div>
                            )}

                            {/* Competitive Advantage */}
                            {insights.competitive_advantage && (
                              <div className="ai-section-card" style={{ borderLeftColor: '#667eea' }}>
                                <div className="section-header">
                                  <span className="section-icon">🏆</span>
                                  <h4>Competitive Advantage</h4>
                                </div>
                                <p className="strategy-text">{insights.competitive_advantage}</p>
                              </div>
                            )}

                            {/* Risks */}
                            {insights.risks && insights.risks.length > 0 && (
                              <div className="ai-section-card risks">
                                <div className="section-header">
                                  <span className="section-icon">⚠️</span>
                                  <h4>Risks</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {insights.risks.map((r, i) => (
                                    <li key={i} className="risk-item">
                                      <span className="bullet">▸</span>
                                      <span>{r}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Opportunities */}
                            {insights.opportunities && insights.opportunities.length > 0 && (
                              <div className="ai-section-card" style={{ borderLeftColor: '#ffc107' }}>
                                <div className="section-header">
                                  <span className="section-icon">💡</span>
                                  <h4>Opportunities</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {insights.opportunities.map((o, i) => (
                                    <li key={i} className="opportunity-item">
                                      <span className="bullet">▸</span>
                                      <span>{o}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Action Items */}
                            {insights.action_items && insights.action_items.length > 0 && (
                              <div className="ai-section-card" style={{ borderLeftColor: '#00c853', background: 'rgba(0, 200, 83, 0.1)' }}>
                                <div className="section-header">
                                  <span className="section-icon">✅</span>
                                  <h4>Action Items</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {insights.action_items.map((a, i) => (
                                    <li key={i} className="driver-item">
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
                      // Show raw response in a formatted way if available
                      if (insights?.raw) {
                        // Try to extract key-value pairs from truncated JSON
                        const rawText = insights.raw;
                        const extractedInfo = [];

                        // Try to extract common fields even from incomplete JSON
                        const patterns = [
                          { key: 'target_customer', label: 'Target Customer', icon: '👥' },
                          { key: 'cross_sell_potential', label: 'Cross-Sell Potential', icon: '📈' },
                          { key: 'seasonal_relevance', label: 'Seasonal Relevance', icon: '🗓️' },
                          { key: 'marketing_angle', label: 'Marketing Angle', icon: '📣' },
                          { key: 'competitive_advantage', label: 'Competitive Advantage', icon: '🏆' }
                        ];

                        patterns.forEach(({ key, label, icon }) => {
                          const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 's');
                          const match = rawText.match(regex);
                          if (match && match[1]) {
                            extractedInfo.push({ label, icon, value: match[1].replace(/\\n/g, ' ').replace(/\\"/g, '"') });
                          }
                        });

                        if (extractedInfo.length > 0) {
                          return (
                            <div className="ai-structured-output">
                              <div className="ai-section-card" style={{ borderLeftColor: '#ffc107', marginBottom: '16px' }}>
                                <div className="section-header">
                                  <span className="section-icon">⚠️</span>
                                  <h4>Partial Analysis (Response was truncated)</h4>
                                </div>
                                <p style={{ color: '#888', fontSize: '13px' }}>Some information may be incomplete. Try clicking "Get AI Insights" again.</p>
                              </div>
                              {extractedInfo.map((info, i) => (
                                <div key={i} className="ai-section-card drivers">
                                  <div className="section-header">
                                    <span className="section-icon">{info.icon}</span>
                                    <h4>{info.label}</h4>
                                  </div>
                                  <p className="strategy-text">{info.value}</p>
                                </div>
                              ))}
                            </div>
                          );
                        }

                        // Final fallback - show formatted text
                        return (
                          <div className="ai-section-card" style={{ borderLeftColor: '#ff6b6b' }}>
                            <div className="section-header">
                              <span className="section-icon">⚠️</span>
                              <h4>AI Response (Could not parse)</h4>
                            </div>
                            <p style={{ color: '#888', fontSize: '13px', marginBottom: '12px' }}>
                              The AI response could not be fully parsed. Please try again.
                            </p>
                            <div style={{
                              background: '#1a1a2e',
                              padding: '16px',
                              borderRadius: '8px',
                              maxHeight: '300px',
                              overflow: 'auto',
                              fontSize: '13px',
                              lineHeight: '1.5'
                            }}>
                              {rawText.split('\\n').map((line, i) => (
                                <div key={i} style={{ marginBottom: '4px' }}>{line}</div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              )}

              {!analyzingBundle && !aiInsights && !selectedItem.ai_analysis && (
                <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🤖</div>
                  <div>Click "Get AI Insights" to analyze this bundle with AI</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>
                    Get target customer insights, pricing optimization, and marketing recommendations
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Close</button>
              {selectedItem.status === 'suggested' && (
                <button className="btn btn-success" onClick={() => handleStatusChange(selectedItem, 'active')}>
                  Activate Bundle
                </button>
              )}
              {selectedItem.status === 'active' && (
                <button className="btn btn-secondary" onClick={() => handleStatusChange(selectedItem, 'suggested')}>
                  Deactivate
                </button>
              )}
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
            <h2>{selectedItem ? 'Edit' : 'Add'} Bundle</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Bundle Name</label>
                <input
                  type="text"
                  value={formData.bundle_name}
                  onChange={(e) => setFormData({ ...formData, bundle_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Products (comma-separated)</label>
                <textarea
                  className="form-control"
                  value={formData.products}
                  onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                  placeholder="Product 1, Product 2, Product 3"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Individual Total ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.individual_total}
                    onChange={(e) => setFormData({ ...formData, individual_total: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Bundle Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.bundle_price}
                    onChange={(e) => setFormData({ ...formData, bundle_price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Discount (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Expected Margin (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expected_margin}
                    onChange={(e) => setFormData({ ...formData, expected_margin: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Affinity Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.affinity_score}
                    onChange={(e) => setFormData({ ...formData, affinity_score: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select
                    className="form-control"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="suggested">Suggested</option>
                    <option value="active">Active</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Recommendation Reason</label>
                <textarea
                  className="form-control"
                  value={formData.recommendation_reason}
                  onChange={(e) => setFormData({ ...formData, recommendation_reason: e.target.value })}
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

      {/* AI Generated Bundles Modal */}
      {showGeneratedModal && generatedBundles.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowGeneratedModal(false)}>
          <div className="modal" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ai-analysis-header" style={{ marginBottom: '20px' }}>
              <span className="ai-icon">🎁</span>
              <h2>AI Generated Bundle Recommendations</h2>
              <span className="ai-badge">Powered by Claude</span>
            </div>

            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              The AI has analyzed your products and generated {generatedBundles.length} profitable bundle recommendations:
            </p>

            <div className="ai-output-professional">
              {generatedBundles.map((bundle, index) => (
                <div key={index} className="ai-section-card" style={{ marginBottom: '20px', borderLeftColor: ['#667eea', '#00c853', '#ffc107'][index % 3] }}>
                  <div className="section-header">
                    <span className="section-icon">{['🎯', '⭐', '💎'][index % 3]}</span>
                    <h4>{bundle.bundle_name}</h4>
                  </div>

                  {/* Bundle Products */}
                  <div className="bundle-products" style={{ marginBottom: '16px' }}>
                    <div className="product-tags">
                      {bundle.products?.split(',').map((p, i) => (
                        <span key={i} className="product-tag">{p.trim()}</span>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="ai-summary-card" style={{ marginBottom: '16px' }}>
                    <div className="summary-item">
                      <span className="summary-icon">💵</span>
                      <div>
                        <div className="summary-label">Individual Total</div>
                        <div className="summary-value" style={{ textDecoration: 'line-through', color: '#888' }}>
                          ${parseFloat(bundle.individual_total || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="summary-item">
                      <span className="summary-icon">🏷️</span>
                      <div>
                        <div className="summary-label">Bundle Price</div>
                        <div className="summary-value" style={{ color: '#00c853' }}>
                          ${parseFloat(bundle.bundle_price || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div className="summary-item">
                      <span className="summary-icon">📊</span>
                      <div>
                        <div className="summary-label">Discount</div>
                        <div className="summary-value" style={{ color: '#ff6b6b' }}>
                          {parseFloat(bundle.discount_percentage || 0).toFixed(0)}% OFF
                        </div>
                      </div>
                    </div>
                    <div className="summary-item">
                      <span className="summary-icon">📈</span>
                      <div>
                        <div className="summary-label">Affinity Score</div>
                        <div className="summary-value" style={{ color: getAffinityColor(bundle.affinity_score) }}>
                          {bundle.affinity_score}/100
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Reason */}
                  <p className="strategy-text" style={{ marginBottom: '12px' }}>
                    <strong>Why this bundle works:</strong> {bundle.recommendation_reason}
                  </p>

                  {/* AI Detailed Analysis */}
                  {bundle.ai_analysis && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      {(() => {
                        const analysis = typeof bundle.ai_analysis === 'string'
                          ? (() => { try { return JSON.parse(bundle.ai_analysis); } catch(e) { return null; } })()
                          : bundle.ai_analysis;
                        if (analysis) {
                          return (
                            <div className="ai-list-professional" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              {analysis.target_customer && (
                                <div><strong>👥 Target Customer:</strong> {analysis.target_customer}</div>
                              )}
                              {analysis.cross_sell_potential && (
                                <div><strong>📈 Cross-Sell:</strong> {analysis.cross_sell_potential}</div>
                              )}
                              {analysis.seasonal_relevance && (
                                <div><strong>🗓️ Timing:</strong> {analysis.seasonal_relevance}</div>
                              )}
                              {analysis.marketing_angle && (
                                <div><strong>📣 Marketing:</strong> {analysis.marketing_angle}</div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowGeneratedModal(false)}>Close</button>
              <button className="btn btn-primary" onClick={() => {
                setShowGeneratedModal(false);
                if (generatedBundles[0]) {
                  setSelectedItem(generatedBundles[0]);
                  setShowDetailModal(true);
                }
              }}>View First Bundle Details</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default BundleRecommendations;
