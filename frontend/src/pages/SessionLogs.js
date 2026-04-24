import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const SessionLogs = () => {
  const [sessionLogs, setSessionLogs] = useState([]);
  const [selectedSessionLog, setSelectedSessionLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    session_token: '',
    ip_address: '',
    user_agent: '',
    login_at: '',
    logout_at: '',
    status: 'active',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchSessionLogs();
  }, []);

  const fetchSessionLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/session-logs`);
      setSessionLogs(response.data);
    } catch (error) {
      console.error('Error fetching session logs:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch session logs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (sessionLog) => {
    try {
      const response = await axios.get(`${API_URL}/session-logs/${sessionLog.id}`);
      setSelectedSessionLog(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching session log details:', error);
    }
  };

  const handleNewSessionLog = () => {
    setFormData({
      user_id: '',
      session_token: '',
      ip_address: '',
      user_agent: '',
      login_at: '',
      logout_at: '',
      status: 'active',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      user_id: selectedSessionLog.user_id || '',
      session_token: selectedSessionLog.session_token || '',
      ip_address: selectedSessionLog.ip_address || '',
      user_agent: selectedSessionLog.user_agent || '',
      login_at: selectedSessionLog.login_at ? selectedSessionLog.login_at.slice(0, 16) : '',
      logout_at: selectedSessionLog.logout_at ? selectedSessionLog.logout_at.slice(0, 16) : '',
      status: selectedSessionLog.status || 'active',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this session log?')) {
      try {
        await axios.delete(`${API_URL}/session-logs/${selectedSessionLog.id}`);
        setIsDetailView(false);
        setSelectedSessionLog(null);
        fetchSessionLogs();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Session log deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting session log:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete session log',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/session-logs/${id}`)));
      fetchSessionLogs();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} session logs deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some session logs',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/session-logs/${selectedSessionLog.id}`, formData);
        const response = await axios.get(`${API_URL}/session-logs/${selectedSessionLog.id}`);
        setSelectedSessionLog(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Session log updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/session-logs`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Session log created successfully',
        });
      }
      setIsModalOpen(false);
      fetchSessionLogs();
    } catch (error) {
      console.error('Error saving session log:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save session log',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatDateTime = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: { backgroundColor: '#dcfce7', color: '#166534' },
      completed: { backgroundColor: '#dbeafe', color: '#1e40af' },
      expired: { backgroundColor: '#fef3c7', color: '#92400e' },
      failed: { backgroundColor: '#fee2e2', color: '#991b1b' },
    };
    const style = statusStyles[status] || { backgroundColor: '#f3f4f6', color: '#374151' };
    return (
      <span
        style={{
          ...style,
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
        }}
      >
        {status}
      </span>
    );
  };

  const columns = [
    { key: 'name', label: 'User Name', sortable: true },
    { key: 'ip_address', label: 'IP Address', sortable: true },
    {
      key: 'login_at',
      label: 'Login At',
      sortable: true,
      render: (row) => formatDateTime(row.login_at),
    },
    {
      key: 'logout_at',
      label: 'Logout At',
      sortable: true,
      render: (row) => row.logout_at ? formatDateTime(row.logout_at) : 'Active',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (row) => getStatusBadge(row.status),
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Session Log' : 'New Session Log'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>User ID</label>
              <input
                type="number"
                name="user_id"
                value={formData.user_id}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Session Token</label>
              <input
                type="text"
                name="session_token"
                value={formData.session_token}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>IP Address</label>
                <input
                  type="text"
                  name="ip_address"
                  value={formData.ip_address}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="expired">Expired</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>User Agent</label>
              <input
                type="text"
                name="user_agent"
                value={formData.user_agent}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Login At</label>
                <input
                  type="datetime-local"
                  name="login_at"
                  value={formData.login_at}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Logout At</label>
                <input
                  type="datetime-local"
                  name="logout_at"
                  value={formData.logout_at}
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

  if (isDetailView && selectedSessionLog) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Session Logs
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedSessionLog.name || 'Session Log'}</h2>
              <p className="subtitle">Session: {selectedSessionLog.session_token || 'N/A'}</p>
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
              <label>User Name</label>
              <div className="value">{selectedSessionLog.name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedSessionLog.email || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Session Token</label>
              <div className="value">{selectedSessionLog.session_token || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>IP Address</label>
              <div className="value">{selectedSessionLog.ip_address || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>User Agent</label>
            <div className="value">{selectedSessionLog.user_agent || 'N/A'}</div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Login At</label>
              <div className="value">{formatDateTime(selectedSessionLog.login_at)}</div>
            </div>
            <div className="detail-item">
              <label>Logout At</label>
              <div className="value">{selectedSessionLog.logout_at ? formatDateTime(selectedSessionLog.logout_at) : 'Active'}</div>
            </div>
            <div className="detail-item">
              <label>Status</label>
              <div className="value">{getStatusBadge(selectedSessionLog.status)}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{formatDateTime(selectedSessionLog.created_at)}</div>
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
        <h1>Session Logs</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewSessionLog}>
          + New Session Log
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={sessionLogs}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'email', 'ip_address', 'session_token']}
          exportFilename="session-logs"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default SessionLogs;
