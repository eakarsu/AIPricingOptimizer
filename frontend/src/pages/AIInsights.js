import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const AIInsights = () => {
  const [insights, setInsights] = useState([]);
  const [selectedInsight, setSelectedInsight] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    insight_type: '',
    title: '',
    content: '',
    priority: '',
    status: 'new',
    related_products: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const response = await axios.get(`${API_URL}/ai-insights`);
      setInsights(response.data);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (insight) => {
    try {
      const response = await axios.get(`${API_URL}/ai-insights/${insight.id}`);
      setSelectedInsight(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching insight details:', error);
    }
  };

  const handleNewInsight = () => {
    setFormData({
      insight_type: '',
      title: '',
      content: '',
      priority: '',
      status: 'new',
      related_products: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleGenerateInsights = async () => {
    setGenerating(true);
    addNotification({ type: 'info', title: 'Generating', message: 'AI is analyzing your data...' });
    try {
      const response = await axios.post(`${API_URL}/ai-insights/generate`);
      if (response.data.insights) {
        fetchInsights();
        addNotification({
          type: 'success',
          title: 'Insights Generated',
          message: `Generated ${response.data.insights.length} new AI insights!`,
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'No Insights',
          message: response.data.message || 'AI could not generate insights',
        });
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to generate AI insights' });
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = () => {
    setFormData({
      insight_type: selectedInsight.insight_type || '',
      title: selectedInsight.title || '',
      content: selectedInsight.content || '',
      priority: selectedInsight.priority || '',
      status: selectedInsight.status || 'new',
      related_products: selectedInsight.related_products || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this insight?')) {
      try {
        await axios.delete(`${API_URL}/ai-insights/${selectedInsight.id}`);
        setIsDetailView(false);
        setSelectedInsight(null);
        fetchInsights();
        addNotification({ type: 'success', title: 'Deleted', message: 'Insight deleted successfully' });
      } catch (error) {
        console.error('Error deleting insight:', error);
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/ai-insights/${id}`)));
      fetchInsights();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} insights deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await axios.put(`${API_URL}/ai-insights/${selectedInsight.id}`, {
        ...selectedInsight,
        status: newStatus,
      });
      const response = await axios.get(`${API_URL}/ai-insights/${selectedInsight.id}`);
      setSelectedInsight(response.data);
      fetchInsights();
      addNotification({ type: 'success', title: 'Updated', message: `Status changed to ${newStatus}` });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/ai-insights/${selectedInsight.id}`, formData);
        const response = await axios.get(`${API_URL}/ai-insights/${selectedInsight.id}`);
        setSelectedInsight(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'Insight updated successfully' });
      } else {
        await axios.post(`${API_URL}/ai-insights`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'Insight created successfully' });
      }
      setIsModalOpen(false);
      fetchInsights();
    } catch (error) {
      console.error('Error saving insight:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'pricing': return '💰';
      case 'competitor': return '🏢';
      case 'demand': return '📈';
      case 'trend': return '🌍';
      default: return '💡';
    }
  };

  const columns = [
    {
      key: 'insight_type',
      label: 'Type',
      sortable: true,
      filterable: true,
      render: (row) => <span>{getTypeIcon(row.insight_type)} {row.insight_type}</span>,
    },
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.priority}`}>{row.priority}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.status}`}>{row.status}</span>,
    },
    {
      key: 'related_products',
      label: 'Related Products',
      render: (row) => row.related_products?.substring(0, 30) + (row.related_products?.length > 30 ? '...' : '') || '-',
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit AI Insight' : 'New AI Insight'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Title</label>
              <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Insight Type</label>
                <select className="form-control" name="insight_type" value={formData.insight_type} onChange={handleInputChange}>
                  <option value="">Select type</option>
                  <option value="pricing">Pricing</option>
                  <option value="competitor">Competitor</option>
                  <option value="demand">Demand</option>
                  <option value="trend">Trend</option>
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select className="form-control" name="priority" value={formData.priority} onChange={handleInputChange}>
                  <option value="">Select priority</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" name="status" value={formData.status} onChange={handleInputChange}>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Related Products</label>
              <input type="text" name="related_products" value={formData.related_products} onChange={handleInputChange} placeholder="Comma-separated product names" />
            </div>
            <div className="form-group">
              <label>Content</label>
              <textarea className="form-control" name="content" value={formData.content} onChange={handleInputChange} style={{ minHeight: '150px' }} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{isEditing ? 'Update' : 'Create'}</button>
            </div>
          </form>
        </div>
      </div>
    )
  );

  if (isDetailView && selectedInsight) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>← Back to AI Insights</span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{getTypeIcon(selectedInsight.insight_type)} {selectedInsight.title}</h2>
              <p className="subtitle">
                <span className={`badge badge-${selectedInsight.status}`} style={{ marginRight: '10px' }}>
                  {selectedInsight.status}
                </span>
                <span className={`badge badge-${selectedInsight.priority}`}>
                  {selectedInsight.priority} priority
                </span>
              </p>
            </div>
            <div className="detail-actions">
              {selectedInsight.status === 'new' && (
                <button className="btn btn-success btn-small" onClick={() => handleStatusChange('reviewed')}>
                  Mark Reviewed
                </button>
              )}
              <button className="btn btn-primary btn-small" onClick={handleEdit}>Edit</button>
              <button className="btn btn-danger btn-small" onClick={handleDelete}>Delete</button>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Insight Type</label>
              <div className="value" style={{ textTransform: 'capitalize' }}>
                {selectedInsight.insight_type || 'General'}
              </div>
            </div>
            <div className="detail-item">
              <label>Related Products</label>
              <div className="value">{selectedInsight.related_products || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedInsight.created_at).toLocaleString()}</div>
            </div>
          </div>

          <div className="ai-analysis">
            <h3>Insight Details</h3>
            <div className="content">{selectedInsight.content}</div>
          </div>
        </div>

        {renderModal()}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>AI Insights</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-success btn-small"
            onClick={handleGenerateInsights}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate AI Insights'}
          </button>
          <button className="btn btn-primary btn-small" onClick={handleNewInsight}>+ New Insight</button>
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={insights}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['title', 'content', 'related_products']}
          exportFilename="ai_insights"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default AIInsights;
