import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PaginationConfigs = () => {
  const [paginationConfigs, setPaginationConfigs] = useState([]);
  const [selectedPaginationConfig, setSelectedPaginationConfig] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    page_name: '',
    items_per_page: '',
    max_items_per_page: '',
    default_sort_field: '',
    default_sort_order: 'ASC',
    enabled: 'true',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/pagination-configs`);
      setPaginationConfigs(response.data);
    } catch (error) {
      console.error('Error fetching pagination configs:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch pagination configs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (paginationConfig) => {
    try {
      const response = await axios.get(`${API_URL}/pagination-configs/${paginationConfig.id}`);
      setSelectedPaginationConfig(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching pagination config details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      page_name: '',
      items_per_page: '',
      max_items_per_page: '',
      default_sort_field: '',
      default_sort_order: 'ASC',
      enabled: 'true',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      page_name: selectedPaginationConfig.page_name,
      items_per_page: selectedPaginationConfig.items_per_page || '',
      max_items_per_page: selectedPaginationConfig.max_items_per_page || '',
      default_sort_field: selectedPaginationConfig.default_sort_field || '',
      default_sort_order: selectedPaginationConfig.default_sort_order || 'ASC',
      enabled: String(selectedPaginationConfig.enabled),
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this pagination config?')) {
      try {
        await axios.delete(`${API_URL}/pagination-configs/${selectedPaginationConfig.id}`);
        setIsDetailView(false);
        setSelectedPaginationConfig(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Pagination config deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting pagination config:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete pagination config',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/pagination-configs/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} pagination configs deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some pagination configs',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/pagination-configs/${selectedPaginationConfig.id}`, formData);
        const response = await axios.get(`${API_URL}/pagination-configs/${selectedPaginationConfig.id}`);
        setSelectedPaginationConfig(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Pagination config updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/pagination-configs`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Pagination config created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving pagination config:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save pagination config',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const columns = [
    { key: 'page_name', label: 'Page Name', sortable: true },
    { key: 'items_per_page', label: 'Items/Page', sortable: true },
    { key: 'max_items_per_page', label: 'Max Items', sortable: true },
    { key: 'default_sort_field', label: 'Sort Field', sortable: true },
    { key: 'default_sort_order', label: 'Sort Order', sortable: true },
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
          <h2>{isEditing ? 'Edit Pagination Config' : 'New Pagination Config'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Page Name</label>
              <input
                type="text"
                name="page_name"
                value={formData.page_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Items Per Page</label>
                <input
                  type="number"
                  name="items_per_page"
                  value={formData.items_per_page}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Max Items Per Page</label>
                <input
                  type="number"
                  name="max_items_per_page"
                  value={formData.max_items_per_page}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Default Sort Field</label>
                <input
                  type="text"
                  name="default_sort_field"
                  value={formData.default_sort_field}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Default Sort Order</label>
                <select
                  name="default_sort_order"
                  value={formData.default_sort_order}
                  onChange={handleInputChange}
                >
                  <option value="ASC">ASC</option>
                  <option value="DESC">DESC</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Enabled</label>
              <select
                name="enabled"
                value={formData.enabled}
                onChange={handleInputChange}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
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

  if (isDetailView && selectedPaginationConfig) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          &larr; Back to Pagination Configs
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedPaginationConfig.page_name}</h2>
              <p className="subtitle">Pagination Config</p>
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
              <label>Page Name</label>
              <div className="value">{selectedPaginationConfig.page_name}</div>
            </div>
            <div className="detail-item">
              <label>Items Per Page</label>
              <div className="value">{selectedPaginationConfig.items_per_page}</div>
            </div>
            <div className="detail-item">
              <label>Max Items Per Page</label>
              <div className="value">{selectedPaginationConfig.max_items_per_page}</div>
            </div>
            <div className="detail-item">
              <label>Default Sort Field</label>
              <div className="value">{selectedPaginationConfig.default_sort_field || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Default Sort Order</label>
              <div className="value">{selectedPaginationConfig.default_sort_order || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Enabled</label>
              <div className="value">{selectedPaginationConfig.enabled ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div className="detail-grid" style={{ marginTop: '10px' }}>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedPaginationConfig.created_at).toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>Updated At</label>
              <div className="value">{new Date(selectedPaginationConfig.updated_at).toLocaleString()}</div>
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
        <h1>Pagination Configs</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Pagination Config
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={paginationConfigs}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['page_name', 'default_sort_field']}
          exportFilename="pagination-configs"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PaginationConfigs;
