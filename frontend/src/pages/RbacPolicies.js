import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const RbacPolicies = () => {
  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    role_name: 'admin',
    resource: '',
    action: 'read',
    effect: 'allow',
    conditions: '',
    priority: '',
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
      const response = await axios.get(`${API_URL}/rbac-policies`);
      setPolicies(response.data);
    } catch (error) {
      console.error('Error fetching RBAC policies:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch RBAC policies',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (policy) => {
    try {
      const response = await axios.get(`${API_URL}/rbac-policies/${policy.id}`);
      setSelectedPolicy(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching RBAC policy details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      role_name: 'admin',
      resource: '',
      action: 'read',
      effect: 'allow',
      conditions: '',
      priority: '',
      enabled: 'true',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      role_name: selectedPolicy.role_name || 'admin',
      resource: selectedPolicy.resource || '',
      action: selectedPolicy.action || 'read',
      effect: selectedPolicy.effect || 'allow',
      conditions: selectedPolicy.conditions || '',
      priority: selectedPolicy.priority != null ? selectedPolicy.priority : '',
      enabled: selectedPolicy.enabled != null ? String(selectedPolicy.enabled) : 'true',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this RBAC policy?')) {
      try {
        await axios.delete(`${API_URL}/rbac-policies/${selectedPolicy.id}`);
        setIsDetailView(false);
        setSelectedPolicy(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'RBAC policy deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting RBAC policy:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete RBAC policy',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/rbac-policies/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} RBAC policies deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some RBAC policies',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/rbac-policies/${selectedPolicy.id}`, formData);
        const response = await axios.get(`${API_URL}/rbac-policies/${selectedPolicy.id}`);
        setSelectedPolicy(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'RBAC policy updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/rbac-policies`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'RBAC policy created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving RBAC policy:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save RBAC policy',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const columns = [
    { key: 'role_name', label: 'Role', sortable: true, filterable: true },
    { key: 'resource', label: 'Resource', sortable: true },
    { key: 'action', label: 'Action', sortable: true, filterable: true },
    {
      key: 'effect',
      label: 'Effect',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span
          className={`badge ${row.effect === 'allow' ? 'badge-green' : 'badge-red'}`}
        >
          {row.effect}
        </span>
      ),
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
          <h2>{isEditing ? 'Edit RBAC Policy' : 'New RBAC Policy'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Role Name</label>
              <select
                name="role_name"
                value={formData.role_name}
                onChange={handleInputChange}
                required
              >
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="user">user</option>
              </select>
            </div>
            <div className="form-group">
              <label>Resource</label>
              <input
                type="text"
                name="resource"
                value={formData.resource}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Action</label>
                <select
                  name="action"
                  value={formData.action}
                  onChange={handleInputChange}
                  required
                >
                  <option value="create">create</option>
                  <option value="read">read</option>
                  <option value="update">update</option>
                  <option value="delete">delete</option>
                  <option value="export">export</option>
                </select>
              </div>
              <div className="form-group">
                <label>Effect</label>
                <select
                  name="effect"
                  value={formData.effect}
                  onChange={handleInputChange}
                  required
                >
                  <option value="allow">allow</option>
                  <option value="deny">deny</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Conditions</label>
              <input
                type="text"
                name="conditions"
                value={formData.conditions}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <input
                  type="number"
                  name="priority"
                  value={formData.priority}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Enabled</label>
                <select
                  name="enabled"
                  value={formData.enabled}
                  onChange={handleInputChange}
                  required
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

  if (isDetailView && selectedPolicy) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to RBAC Policies
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedPolicy.role_name} - {selectedPolicy.resource}</h2>
              <p className="subtitle">{selectedPolicy.action} / {selectedPolicy.effect}</p>
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
              <label>Role Name</label>
              <div className="value">{selectedPolicy.role_name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Resource</label>
              <div className="value">{selectedPolicy.resource || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Action</label>
              <div className="value">{selectedPolicy.action || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Effect</label>
              <div className="value">{selectedPolicy.effect || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Conditions</label>
              <div className="value">{selectedPolicy.conditions || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Priority</label>
              <div className="value">{selectedPolicy.priority != null ? selectedPolicy.priority : 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Enabled</label>
              <div className="value">{selectedPolicy.enabled ? 'Yes' : 'No'}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedPolicy.created_at).toLocaleString()}</div>
            </div>
            <div className="detail-item">
              <label>Updated At</label>
              <div className="value">{selectedPolicy.updated_at ? new Date(selectedPolicy.updated_at).toLocaleString() : 'N/A'}</div>
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
        <h1>RBAC Policies</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New RBAC Policy
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={policies}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['role_name', 'resource', 'action', 'effect']}
          exportFilename="rbac-policies"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default RbacPolicies;
