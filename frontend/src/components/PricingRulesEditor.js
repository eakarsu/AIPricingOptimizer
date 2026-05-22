import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5100/api';

const empty = { sku: '', min_price: '', max_price: '', competitor_undercut_pct: '', notes: '' };

export default function PricingRulesEditor() {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/custom-views/pricing-rules`);
      setRules(res.data.rules || []);
    } catch (e) {
      setMsg(`Error loading: ${e.response?.data?.error || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setMsg(null);
    try {
      if (editId) {
        await axios.put(`${API_URL}/custom-views/pricing-rules/${editId}`, form);
        setMsg('Rule updated.');
      } else {
        await axios.post(`${API_URL}/custom-views/pricing-rules`, form);
        setMsg('Rule created.');
      }
      setForm(empty);
      setEditId(null);
      load();
    } catch (e) {
      setMsg(`Error: ${e.response?.data?.error || e.message}`);
    }
  };

  const edit = (r) => {
    setEditId(r.id);
    setForm({
      sku: r.sku,
      min_price: r.min_price,
      max_price: r.max_price,
      competitor_undercut_pct: r.competitor_undercut_pct,
      notes: r.notes || '',
    });
  };

  const del = async (id) => {
    if (!window.confirm(`Delete rule ${id}?`)) return;
    try {
      await axios.delete(`${API_URL}/custom-views/pricing-rules/${id}`);
      setMsg(`Deleted rule ${id}.`);
      load();
    } catch (e) {
      setMsg(`Error: ${e.response?.data?.error || e.message}`);
    }
  };

  return (
    <div data-testid="rules-editor" style={{ background: '#111827', padding: 16, borderRadius: 8 }}>
      <h3 style={{ color: '#e5e7eb', margin: '0 0 12px 0' }}>Pricing Rules Editor</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 8, marginBottom: 12 }}>
        <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
          style={inputStyle} />
        <input placeholder="Min $" type="number" value={form.min_price} onChange={(e) => setForm({ ...form, min_price: e.target.value })}
          style={inputStyle} />
        <input placeholder="Max $" type="number" value={form.max_price} onChange={(e) => setForm({ ...form, max_price: e.target.value })}
          style={inputStyle} />
        <input placeholder="Undercut %" type="number" value={form.competitor_undercut_pct} onChange={(e) => setForm({ ...form, competitor_undercut_pct: e.target.value })}
          style={inputStyle} />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          style={inputStyle} />
        <button onClick={save} style={btnStyle}>{editId ? 'Update' : 'Add'}</button>
      </div>
      {msg && <div style={{ color: '#9ca3af', marginBottom: 10, fontSize: 13 }}>{msg}</div>}
      {loading ? (
        <div style={{ color: '#9ca3af' }}>Loading rules...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e5e7eb' }}>
          <thead>
            <tr style={{ background: '#1f2937' }}>
              <th style={th}>ID</th>
              <th style={th}>SKU</th>
              <th style={th}>Min</th>
              <th style={th}>Max</th>
              <th style={th}>Undercut %</th>
              <th style={th}>Notes</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #374151' }}>
                <td style={td}>{r.id}</td>
                <td style={td}><b>{r.sku}</b></td>
                <td style={td}>${Number(r.min_price).toFixed(2)}</td>
                <td style={td}>${Number(r.max_price).toFixed(2)}</td>
                <td style={td}>{Number(r.competitor_undercut_pct).toFixed(2)}%</td>
                <td style={td}>{r.notes || '-'}</td>
                <td style={td}>
                  <button onClick={() => edit(r)} style={smallBtn('#2563eb')}>Edit</button>
                  <button onClick={() => del(r.id)} style={smallBtn('#ef4444')}>Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const inputStyle = { padding: 8, background: '#1f2937', color: '#e5e7eb', border: '1px solid #374151', borderRadius: 6 };
const btnStyle = { padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' };
const th = { padding: 8, textAlign: 'left', borderBottom: '1px solid #374151', fontSize: 12, textTransform: 'uppercase', color: '#9ca3af' };
const td = { padding: 8, fontSize: 13 };
const smallBtn = (bg) => ({ padding: '4px 10px', marginRight: 6, background: bg, color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 });
