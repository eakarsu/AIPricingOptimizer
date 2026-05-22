import React, { useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5100/api';

export default function RecommendationPdfPanel() {
  const [sku, setSku] = useState('SKU-1001');
  const [reason, setReason] = useState('Quarterly competitive repricing');
  const [status, setStatus] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    setStatus(null);
    try {
      const res = await axios.get(`${API_URL}/custom-views/recommendation-pdf`, {
        params: { sku, reason },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pricing_${sku}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Downloaded pricing_${sku}.pdf (${res.data.size} bytes)`);
    } catch (e) {
      setStatus(`Error: ${e.response?.data?.error || e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div data-testid="pdf-panel" style={{ background: '#111827', padding: 16, borderRadius: 8 }}>
      <h3 style={{ color: '#e5e7eb', margin: '0 0 12px 0' }}>Pricing Recommendation PDF</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 12 }}>
        <label style={{ color: '#9ca3af', alignSelf: 'center' }}>SKU</label>
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          style={{ padding: 8, background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        />
        <label style={{ color: '#9ca3af', alignSelf: 'center' }}>Reason</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          style={{ padding: 8, background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 }}
        />
      </div>
      <button
        onClick={download}
        disabled={downloading}
        style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: downloading ? 0.6 : 1 }}
      >
        {downloading ? 'Generating...' : 'Download PDF'}
      </button>
      {status && <div style={{ marginTop: 10, color: '#9ca3af', fontSize: 13 }}>{status}</div>}
    </div>
  );
}
