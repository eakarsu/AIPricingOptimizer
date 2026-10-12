import React from 'react';

// Choices come only from products returned by the application. Selecting one never generates.
export default function ProductSelectionPresets({ products, onChange, disabled = false }) {
  if (products.length < 2) return <p className="ai-muted">Load at least two real products to use the example selections. You can select an available product manually.</p>;
  return <div className="ai-actions" aria-label="Product examples">
    {products.slice(0, 3).map((product) => <button key={product.id} type="button" className="btn btn-secondary btn-small" disabled={disabled} onClick={() => onChange(String(product.id))}>Use {product.name}</button>)}
  </div>;
}
