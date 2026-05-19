import React from 'react';
import Layout from '../components/Layout';
import ElasticityChart from '../components/ElasticityChart';
import MarginHeatmap from '../components/MarginHeatmap';
import RecommendationPdfPanel from '../components/RecommendationPdfPanel';
import PricingRulesEditor from '../components/PricingRulesEditor';

export default function CustomViewsPage() {
  return (
    <Layout>
      <div style={{ padding: 16 }}>
        <h1 style={{ color: '#e5e7eb', marginBottom: 6 }}>Pricing Views</h1>
        <p style={{ color: '#9ca3af', marginBottom: 20 }}>
          Pricing optimization custom views: elasticity, margin distribution, recommendation export, and rule management.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ElasticityChart />
          <MarginHeatmap />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <RecommendationPdfPanel />
          <PricingRulesEditor />
        </div>
      </div>
    </Layout>
  );
}
