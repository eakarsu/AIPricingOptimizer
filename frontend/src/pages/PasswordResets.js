import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PasswordResets = () => {
  const [passwordResets, setPasswordResets] = useState([]);
  const [selectedPasswordReset, setSelectedPasswordReset] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    token: '',
    used: '',
    expires_at: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchPasswordResets();
  }, []);

  const fetchPasswordResets = async () => {
    try {
      const response = await axios.get(`${API_URL}/password-resets`);
      setPasswordResets(response.data);
    } catch (error) {
      console.error('Error fetching password resets:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch password resets',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (passwordReset) => {
    try {
      const response = await axios.get(`${API_URL}/password-resets/${passwordReset.id}`);
      setSelectedPasswordReset(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching password reset details:', error);
    }
  };

  const handleNewPasswordReset = () => {
    setFormData({
      user_id: '',
      token: '',
      used: '',
      expires_at: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      user_id: selectedPasswordReset.user_id || '',
      token: selectedPasswordReset.token || '',
      used: selectedPasswordReset.used ? '1' : '0',
      expires_at: selectedPasswordReset.expires_at
        ? new Date(selectedPasswordReset.expires_at).toISOString().slice(0, 16)
        : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this password reset?')) {
      try {
        await axios.delete(`${API_URL}/password-resets/${selectedPasswordReset.id}`);
        setIsDetailView(false);
        setSelectedPasswordReset(null);
        fetchPasswordResets();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Password reset deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting password reset:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete password reset',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/password-resets/${id}`)));
      fetchPasswordResets();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} password resets deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some password resets',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/password-resets/${selectedPasswordReset.id}`, formData);
        const response = await axios.get(`${API_URL}/password-resets/${selectedPasswordReset.id}`);
        setSelectedPasswordReset(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Password reset updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/password-resets`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Password reset created successfully',
        });
      }
      setIsModalOpen(false);
      fetchPasswordResets();
    } catch (error) {
      console.error('Error saving password reset:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save password reset',
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

  const truncateToken = (token) => {
    if (!token) return 'N/A';
    if (token.length > 20) return token.substring(0, 20) + '...';
    return token;
  };

  const columns = [
    { key: 'name', label: 'User Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'token',
      label: 'Token',
      sortable: true,
      render: (row) => truncateToken(row.token),
    },
    {
      key: 'used',
      label: 'Used',
      sortable: true,
      filterable: true,
      render: (row) => (row.used ? 'Yes' : 'No'),
    },
    {
      key: 'expires_at',
      label: 'Expires At',
      sortable: true,
      render: (row) => formatDate(row.expires_at),
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
          <h2>{isEditing ? 'Edit Password Reset' : 'New Password Reset'}</h2>
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
              <label>Token</label>
              <input
                type="text"
                name="token"
                value={formData.token}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Used</label>
                <select
                  name="used"
                  value={formData.used}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select...</option>
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="form-group">
                <label>Expires At</label>
                <input
                  type="datetime-local"
                  name="expires_at"
                  value={formData.expires_at}
                  onChange={handleInputChange}
                  required
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

  if (isDetailView && selectedPasswordReset) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Password Resets
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedPasswordReset.name || 'N/A'}</h2>
              <p className="subtitle">{selectedPasswordReset.email || 'N/A'}</p>
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
              <div className="value">{selectedPasswordReset.name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedPasswordReset.email || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Token</label>
              <div className="value">{selectedPasswordReset.token || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Used</label>
              <div className="value">{selectedPasswordReset.used ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Expires At</label>
              <div className="value">{formatDate(selectedPasswordReset.expires_at)}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{formatDate(selectedPasswordReset.created_at)}</div>
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
        <h1>Password Resets</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewPasswordReset}>
          + New Password Reset
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={passwordResets}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'email', 'token']}
          exportFilename="password-resets"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PasswordResets;
