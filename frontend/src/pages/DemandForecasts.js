import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = 'http://localhost:3001/api';

const DemandForecasts = () => {
  const [forecasts, setForecasts] = useState([]);
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
    forecast_period: '',
    predicted_demand: '',
    confidence_level: '',
    seasonality_factor: '',
    trend_direction: 'stable',
    recommended_price: '',
    current_price: '',
    factors: ''
  });

  useEffect(() => {
    fetchForecasts();
    fetchProducts();
  }, []);

  const fetchForecasts = async () => {
    try {
      const response = await axios.get(`${API_URL}/demand-forecasts`);
      setForecasts(response.data);
    } catch (error) {
      console.error('Error fetching forecasts:', error);
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

  const handleAnalyzeForecast = async () => {
    if (!selectedItem) return;
    setAnalyzingItem(true);
    setAiInsights(null);
    try {
      const response = await axios.post(`${API_URL}/demand-forecasts/analyze`, {
        forecastId: selectedItem.id
      });
      if (response.data.analysis) {
        setAiInsights(response.data.analysis);
        setSelectedItem(prev => ({ ...prev, ai_analysis: JSON.stringify(response.data.analysis) }));
      } else if (response.data.aiResponse) {
        setAiInsights({ raw: response.data.aiResponse });
      }
    } catch (error) {
      console.error('Error analyzing forecast:', error);
      alert('Error analyzing forecast: ' + error.message);
    } finally {
      setAnalyzingItem(false);
    }
  };

  const handleGenerateForecast = async () => {
    if (!selectedProduct) return;
    setGenerating(true);
    try {
      const response = await axios.post(`${API_URL}/demand-forecasts/generate`, {
        productId: selectedProduct
      });
      console.log('=== GENERATE FORECAST RESPONSE ===');
      console.log('Full response:', response.data);
      console.log('Forecast:', response.data.forecast);
      console.log('AI Response:', response.data.aiResponse);
      if (response.data.forecast) {
        fetchForecasts();
        const itemWithAI = { ...response.data.forecast, aiResponse: response.data.aiResponse };
        console.log('Setting selectedItem to:', itemWithAI);
        setSelectedItem(itemWithAI);
        setShowDetailModal(true);
      } else {
        console.log('No forecast in response!');
        alert('No forecast generated. Check console for details.');
      }
    } catch (error) {
      console.error('Error generating forecast:', error);
      alert('Error generating forecast: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedItem && !showDetailModal) {
        await axios.put(`${API_URL}/demand-forecasts/${selectedItem.id}`, formData);
      } else {
        await axios.post(`${API_URL}/demand-forecasts`, formData);
      }
      fetchForecasts();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this forecast?')) {
      try {
        await axios.delete(`${API_URL}/demand-forecasts/${id}`);
        fetchForecasts();
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
      forecast_period: item.forecast_period,
      predicted_demand: item.predicted_demand,
      confidence_level: item.confidence_level,
      seasonality_factor: item.seasonality_factor,
      trend_direction: item.trend_direction,
      recommended_price: item.recommended_price,
      current_price: item.current_price,
      factors: item.factors || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      product_name: '',
      forecast_period: '',
      predicted_demand: '',
      confidence_level: '',
      seasonality_factor: '',
      trend_direction: 'stable',
      recommended_price: '',
      current_price: '',
      factors: ''
    });
    setSelectedItem(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getTrendBadge = (trend) => {
    const badges = {
      'increasing': 'badge badge-increasing',
      'decreasing': 'badge badge-decreasing',
      'stable': 'badge badge-stable',
      'seasonal': 'badge badge-seasonal'
    };
    return badges[trend] || 'badge badge-stable';
  };

  const getConfidenceColor = (level) => {
    if (level >= 80) return '#00c853';
    if (level >= 60) return '#ffc107';
    return '#ff6b6b';
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
        <h1>AI Demand Forecaster</h1>
        <button className="btn btn-primary btn-small" onClick={openNewModal}>
          + New Forecast
        </button>
      </div>

      {/* AI Generate Section */}
      <div className="ai-generate-section">
        <h3>Generate AI Forecast</h3>
        <div className="generate-controls">
          <select
            className="form-control"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ maxWidth: '300px' }}
          >
            <option value="">Select a product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-small"
            onClick={handleGenerateForecast}
            disabled={!selectedProduct || generating}
          >
            {generating ? 'Generating...' : 'Generate Forecast'}
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-value">{forecasts.filter(f => f.trend_direction === 'increasing').length}</div>
          <div className="stat-label">Increasing Demand</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{forecasts.filter(f => f.trend_direction === 'seasonal').length}</div>
          <div className="stat-label">Seasonal</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{forecasts.filter(f => f.trend_direction === 'decreasing').length}</div>
          <div className="stat-label">Decreasing</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">{forecasts.length}</div>
          <div className="stat-label">Total Forecasts</div>
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
                <th>Period</th>
                <th>Predicted Demand</th>
                <th>Confidence</th>
                <th>Seasonality</th>
                <th>Trend</th>
                <th>Recommended Price</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map((item) => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  <td>{item.product_name}</td>
                  <td>{item.forecast_period}</td>
                  <td>{item.predicted_demand?.toLocaleString()} units</td>
                  <td>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${item.confidence_level}%`,
                          backgroundColor: getConfidenceColor(item.confidence_level)
                        }}
                      />
                      <span>{item.confidence_level}%</span>
                    </div>
                  </td>
                  <td>{parseFloat(item.seasonality_factor).toFixed(2)}x</td>
                  <td><span className={getTrendBadge(item.trend_direction)}>{item.trend_direction}</span></td>
                  <td>${parseFloat(item.recommended_price).toFixed(2)}</td>
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
            <h2>Demand Forecast Details</h2>

            <div className="detail-grid">
              <div className="detail-item">
                <label>Product</label>
                <div className="value">{selectedItem.product_name}</div>
              </div>
              <div className="detail-item">
                <label>Forecast Period</label>
                <div className="value">{selectedItem.forecast_period}</div>
              </div>
              <div className="detail-item">
                <label>Predicted Demand</label>
                <div className="value">{selectedItem.predicted_demand?.toLocaleString()} units</div>
              </div>
              <div className="detail-item">
                <label>Confidence Level</label>
                <div className="value" style={{ color: getConfidenceColor(selectedItem.confidence_level) }}>
                  {selectedItem.confidence_level}%
                </div>
              </div>
              <div className="detail-item">
                <label>Seasonality Factor</label>
                <div className="value">{parseFloat(selectedItem.seasonality_factor).toFixed(2)}x</div>
              </div>
              <div className="detail-item">
                <label>Trend Direction</label>
                <div className="value">
                  <span className={getTrendBadge(selectedItem.trend_direction)}>{selectedItem.trend_direction}</span>
                </div>
              </div>
              <div className="detail-item">
                <label>Current Price</label>
                <div className="value">${parseFloat(selectedItem.current_price).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <label>Recommended Price</label>
                <div className="value price-up">${parseFloat(selectedItem.recommended_price).toFixed(2)}</div>
              </div>
            </div>

            {selectedItem.factors && (
              <div className="detail-item" style={{ marginTop: '20px' }}>
                <label>Key Factors</label>
                <div className="value">{selectedItem.factors}</div>
              </div>
            )}

            {/* AI Insights Section */}
            <div className="ai-insights-section" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#667eea' }}>AI Demand Analysis</h3>
                <button
                  className="btn btn-primary btn-small"
                  onClick={handleAnalyzeForecast}
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
                  <p>AI is analyzing demand forecast...</p>
                </div>
              )}

              {!analyzingItem && (aiInsights || selectedItem.ai_analysis || selectedItem.aiResponse) && (
                <div className="ai-analysis-container">
                  <div className="ai-analysis-header">
                    <span className="ai-icon">🤖</span>
                    <h3>AI Detailed Analysis</h3>
                    <span className="ai-badge">Powered by Claude</span>
                  </div>
                  <div className="ai-output-professional">
                    {(() => {
                      const insights = aiInsights || parseAIAnalysis(selectedItem.aiResponse || selectedItem.ai_analysis);
                      if (insights && !insights.raw) {
                        const da = insights.detailed_analysis || insights;
                        return (
                          <div className="ai-structured-output">
                            {/* Demand Summary Card */}
                            <div className="ai-summary-card">
                              <div className="summary-item">
                                <span className="summary-icon">📊</span>
                                <div>
                                  <div className="summary-label">Predicted Demand</div>
                                  <div className="summary-value">
                                    {(insights.predicted_demand || selectedItem.predicted_demand)?.toLocaleString()} units
                                  </div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">🎯</span>
                                <div>
                                  <div className="summary-label">Confidence Score</div>
                                  <div className="summary-value">
                                    {insights.confidence_level || insights.confidence_score || selectedItem.confidence_level}%
                                  </div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">📈</span>
                                <div>
                                  <div className="summary-label">Trend Direction</div>
                                  <div className="summary-value capitalize">
                                    {insights.trend_direction || selectedItem.trend_direction}
                                  </div>
                                </div>
                              </div>
                              <div className="summary-item">
                                <span className="summary-icon">💰</span>
                                <div>
                                  <div className="summary-label">Recommended Price</div>
                                  <div className="summary-value">
                                    ${parseFloat(insights.recommended_price || selectedItem.recommended_price || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Seasonality Factor */}
                            <div className="ai-section-card seasonality">
                              <div className="section-header">
                                <span className="section-icon">🌡️</span>
                                <h4>Seasonality Factor</h4>
                              </div>
                              <div className="seasonality-display">
                                <div className="seasonality-value">
                                  {parseFloat(insights.seasonality_factor || selectedItem.seasonality_factor || 1).toFixed(2)}x
                                </div>
                                <div className="seasonality-bar">
                                  <div className="seasonality-fill" style={{
                                    width: `${Math.min((insights.seasonality_factor || selectedItem.seasonality_factor || 1) * 50, 100)}%`
                                  }}></div>
                                </div>
                              </div>
                            </div>

                            {/* Key Factors */}
                            {(insights.factors || selectedItem.factors) && (
                              <div className="ai-section-card strategy">
                                <div className="section-header">
                                  <span className="section-icon">📋</span>
                                  <h4>Key Factors</h4>
                                </div>
                                <p className="strategy-text">{insights.factors || selectedItem.factors}</p>
                              </div>
                            )}

                            {/* Demand Drivers */}
                            {da.demand_drivers && da.demand_drivers.length > 0 && (
                              <div className="ai-section-card drivers">
                                <div className="section-header">
                                  <span className="section-icon">🚀</span>
                                  <h4>Demand Drivers</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {da.demand_drivers.map((d, i) => (
                                    <li key={i} className="driver-item">
                                      <span className="bullet">▸</span>
                                      <span>{d}</span>
                                    </li>
                                  ))}
                                </ul>
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

                            {/* Opportunities */}
                            {da.opportunities && da.opportunities.length > 0 && (
                              <div className="ai-section-card opportunities">
                                <div className="section-header">
                                  <span className="section-icon">💡</span>
                                  <h4>Opportunities</h4>
                                </div>
                                <ul className="ai-list-professional">
                                  {da.opportunities.map((o, i) => (
                                    <li key={i} className="opportunity-item">
                                      <span className="bullet">▸</span>
                                      <span>{o}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Pricing Strategy */}
                            {da.pricing_strategy && (
                              <div className="ai-section-card strategy">
                                <div className="section-header">
                                  <span className="section-icon">🎯</span>
                                  <h4>Recommended Pricing Strategy</h4>
                                </div>
                                <p className="strategy-text">{da.pricing_strategy}</p>
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
                  <div>Click "Get AI Insights" to analyze this forecast with AI</div>
                  <div style={{ fontSize: '13px', marginTop: '8px' }}>
                    Get demand drivers, risk factors, opportunities, and pricing strategy recommendations
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
            <h2>{selectedItem ? 'Edit' : 'Add'} Demand Forecast</h2>
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
                  <label>Forecast Period</label>
                  <input
                    type="text"
                    placeholder="e.g., Q1 2024"
                    value={formData.forecast_period}
                    onChange={(e) => setFormData({ ...formData, forecast_period: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Predicted Demand (units)</label>
                  <input
                    type="number"
                    value={formData.predicted_demand}
                    onChange={(e) => setFormData({ ...formData, predicted_demand: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Confidence Level (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.confidence_level}
                    onChange={(e) => setFormData({ ...formData, confidence_level: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Seasonality Factor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.seasonality_factor}
                    onChange={(e) => setFormData({ ...formData, seasonality_factor: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Trend Direction</label>
                <select
                  className="form-control"
                  value={formData.trend_direction}
                  onChange={(e) => setFormData({ ...formData, trend_direction: e.target.value })}
                >
                  <option value="increasing">Increasing</option>
                  <option value="decreasing">Decreasing</option>
                  <option value="stable">Stable</option>
                  <option value="seasonal">Seasonal</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Current Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_price}
                    onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Recommended Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.recommended_price}
                    onChange={(e) => setFormData({ ...formData, recommended_price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Key Factors</label>
                <textarea
                  className="form-control"
                  value={formData.factors}
                  onChange={(e) => setFormData({ ...formData, factors: e.target.value })}
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

export default DemandForecasts;
