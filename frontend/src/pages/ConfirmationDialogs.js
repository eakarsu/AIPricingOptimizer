import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const ConfirmationDialogs = () => {
  const [confirmationDialogs, setConfirmationDialogs] = useState([]);
  const [selectedDialog, setSelectedDialog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    action_name: '',
    dialog_title: '',
    dialog_message: '',
    confirm_button_text: '',
    cancel_button_text: '',
    severity: 'info',
    requires_input: 'false',
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
      const response = await axios.get(`${API_URL}/confirmation-dialogs`);
      setConfirmationDialogs(response.data);
    } catch (error) {
      console.error('Error fetching confirmation dialogs:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch confirmation dialogs',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (dialog) => {
    try {
      const response = await axios.get(`${API_URL}/confirmation-dialogs/${dialog.id}`);
      setSelectedDialog(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching confirmation dialog details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      action_name: '',
      dialog_title: '',
      dialog_message: '',
      confirm_button_text: '',
      cancel_button_text: '',
      severity: 'info',
      requires_input: 'false',
      enabled: 'true',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      action_name: selectedDialog.action_name || '',
      dialog_title: selectedDialog.dialog_title || '',
      dialog_message: selectedDialog.dialog_message || '',
      confirm_button_text: selectedDialog.confirm_button_text || '',
      cancel_button_text: selectedDialog.cancel_button_text || '',
      severity: selectedDialog.severity || 'info',
      requires_input: String(selectedDialog.requires_input),
      enabled: String(selectedDialog.enabled),
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this confirmation dialog?')) {
      try {
        await axios.delete(`${API_URL}/confirmation-dialogs/${selectedDialog.id}`);
        setIsDetailView(false);
        setSelectedDialog(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Confirmation dialog deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting confirmation dialog:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete confirmation dialog',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/confirmation-dialogs/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} confirmation dialogs deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some confirmation dialogs',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/confirmation-dialogs/${selectedDialog.id}`, formData);
        const response = await axios.get(`${API_URL}/confirmation-dialogs/${selectedDialog.id}`);
        setSelectedDialog(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Confirmation dialog updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/confirmation-dialogs`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Confirmation dialog created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving confirmation dialog:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save confirmation dialog',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getSeverityBadge = (severity) => {
    const styles = {
      info: { backgroundColor: '#dbeafe', color: '#1e40af' },
      warning: { backgroundColor: '#fef3c7', color: '#92400e' },
      danger: { backgroundColor: '#fee2e2', color: '#991b1b' },
    };
    const style = styles[severity] || styles.info;
    return (
      <span
        style={{
          ...style,
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '600',
        }}
      >
        {severity}
      </span>
    );
  };

  const columns = [
    { key: 'action_name', label: 'Action Name', sortable: true },
    { key: 'dialog_title', label: 'Dialog Title', sortable: true },
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      filterable: true,
      render: (row) => getSeverityBadge(row.severity),
    },
    {
      key: 'requires_input',
      label: 'Requires Input',
      sortable: true,
      render: (row) => (row.requires_input ? 'Yes' : 'No'),
    },
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
          <h2>{isEditing ? 'Edit Confirmation Dialog' : 'New Confirmation Dialog'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Action Name</label>
              <input
                type="text"
                name="action_name"
                value={formData.action_name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Dialog Title</label>
              <input
                type="text"
                name="dialog_title"
                value={formData.dialog_title}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>Dialog Message</label>
              <textarea
                className="form-control"
                name="dialog_message"
                value={formData.dialog_message}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Confirm Button Text</label>
                <input
                  type="text"
                  name="confirm_button_text"
                  value={formData.confirm_button_text}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Cancel Button Text</label>
                <input
                  type="text"
                  name="cancel_button_text"
                  value={formData.cancel_button_text}
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
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="danger">Danger</option>
                </select>
              </div>
              <div className="form-group">
                <label>Requires Input</label>
                <select
                  name="requires_input"
                  value={formData.requires_input}
                  onChange={handleInputChange}
                >
                  <option value="true">True</option>
                  <option value="false">False</option>
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
                <option value="true">True</option>
                <option value="false">False</option>
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

  if (isDetailView && selectedDialog) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          &larr; Back to Confirmation Dialogs
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedDialog.action_name}</h2>
              <p className="subtitle">Severity: {getSeverityBadge(selectedDialog.severity)}</p>
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
              <label>Action Name</label>
              <div className="value">{selectedDialog.action_name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Dialog Title</label>
              <div className="value">{selectedDialog.dialog_title || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Confirm Button Text</label>
              <div className="value">{selectedDialog.confirm_button_text || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Cancel Button Text</label>
              <div className="value">{selectedDialog.cancel_button_text || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Dialog Message</label>
            <div className="value">{selectedDialog.dialog_message || 'No message'}</div>
          </div>

          <div className="detail-grid">
            <div className="detail-item">
              <label>Severity</label>
              <div className="value">{getSeverityBadge(selectedDialog.severity)}</div>
            </div>
            <div className="detail-item">
              <label>Requires Input</label>
              <div className="value">{selectedDialog.requires_input ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Enabled</label>
              <div className="value">{selectedDialog.enabled ? 'Yes' : 'No'}</div>
            </div>
          </div>

          <div className="detail-grid" style={{ marginTop: '20px' }}>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedDialog.created_at).toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>Updated At</label>
              <div className="value">{new Date(selectedDialog.updated_at).toLocaleString()}</div>
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
        <h1>Confirmation Dialogs</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New Confirmation Dialog
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={confirmationDialogs}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['action_name', 'dialog_title', 'severity']}
          exportFilename="confirmation-dialogs"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default ConfirmationDialogs;
