import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { BarChart, LineChart, DonutChart, ChartLegend } from '../components/Charts';
import { useNotifications } from '../context/NotificationContext';

const API_URL = 'http://localhost:3001/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalCompetitors: 0,
    pendingSuggestions: 0,
    newInsights: 0,
    totalBundles: 0,
    totalForecasts: 0,
    totalDiscounts: 0,
    totalElasticity: 0,
    priceAlerts: 0,
    trackedProducts: 0,
    activeTrackerAlerts: 0,
    totalPasswordResets: 0,
    totalPasswordChanges: 0,
    totalSessionLogs: 0,
    totalPaginationConfigs: 0,
    totalPdfExports: 0,
    totalConfirmationDialogs: 0,
    totalErrorLogs: 0,
    totalLoadingConfigs: 0,
    totalRbacPolicies: 0,
    totalRateLimitLogs: 0,
    totalSecurityHeaders: 0,
    totalEmailVerifications: 0,
    totalPasswordValidations: 0,
  });
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [suggestionStatus, setSuggestionStatus] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const statsResponse = await axios.get(`${API_URL}/dashboard/stats`);
      setStats(statsResponse.data);

      // Fetch price history for chart
      const historyResponse = await axios.get(`${API_URL}/price-history`);
      const historyData = historyResponse.data.slice(0, 10).reverse().map(h => ({
        label: h.product_name.substring(0, 15),
        value: parseFloat(h.new_price),
      }));
      setPriceHistory(historyData);

      // Fetch products for category breakdown
      const productsResponse = await axios.get(`${API_URL}/products`);
      const categories = {};
      productsResponse.data.forEach(p => {
        const cat = p.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      setCategoryData(Object.entries(categories).map(([label, value]) => ({ label, value })));

      // Fetch price suggestions for status breakdown
      const suggestionsResponse = await axios.get(`${API_URL}/price-suggestions`);
      const statuses = { pending: 0, approved: 0, rejected: 0 };
      suggestionsResponse.data.forEach(s => {
        if (statuses[s.status] !== undefined) {
          statuses[s.status]++;
        }
      });
      setSuggestionStatus([
        { label: 'Pending', value: statuses.pending, color: '#ffc107' },
        { label: 'Approved', value: statuses.approved, color: '#00c853' },
        { label: 'Rejected', value: statuses.rejected, color: '#ff6b6b' },
      ]);

      // Show notification for new insights
      if (statsResponse.data.newInsights > 0) {
        addNotification({
          type: 'info',
          title: 'New AI Insights',
          message: `You have ${statsResponse.data.newInsights} new AI insights to review.`,
        });
      }

      // Show notification for price alerts
      if (statsResponse.data.priceAlerts > 0) {
        addNotification({
          type: 'warning',
          title: 'Price Alerts',
          message: `${statsResponse.data.priceAlerts} competitor price changes need attention.`,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const existingFeatures = [
    {
      id: 'products',
      title: 'Products',
      description: 'Manage your product catalog and pricing',
      icon: '📦',
      stat: stats.totalProducts,
      statLabel: 'Total Products',
      path: '/products',
    },
    {
      id: 'competitors',
      title: 'Competitor Analysis',
      description: 'Track and analyze competitor pricing strategies',
      icon: '🏢',
      stat: stats.totalCompetitors,
      statLabel: 'Competitors Tracked',
      path: '/competitors',
    },
    {
      id: 'demand',
      title: 'Demand Signals',
      description: 'Monitor market demand indicators and trends',
      icon: '📈',
      stat: '-',
      statLabel: 'Active Signals',
      path: '/demand-signals',
    },
    {
      id: 'suggestions',
      title: 'Price Suggestions',
      description: 'AI-generated pricing recommendations',
      icon: '💡',
      stat: stats.pendingSuggestions,
      statLabel: 'Pending Review',
      path: '/price-suggestions',
    },
    {
      id: 'history',
      title: 'Price History',
      description: 'Track all pricing changes over time',
      icon: '📜',
      stat: '-',
      statLabel: 'Price Changes',
      path: '/price-history',
    },
    {
      id: 'trends',
      title: 'Market Trends',
      description: 'Analyze market trends and their impact',
      icon: '🌍',
      stat: '-',
      statLabel: 'Active Trends',
      path: '/market-trends',
    },
    {
      id: 'insights',
      title: 'AI Insights',
      description: 'Get AI-powered strategic insights',
      icon: '🤖',
      stat: stats.newInsights,
      statLabel: 'New Insights',
      path: '/ai-insights',
    },
  ];

  const newAIFeatures = [
    {
      id: 'competitor-tracking',
      title: 'AI Competitor Price Tracker',
      description: 'Monitor competitor pricing changes in real-time',
      icon: '🎯',
      stat: stats.priceAlerts,
      statLabel: 'Price Alerts',
      path: '/competitor-tracking',
      isNew: true,
    },
    {
      id: 'demand-forecasts',
      title: 'AI Demand Forecaster',
      description: 'Predict demand for dynamic pricing decisions',
      icon: '🔮',
      stat: stats.totalForecasts,
      statLabel: 'Forecasts',
      path: '/demand-forecasts',
      isNew: true,
    },
    {
      id: 'bundle-recommendations',
      title: 'AI Bundle Recommender',
      description: 'Suggest profitable product bundles',
      icon: '📦',
      stat: stats.totalBundles,
      statLabel: 'Bundles',
      path: '/bundle-recommendations',
      isNew: true,
    },
    {
      id: 'discount-optimizations',
      title: 'AI Discount Optimizer',
      description: 'Calculate optimal discount levels',
      icon: '🏷️',
      stat: stats.totalDiscounts,
      statLabel: 'Optimizations',
      path: '/discount-optimizations',
      isNew: true,
    },
    {
      id: 'price-elasticity',
      title: 'AI Price Elasticity Analyzer',
      description: 'Measure price sensitivity and demand curves',
      icon: '📊',
      stat: stats.totalElasticity,
      statLabel: 'Analyzed',
      path: '/price-elasticity',
      isNew: true,
    },
    {
      id: 'price-tracker',
      title: 'AI Price Tracker',
      description: 'Track e-commerce prices and get AI deal analysis',
      icon: '🛒',
      stat: stats.trackedProducts,
      statLabel: 'Products Tracked',
      path: '/price-tracker',
      isNew: true,
    },
  ];

  const adminFeatures = [
    {
      id: 'password-resets',
      title: 'Password Resets',
      description: 'Manage password reset tokens and history',
      icon: '🔑',
      stat: stats.totalPasswordResets,
      statLabel: 'Resets',
      path: '/password-resets',
      isNew: true,
    },
    {
      id: 'password-changes',
      title: 'Password Changes',
      description: 'Track password change activity',
      icon: '🔄',
      stat: stats.totalPasswordChanges,
      statLabel: 'Changes',
      path: '/password-changes',
      isNew: true,
    },
    {
      id: 'session-logs',
      title: 'Session Logs',
      description: 'Monitor user session activity',
      icon: '📋',
      stat: stats.totalSessionLogs,
      statLabel: 'Sessions',
      path: '/session-logs',
      isNew: true,
    },
    {
      id: 'pagination-configs',
      title: 'Pagination Configs',
      description: 'Configure pagination settings per page',
      icon: '📄',
      stat: stats.totalPaginationConfigs,
      statLabel: 'Configs',
      path: '/pagination-configs',
      isNew: true,
    },
    {
      id: 'pdf-exports',
      title: 'PDF Exports',
      description: 'Track PDF export history and status',
      icon: '📑',
      stat: stats.totalPdfExports,
      statLabel: 'Exports',
      path: '/pdf-exports',
      isNew: true,
    },
    {
      id: 'confirmation-dialogs',
      title: 'Confirmation Dialogs',
      description: 'Manage confirmation dialog configurations',
      icon: '💬',
      stat: stats.totalConfirmationDialogs,
      statLabel: 'Dialogs',
      path: '/confirmation-dialogs',
      isNew: true,
    },
    {
      id: 'error-logs',
      title: 'Error Logs',
      description: 'View and manage application error logs',
      icon: '🚨',
      stat: stats.totalErrorLogs,
      statLabel: 'Errors',
      path: '/error-logs',
      isNew: true,
    },
    {
      id: 'loading-configs',
      title: 'Loading Configs',
      description: 'Configure loading states per component',
      icon: '⏳',
      stat: stats.totalLoadingConfigs,
      statLabel: 'Configs',
      path: '/loading-configs',
      isNew: true,
    },
    {
      id: 'rbac-policies',
      title: 'RBAC Policies',
      description: 'Manage role-based access control policies',
      icon: '🛡️',
      stat: stats.totalRbacPolicies,
      statLabel: 'Policies',
      path: '/rbac-policies',
      isNew: true,
    },
    {
      id: 'rate-limit-logs',
      title: 'Rate Limit Logs',
      description: 'Monitor API rate limiting activity',
      icon: '🚦',
      stat: stats.totalRateLimitLogs,
      statLabel: 'Logs',
      path: '/rate-limit-logs',
      isNew: true,
    },
    {
      id: 'security-headers',
      title: 'Security Headers',
      description: 'Manage HTTP security header configurations',
      icon: '🔒',
      stat: stats.totalSecurityHeaders,
      statLabel: 'Headers',
      path: '/security-headers',
      isNew: true,
    },
    {
      id: 'email-verifications',
      title: 'Email Verifications',
      description: 'Track email verification status',
      icon: '📧',
      stat: stats.totalEmailVerifications,
      statLabel: 'Verifications',
      path: '/email-verifications',
      isNew: true,
    },
    {
      id: 'password-validations',
      title: 'Password Validations',
      description: 'Configure password validation rules',
      icon: '✅',
      stat: stats.totalPasswordValidations,
      statLabel: 'Rules',
      path: '/password-validations',
      isNew: true,
    },
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card purple">
          <div className="stat-value">{loading ? '...' : stats.totalProducts}</div>
          <div className="stat-label">Total Products</div>
        </div>
        <div className="stat-card green">
          <div className="stat-value">{loading ? '...' : stats.totalCompetitors}</div>
          <div className="stat-label">Competitors Tracked</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-value">{loading ? '...' : stats.pendingSuggestions}</div>
          <div className="stat-label">Pending Suggestions</div>
        </div>
        <div className="stat-card red">
          <div className="stat-value">{loading ? '...' : stats.priceAlerts}</div>
          <div className="stat-label">Price Alerts</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Recent Price Changes</h3>
          <LineChart data={priceHistory} width={380} height={220} />
        </div>
        <div className="chart-card">
          <h3>Products by Category</h3>
          <BarChart data={categoryData} width={380} height={220} />
        </div>
        <div className="chart-card">
          <h3>Price Suggestion Status</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <DonutChart data={suggestionStatus} width={180} height={180} />
            <ChartLegend data={suggestionStatus} />
          </div>
        </div>
      </div>

      {/* New AI Features Section */}
      <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>AI-Powered Features</span>
        <span className="badge badge-new">NEW</span>
      </h2>

      <div className="dashboard-cards ai-features">
        {newAIFeatures.map((card) => (
          <div
            key={card.id}
            className={`dashboard-card ${card.isNew ? 'new-feature' : ''}`}
            onClick={() => handleCardClick(card.path)}
          >
            {card.isNew && <span className="new-badge">NEW</span>}
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <div className="card-stat">
              {card.stat} <span style={{ fontSize: '14px', color: '#888' }}>{card.statLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: '20px', marginTop: '30px' }}>Core Features</h2>

      <div className="dashboard-cards">
        {existingFeatures.map((card) => (
          <div
            key={card.id}
            className="dashboard-card"
            onClick={() => handleCardClick(card.path)}
          >
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <div className="card-stat">{card.stat} <span style={{ fontSize: '14px', color: '#888' }}>{card.statLabel}</span></div>
          </div>
        ))}
      </div>

      {/* Admin Features Section */}
      <h2 style={{ marginBottom: '20px', marginTop: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span>Admin Features</span>
        <span className="badge badge-new">NEW</span>
      </h2>

      <div className="dashboard-cards ai-features">
        {adminFeatures.map((card) => (
          <div
            key={card.id}
            className={`dashboard-card ${card.isNew ? 'new-feature' : ''}`}
            onClick={() => handleCardClick(card.path)}
          >
            {card.isNew && <span className="new-badge">NEW</span>}
            <div className="card-icon">{card.icon}</div>
            <h3>{card.title}</h3>
            <p>{card.description}</p>
            <div className="card-stat">
              {card.stat} <span style={{ fontSize: '14px', color: '#888' }}>{card.statLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
};

export default Dashboard;
