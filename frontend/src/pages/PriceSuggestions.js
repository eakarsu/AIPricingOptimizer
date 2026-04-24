import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PriceSuggestions = () => {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState({
    product_name: '',
    current_price: '',
    suggested_price: '',
    confidence: '',
    reason: '',
    expected_impact: '',
    status: 'pending',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [dataSourcesSummary, setDataSourcesSummary] = useState(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchSuggestions();
    fetchProducts();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await axios.get(`${API_URL}/price-suggestions`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to fetch price suggestions' });
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

  const handleRowClick = async (suggestion) => {
    try {
      const response = await axios.get(`${API_URL}/price-suggestions/${suggestion.id}`);
      setSelectedSuggestion(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching suggestion details:', error);
    }
  };

  const handleNewSuggestion = () => {
    setFormData({
      product_name: '',
      current_price: '',
      suggested_price: '',
      confidence: '',
      reason: '',
      expected_impact: '',
      status: 'pending',
    });
    setSelectedProductId('');
    setDataSourcesSummary(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleAiAssist = async () => {
    if (!selectedProductId) {
      addNotification({ type: 'warning', title: 'Select Product', message: 'Please select a product first' });
      return;
    }
    setAiAssisting(true);
    setDataSourcesSummary(null);
    addNotification({ type: 'info', title: 'AI Analyzing', message: 'Gathering data from all sources...' });
    try {
      const response = await axios.post(`${API_URL}/price-suggestions/preview`, {
        productId: selectedProductId,
      });
      if (response.data.preview) {
        const preview = response.data.preview;
        setFormData({
          product_name: preview.product_name || '',
          current_price: preview.current_price || '',
          suggested_price: preview.suggested_price || '',
          confidence: preview.confidence || '',
          reason: preview.reason || '',
          expected_impact: preview.expected_impact || '',
          status: 'pending',
        });
        // Store data sources summary
        if (response.data.dataSourcesSummary) {
          setDataSourcesSummary(response.data.dataSourcesSummary);
          const ds = response.data.dataSourcesSummary;
          addNotification({
            type: 'success',
            title: 'AI Analysis Complete',
            message: `Analyzed: ${ds.competitors} competitors, ${ds.demandSignals} demand signals, ${ds.marketTrends} trends, ${ds.priceHistory} history records (${ds.dataConfidence}% confidence)`
          });
        } else {
          addNotification({ type: 'success', title: 'AI Complete', message: 'Form populated with AI suggestion' });
        }
      } else {
        addNotification({ type: 'warning', title: 'No Data', message: response.data.message || 'AI could not generate suggestion' });
      }
    } catch (error) {
      console.error('Error with AI assist:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to get AI suggestion. Check your API key.' });
    } finally {
      setAiAssisting(false);
    }
  };

  const handleProductSelect = (productId) => {
    setSelectedProductId(productId);
    setDataSourcesSummary(null); // Reset data sources when changing product
    const product = products.find(p => p.id === parseInt(productId));
    if (product) {
      setFormData(prev => ({
        ...prev,
        product_name: product.name,
        current_price: product.current_price,
        suggested_price: '',
        confidence: '',
        reason: '',
        expected_impact: '',
      }));
    }
  };

  const handleGenerateAI = async (productId) => {
    setGenerating(true);
    addNotification({ type: 'info', title: 'AI Analyzing', message: 'Gathering competitors, demand signals, trends & history...' });
    try {
      const response = await axios.post(`${API_URL}/price-suggestions/generate`, {
        productId,
      });
      if (response.data.suggestion) {
        fetchSuggestions();
        // Show detailed success message with data sources
        if (response.data.dataSourcesSummary) {
          const ds = response.data.dataSourcesSummary;
          addNotification({
            type: 'success',
            title: 'AI Suggestion Created',
            message: `Based on: ${ds.competitors} competitors, ${ds.demandSignals} demand signals, ${ds.marketTrends} trends (${ds.dataConfidence}% data confidence)`
          });
        } else {
          addNotification({ type: 'success', title: 'Generated', message: 'AI price suggestion created successfully!' });
        }
      } else {
        addNotification({ type: 'warning', title: 'No Suggestion', message: response.data.message || 'AI could not generate suggestion' });
      }
    } catch (error) {
      console.error('Error generating suggestion:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to generate AI suggestion' });
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = () => {
    setFormData({
      product_name: selectedSuggestion.product_name,
      current_price: selectedSuggestion.current_price || '',
      suggested_price: selectedSuggestion.suggested_price || '',
      confidence: selectedSuggestion.confidence || '',
      reason: selectedSuggestion.reason || '',
      expected_impact: selectedSuggestion.expected_impact || '',
      status: selectedSuggestion.status || 'pending',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this suggestion?')) {
      try {
        await axios.delete(`${API_URL}/price-suggestions/${selectedSuggestion.id}`);
        setIsDetailView(false);
        setSelectedSuggestion(null);
        fetchSuggestions();
        addNotification({ type: 'success', title: 'Deleted', message: 'Price suggestion deleted successfully' });
      } catch (error) {
        console.error('Error deleting suggestion:', error);
        addNotification({ type: 'error', title: 'Error', message: 'Failed to delete suggestion' });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/price-suggestions/${id}`)));
      fetchSuggestions();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} suggestions deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete some suggestions' });
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.put(`${API_URL}/price-suggestions/${selectedSuggestion.id}`, {
        ...selectedSuggestion,
        status: newStatus,
      });
      const response = await axios.get(`${API_URL}/price-suggestions/${selectedSuggestion.id}`);
      setSelectedSuggestion(response.data);
      fetchSuggestions();
      addNotification({ type: 'success', title: 'Updated', message: `Status changed to ${newStatus}` });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/price-suggestions/${selectedSuggestion.id}`, formData);
        const response = await axios.get(`${API_URL}/price-suggestions/${selectedSuggestion.id}`);
        setSelectedSuggestion(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'Price suggestion updated successfully' });
      } else {
        await axios.post(`${API_URL}/price-suggestions`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'Price suggestion created successfully' });
      }
      setIsModalOpen(false);
      fetchSuggestions();
    } catch (error) {
      console.error('Error saving suggestion:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to save suggestion' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const getPriceChange = (current, suggested) => {
    if (!current || !suggested) return null;
    return ((suggested - current) / current * 100).toFixed(1);
  };

  const columns = [
    { key: 'product_name', label: 'Product', sortable: true },
    {
      key: 'current_price',
      label: 'Current Price',
      sortable: true,
      render: (row) => formatCurrency(row.current_price),
    },
    {
      key: 'suggested_price',
      label: 'Suggested Price',
      sortable: true,
      render: (row) => formatCurrency(row.suggested_price),
    },
    {
      key: 'change',
      label: 'Change',
      render: (row) => {
        const change = getPriceChange(row.current_price, row.suggested_price);
        return change ? (
          <span className={change > 0 ? 'price-up' : 'price-down'}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        ) : '-';
      },
    },
    {
      key: 'confidence',
      label: 'Confidence',
      sortable: true,
      render: (row) => `${row.confidence}%`,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.status}`}>{row.status}</span>,
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Price Suggestion' : 'New Price Suggestion'}</h2>
          <form onSubmit={handleSubmit}>
            {!isEditing && (
              <div className="form-group">
                <label>Select Product (for AI Assist)</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <select
                    className="form-control"
                    value={selectedProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">-- Select a product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (${p.current_price})</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-success btn-small"
                    onClick={handleAiAssist}
                    disabled={aiAssisting || !selectedProductId}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {aiAssisting ? 'Analyzing...' : 'AI Predict Price'}
                  </button>
                </div>
                {dataSourcesSummary && (
                  <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: '#f0f9ff',
                    borderRadius: '6px',
                    border: '1px solid #0ea5e9',
                    fontSize: '12px'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#0369a1' }}>
                      AI Data Sources Analyzed:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                        {dataSourcesSummary.competitors} Competitors
                      </span>
                      <span style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                        {dataSourcesSummary.demandSignals} Demand Signals
                      </span>
                      <span style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                        {dataSourcesSummary.marketTrends} Market Trends
                      </span>
                      <span style={{ background: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>
                        {dataSourcesSummary.priceHistory} Price History
                      </span>
                    </div>
                    <div style={{ marginTop: '5px', color: '#0369a1' }}>
                      Data Confidence: <strong>{dataSourcesSummary.dataConfidence}%</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="form-group">
              <label>Product Name</label>
              <input
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Current Price</label>
                <input
                  type="number"
                  step="0.01"
                  name="current_price"
                  value={formData.current_price}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Suggested Price</label>
                <input
                  type="number"
                  step="0.01"
                  name="suggested_price"
                  value={formData.suggested_price}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Confidence (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  name="confidence"
                  value={formData.confidence}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  className="form-control"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Reason</label>
              <textarea
                className="form-control"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Expected Impact</label>
              <textarea
                className="form-control"
                name="expected_impact"
                value={formData.expected_impact}
                onChange={handleInputChange}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {isEditing ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  );

  if (isDetailView && selectedSuggestion) {
    const priceChange = getPriceChange(selectedSuggestion.current_price, selectedSuggestion.suggested_price);

    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Price Suggestions
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedSuggestion.product_name}</h2>
              <p className="subtitle">
                <span className={`badge badge-${selectedSuggestion.status}`}>
                  {selectedSuggestion.status}
                </span>
              </p>
            </div>
            <div className="detail-actions">
              {selectedSuggestion.status === 'pending' && (
                <>
                  <button className="btn btn-success btn-small" onClick={() => handleStatusChange('approved')}>
                    Approve
                  </button>
                  <button className="btn btn-danger btn-small" onClick={() => handleStatusChange('rejected')}>
                    Reject
                  </button>
                </>
              )}
              <button className="btn btn-primary btn-small" onClick={handleEdit}>
                Edit
              </button>
              <button className="btn btn-danger btn-small" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Current Price</label>
              <div className="value">{formatCurrency(selectedSuggestion.current_price)}</div>
            </div>
            <div className="detail-item">
              <label>Suggested Price</label>
              <div className="value">{formatCurrency(selectedSuggestion.suggested_price)}</div>
            </div>
            <div className="detail-item">
              <label>Price Change</label>
              <div className={`value ${priceChange > 0 ? 'price-up' : 'price-down'}`}>
                {priceChange ? `${priceChange > 0 ? '+' : ''}${priceChange}%` : 'N/A'}
              </div>
            </div>
            <div className="detail-item">
              <label>Confidence</label>
              <div className="value">{selectedSuggestion.confidence}%</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Reason</label>
            <div className="value">{selectedSuggestion.reason || 'No reason provided'}</div>
          </div>

          <div className="detail-item">
            <label>Expected Impact</label>
            <div className="value">{selectedSuggestion.expected_impact || 'No impact analysis'}</div>
          </div>
        </div>

        {renderModal()}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Price Suggestions</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select
            className="form-control"
            style={{ width: 'auto', padding: '8px 16px' }}
            onChange={(e) => e.target.value && handleGenerateAI(e.target.value)}
            value=""
            disabled={generating}
          >
            <option value="">{generating ? 'Generating...' : 'Generate AI Suggestion'}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-small" onClick={handleNewSuggestion}>
            + New Suggestion
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={suggestions}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['product_name', 'reason', 'expected_impact']}
          exportFilename="price_suggestions"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PriceSuggestions;
