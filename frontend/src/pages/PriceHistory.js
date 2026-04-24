import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PriceHistory = () => {
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    product_name: '',
    old_price: '',
    new_price: '',
    change_reason: '',
    changed_by: '',
    change_date: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/price-history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching price history:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to fetch price history' });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (item) => {
    try {
      const response = await axios.get(`${API_URL}/price-history/${item.id}`);
      setSelectedHistory(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching history details:', error);
    }
  };

  const handleNewHistory = () => {
    setFormData({
      product_name: '',
      old_price: '',
      new_price: '',
      change_reason: '',
      changed_by: '',
      change_date: new Date().toISOString().split('T')[0],
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      product_name: selectedHistory.product_name,
      old_price: selectedHistory.old_price || '',
      new_price: selectedHistory.new_price || '',
      change_reason: selectedHistory.change_reason || '',
      changed_by: selectedHistory.changed_by || '',
      change_date: selectedHistory.change_date ? new Date(selectedHistory.change_date).toISOString().split('T')[0] : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this price history record?')) {
      try {
        await axios.delete(`${API_URL}/price-history/${selectedHistory.id}`);
        setIsDetailView(false);
        setSelectedHistory(null);
        fetchHistory();
        addNotification({ type: 'success', title: 'Deleted', message: 'Price history record deleted successfully' });
      } catch (error) {
        console.error('Error deleting history:', error);
        addNotification({ type: 'error', title: 'Error', message: 'Failed to delete record' });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/price-history/${id}`)));
      fetchHistory();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} records deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete some records' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/price-history/${selectedHistory.id}`, formData);
        const response = await axios.get(`${API_URL}/price-history/${selectedHistory.id}`);
        setSelectedHistory(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'Price history updated successfully' });
      } else {
        await axios.post(`${API_URL}/price-history`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'Price history record created successfully' });
      }
      setIsModalOpen(false);
      fetchHistory();
    } catch (error) {
      console.error('Error saving price history:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to save record' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatCurrency = (value) => {
    if (!value) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const getPriceChange = (oldPrice, newPrice) => {
    if (!oldPrice || !newPrice) return null;
    return ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
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
    { key: 'product_name', label: 'Product', sortable: true },
    {
      key: 'old_price',
      label: 'Old Price',
      sortable: true,
      render: (row) => formatCurrency(row.old_price),
    },
    {
      key: 'new_price',
      label: 'New Price',
      sortable: true,
      render: (row) => formatCurrency(row.new_price),
    },
    {
      key: 'change',
      label: 'Change',
      render: (row) => {
        const change = getPriceChange(row.old_price, row.new_price);
        return change ? (
          <span className={change > 0 ? 'price-up' : 'price-down'}>
            {change > 0 ? '+' : ''}{change}%
          </span>
        ) : '-';
      },
    },
    { key: 'changed_by', label: 'Changed By', sortable: true, filterable: true },
    {
      key: 'change_date',
      label: 'Date',
      sortable: true,
      render: (row) => formatDate(row.change_date),
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Price History' : 'New Price History'}</h2>
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
                <label>Old Price</label>
                <input
                  type="number"
                  step="0.01"
                  name="old_price"
                  value={formData.old_price}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>New Price</label>
                <input
                  type="number"
                  step="0.01"
                  name="new_price"
                  value={formData.new_price}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Changed By</label>
                <input
                  type="text"
                  name="changed_by"
                  value={formData.changed_by}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Change Date</label>
                <input
                  type="date"
                  name="change_date"
                  value={formData.change_date}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Change Reason</label>
              <textarea
                className="form-control"
                name="change_reason"
                value={formData.change_reason}
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

  if (isDetailView && selectedHistory) {
    const priceChange = getPriceChange(selectedHistory.old_price, selectedHistory.new_price);

    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Price History
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedHistory.product_name}</h2>
              <p className="subtitle">Price change on {formatDate(selectedHistory.change_date)}</p>
            </div>
            <div className="detail-actions">
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
              <label>Old Price</label>
              <div className="value">{formatCurrency(selectedHistory.old_price)}</div>
            </div>
            <div className="detail-item">
              <label>New Price</label>
              <div className="value">{formatCurrency(selectedHistory.new_price)}</div>
            </div>
            <div className="detail-item">
              <label>Price Change</label>
              <div className={`value ${priceChange > 0 ? 'price-up' : 'price-down'}`}>
                {priceChange ? `${priceChange > 0 ? '+' : ''}${priceChange}%` : 'N/A'}
              </div>
            </div>
            <div className="detail-item">
              <label>Changed By</label>
              <div className="value">{selectedHistory.changed_by || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item">
            <label>Change Reason</label>
            <div className="value">{selectedHistory.change_reason || 'No reason provided'}</div>
          </div>
        </div>

        {renderModal()}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Price History</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewHistory}>
          + New Record
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={history}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['product_name', 'changed_by', 'change_reason']}
          exportFilename="price_history"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PriceHistory;
