import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const RateLimitLogs = () => {
  const [rateLimitLogs, setRateLimitLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    ip_address: '',
    endpoint: '',
    method: 'GET',
    request_count: '',
    window_start: '',
    window_end: '',
    blocked: 'false',
    user_id: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/rate-limit-logs`);
      setRateLimitLogs(response.data);
    } catch (error) {
      console.error('Error fetching rate limit logs:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch rate limit logs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (log) => {
    try {
      const response = await axios.get(`${API_URL}/rate-limit-logs/${log.id}`);
      setSelectedLog(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching rate limit log details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      ip_address: '',
      endpoint: '',
      method: 'GET',
      request_count: '',
      window_start: '',
      window_end: '',
      blocked: 'false',
      user_id: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      ip_address: selectedLog.ip_address || '',
      endpoint: selectedLog.endpoint || '',
      method: selectedLog.method || 'GET',
      request_count: selectedLog.request_count || '',
      window_start: selectedLog.window_start ? selectedLog.window_start.slice(0, 16) : '',
      window_end: selectedLog.window_end ? selectedLog.window_end.slice(0, 16) : '',
      blocked: selectedLog.blocked ? 'true' : 'false',
      user_id: selectedLog.user_id || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this rate limit log?')) {
      try {
        await axios.delete(`${API_URL}/rate-limit-logs/${selectedLog.id}`);
        setIsDetailView(false);
        setSelectedLog(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Rate limit log deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting rate limit log:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete rate limit log',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/rate-limit-logs/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} rate limit logs deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some rate limit logs',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        blocked: formData.blocked === 'true',
        request_count: formData.request_count ? Number(formData.request_count) : null,
        user_id: formData.user_id ? Number(formData.user_id) : null,
      };
      if (isEditing) {
        await axios.put(`${API_URL}/rate-limit-logs/${selectedLog.id}`, payload);
        const response = await axios.get(`${API_URL}/rate-limit-logs/${selectedLog.id}`);
        setSelectedLog(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Rate limit log updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/rate-limit-logs`, payload);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Rate limit log created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving rate limit log:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save rate limit log',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const columns = [
    { key: 'ip_address', label: 'IP Address', sortable: true },
    { key: 'endpoint', label: 'Endpoint', sortable: true },
    { key: 'method', label: 'Method', sortable: true, filterable: true },
    { key: 'request_count', label: 'Requests', sortable: true },
    {
      key: 'blocked',
      label: 'Blocked',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className={`badge ${row.blocked ? 'badge-red' : 'badge-green'}`}>
          {row.blocked ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'name',
      label: 'User',
      sortable: true,
      render: (row) => row.name || 'Anonymous',
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Rate Limit Log' : 'New Rate Limit Log'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>IP Address</label>
              <input
                type="text"
                name="ip_address"
                value={formData.ip_address}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Endpoint</label>
              <input
                type="text"
                name="endpoint"
                value={formData.endpoint}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Method</label>
                <select
                  name="method"
                  value={formData.method}
                  onChange={handleInputChange}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="form-group">
                <label>Request Count</label>
                <input
                  type="number"
                  name="request_count"
                  value={formData.request_count}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Window Start</label>
                <input
                  type="datetime-local"
                  name="window_start"
                  value={formData.window_start}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Window End</label>
                <input
                  type="datetime-local"
                  name="window_end"
                  value={formData.window_end}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Blocked</label>
                <select
                  name="blocked"
                  value={formData.blocked}
                  onChange={handleInputChange}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label>User ID</label>
                <input
                  type="number"
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleInputChange}
                />
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

  if (isDetailView && selectedLog) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Rate Limit Logs
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedLog.ip_address}</h2>
              <p className="subtitle">{selectedLog.endpoint || 'N/A'}</p>
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
              <label>IP Address</label>
              <div className="value">{selectedLog.ip_address || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Endpoint</label>
              <div className="value">{selectedLog.endpoint || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Method</label>
              <div className="value">{selectedLog.method || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Request Count</label>
              <div className="value">{selectedLog.request_count ?? 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Window Start</label>
              <div className="value">
                {selectedLog.window_start ? new Date(selectedLog.window_start).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div className="detail-item">
              <label>Window End</label>
              <div className="value">
                {selectedLog.window_end ? new Date(selectedLog.window_end).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div className="detail-item">
              <label>Blocked</label>
              <div className="value">
                <span className={`badge ${selectedLog.blocked ? 'badge-red' : 'badge-green'}`}>
                  {selectedLog.blocked ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>User Name</label>
              <div className="value">{selectedLog.name || 'Anonymous'}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedLog.email || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedLog.created_at).toLocaleString()}</div>
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
        <h1>Rate Limit Logs</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Rate Limit Log
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={rateLimitLogs}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['ip_address', 'endpoint', 'method', 'name']}
          exportFilename="rate-limit-logs"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default RateLimitLogs;
