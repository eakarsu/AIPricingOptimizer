import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = 'http://localhost:3001/api';

const PriceTracker = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('products');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    url: '',
    current_price: '',
    original_price: '',
    image_url: '',
    category_id: '',
    store_id: '',
  });
  const [alertForm, setAlertForm] = useState({
    product_id: '',
    target_price: '',
    alert_type: 'below',
  });

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsRes, categoriesRes, storesRes, alertsRes] = await Promise.all([
        axios.get(`${API_URL}/price-tracker`, { headers }),
        axios.get(`${API_URL}/price-tracker-categories`, { headers }),
        axios.get(`${API_URL}/price-tracker-stores`, { headers }),
        axios.get(`${API_URL}/price-tracker-alerts`, { headers }),
      ]);
      setItems(itemsRes.data);
      setCategories(categoriesRes.data);
      setStores(storesRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowModal(true);
    setAiResult(null);
  };

  const handleEdit = () => {
    setFormData({
      name: selectedItem.name,
      description: selectedItem.description || '',
      url: selectedItem.url || '',
      current_price: selectedItem.current_price,
      original_price: selectedItem.original_price || '',
      image_url: selectedItem.image_url || '',
      category_id: selectedItem.category_id || '',
      store_id: selectedItem.store_id || '',
    });
    setEditMode(true);
    setShowForm(true);
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await axios.delete(`${API_URL}/price-tracker/${selectedItem.id}`, { headers });
        setItems(items.filter((i) => i.id !== selectedItem.id));
        setShowModal(false);
        setSelectedItem(null);
      } catch (error) {
        console.error('Failed to delete item:', error);
      }
    }
  };

  const handleNewItem = () => {
    setFormData({
      name: '',
      description: '',
      url: '',
      current_price: '',
      original_price: '',
      image_url: '',
      category_id: '',
      store_id: '',
    });
    setEditMode(false);
    setShowForm(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        const response = await axios.put(`${API_URL}/price-tracker/${selectedItem.id}`, formData, { headers });
        setItems(items.map((i) => (i.id === selectedItem.id ? response.data : i)));
      } else {
        const response = await axios.post(`${API_URL}/price-tracker`, formData, { headers });
        setItems([response.data, ...items]);
      }
      setShowForm(false);
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Failed to save item:', error);
    }
  };

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/price-tracker-alerts`, alertForm, { headers });
      loadData();
      setAlertForm({ product_id: '', target_price: '', alert_type: 'below' });
    } catch (error) {
      console.error('Failed to create alert:', error);
    }
  };

  const handleDeleteAlert = async (alertId) => {
    if (window.confirm('Delete this alert?')) {
      try {
        await axios.delete(`${API_URL}/price-tracker-alerts/${alertId}`, { headers });
        setAlerts(alerts.filter((a) => a.id !== alertId));
      } catch (error) {
        console.error('Failed to delete alert:', error);
      }
    }
  };

  const handleAIAnalysis = async (type) => {
    setAiLoading(true);
    setAiResult(null);
    try {
      let response;
      if (type === 'deal') {
        response = await axios.post(`${API_URL}/price-tracker/ai/analyze-deal`, { productId: selectedItem.id }, { headers });
      } else if (type === 'predict') {
        response = await axios.post(`${API_URL}/price-tracker/ai/predict-price`, { productId: selectedItem.id }, { headers });
      }
      setAiResult(response.data);
    } catch (error) {
      console.error('AI analysis failed:', error);
      setAiResult({ error: 'Failed to get AI analysis. Please try again.' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleGetRecommendations = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const response = await axios.get(`${API_URL}/price-tracker/ai/recommendations`, { headers });
      setAiResult(response.data);
    } catch (error) {
      console.error('AI recommendations failed:', error);
      setAiResult({ error: 'Failed to get recommendations.' });
    } finally {
      setAiLoading(false);
    }
  };

  const calculateDiscount = (original, current) => {
    if (!original || original <= current) return null;
    return (((original - current) / original) * 100).toFixed(0);
  };

  // Format AI response into readable sections
  const formatAIResponse = (text) => {
    if (!text) return null;

    const sections = [];
    const lines = text.split('\n');
    let currentSection = { title: '', content: [] };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check for headers (##, ###, or numbered items like "1.")
      if (trimmed.match(/^#{1,3}\s/) || trimmed.match(/^\*\*[^*]+\*\*:?$/)) {
        if (currentSection.content.length > 0 || currentSection.title) {
          sections.push({ ...currentSection });
        }
        currentSection = {
          title: trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, ''),
          content: []
        };
      } else {
        currentSection.content.push(trimmed);
      }
    });

    if (currentSection.content.length > 0 || currentSection.title) {
      sections.push(currentSection);
    }

    return sections;
  };

  const styles = {
    pageHeader: {
      marginBottom: '24px',
    },
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    },
    statCard: {
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(139, 92, 246, 0.2)',
    },
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#a78bfa',
    },
    statLabel: {
      fontSize: '14px',
      color: '#9ca3af',
      marginTop: '4px',
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      paddingBottom: '16px',
    },
    tab: {
      padding: '10px 24px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s',
    },
    tabActive: {
      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      color: 'white',
    },
    tabInactive: {
      background: 'rgba(255,255,255,0.05)',
      color: '#9ca3af',
    },
    card: {
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.1)',
      overflow: 'hidden',
    },
    cardHeader: {
      padding: '20px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#f3f4f6',
    },
    cardBody: {
      padding: '24px',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
    },
    th: {
      textAlign: 'left',
      padding: '12px 16px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#9ca3af',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    td: {
      padding: '16px',
      fontSize: '14px',
      color: '#e5e7eb',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    tr: {
      cursor: 'pointer',
      transition: 'background 0.2s',
    },
    priceGreen: {
      color: '#10b981',
      fontWeight: '600',
    },
    priceStrike: {
      color: '#6b7280',
      textDecoration: 'line-through',
      fontSize: '13px',
    },
    badge: {
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
    },
    badgeGreen: {
      background: 'rgba(16, 185, 129, 0.15)',
      color: '#10b981',
    },
    badgeYellow: {
      background: 'rgba(245, 158, 11, 0.15)',
      color: '#f59e0b',
    },
    btn: {
      padding: '10px 20px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s',
    },
    btnPrimary: {
      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      color: 'white',
    },
    btnSecondary: {
      background: 'rgba(255,255,255,0.1)',
      color: '#e5e7eb',
    },
    btnDanger: {
      background: 'rgba(239, 68, 68, 0.15)',
      color: '#f87171',
    },
    btnSmall: {
      padding: '6px 14px',
      fontSize: '13px',
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    },
    modalContent: {
      background: '#1f2937',
      borderRadius: '16px',
      width: '100%',
      maxWidth: '640px',
      maxHeight: '85vh',
      overflow: 'auto',
      border: '1px solid rgba(255,255,255,0.1)',
    },
    modalHeader: {
      padding: '24px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#f3f4f6',
    },
    modalClose: {
      background: 'none',
      border: 'none',
      color: '#9ca3af',
      fontSize: '24px',
      cursor: 'pointer',
    },
    modalBody: {
      padding: '24px',
    },
    detailGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      marginBottom: '24px',
    },
    detailItem: {
      background: 'rgba(255,255,255,0.03)',
      padding: '16px',
      borderRadius: '10px',
    },
    detailLabel: {
      fontSize: '12px',
      color: '#9ca3af',
      marginBottom: '6px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    detailValue: {
      fontSize: '16px',
      color: '#f3f4f6',
      fontWeight: '500',
    },
    aiSection: {
      marginTop: '24px',
      paddingTop: '24px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    },
    aiSectionTitle: {
      fontSize: '16px',
      fontWeight: '600',
      color: '#a78bfa',
      marginBottom: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },
    aiButtons: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
    },
    aiResult: {
      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08))',
      borderRadius: '12px',
      padding: '24px',
      border: '1px solid rgba(139, 92, 246, 0.2)',
    },
    aiResultHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
      paddingBottom: '16px',
      borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
    },
    aiResultBadge: {
      background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      color: 'white',
      padding: '6px 14px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: '600',
    },
    aiResultModel: {
      color: '#9ca3af',
      fontSize: '13px',
    },
    aiResultContent: {
      color: '#e5e7eb',
      lineHeight: '1.7',
    },
    aiResultSection: {
      marginBottom: '20px',
    },
    aiResultSectionTitle: {
      fontSize: '15px',
      fontWeight: '600',
      color: '#c4b5fd',
      marginBottom: '10px',
    },
    aiResultText: {
      fontSize: '14px',
      color: '#d1d5db',
      lineHeight: '1.8',
    },
    aiResultTimestamp: {
      marginTop: '20px',
      paddingTop: '16px',
      borderTop: '1px solid rgba(139, 92, 246, 0.2)',
      color: '#6b7280',
      fontSize: '12px',
      textAlign: 'right',
    },
    formGroup: {
      marginBottom: '20px',
    },
    formLabel: {
      display: 'block',
      fontSize: '14px',
      fontWeight: '500',
      color: '#d1d5db',
      marginBottom: '8px',
    },
    formInput: {
      width: '100%',
      padding: '12px 16px',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: '#f3f4f6',
      fontSize: '14px',
      outline: 'none',
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
    },
    formActions: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px',
    },
    loading: {
      textAlign: 'center',
      padding: '40px',
      color: '#9ca3af',
    },
    spinner: {
      width: '32px',
      height: '32px',
      border: '3px solid rgba(139, 92, 246, 0.2)',
      borderTopColor: '#8b5cf6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto 16px',
    },
    alertForm: {
      display: 'flex',
      gap: '12px',
      marginBottom: '24px',
      flexWrap: 'wrap',
      padding: '20px',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.05)',
    },
    topDealsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    },
    topDealCard: {
      background: 'rgba(16, 185, 129, 0.08)',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid rgba(16, 185, 129, 0.2)',
    },
  };

  return (
    <Layout>
      <div style={styles.pageHeader}>
        <h1 className="page-title">AI Price Tracker</h1>
        <p style={{ color: '#9ca3af', marginTop: '8px' }}>Track e-commerce prices and get AI-powered deal analysis</p>
      </div>

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{items.length}</div>
          <div style={styles.statLabel}>Products Tracked</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{alerts.length}</div>
          <div style={styles.statLabel}>Active Alerts</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{categories.length}</div>
          <div style={styles.statLabel}>Categories</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stores.length}</div>
          <div style={styles.statLabel}>Stores</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['products', 'alerts', 'ai'].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setAiResult(null); }}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : styles.tabInactive),
            }}
          >
            {tab === 'products' && `Tracked Products (${items.length})`}
            {tab === 'alerts' && `Price Alerts (${alerts.length})`}
            {tab === 'ai' && 'AI Recommendations'}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Tracked Products</h3>
            <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={handleNewItem}>
              + Add Product
            </button>
          </div>
          <div style={styles.cardBody}>
            {loading ? (
              <div style={styles.loading}>
                <div style={styles.spinner}></div>
                Loading products...
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Category</th>
                    <th style={styles.th}>Store</th>
                    <th style={styles.th}>Current Price</th>
                    <th style={styles.th}>Original</th>
                    <th style={styles.th}>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      style={styles.tr}
                      onClick={() => handleRowClick(item)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={styles.td}>{item.name}</td>
                      <td style={styles.td}>{item.category_name || '-'}</td>
                      <td style={styles.td}>{item.store_name || '-'}</td>
                      <td style={{ ...styles.td, ...styles.priceGreen }}>${parseFloat(item.current_price).toFixed(2)}</td>
                      <td style={styles.td}>
                        {item.original_price ? (
                          <span style={styles.priceStrike}>${parseFloat(item.original_price).toFixed(2)}</span>
                        ) : '-'}
                      </td>
                      <td style={styles.td}>
                        {calculateDiscount(item.original_price, item.current_price) && (
                          <span style={{ ...styles.badge, ...styles.badgeGreen }}>
                            {calculateDiscount(item.original_price, item.current_price)}% OFF
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Price Alerts</h3>
          </div>
          <div style={styles.cardBody}>
            <form onSubmit={handleCreateAlert} style={styles.alertForm}>
              <select
                value={alertForm.product_id}
                onChange={(e) => setAlertForm({ ...alertForm, product_id: e.target.value })}
                required
                style={{ ...styles.formInput, flex: '2', minWidth: '200px' }}
              >
                <option value="">Select Product</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} - ${item.current_price}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Target Price"
                value={alertForm.target_price}
                onChange={(e) => setAlertForm({ ...alertForm, target_price: e.target.value })}
                required
                style={{ ...styles.formInput, flex: '1', minWidth: '120px' }}
              />
              <select
                value={alertForm.alert_type}
                onChange={(e) => setAlertForm({ ...alertForm, alert_type: e.target.value })}
                style={{ ...styles.formInput, flex: '1', minWidth: '130px' }}
              >
                <option value="below">Price Below</option>
                <option value="above">Price Above</option>
              </select>
              <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }}>Create Alert</button>
            </form>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Product</th>
                  <th style={styles.th}>Current Price</th>
                  <th style={styles.th}>Target Price</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id} style={styles.tr}>
                    <td style={styles.td}>{alert.product_name}</td>
                    <td style={{ ...styles.td, ...styles.priceGreen }}>${parseFloat(alert.current_price).toFixed(2)}</td>
                    <td style={styles.td}>
                      <span style={{ color: '#f59e0b', fontWeight: '600' }}>${parseFloat(alert.target_price).toFixed(2)}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...styles.badgeYellow }}>
                        {alert.alert_type === 'below' ? 'Price Below' : 'Price Above'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={{ ...styles.btn, ...styles.btnDanger, ...styles.btnSmall }}
                        onClick={() => handleDeleteAlert(alert.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Recommendations Tab */}
      {activeTab === 'ai' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>AI Recommendations</h3>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleGetRecommendations}
              disabled={aiLoading}
            >
              {aiLoading ? 'Analyzing...' : 'Get AI Recommendations'}
            </button>
          </div>
          <div style={styles.cardBody}>
            {aiLoading && (
              <div style={styles.loading}>
                <div style={styles.spinner}></div>
                AI is analyzing your tracked products...
              </div>
            )}

            {aiResult && !aiResult.error && (
              <>
                {aiResult.topDeals && aiResult.topDeals.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ color: '#10b981', marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>
                      Top Deals Found
                    </h4>
                    <div style={styles.topDealsGrid}>
                      {aiResult.topDeals.slice(0, 6).map((deal, i) => (
                        <div key={i} style={styles.topDealCard}>
                          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#f3f4f6' }}>{deal.name}</div>
                          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
                            {deal.store_name || deal.category_name}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#10b981', fontWeight: '700', fontSize: '18px' }}>
                              ${parseFloat(deal.current_price).toFixed(2)}
                            </span>
                            <span style={{ ...styles.badge, ...styles.badgeGreen }}>
                              {parseFloat(deal.discount_percent).toFixed(0)}% OFF
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.aiResult}>
                  <div style={styles.aiResultHeader}>
                    <span style={styles.aiResultBadge}>AI Analysis</span>
                    <span style={styles.aiResultModel}>Model: {aiResult.model}</span>
                  </div>
                  <div style={styles.aiResultContent}>
                    {formatAIResponse(aiResult.analysis)?.map((section, idx) => (
                      <div key={idx} style={styles.aiResultSection}>
                        {section.title && (
                          <div style={styles.aiResultSectionTitle}>{section.title}</div>
                        )}
                        {section.content.map((line, lineIdx) => (
                          <p key={lineIdx} style={styles.aiResultText}>{line}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div style={styles.aiResultTimestamp}>
                    Generated at {new Date(aiResult.timestamp).toLocaleString()}
                  </div>
                </div>
              </>
            )}

            {aiResult?.error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '20px', borderRadius: '12px', color: '#f87171' }}>
                {aiResult.error}
              </div>
            )}

            {!aiLoading && !aiResult && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>AI</div>
                <p>Click "Get AI Recommendations" to analyze your tracked products</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedItem && (
        <div style={styles.modal} onClick={() => setShowModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{selectedItem.name}</h2>
              <button style={styles.modalClose} onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <div style={styles.detailLabel}>Category</div>
                  <div style={styles.detailValue}>{selectedItem.category_name || 'N/A'}</div>
                </div>
                <div style={styles.detailItem}>
                  <div style={styles.detailLabel}>Store</div>
                  <div style={styles.detailValue}>{selectedItem.store_name || 'N/A'}</div>
                </div>
                <div style={styles.detailItem}>
                  <div style={styles.detailLabel}>Current Price</div>
                  <div style={{ ...styles.detailValue, color: '#10b981', fontSize: '24px' }}>
                    ${parseFloat(selectedItem.current_price).toFixed(2)}
                  </div>
                </div>
                <div style={styles.detailItem}>
                  <div style={styles.detailLabel}>Original Price</div>
                  <div style={{ ...styles.detailValue, color: '#6b7280', textDecoration: 'line-through' }}>
                    {selectedItem.original_price ? `$${parseFloat(selectedItem.original_price).toFixed(2)}` : 'N/A'}
                  </div>
                </div>
              </div>

              {selectedItem.description && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={styles.detailLabel}>Description</div>
                  <p style={{ color: '#d1d5db', lineHeight: '1.6' }}>{selectedItem.description}</p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={handleEdit}>Edit</button>
                <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={handleDelete}>Delete</button>
                {selectedItem.url && (
                  <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" style={{ ...styles.btn, ...styles.btnSecondary, textDecoration: 'none' }}>
                    View Product
                  </a>
                )}
              </div>

              <div style={styles.aiSection}>
                <div style={styles.aiSectionTitle}>
                  <span>AI Analysis</span>
                </div>
                <div style={styles.aiButtons}>
                  <button
                    style={{ ...styles.btn, ...styles.btnPrimary }}
                    onClick={() => handleAIAnalysis('deal')}
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Analyzing...' : 'Analyze Deal'}
                  </button>
                  <button
                    style={{ ...styles.btn, ...styles.btnPrimary }}
                    onClick={() => handleAIAnalysis('predict')}
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Analyzing...' : 'Predict Price'}
                  </button>
                </div>

                {aiLoading && (
                  <div style={styles.loading}>
                    <div style={styles.spinner}></div>
                    Analyzing with AI...
                  </div>
                )}

                {aiResult && !aiResult.error && (
                  <div style={styles.aiResult}>
                    <div style={styles.aiResultHeader}>
                      <span style={styles.aiResultBadge}>AI Analysis</span>
                      <span style={styles.aiResultModel}>Model: {aiResult.model}</span>
                    </div>
                    <div style={styles.aiResultContent}>
                      {formatAIResponse(aiResult.analysis)?.map((section, idx) => (
                        <div key={idx} style={styles.aiResultSection}>
                          {section.title && (
                            <div style={styles.aiResultSectionTitle}>{section.title}</div>
                          )}
                          {section.content.map((line, lineIdx) => (
                            <p key={lineIdx} style={styles.aiResultText}>{line}</p>
                          ))}
                        </div>
                      ))}
                    </div>
                    <div style={styles.aiResultTimestamp}>
                      Generated at {new Date(aiResult.timestamp).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={styles.modal} onClick={() => setShowForm(false)}>
          <div style={{ ...styles.modalContent, maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editMode ? 'Edit Product' : 'Add New Product'}</h2>
              <button style={styles.modalClose} onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <div style={styles.modalBody}>
              <form onSubmit={handleFormSubmit}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Name *</label>
                  <input
                    type="text"
                    style={styles.formInput}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Description</label>
                  <textarea
                    style={{ ...styles.formInput, minHeight: '80px', resize: 'vertical' }}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Current Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      style={styles.formInput}
                      value={formData.current_price}
                      onChange={(e) => setFormData({ ...formData, current_price: e.target.value })}
                      required
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Original Price</label>
                    <input
                      type="number"
                      step="0.01"
                      style={styles.formInput}
                      value={formData.original_price}
                      onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                    />
                  </div>
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Category</label>
                    <select
                      style={styles.formInput}
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Store</label>
                    <select
                      style={styles.formInput}
                      value={formData.store_id}
                      onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                    >
                      <option value="">Select Store</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>{store.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Product URL</label>
                  <input
                    type="url"
                    style={styles.formInput}
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  />
                </div>
                <div style={styles.formActions}>
                  <button type="button" style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }}>
                    {editMode ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
};

export default PriceTracker;
