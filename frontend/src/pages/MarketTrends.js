import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const MarketTrends = () => {
  const [trends, setTrends] = useState([]);
  const [selectedTrend, setSelectedTrend] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    trend_name: '',
    category: '',
    direction: '',
    impact_level: '',
    description: '',
    data_source: '',
    start_date: '',
    end_date: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    try {
      const response = await axios.get(`${API_URL}/market-trends`);
      setTrends(response.data);
    } catch (error) {
      console.error('Error fetching market trends:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to fetch market trends' });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (trend) => {
    try {
      const response = await axios.get(`${API_URL}/market-trends/${trend.id}`);
      setSelectedTrend(response.data);
      setAiAnalysis(null);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching trend details:', error);
    }
  };

  const handleNewTrend = () => {
    setFormData({
      trend_name: '',
      category: '',
      direction: '',
      impact_level: '',
      description: '',
      data_source: '',
      start_date: '',
      end_date: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      trend_name: selectedTrend.trend_name,
      category: selectedTrend.category || '',
      direction: selectedTrend.direction || '',
      impact_level: selectedTrend.impact_level || '',
      description: selectedTrend.description || '',
      data_source: selectedTrend.data_source || '',
      start_date: selectedTrend.start_date ? new Date(selectedTrend.start_date).toISOString().split('T')[0] : '',
      end_date: selectedTrend.end_date ? new Date(selectedTrend.end_date).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this market trend?')) {
      try {
        await axios.delete(`${API_URL}/market-trends/${selectedTrend.id}`);
        setIsDetailView(false);
        setSelectedTrend(null);
        fetchTrends();
        addNotification({ type: 'success', title: 'Deleted', message: 'Market trend deleted successfully' });
      } catch (error) {
        console.error('Error deleting trend:', error);
        addNotification({ type: 'error', title: 'Error', message: 'Failed to delete trend' });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/market-trends/${id}`)));
      fetchTrends();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} trends deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete some trends' });
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    addNotification({ type: 'info', title: 'Analyzing', message: 'AI is analyzing market trend...' });
    try {
      const response = await axios.post(`${API_URL}/market-trends/analyze`, {
        trendId: selectedTrend.id,
      });
      setAiAnalysis(response.data.analysis);
      addNotification({ type: 'success', title: 'Analysis Complete', message: 'AI trend analysis generated' });
    } catch (error) {
      console.error('Error analyzing trend:', error);
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
        await axios.put(`${API_URL}/market-trends/${selectedTrend.id}`, formData);
        const response = await axios.get(`${API_URL}/market-trends/${selectedTrend.id}`);
        setSelectedTrend(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'Market trend updated successfully' });
      } else {
        await axios.post(`${API_URL}/market-trends`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'Market trend created successfully' });
      }
      setIsModalOpen(false);
      fetchTrends();
    } catch (error) {
      console.error('Error saving trend:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to save trend' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns = [
    { key: 'trend_name', label: 'Trend', sortable: true },
    { key: 'category', label: 'Category', sortable: true, filterable: true },
    {
      key: 'direction',
      label: 'Direction',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.direction}`}>{row.direction || '-'}</span>,
    },
    {
      key: 'impact_level',
      label: 'Impact',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.impact_level}`}>{row.impact_level || '-'}</span>,
    },
    { key: 'data_source', label: 'Source', sortable: true },
    {
      key: 'period',
      label: 'Period',
      render: (row) => `${formatDate(row.start_date)} - ${formatDate(row.end_date)}`,
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Market Trend' : 'New Market Trend'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Trend Name</label>
              <input
                type="text"
                name="trend_name"
                value={formData.trend_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Data Source</label>
                <input
                  type="text"
                  name="data_source"
                  value={formData.data_source}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Direction</label>
                <select
                  className="form-control"
                  name="direction"
                  value={formData.direction}
                  onChange={handleInputChange}
                >
                  <option value="">Select direction</option>
                  <option value="increasing">Increasing</option>
                  <option value="decreasing">Decreasing</option>
                  <option value="stable">Stable</option>
                </select>
              </div>
              <div className="form-group">
                <label>Impact Level</label>
                <select
                  className="form-control"
                  name="impact_level"
                  value={formData.impact_level}
                  onChange={handleInputChange}
                >
                  <option value="">Select impact</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                name="description"
                value={formData.description}
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

  if (isDetailView && selectedTrend) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Market Trends
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedTrend.trend_name}</h2>
              <p className="subtitle">{selectedTrend.category}</p>
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
              <label>Direction</label>
              <div className="value">
                <span className={`badge badge-${selectedTrend.direction}`}>
                  {selectedTrend.direction || 'Unknown'}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>Impact Level</label>
              <div className="value">
                <span className={`badge badge-${selectedTrend.impact_level}`}>
                  {selectedTrend.impact_level || 'Unknown'}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>Start Date</label>
              <div className="value">{formatDate(selectedTrend.start_date)}</div>
            </div>
            <div className="detail-item">
              <label>End Date</label>
              <div className="value">{formatDate(selectedTrend.end_date)}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Description</label>
            <div className="value">{selectedTrend.description || 'No description'}</div>
          </div>

          <div className="detail-item">
            <label>Data Source</label>
            <div className="value">{selectedTrend.data_source || 'N/A'}</div>
          </div>

          {aiAnalysis && (
            <div className="ai-analysis">
              <h3>AI Trend Analysis</h3>
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
        <h1>Market Trends</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewTrend}>
          + New Trend
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={trends}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['trend_name', 'category', 'description', 'data_source']}
          exportFilename="market_trends"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default MarketTrends;
