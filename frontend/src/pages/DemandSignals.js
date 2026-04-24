import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const DemandSignals = () => {
  const [signals, setSignals] = useState([]);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    signal_type: '',
    signal_strength: '',
    source: '',
    trend: '',
    volume: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    try {
      const response = await axios.get(`${API_URL}/demand-signals`);
      setSignals(response.data);
    } catch (error) {
      console.error('Error fetching demand signals:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to fetch demand signals' });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (signal) => {
    try {
      const response = await axios.get(`${API_URL}/demand-signals/${signal.id}`);
      setSelectedSignal(response.data);
      setAiAnalysis(null);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching signal details:', error);
    }
  };

  const handleNewSignal = () => {
    setFormData({
      product_name: '',
      signal_type: '',
      signal_strength: '',
      source: '',
      trend: '',
      volume: '',
      notes: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      product_name: selectedSignal.product_name,
      signal_type: selectedSignal.signal_type || '',
      signal_strength: selectedSignal.signal_strength || '',
      source: selectedSignal.source || '',
      trend: selectedSignal.trend || '',
      volume: selectedSignal.volume || '',
      notes: selectedSignal.notes || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this demand signal?')) {
      try {
        await axios.delete(`${API_URL}/demand-signals/${selectedSignal.id}`);
        setIsDetailView(false);
        setSelectedSignal(null);
        fetchSignals();
        addNotification({ type: 'success', title: 'Deleted', message: 'Demand signal deleted successfully' });
      } catch (error) {
        console.error('Error deleting signal:', error);
        addNotification({ type: 'error', title: 'Error', message: 'Failed to delete demand signal' });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/demand-signals/${id}`)));
      fetchSignals();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} demand signals deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete some signals' });
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    addNotification({ type: 'info', title: 'Analyzing', message: 'AI is analyzing demand signal...' });
    try {
      const response = await axios.post(`${API_URL}/demand-signals/analyze`, {
        signalId: selectedSignal.id,
      });
      setAiAnalysis(response.data.analysis);
      addNotification({ type: 'success', title: 'Analysis Complete', message: 'AI demand analysis generated' });
    } catch (error) {
      console.error('Error analyzing demand signal:', error);
      setAiAnalysis('Failed to generate analysis. Please try again.');
      addNotification({ type: 'error', title: 'Error', message: 'Failed to generate AI analysis' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/demand-signals/${selectedSignal.id}`, formData);
        const response = await axios.get(`${API_URL}/demand-signals/${selectedSignal.id}`);
        setSelectedSignal(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'Demand signal updated successfully' });
      } else {
        await axios.post(`${API_URL}/demand-signals`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'Demand signal created successfully' });
      }
      setIsModalOpen(false);
      fetchSignals();
    } catch (error) {
      console.error('Error saving demand signal:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to save demand signal' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getStrengthColor = (strength) => {
    if (strength >= 80) return '#00c853';
    if (strength >= 60) return '#ffc107';
    if (strength >= 40) return '#ff9800';
    return '#ff6b6b';
  };

  const columns = [
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'signal_type', label: 'Signal Type', sortable: true, filterable: true },
    {
      key: 'signal_strength',
      label: 'Strength',
      sortable: true,
      render: (row) => (
        <span style={{ color: getStrengthColor(row.signal_strength) }}>
          {row.signal_strength}/100
        </span>
      ),
    },
    { key: 'source', label: 'Source', sortable: true },
    {
      key: 'trend',
      label: 'Trend',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.trend}`}>{row.trend || '-'}</span>,
    },
    {
      key: 'volume',
      label: 'Volume',
      sortable: true,
      render: (row) => row.volume?.toLocaleString() || '-',
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Demand Signal' : 'New Demand Signal'}</h2>
          <form onSubmit={handleSubmit}>
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
                <label>Signal Type</label>
                <select
                  className="form-control"
                  name="signal_type"
                  value={formData.signal_type}
                  onChange={handleInputChange}
                >
                  <option value="">Select type</option>
                  <option value="search_volume">Search Volume</option>
                  <option value="social_mentions">Social Mentions</option>
                  <option value="reviews">Reviews</option>
                  <option value="cart_additions">Cart Additions</option>
                  <option value="subscription_rate">Subscription Rate</option>
                  <option value="return_rate">Return Rate</option>
                </select>
              </div>
              <div className="form-group">
                <label>Signal Strength (0-100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  name="signal_strength"
                  value={formData.signal_strength}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Source</label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Volume</label>
                <input
                  type="number"
                  name="volume"
                  value={formData.volume}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Trend</label>
              <select
                className="form-control"
                name="trend"
                value={formData.trend}
                onChange={handleInputChange}
              >
                <option value="">Select trend</option>
                <option value="increasing">Increasing</option>
                <option value="decreasing">Decreasing</option>
                <option value="stable">Stable</option>
                <option value="seasonal">Seasonal</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="form-control"
                name="notes"
                value={formData.notes}
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

  if (isDetailView && selectedSignal) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Demand Signals
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedSignal.product_name}</h2>
              <p className="subtitle">{selectedSignal.signal_type}</p>
            </div>
            <div className="detail-actions">
              <button className="btn btn-success btn-small" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? 'Analyzing...' : 'AI Analysis'}
              </button>
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
              <label>Signal Strength</label>
              <div className="value" style={{ color: getStrengthColor(selectedSignal.signal_strength) }}>
                {selectedSignal.signal_strength}/100
              </div>
            </div>
            <div className="detail-item">
              <label>Source</label>
              <div className="value">{selectedSignal.source || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Trend</label>
              <div className="value">
                <span className={`badge badge-${selectedSignal.trend}`}>
                  {selectedSignal.trend || 'Unknown'}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>Volume</label>
              <div className="value">{selectedSignal.volume?.toLocaleString() || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Notes</label>
            <div className="value">{selectedSignal.notes || 'No notes'}</div>
          </div>

          {aiAnalysis && (
            <div className="ai-analysis">
              <h3>AI Demand Analysis</h3>
              <div className="content">{aiAnalysis}</div>
            </div>
          )}
        </div>

        {renderModal()}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Demand Signals</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewSignal}>
          + New Signal
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={signals}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['product_name', 'signal_type', 'source', 'notes']}
          exportFilename="demand_signals"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default DemandSignals;
