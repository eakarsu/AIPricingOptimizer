import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const EmailVerifications = () => {
  const [emailVerifications, setEmailVerifications] = useState([]);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    token: '',
    verified: 'false',
    expires_at: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/email-verifications`);
      setEmailVerifications(response.data);
    } catch (error) {
      console.error('Error fetching email verifications:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch email verifications',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (verification) => {
    try {
      const response = await axios.get(`${API_URL}/email-verifications/${verification.id}`);
      setSelectedVerification(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching email verification details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      user_id: '',
      token: '',
      verified: 'false',
      expires_at: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      user_id: selectedVerification.user_id || '',
      token: selectedVerification.token || '',
      verified: selectedVerification.verified ? 'true' : 'false',
      expires_at: selectedVerification.expires_at
        ? new Date(selectedVerification.expires_at).toISOString().slice(0, 16)
        : '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this email verification?')) {
      try {
        await axios.delete(`${API_URL}/email-verifications/${selectedVerification.id}`);
        setIsDetailView(false);
        setSelectedVerification(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Email verification deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting email verification:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete email verification',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/email-verifications/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} email verifications deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some email verifications',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        user_id: Number(formData.user_id),
        verified: formData.verified === 'true',
      };
      if (isEditing) {
        await axios.put(`${API_URL}/email-verifications/${selectedVerification.id}`, payload);
        const response = await axios.get(`${API_URL}/email-verifications/${selectedVerification.id}`);
        setSelectedVerification(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Email verification updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/email-verifications`, payload);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Email verification created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving email verification:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save email verification',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const columns = [
    { key: 'name', label: 'User Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'token',
      label: 'Token',
      sortable: true,
      render: (row) => row.token ? row.token.substring(0, 20) + (row.token.length > 20 ? '...' : '') : '-',
    },
    {
      key: 'verified',
      label: 'Verified',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span style={{ color: row.verified ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
          {row.verified ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'expires_at',
      label: 'Expires At',
      sortable: true,
      render: (row) => row.expires_at ? new Date(row.expires_at).toLocaleString() : '-',
    },
    {
      key: 'created_at',
      label: 'Created At',
      sortable: true,
      render: (row) => row.created_at ? new Date(row.created_at).toLocaleString() : '-',
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Email Verification' : 'New Email Verification'}</h2>
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
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Verified</label>
                <select
                  name="verified"
                  value={formData.verified}
                  onChange={handleInputChange}
                >
                  <option value="false">False</option>
                  <option value="true">True</option>
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

  if (isDetailView && selectedVerification) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          &larr; Back to Email Verifications
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedVerification.name || 'Email Verification'}</h2>
              <p className="subtitle">{selectedVerification.email || 'N/A'}</p>
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
              <div className="value">{selectedVerification.name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedVerification.email || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Token</label>
              <div className="value">{selectedVerification.token || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Verified</label>
              <div className="value">
                <span style={{ color: selectedVerification.verified ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {selectedVerification.verified ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>Expires At</label>
              <div className="value">
                {selectedVerification.expires_at ? new Date(selectedVerification.expires_at).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">
                {selectedVerification.created_at ? new Date(selectedVerification.created_at).toLocaleString() : 'N/A'}
              </div>
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
        <h1>Email Verifications</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Email Verification
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={emailVerifications}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'email', 'token']}
          exportFilename="email-verifications"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default EmailVerifications;
