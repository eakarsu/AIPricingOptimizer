import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const SecurityHeaders = () => {
  const [securityHeaders, setSecurityHeaders] = useState([]);
  const [selectedHeader, setSelectedHeader] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    header_name: '',
    header_value: '',
    description: '',
    category: '',
    enabled: 'true',
    applies_to: 'all',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/security-headers`);
      setSecurityHeaders(response.data);
    } catch (error) {
      console.error('Error fetching security headers:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch security headers',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (header) => {
    try {
      const response = await axios.get(`${API_URL}/security-headers/${header.id}`);
      setSelectedHeader(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching security header details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      header_name: '',
      header_value: '',
      description: '',
      category: '',
      enabled: 'true',
      applies_to: 'all',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      header_name: selectedHeader.header_name,
      header_value: selectedHeader.header_value || '',
      description: selectedHeader.description || '',
      category: selectedHeader.category || '',
      enabled: String(selectedHeader.enabled),
      applies_to: selectedHeader.applies_to || 'all',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this security header?')) {
      try {
        await axios.delete(`${API_URL}/security-headers/${selectedHeader.id}`);
        setIsDetailView(false);
        setSelectedHeader(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Security header deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting security header:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete security header',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/security-headers/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} security headers deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some security headers',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/security-headers/${selectedHeader.id}`, formData);
        const response = await axios.get(`${API_URL}/security-headers/${selectedHeader.id}`);
        setSelectedHeader(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Security header updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/security-headers`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Security header created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving security header:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save security header',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const columns = [
    { key: 'header_name', label: 'Header Name', sortable: true },
    {
      key: 'header_value',
      label: 'Value',
      sortable: true,
      render: (row) => row.header_value && row.header_value.length > 40
        ? row.header_value.substring(0, 40) + '...'
        : row.header_value,
    },
    { key: 'category', label: 'Category', sortable: true, filterable: true },
    { key: 'applies_to', label: 'Applies To', sortable: true, filterable: true },
    {
      key: 'enabled',
      label: 'Enabled',
      sortable: true,
      render: (row) => row.enabled ? 'Yes' : 'No',
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Security Header' : 'New Security Header'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Header Name</label>
              <input
                type="text"
                name="header_name"
                value={formData.header_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Header Value</label>
              <textarea
                className="form-control"
                name="header_value"
                value={formData.header_value}
                onChange={handleInputChange}
                required
              />
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
                <label>Enabled</label>
                <select
                  name="enabled"
                  value={formData.enabled}
                  onChange={handleInputChange}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Applies To</label>
              <select
                name="applies_to"
                value={formData.applies_to}
                onChange={handleInputChange}
              >
                <option value="all">All</option>
                <option value="api">API</option>
                <option value="frontend">Frontend</option>
              </select>
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

  if (isDetailView && selectedHeader) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Security Headers
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedHeader.header_name}</h2>
              <p className="subtitle">Category: {selectedHeader.category || 'N/A'}</p>
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
              <label>Header Name</label>
              <div className="value">{selectedHeader.header_name}</div>
            </div>
            <div className="detail-item">
              <label>Category</label>
              <div className="value">{selectedHeader.category || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Enabled</label>
              <div className="value">{selectedHeader.enabled ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Applies To</label>
              <div className="value">{selectedHeader.applies_to || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Header Value</label>
            <div className="value">{selectedHeader.header_value || 'N/A'}</div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Description</label>
            <div className="value">{selectedHeader.description || 'No description'}</div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedHeader.created_at).toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>Updated At</label>
              <div className="value">{new Date(selectedHeader.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {renderModal()}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Security Headers</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Security Header
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={securityHeaders}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['header_name', 'header_value', 'category']}
          exportFilename="security-headers"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default SecurityHeaders;
