import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = 'http://localhost:3001/api';

const CompetitorTracking = () => {
  const [trackingData, setTrackingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [formData, setFormData] = useState({
    competitor_name: '',
    product_name: '',
    previous_price: '',
    current_price: '',
    alert_status: 'normal',
    notes: ''
  });

  useEffect(() => {
    fetchTrackingData();
  }, []);

  const fetchTrackingData = async () => {
    try {
      const response = await axios.get(`${API_URL}/competitor-tracking`);
      setTrackingData(response.data);
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
    setAiAnalysis(null);
  };

  const handleAnalyze = async () => {
    if (!selectedItem) return;
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/competitor-tracking/analyze`, {
        trackingId: selectedItem.id
      });
      setAiAnalysis(response.data.analysis);
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
        await axios.put(`${API_URL}/competitor-tracking/${selectedItem.id}`, formData);
      } else {
        await axios.post(`${API_URL}/competitor-tracking`, formData);
      }
      fetchTrackingData();
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await axios.delete(`${API_URL}/competitor-tracking/${id}`);
        fetchTrackingData();
        setShowDetailModal(false);
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setFormData({
      competitor_name: item.competitor_name,
      product_name: item.product_name,
      previous_price: item.previous_price,
      current_price: item.current_price,
      alert_status: item.alert_status,
      notes: item.notes || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      competitor_name: '',
      product_name: '',
      previous_price: '',
      current_price: '',
      alert_status: 'normal',
      notes: ''
    });
    setSelectedItem(null);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getAlertBadge = (status) => {
    const badges = {
      'alert': 'badge badge-high',
      'price_drop': 'badge badge-decreasing',
      'price_increase': 'badge badge-increasing',
      'normal': 'badge badge-stable'
    };
    return badges[status] || 'badge badge-stable';
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
        <h1>AI Competitor Price Tracker</h1>
        <button className="btn btn-primary btn-small" onClick={openNewModal}>
          + New Tracking
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card red">
          <div className="stat-value">{trackingData.filter(t => t.alert_status === 'alert').length}</div>
          <div className="stat-label">Price Alerts</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{trackingData.filter(t => t.alert_status === 'price_drop').length}</div>
          <div className="stat-label">Price Drops</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{trackingData.filter(t => t.alert_status === 'price_increase').length}</div>
          <div className="stat-label">Price Increases</div>
        </div>
        <div className="stat-card purple">
          <div className="stat-value">{trackingData.length}</div>
          <div className="stat-label">Total Tracked</div>
        </div>
      </div>

      <div className="data-table-container">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Competitor</th>
                <th>Product</th>
                <th>Previous Price</th>
                <th>Current Price</th>
                <th>Change</th>
                <th>Status</th>
                <th>Tracked Date</th>
              </tr>
            </thead>
            <tbody>
              {trackingData.map((item) => (
                <tr key={item.id} onClick={() => handleRowClick(item)}>
                  <td>{item.competitor_name}</td>
                  <td>{item.product_name}</td>
                  <td>${parseFloat(item.previous_price).toFixed(2)}</td>
                  <td>${parseFloat(item.current_price).toFixed(2)}</td>
                  <td className={parseFloat(item.price_change) < 0 ? 'price-down' : 'price-up'}>
                    {parseFloat(item.price_change) > 0 ? '+' : ''}${parseFloat(item.price_change).toFixed(2)}
                    ({parseFloat(item.change_percentage).toFixed(1)}%)
                  </td>
                  <td><span className={getAlertBadge(item.alert_status)}>{item.alert_status}</span></td>
                  <td>{new Date(item.tracked_date).toLocaleDateString()}</td>
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
            <h2>Price Change Details</h2>

            <div className="detail-grid">
              <div className="detail-item">
                <label>Competitor</label>
                <div className="value">{selectedItem.competitor_name}</div>
              </div>
              <div className="detail-item">
                <label>Product</label>
                <div className="value">{selectedItem.product_name}</div>
              </div>
              <div className="detail-item">
                <label>Previous Price</label>
                <div className="value">${parseFloat(selectedItem.previous_price).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <label>Current Price</label>
                <div className="value">${parseFloat(selectedItem.current_price).toFixed(2)}</div>
              </div>
              <div className="detail-item">
                <label>Price Change</label>
                <div className={`value ${parseFloat(selectedItem.price_change) < 0 ? 'price-down' : 'price-up'}`}>
                  {parseFloat(selectedItem.price_change) > 0 ? '+' : ''}${parseFloat(selectedItem.price_change).toFixed(2)}
                  ({parseFloat(selectedItem.change_percentage).toFixed(1)}%)
                </div>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <div className="value">
                  <span className={getAlertBadge(selectedItem.alert_status)}>{selectedItem.alert_status}</span>
                </div>
              </div>
            </div>

            {selectedItem.notes && (
              <div className="detail-item" style={{ marginTop: '20px' }}>
                <label>Notes</label>
                <div className="value">{selectedItem.notes}</div>
              </div>
            )}

            {!aiAnalysis && !analyzing && (
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-primary btn-small" onClick={handleAnalyze}>
                  Generate AI Strategic Analysis
                </button>
              </div>
            )}
            {analyzing && (
              <div className="ai-analysis-container" style={{ marginTop: '20px' }}>
                <div className="ai-analysis-header">
                  <span className="ai-icon">🤖</span>
                  <h3>AI Strategic Analysis</h3>
                  <span className="ai-badge">Analyzing...</span>
                </div>
                <div className="ai-output-professional">
                  <div className="loading">Analyzing competitive landscape and generating strategic recommendations...</div>
                </div>
              </div>
            )}
            {aiAnalysis && (
              <div className="ai-analysis-container" style={{ marginTop: '20px' }}>
                <div className="ai-analysis-header">
                  <span className="ai-icon">🎯</span>
                  <h3>AI Strategic Analysis</h3>
                  <span className="ai-badge">Powered by Claude</span>
                </div>
                <div className="ai-output-professional">
                  {(() => {
                    const parsed = parseAIAnalysis(aiAnalysis);
                    if (parsed) {
                      return (
                        <div className="ai-structured-output">
                          {/* Impact Assessment */}
                          {parsed.impact_assessment && (
                            <div className="ai-section-card risks">
                              <div className="section-header">
                                <span className="section-icon">⚡</span>
                                <h4>Impact Assessment</h4>
                              </div>
                              <div className="ai-summary-card" style={{ marginBottom: '12px' }}>
                                <div className="summary-item">
                                  <span className="summary-icon">📊</span>
                                  <div>
                                    <div className="summary-label">Severity Level</div>
                                    <div className="summary-value">
                                      <span className={`badge badge-${parsed.impact_assessment.severity}`}>
                                        {parsed.impact_assessment.severity}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <ul className="ai-list-professional">
                                <li className="driver-item">
                                  <span className="bullet">▸</span>
                                  <span><strong>Market Impact:</strong> {parsed.impact_assessment.market_impact}</span>
                                </li>
                                <li className="driver-item">
                                  <span className="bullet">▸</span>
                                  <span><strong>Competitive Position:</strong> {parsed.impact_assessment.competitive_position}</span>
                                </li>
                              </ul>
                            </div>
                          )}

                          {/* Recommended Actions */}
                          {parsed.recommended_actions && parsed.recommended_actions.length > 0 && (
                            <div className="ai-section-card drivers">
                              <div className="section-header">
                                <span className="section-icon">🚀</span>
                                <h4>Recommended Actions</h4>
                              </div>
                              <ul className="ai-list-professional">
                                {parsed.recommended_actions.map((action, idx) => (
                                  <li key={idx} className="driver-item">
                                    <span className={`badge badge-${action.priority === 'immediate' ? 'high' : action.priority === 'short-term' ? 'medium' : 'low'}`} style={{ marginRight: '10px' }}>
                                      {action.priority}
                                    </span>
                                    <div>
                                      <strong>{action.action}</strong>
                                      <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '13px' }}>{action.expected_outcome}</p>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Price Recommendation */}
                          {parsed.price_recommendation && (
                            <div className="ai-section-card strategy">
                              <div className="section-header">
                                <span className="section-icon">💰</span>
                                <h4>Price Recommendation</h4>
                              </div>
                              <div className="ai-summary-card">
                                <div className="summary-item" style={{ flex: '0 0 auto' }}>
                                  <span className="summary-icon">🎯</span>
                                  <div>
                                    <div className="summary-label">Suggested Price</div>
                                    <div className="summary-value" style={{ color: '#00c853', fontSize: '24px' }}>
                                      ${parsed.price_recommendation.suggested_price}
                                    </div>
                                  </div>
                                </div>
                                <div className="summary-item" style={{ flex: 1 }}>
                                  <div>
                                    <div className="summary-label">Timing</div>
                                    <div className="summary-value">{parsed.price_recommendation.timing}</div>
                                  </div>
                                </div>
                              </div>
                              <p className="strategy-text" style={{ marginTop: '12px' }}>
                                {parsed.price_recommendation.reasoning}
                              </p>
                            </div>
                          )}

                          {/* Risk Analysis */}
                          {parsed.risk_analysis && (
                            <div className="ai-section-card opportunities">
                              <div className="section-header">
                                <span className="section-icon">⚠️</span>
                                <h4>Risk Analysis</h4>
                              </div>
                              <ul className="ai-list-professional">
                                <li className="risk-item">
                                  <span className="bullet">▸</span>
                                  <span><strong>If We Match:</strong> {parsed.risk_analysis.if_we_match}</span>
                                </li>
                                <li className="risk-item">
                                  <span className="bullet">▸</span>
                                  <span><strong>If We Don't Match:</strong> {parsed.risk_analysis.if_we_dont_match}</span>
                                </li>
                              </ul>
                              <div className="ai-section-card" style={{ marginTop: '12px', borderLeft: '4px solid #00c853', background: 'rgba(0, 200, 83, 0.1)' }}>
                                <div className="section-header">
                                  <span className="section-icon">✅</span>
                                  <h4>Best Strategy</h4>
                                </div>
                                <p className="strategy-text">{parsed.risk_analysis.best_strategy}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="ai-raw-output">
                        <pre>{typeof aiAnalysis === 'string' ? aiAnalysis : JSON.stringify(aiAnalysis, null, 2)}</pre>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

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
            <h2>{selectedItem ? 'Edit' : 'Add'} Price Tracking</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Competitor Name</label>
                <input
                  type="text"
                  value={formData.competitor_name}
                  onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })}
                  required
                />
              </div>
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
                  <label>Previous Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.previous_price}
                    onChange={(e) => setFormData({ ...formData, previous_price: e.target.value })}
                    required
                  />
                </div>
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
              </div>
              <div className="form-group">
                <label>Alert Status</label>
                <select
                  className="form-control"
                  value={formData.alert_status}
                  onChange={(e) => setFormData({ ...formData, alert_status: e.target.value })}
                >
                  <option value="normal">Normal</option>
                  <option value="price_drop">Price Drop</option>
                  <option value="price_increase">Price Increase</option>
                  <option value="alert">Alert</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  className="form-control"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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

export default CompetitorTracking;
