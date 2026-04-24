import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const PdfExports = () => {
  const [pdfExports, setPdfExports] = useState([]);
  const [selectedExport, setSelectedExport] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    export_type: '',
    file_name: '',
    file_size: '',
    page_count: '',
    status: 'pending',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/pdf-exports`);
      setPdfExports(response.data);
    } catch (error) {
      console.error('Error fetching pdf exports:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch pdf exports',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (pdfExport) => {
    try {
      const response = await axios.get(`${API_URL}/pdf-exports/${pdfExport.id}`);
      setSelectedExport(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching pdf export details:', error);
    }
  };

  const handleNew = () => {
    setFormData({
      user_id: '',
      export_type: '',
      file_name: '',
      file_size: '',
      page_count: '',
      status: 'pending',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      user_id: selectedExport.user_id || '',
      export_type: selectedExport.export_type || '',
      file_name: selectedExport.file_name || '',
      file_size: selectedExport.file_size || '',
      page_count: selectedExport.page_count || '',
      status: selectedExport.status || 'pending',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this pdf export?')) {
      try {
        await axios.delete(`${API_URL}/pdf-exports/${selectedExport.id}`);
        setIsDetailView(false);
        setSelectedExport(null);
        fetchData();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'PDF export deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting pdf export:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete pdf export',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/pdf-exports/${id}`)));
      fetchData();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} pdf exports deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some pdf exports',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/pdf-exports/${selectedExport.id}`, formData);
        const response = await axios.get(`${API_URL}/pdf-exports/${selectedExport.id}`);
        setSelectedExport(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'PDF export updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/pdf-exports`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'PDF export created successfully',
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving pdf export:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save pdf export',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return 'N/A';
    const num = Number(bytes);
    if (num < 1024) return num + ' B';
    if (num < 1024 * 1024) return (num / 1024).toFixed(1) + ' KB';
    return (num / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusBadge = (status) => {
    const styles = {
      completed: { backgroundColor: '#dcfce7', color: '#166534' },
      failed: { backgroundColor: '#fef2f2', color: '#991b1b' },
      pending: { backgroundColor: '#fef9c3', color: '#854d0e' },
    };
    const style = styles[status] || styles.pending;
    return (
      <span
        style={{
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 500,
          ...style,
        }}
      >
        {status}
      </span>
    );
  };

  const columns = [
    { key: 'name', label: 'User', sortable: true },
    { key: 'export_type', label: 'Export Type', sortable: true },
    { key: 'file_name', label: 'File Name', sortable: true },
    {
      key: 'file_size',
      label: 'File Size',
      sortable: true,
      render: (row) => formatFileSize(row.file_size),
    },
    { key: 'page_count', label: 'Pages', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      render: (row) => getStatusBadge(row.status),
    },
    {
      key: 'created_at',
      label: 'Created At',
      sortable: true,
      render: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit PDF Export' : 'New PDF Export'}</h2>
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
                <label>Export Type</label>
                <input
                  type="text"
                  name="export_type"
                  value={formData.export_type}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>File Name</label>
                <input
                  type="text"
                  name="file_name"
                  value={formData.file_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>File Size (bytes)</label>
                <input
                  type="number"
                  name="file_size"
                  value={formData.file_size}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>Page Count</label>
                <input
                  type="number"
                  name="page_count"
                  value={formData.page_count}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="form-control"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
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

  if (isDetailView && selectedExport) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to PDF Exports
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedExport.file_name}</h2>
              <p className="subtitle">Export Type: {selectedExport.export_type || 'N/A'}</p>
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
              <div className="value">{selectedExport.name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Email</label>
              <div className="value">{selectedExport.email || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Export Type</label>
              <div className="value">{selectedExport.export_type || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>File Name</label>
              <div className="value">{selectedExport.file_name || 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>File Size</label>
              <div className="value">{formatFileSize(selectedExport.file_size)}</div>
            </div>
            <div className="detail-item">
              <label>Page Count</label>
              <div className="value">{selectedExport.page_count ?? 'N/A'}</div>
            </div>
            <div className="detail-item">
              <label>Status</label>
              <div className="value">{getStatusBadge(selectedExport.status)}</div>
            </div>
            <div className="detail-item">
              <label>Created At</label>
              <div className="value">{new Date(selectedExport.created_at).toLocaleString()}</div>
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
        <h1>PDF Exports</h1>
        <button className="btn btn-primary btn-small" onClick={handleNew}>
          + New PDF Export
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={pdfExports}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'email', 'export_type', 'file_name']}
          exportFilename="pdf-exports"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default PdfExports;
