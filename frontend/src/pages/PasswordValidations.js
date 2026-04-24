import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PasswordValidations = () => {
  const [passwordValidations, setPasswordValidations] = useState([]);
  const [selectedValidation, setSelectedValidation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    rule_name: '',
    rule_type: 'length',
    rule_value: '',
    error_message: '',
    severity: 'error',
    enabled: 'true',
    priority: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/password-validations`);
      setPasswordValidations(response.data);
    } catch (error) {
      console.error('Error fetching password validations:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch password validations',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (validation) => {
    try {
      const response = await axios.get(`${API_URL}/password-validations/${validation.id}`);
      setSelectedValidation(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching password validation details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      rule_name: '',
      rule_type: 'length',
      rule_value: '',
      error_message: '',
      severity: 'error',
      enabled: 'true',
      priority: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      rule_name: selectedValidation.rule_name,
      rule_type: selectedValidation.rule_type || 'length',
      rule_value: selectedValidation.rule_value || '',
      error_message: selectedValidation.error_message || '',
      severity: selectedValidation.severity || 'error',
      enabled: String(selectedValidation.enabled),
      priority: selectedValidation.priority || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this password validation?')) {
      try {
        await axios.delete(`${API_URL}/password-validations/${selectedValidation.id}`);
        setIsDetailView(false);
        setSelectedValidation(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Password validation deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting password validation:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete password validation',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/password-validations/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} password validations deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some password validations',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/password-validations/${selectedValidation.id}`, formData);
        const response = await axios.get(`${API_URL}/password-validations/${selectedValidation.id}`);
        setSelectedValidation(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Password validation updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/password-validations`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Password validation created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving password validation:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save password validation',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
    };
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor: `${colors[severity] || '#6b7280'}20`,
          color: colors[severity] || '#6b7280',
        }}
      >
        {severity}
      </span>
    );
  };

  const columns = [
    { key: 'rule_name', label: 'Rule Name', sortable: true },
    { key: 'rule_type', label: 'Type', sortable: true, filterable: true },
    { key: 'rule_value', label: 'Value', sortable: true },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      filterable: true,
      render: (row) => getSeverityBadge(row.severity),
    },
    { key: 'priority', label: 'Priority', sortable: true },
    {
      key: 'enabled',
      label: 'Enabled',
      sortable: true,
      render: (row) => (row.enabled ? 'Yes' : 'No'),
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Password Validation' : 'New Password Validation'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Rule Name</label>
              <input
                type="text"
                name="rule_name"
                value={formData.rule_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Rule Type</label>
                <select
                  name="rule_type"
                  value={formData.rule_type}
                  onChange={handleInputChange}
                >
                  <option value="length">length</option>
                  <option value="pattern">pattern</option>
                  <option value="dictionary">dictionary</option>
                  <option value="custom">custom</option>
                  <option value="history">history</option>
                  <option value="entropy">entropy</option>
                  <option value="expiry">expiry</option>
                  <option value="api">api</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rule Value</label>
                <input
                  type="text"
                  name="rule_value"
                  value={formData.rule_value}
                  onChange={handleInputChange}
                />
              </div>
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
            <div className="form-row">
              <div className="form-group">
                <label>Severity</label>
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleInputChange}
                >
                  <option value="info">info</option>
                  <option value="warning">warning</option>
                  <option value="error">error</option>
                </select>
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
            </div>
            <div className="form-group">
              <label>Priority</label>
              <input
                type="number"
                name="priority"
                value={formData.priority}
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

  if (isDetailView && selectedValidation) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          &larr; Back to Password Validations
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedValidation.rule_name}</h2>
              <p className="subtitle">Type: {selectedValidation.rule_type || 'N/A'}</p>
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
              <label>Rule Name</label>
              <div className="value">{selectedValidation.rule_name}</div>
            </div>
            <div className="detail-item">
              <label>Rule Type</label>
              <div className="value">{selectedValidation.rule_type || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Rule Value</label>
              <div className="value">{selectedValidation.rule_value || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Severity</label>
              <div className="value">{getSeverityBadge(selectedValidation.severity)}</div>
            </div>
            <div className="detail-item">
              <label>Enabled</label>
              <div className="value">{selectedValidation.enabled ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Priority</label>
              <div className="value">{selectedValidation.priority || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Error Message</label>
            <div className="value">{selectedValidation.error_message || 'No error message'}</div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedValidation.created_at).toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>Updated At</label>
              <div className="value">{new Date(selectedValidation.updated_at).toLocaleString()}</div>
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
        <h1>Password Validations</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Password Validation
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={passwordValidations}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['rule_name', 'rule_type', 'rule_value']}
          exportFilename="password-validations"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PasswordValidations;
