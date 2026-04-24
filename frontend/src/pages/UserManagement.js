import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      // Mock data for demo
      setUsers([
        { id: 1, name: 'Admin User', email: 'admin@pricingoptimizer.com', role: 'admin', created_at: '2024-01-01' },
        { id: 2, name: 'John Doe', email: 'john@example.com', role: 'user', created_at: '2024-01-15' },
        { id: 3, name: 'Jane Smith', email: 'jane@example.com', role: 'manager', created_at: '2024-02-01' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (user) => {
    try {
      const response = await axios.get(`${API_URL}/users/${user.id}`);
      setSelectedUser(response.data);
      setIsDetailModalOpen(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Fallback to local data
      setSelectedUser(user);
      setIsDetailModalOpen(true);
    }
  };

  const handleNewUser = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'user',
    });
    setIsEditing(false);
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      name: selectedUser.name,
      email: selectedUser.email,
      password: '',
      role: selectedUser.role,
    });
    setIsDetailModalOpen(false);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    });
    setIsEditing(true);
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedUser.name}?`)) {
      try {
        await axios.delete(`${API_URL}/users/${selectedUser.id}`);
        setIsDetailModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
        addNotification({ type: 'success', title: 'Deleted', message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        addNotification({ type: 'error', title: 'Error', message: 'Failed to delete user' });
      }
    }
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Are you sure you want to delete ${user.name}?`)) {
      try {
        await axios.delete(`${API_URL}/users/${user.id}`);
        fetchUsers();
        addNotification({ type: 'success', title: 'Deleted', message: 'User deleted successfully' });
      } catch (error) {
        console.error('Error deleting user:', error);
        // For demo, just filter out
        setUsers(prev => prev.filter(u => u.id !== user.id));
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/users/${id}`)));
      fetchUsers();
      addNotification({ type: 'success', title: 'Deleted', message: `${ids.length} users deleted` });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      setUsers(prev => prev.filter(u => !ids.includes(u.id)));
      addNotification({ type: 'error', title: 'Error', message: 'Failed to delete some users' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/users/${selectedUser.id}`, formData);
        // Refresh selected user data
        const response = await axios.get(`${API_URL}/users/${selectedUser.id}`);
        setSelectedUser(response.data);
        addNotification({ type: 'success', title: 'Updated', message: 'User updated successfully' });
      } else {
        await axios.post(`${API_URL}/users`, formData);
        addNotification({ type: 'success', title: 'Created', message: 'User created successfully' });
      }
      fetchUsers();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving user:', error);
      addNotification({ type: 'error', title: 'Error', message: 'Failed to save user' });
      // For demo, add locally
      if (!isEditing) {
        setUsers(prev => [...prev, {
          id: Date.now(),
          ...formData,
          created_at: new Date().toISOString(),
        }]);
      } else {
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...formData } : u));
      }
      setIsModalOpen(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      filterable: true,
      render: (row) => (
        <span className={`badge badge-${row.role}`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit User' : 'Add New User'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>{isEditing ? 'New Password (leave blank to keep current)' : 'Password'}</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!isEditing}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
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

  const renderDetailModal = () => (
    isDetailModalOpen && selectedUser && (
      <div className="modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="detail-header" style={{ marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0 }}>{selectedUser.name}</h2>
              <p className="subtitle" style={{ margin: '5px 0 0 0', color: '#666' }}>{selectedUser.email}</p>
            </div>
          </div>

          <div className="detail-grid" style={{ marginBottom: '20px' }}>
            <div className="detail-item">
              <label>Name</label>
              <div className="value">{selectedUser.name}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedUser.email}</div>
            </div>
            <div className="detail-item">
              <label>Role</label>
              <div className="value">
                <span className={`badge badge-${selectedUser.role}`}>
                  {selectedUser.role}
                </span>
              </div>
            </div>
            <div className="detail-item">
              <label>Created</label>
              <div className="value">{new Date(selectedUser.created_at).toLocaleDateString()}</div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
              Close
            </button>
            <button type="button" className="btn btn-primary" onClick={handleEdit}>
              Edit
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    )
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewUser}>
          + Add User
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          onRowClick={handleRowClick}
          searchableColumns={['name', 'email']}
          onBulkDelete={handleBulkDelete}
          exportFilename="users"
        />
      )}

      {renderModal()}
      {renderDetailModal()}
    </Layout>
  );
};

export default UserManagement;
