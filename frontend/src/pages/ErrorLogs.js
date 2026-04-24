import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const ErrorLogs = () => {
  const [errorLogs, setErrorLogs] = useState([]);
  const [selectedErrorLog, setSelectedErrorLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    error_type: '',
    error_message: '',
    stack_trace: '',
    endpoint: '',
    method: '',
    user_id: '',
    ip_address: '',
    severity: '',
    resolved: 'false',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/error-logs`);
      setErrorLogs(response.data);
    } catch (error) {
      console.error('Error fetching error logs:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch error logs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (errorLog) => {
    try {
      const response = await axios.get(`${API_URL}/error-logs/${errorLog.id}`);
      setSelectedErrorLog(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching error log details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      error_type: '',
      error_message: '',
      stack_trace: '',
      endpoint: '',
      method: '',
      user_id: '',
      ip_address: '',
      severity: '',
      resolved: 'false',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      error_type: selectedErrorLog.error_type || '',
      error_message: selectedErrorLog.error_message || '',
      stack_trace: selectedErrorLog.stack_trace || '',
      endpoint: selectedErrorLog.endpoint || '',
      method: selectedErrorLog.method || '',
      user_id: selectedErrorLog.user_id || '',
      ip_address: selectedErrorLog.ip_address || '',
      severity: selectedErrorLog.severity || '',
      resolved: selectedErrorLog.resolved ? 'true' : 'false',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this error log?')) {
      try {
        await axios.delete(`${API_URL}/error-logs/${selectedErrorLog.id}`);
        setIsDetailView(false);
        setSelectedErrorLog(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Error log deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting error log:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete error log',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/error-logs/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} error logs deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some error logs',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        resolved: formData.resolved === 'true',
        user_id: formData.user_id ? Number(formData.user_id) : null,
      };
      if (isEditing) {
        await axios.put(`${API_URL}/error-logs/${selectedErrorLog.id}`, submitData);
        const response = await axios.get(`${API_URL}/error-logs/${selectedErrorLog.id}`);
        setSelectedErrorLog(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Error log updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/error-logs`, submitData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Error log created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving error log:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save error log',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getSeverityBadge = (severity) => {
    const styles = {
      warning: { backgroundColor: '#f59e0b', color: '#fff' },
      error: { backgroundColor: '#ef4444', color: '#fff' },
      critical: { backgroundColor: '#7c3aed', color: '#fff' },
    };
    const style = styles[severity] || { backgroundColor: '#6b7280', color: '#fff' };
    return (
      <span
        style={{
          ...style,
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}
      >
        {severity || 'N/A'}
      </span>
    );
  };

  const columns = [
    { key: 'error_type', label: 'Error Type', sortable: true },
    {
      key: 'error_message',
      label: 'Message',
      sortable: true,
      render: (row) => row.error_message
        ? (row.error_message.length > 50 ? row.error_message.substring(0, 50) + '...' : row.error_message)
        : 'N/A',
    },
    { key: 'endpoint', label: 'Endpoint', sortable: true },
    { key: 'method', label: 'Method', sortable: true },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      filterable: true,
      render: (row) => getSeverityBadge(row.severity),
    },
    {
      key: 'resolved',
      label: 'Resolved',
      sortable: true,
      filterable: true,
      render: (row) => row.resolved ? 'Yes' : 'No',
    },
    {
      key: 'created_at',
      label: 'Created At',
      sortable: true,
      render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : 'N/A',
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Error Log' : 'New Error Log'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Error Type</label>
              <input
                type="text"
                name="error_type"
                value={formData.error_type}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Error Message</label>
              <textarea
                className="form-control"
                name="error_message"
                value={formData.error_message}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Stack Trace</label>
              <textarea
                className="form-control"
                name="stack_trace"
                value={formData.stack_trace}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Endpoint</label>
                <input
                  type="text"
                  name="endpoint"
                  value={formData.endpoint}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Method</label>
                <select
                  name="method"
                  value={formData.method}
                  onChange={handleInputChange}
                >
                  <option value="">Select Method</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>User ID</label>
                <input
                  type="number"
                  name="user_id"
                  value={formData.user_id}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>IP Address</label>
                <input
                  type="text"
                  name="ip_address"
                  value={formData.ip_address}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Severity</label>
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleInputChange}
                >
                  <option value="">Select Severity</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Resolved</label>
                <select
                  name="resolved"
                  value={formData.resolved}
                  onChange={handleInputChange}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
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

  if (isDetailView && selectedErrorLog) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          &larr; Back to Error Logs
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedErrorLog.error_type || 'Error Log'}</h2>
              <p className="subtitle">{getSeverityBadge(selectedErrorLog.severity)}</p>
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
              <label>Error Type</label>
              <div className="value">{selectedErrorLog.error_type || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Endpoint</label>
              <div className="value">{selectedErrorLog.endpoint || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Method</label>
              <div className="value">{selectedErrorLog.method || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>User Name</label>
              <div className="value">{selectedErrorLog.name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>IP Address</label>
              <div className="value">{selectedErrorLog.ip_address || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Severity</label>
              <div className="value">{getSeverityBadge(selectedErrorLog.severity)}</div>
            </div>
            <div className="detail-item">
              <label>Resolved</label>
              <div className="value">{selectedErrorLog.resolved ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{selectedErrorLog.created_at ? new Date(selectedErrorLog.created_at).toLocaleString() : 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Error Message</label>
            <div className="value">{selectedErrorLog.error_message || 'No message'}</div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Stack Trace</label>
            <div className="value">
              {selectedErrorLog.stack_trace ? (
                <pre style={{ background: '#1e1e1e', color: '#d4d4d4', padding: '12px', borderRadius: '6px', overflow: 'auto', maxHeight: '400px', fontSize: '13px' }}>
                  <code>{selectedErrorLog.stack_trace}</code>
                </pre>
              ) : (
                'No stack trace'
              )}
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
        <h1>Error Logs</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Error Log
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={errorLogs}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['error_type', 'error_message', 'endpoint', 'ip_address']}
          exportFilename="error-logs"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default ErrorLogs;
