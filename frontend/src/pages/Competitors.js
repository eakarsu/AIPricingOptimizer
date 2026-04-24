import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const Competitors = () => {
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    product_name: '',
    competitor_price: '',
    our_price: '',
    market_position: '',
    notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      const response = await axios.get(`${API_URL}/competitors`);
      setCompetitors(response.data);
    } catch (error) {
      console.error('Error fetching competitors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (competitor) => {
    try {
      const response = await axios.get(`${API_URL}/competitors/${competitor.id}`);
      setSelectedCompetitor(response.data);
      setAiAnalysis(null);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching competitor details:', error);
    }
  };

  const handleNewCompetitor = () => {
    setFormData({
      name: '',
      website: '',
      product_name: '',
      competitor_price: '',
      our_price: '',
      market_position: '',
      notes: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      name: selectedCompetitor.name,
      website: selectedCompetitor.website || '',
      product_name: selectedCompetitor.product_name || '',
      competitor_price: selectedCompetitor.competitor_price || '',
      our_price: selectedCompetitor.our_price || '',
      market_position: selectedCompetitor.market_position || '',
      notes: selectedCompetitor.notes || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this competitor?')) {
      try {
        await axios.delete(`${API_URL}/competitors/${selectedCompetitor.id}`);
        setIsDetailView(false);
        setSelectedCompetitor(null);
        fetchCompetitors();
        addNotification({ type: 'success', title: 'Deleted', message: 'Competitor deleted successfully' });
      } catch (error) {
        console.error('Error deleting competitor:', error);
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/competitors/${id}`)));
      fetchCompetitors();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} competitors deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/competitors/analyze`, {
        competitorId: selectedCompetitor.id,
      });
      setAiAnalysis(response.data.analysis);
      addNotification({ type: 'success', title: 'Analysis Complete', message: 'AI competitor analysis generated' });
    } catch (error) {
      console.error('Error analyzing competitor:', error);
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
        await axios.put(`${API_URL}/competitors/${selectedCompetitor.id}`, formData);
        const response = await axios.get(`${API_URL}/competitors/${selectedCompetitor.id}`);
        setSelectedCompetitor(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'Competitor updated successfully' });
      } else {
        await axios.post(`${API_URL}/competitors`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'Competitor created successfully' });
      }
      setIsModalOpen(false);
      fetchCompetitors();
    } catch (error) {
      console.error('Error saving competitor:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  };

  const getPriceDiff = (competitor_price, our_price) => {
    if (!competitor_price || !our_price) return null;
    return ((our_price - competitor_price) / competitor_price * 100).toFixed(1);
  };

  const columns = [
    { key: 'name', label: 'Competitor', sortable: true },
    { key: 'product_name', label: 'Product', sortable: true },
    { key: 'competitor_price', label: 'Their Price', sortable: true, render: (row) => formatCurrency(row.competitor_price) },
    { key: 'our_price', label: 'Our Price', sortable: true, render: (row) => formatCurrency(row.our_price) },
    {
      key: 'difference',
      label: 'Difference',
      render: (row) => {
        const diff = getPriceDiff(row.competitor_price, row.our_price);
        return diff ? <span className={diff > 0 ? 'price-up' : 'price-down'}>{diff > 0 ? '+' : ''}{diff}%</span> : '-';
      },
    },
    {
      key: 'market_position',
      label: 'Position',
      sortable: true,
      filterable: true,
      render: (row) => <span className={`badge badge-${row.market_position}`}>{row.market_position || '-'}</span>,
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Competitor' : 'New Competitor'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Competitor Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input type="text" name="website" value={formData.website} onChange={handleInputChange} />
              </div>
            </div>
            <div className="form-group">
              <label>Product Name</label>
              <input type="text" name="product_name" value={formData.product_name} onChange={handleInputChange} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Competitor Price</label>
                <input type="number" step="0.01" name="competitor_price" value={formData.competitor_price} onChange={handleInputChange} />
              </div>
              <div className="form-group">
                <label>Our Price</label>
                <input type="number" step="0.01" name="our_price" value={formData.our_price} onChange={handleInputChange} />
              </div>
            </div>
            <div className="form-group">
              <label>Market Position</label>
              <select className="form-control" name="market_position" value={formData.market_position} onChange={handleInputChange}>
                <option value="">Select position</option>
                <option value="premium">Premium</option>
                <option value="mainstream">Mainstream</option>
                <option value="budget">Budget</option>
                <option value="specialty">Specialty</option>
              </select>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" name="notes" value={formData.notes} onChange={handleInputChange} />
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

  if (isDetailView && selectedCompetitor) {
    const priceDiff = getPriceDiff(selectedCompetitor.competitor_price, selectedCompetitor.our_price);

    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>← Back to Competitors</span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedCompetitor.name}</h2>
              <p className="subtitle">{selectedCompetitor.website || 'No website'}</p>
            </div>
            <div className="detail-actions">
              <button className="btn btn-success btn-small" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? 'Analyzing...' : 'AI Analysis'}
              </button>
              <button className="btn btn-primary btn-small" onClick={handleEdit}>Edit</button>
              <button className="btn btn-danger btn-small" onClick={handleDelete}>Delete</button>
            </div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Product</label>
              <div className="value">{selectedCompetitor.product_name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Competitor Price</label>
              <div className="value">{formatCurrency(selectedCompetitor.competitor_price)}</div>
            </div>
            <div className="detail-item">
              <label>Our Price</label>
              <div className="value">{formatCurrency(selectedCompetitor.our_price)}</div>
            </div>
            <div className="detail-item">
              <label>Price Difference</label>
              <div className={`value ${priceDiff > 0 ? 'price-up' : 'price-down'}`}>
                {priceDiff ? `${priceDiff > 0 ? '+' : ''}${priceDiff}%` : 'N/A'}
              </div>
            </div>
            <div className="detail-item">
              <label>Market Position</label>
              <div className="value">
                <span className={`badge badge-${selectedCompetitor.market_position}`}>
                  {selectedCompetitor.market_position || 'Unknown'}
                </span>
              </div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Notes</label>
            <div className="value">{selectedCompetitor.notes || 'No notes'}</div>
          </div>

          {aiAnalysis && (
            <div className="ai-analysis">
              <h3>AI Competitor Analysis</h3>
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
        <h1>Competitor Analysis</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewCompetitor}>+ New Competitor</button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={competitors}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'product_name', 'website']}
          exportFilename="competitors"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default Competitors;
