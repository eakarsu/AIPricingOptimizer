import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const LoadingConfigs = () => {
  const [loadingConfigs, setLoadingConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    component_name: '',
    loading_type: 'spinner',
    skeleton_count: '',
    timeout_ms: '',
    retry_count: '',
    show_progress: 'false',
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
      const response = await axios.get(`${API_URL}/loading-configs`);
      setLoadingConfigs(response.data);
    } catch (error) {
      console.error('Error fetching loading configs:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch loading configs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (config) => {
    try {
      const response = await axios.get(`${API_URL}/loading-configs/${config.id}`);
      setSelectedConfig(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching loading config details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      component_name: '',
      loading_type: 'spinner',
      skeleton_count: '',
      timeout_ms: '',
      retry_count: '',
      show_progress: 'false',
      enabled: 'true',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      component_name: selectedConfig.component_name || '',
      loading_type: selectedConfig.loading_type || 'spinner',
      skeleton_count: selectedConfig.skeleton_count || '',
      timeout_ms: selectedConfig.timeout_ms || '',
      retry_count: selectedConfig.retry_count || '',
      show_progress: String(selectedConfig.show_progress) || 'false',
      enabled: String(selectedConfig.enabled) || 'true',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this loading config?')) {
      try {
        await axios.delete(`${API_URL}/loading-configs/${selectedConfig.id}`);
        setIsDetailView(false);
        setSelectedConfig(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Loading config deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting loading config:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete loading config',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/loading-configs/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} loading configs deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some loading configs',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/loading-configs/${selectedConfig.id}`, formData);
        const response = await axios.get(`${API_URL}/loading-configs/${selectedConfig.id}`);
        setSelectedConfig(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Loading config updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/loading-configs`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Loading config created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving loading config:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save loading config',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatSeconds = (ms) => {
    if (ms == null) return 'N/A';
    return (ms / 1000).toFixed(1) + 's';
  };

  const columns = [
    { key: 'component_name', label: 'Component', sortable: true },
    { key: 'loading_type', label: 'Type', sortable: true, filterable: true },
    { key: 'skeleton_count', label: 'Skeleton Count', sortable: true },
    {
      key: 'timeout_ms',
      label: 'Timeout',
      sortable: true,
      render: (row) => formatSeconds(row.timeout_ms),
    },
    { key: 'retry_count', label: 'Retries', sortable: true },
    {
      key: 'enabled',
      label: 'Enabled',
      sortable: true,
      filterable: true,
      render: (row) => row.enabled ? 'Yes' : 'No',
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Loading Config' : 'New Loading Config'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Component Name</label>
              <input
                type="text"
                name="component_name"
                value={formData.component_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Loading Type</label>
                <select
                  name="loading_type"
                  value={formData.loading_type}
                  onChange={handleInputChange}
                >
                  <option value="spinner">spinner</option>
                  <option value="skeleton">skeleton</option>
                  <option value="pulse">pulse</option>
                  <option value="progress">progress</option>
                </select>
              </div>
              <div className="form-group">
                <label>Skeleton Count</label>
                <input
                  type="number"
                  name="skeleton_count"
                  value={formData.skeleton_count}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Timeout (ms)</label>
                <input
                  type="number"
                  name="timeout_ms"
                  value={formData.timeout_ms}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Retry Count</label>
                <input
                  type="number"
                  name="retry_count"
                  value={formData.retry_count}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Show Progress</label>
                <select
                  name="show_progress"
                  value={formData.show_progress}
                  onChange={handleInputChange}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
              <div className="form-group">
                <label>Enabled</label>
                <select
                  name="enabled"
                  value={formData.enabled}
                  onChange={handleInputChange}
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
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

  if (isDetailView && selectedConfig) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Loading Configs
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedConfig.component_name}</h2>
              <p className="subtitle">Type: {selectedConfig.loading_type || 'N/A'}</p>
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
              <label>Component Name</label>
              <div className="value">{selectedConfig.component_name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Loading Type</label>
              <div className="value">{selectedConfig.loading_type || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Skeleton Count</label>
              <div className="value">{selectedConfig.skeleton_count != null ? selectedConfig.skeleton_count : 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Timeout (ms)</label>
              <div className="value">{selectedConfig.timeout_ms != null ? selectedConfig.timeout_ms : 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Retry Count</label>
              <div className="value">{selectedConfig.retry_count != null ? selectedConfig.retry_count : 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Show Progress</label>
              <div className="value">{selectedConfig.show_progress ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Enabled</label>
              <div className="value">{selectedConfig.enabled ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedConfig.created_at).toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>Updated At</label>
              <div className="value">{selectedConfig.updated_at ? new Date(selectedConfig.updated_at).toLocaleString() : 'N/A'}</div>
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
        <h1>Loading Configs</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Loading Config
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={loadingConfigs}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['component_name', 'loading_type']}
          exportFilename="loading-configs"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default LoadingConfigs;
