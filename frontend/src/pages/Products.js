import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import DataTable from '../components/DataTable';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    current_price: '',
    cost: '',
    category: '',
    sku: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const { addNotification } = useNotifications();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API_URL}/products`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch products',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = async (product) => {
    try {
      const response = await axios.get(`${API_URL}/products/${product.id}`);
      setSelectedProduct(response.data);
      setIsDetailView(true);
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  };

  const handleNewProduct = () => {
    setFormData({
      name: '',
      description: '',
      current_price: '',
      cost: '',
      category: '',
      sku: '',
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = () => {
    setFormData({
      name: selectedProduct.name,
      description: selectedProduct.description || '',
      current_price: selectedProduct.current_price,
      cost: selectedProduct.cost,
      category: selectedProduct.category || '',
      sku: selectedProduct.sku || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await axios.delete(`${API_URL}/products/${selectedProduct.id}`);
        setIsDetailView(false);
        setSelectedProduct(null);
        fetchProducts();
        addNotification({
          type: 'success',
          title: 'Deleted',
          message: 'Product deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting product:', error);
        addNotification({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete product',
        });
      }
    }
  };

  const handleBulkDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => axios.delete(`${API_URL}/products/${id}`)));
      fetchProducts();
      addNotification({
        type: 'success',
        title: 'Deleted',
        message: `${ids.length} products deleted successfully`,
      });
    } catch (error) {
      console.error('Error bulk deleting:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to delete some products',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_URL}/products/${selectedProduct.id}`, formData);
        const response = await axios.get(`${API_URL}/products/${selectedProduct.id}`);
        setSelectedProduct(response.data);
        addNotification({
          type: 'success',
          title: 'Updated',
          message: 'Product updated successfully',
        });
      } else {
        await axios.post(`${API_URL}/products`, formData);
        addNotification({
          type: 'success',
          title: 'Created',
          message: 'Product created successfully',
        });
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save product',
      });
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const calculateMargin = (price, cost) => {
    if (!price || !cost) return '0%';
    return ((price - cost) / price * 100).toFixed(1) + '%';
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'category', label: 'Category', sortable: true, filterable: true },
    {
      key: 'current_price',
      label: 'Current Price',
      sortable: true,
      render: (row) => formatCurrency(row.current_price),
    },
    {
      key: 'cost',
      label: 'Cost',
      sortable: true,
      render: (row) => formatCurrency(row.cost),
    },
    {
      key: 'margin',
      label: 'Margin',
      sortable: false,
      render: (row) => calculateMargin(row.current_price, row.cost),
    },
  ];

  // Modal component to reuse in both views
  const renderModal = () => (
    isModalOpen && (
      <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>{isEditing ? 'Edit Product' : 'New Product'}</h2>
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
            <div className="form-row">
              <div className="form-group">
                <label>Current Price</label>
                <input
                  type="number"
                  step="0.01"
                  name="current_price"
                  value={formData.current_price}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Cost</label>
                <input
                  type="number"
                  step="0.01"
                  name="cost"
                  value={formData.cost}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label>SKU</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                className="form-control"
                name="description"
                value={formData.description}
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

  if (isDetailView && selectedProduct) {
    return (
      <Layout>
        <span className="back-button" onClick={() => setIsDetailView(false)}>
          ← Back to Products
        </span>

        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selectedProduct.name}</h2>
              <p className="subtitle">SKU: {selectedProduct.sku || 'N/A'}</p>
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
              <label>Current Price</label>
              <div className="value">{formatCurrency(selectedProduct.current_price)}</div>
            </div>
            <div className="detail-item">
              <label>Cost</label>
              <div className="value">{formatCurrency(selectedProduct.cost)}</div>
            </div>
            <div className="detail-item">
              <label>Margin</label>
              <div className="value">{calculateMargin(selectedProduct.current_price, selectedProduct.cost)}</div>
            </div>
            <div className="detail-item">
              <label>Category</label>
              <div className="value">{selectedProduct.category || 'N/A'}</div>
            </div>
          </div>

          <div className="detail-item" style={{ marginBottom: '20px' }}>
            <label>Description</label>
            <div className="value">{selectedProduct.description || 'No description'}</div>
          </div>

          <div className="detail-item">
            <label>Created At</label>
            <div className="value">{new Date(selectedProduct.created_at).toLocaleString()}</div>
          </div>
        </div>

        {renderModal()}
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Products</h1>
        <button className="btn btn-primary btn-small" onClick={handleNewProduct}>
          + New Product
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <DataTable
          columns={columns}
          data={products}
          onRowClick={handleRowClick}
          onBulkDelete={handleBulkDelete}
          searchableColumns={['name', 'sku', 'category', 'description']}
          exportFilename="products"
        />
      )}

      {renderModal()}
    </Layout>
  );
};

export default Products;
