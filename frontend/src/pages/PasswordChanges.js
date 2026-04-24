import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PasswordChanges = () => {
  const [passwordChanges, setPasswordChanges] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    change_type: 'manual',
    ip_address: '',
    user_agent: '',
    status: 'success',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchPasswordChanges();
  }, []);

  const fetchPasswordChanges = async () => {
    try {
      const response = await axios.get(`${API_URL}/password-changes`);
      setPasswordChanges(response.data);
    } catch (error) {
      console.error('Error fetching password changes:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch password changes',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (record) => {
    try {
      const response = await axios.get(`${API_URL}/password-changes/${record.id}`);
      setSelectedRecord(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching password change details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      user_id: '',
      change_type: 'manual',
      ip_address: '',
      user_agent: '',
      status: 'success',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      user_id: selectedRecord.user_id,
      change_type: selectedRecord.change_type || 'manual',
      ip_address: selectedRecord.ip_address || '',
      user_agent: selectedRecord.user_agent || '',
      status: selectedRecord.status || 'success',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this password change record?')) {
      try {
        await axios.delete(`${API_URL}/password-changes/${selectedRecord.id}`);
        setIsDetailView(false);
        setSelectedRecord(null);
        fetchPasswordChanges();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Password change record deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting password change:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete password change record',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/password-changes/${id}`)));
      fetchPasswordChanges();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} password change records deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some password change records',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/password-changes/${selectedRecord.id}`, formData);
        const response = await axios.get(`${API_URL}/password-changes/${selectedRecord.id}`);
        setSelectedRecord(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Password change record updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/password-changes`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Password change record created successfully',
        });
      }
      setIsModalOpen(false);
      fetchPasswordChanges();
    } catch (error) {
      console.error('Error saving password change:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save password change record',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString();
  };

  const columns = [
    { key: 'name', label: 'User Name', sortable: true },
    { key: 'change_type', label: 'Change Type', sortable: true, filterable: true },
    { key: 'ip_address', label: 'IP Address', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className={`status-badge status-${row.status}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created At',
      sortable: true,
      render: (row) => formatDate(row.created_at),
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Password Change' : 'New Password Change'}</h2>
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
            <div className="form-row">
              <div className="form-group">
                <label>Change Type</label>
                <select
                  name="change_type"
                  value={formData.change_type}
                  onChange={handleInputChange}
                  required
                >
                  <option value="manual">Manual</option>
                  <option value="reset">Reset</option>
                  <option value="forced">Forced</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                >
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
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
            <div className="form-group">
              <label>User Agent</label>
              <textarea
                className="form-control"
                name="user_agent"
                value={formData.user_agent}
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

  if (isDetailView && selectedRecord) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          &larr; Back to Password Changes
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedRecord.name || 'Unknown User'}</h2>
              <p className="subtitle">{selectedRecord.email || 'No email'}</p>
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
              <div className="value">{selectedRecord.name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedRecord.email || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Change Type</label>
              <div className="value">{selectedRecord.change_type || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>IP Address</label>
              <div className="value">{selectedRecord.ip_address || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>User Agent</label>
            <div className="value">{selectedRecord.user_agent || 'N/A'}</div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Status</label>
              <div className="value">
                <span className={`status-badge status-${selectedRecord.status}`}>
                  {selectedRecord.status}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{formatDate(selectedRecord.created_at)}</div>
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
        <h1>Password Changes</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Password Change
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={passwordChanges}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'email', 'ip_address', 'change_type']}
          exportFilename="password-changes"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PasswordChanges;
