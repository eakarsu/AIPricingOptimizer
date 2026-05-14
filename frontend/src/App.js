import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, NotificationToast } from './context/NotificationContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Competitors from './pages/Competitors';
import DemandSignals from './pages/DemandSignals';
import PriceSuggestions from './pages/PriceSuggestions';
import PriceHistory from './pages/PriceHistory';
import MarketTrends from './pages/MarketTrends';
import AIInsights from './pages/AIInsights';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
// New AI Features
import CompetitorTracking from './pages/CompetitorTracking';
import DemandForecasts from './pages/DemandForecasts';
import BundleRecommendations from './pages/BundleRecommendations';
import DiscountOptimizations from './pages/DiscountOptimizations';
import PriceElasticity from './pages/PriceElasticity';
import PriceTracker from './pages/PriceTracker';
// New audit features
import PricingSimulation from './pages/PricingSimulation';
import AIUsageStats from './pages/AIUsageStats';
import BulkPriceUpdate from './pages/BulkPriceUpdate';
// Admin Features
import PasswordResets from './pages/PasswordResets';
import PasswordChanges from './pages/PasswordChanges';
import SessionLogs from './pages/SessionLogs';
import PaginationConfigs from './pages/PaginationConfigs';
import PdfExports from './pages/PdfExports';
import ConfirmationDialogs from './pages/ConfirmationDialogs';
import ErrorLogs from './pages/ErrorLogs';
import LoadingConfigs from './pages/LoadingConfigs';
import RbacPolicies from './pages/RbacPolicies';
import RateLimitLogs from './pages/RateLimitLogs';
import SecurityHeaders from './pages/SecurityHeaders';
import EmailVerifications from './pages/EmailVerifications';
import PasswordValidations from './pages/PasswordValidations';

// // === Batch 06 Gaps & Frontend Mounts ===
import CFAgenticPricingOptimizationPage from './pages/CFAgenticPricingOptimizationPage';
import CFDemandForecastingEnsemblePage from './pages/CFDemandForecastingEnsemblePage';
import CFPriceElasticityModelingPage from './pages/CFPriceElasticityModelingPage';
import CFCompetitiveIntelligencePage from './pages/CFCompetitiveIntelligencePage';
import CFDiscountOptimizationPage from './pages/CFDiscountOptimizationPage';
import GapStrongerPriceElasticityModelsPerPage from './pages/GapStrongerPriceElasticityModelsPerPage';
import GapNoAutoPage from './pages/GapNoAutoPage';
import GapNoCustomerPage from './pages/GapNoCustomerPage';
import GapNoDedicatedRoutesDirectoryAllInlinePage from './pages/GapNoDedicatedRoutesDirectoryAllInlinePage';
import GapNoWebhooksForPricePage from './pages/GapNoWebhooksForPricePage';
import GapLimitedIntegrationsNoShopifyAmazonEbayAdaptePage from './pages/GapLimitedIntegrationsNoShopifyAmazonEbayAdaptePage';
import GapNoNotificationsModulePage from './pages/GapNoNotificationsModulePage';
import GapNoAuditLoggingDedicatedModuleDespiteSessionPage from './pages/GapNoAuditLoggingDedicatedModuleDespiteSessionPage';
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="login-container">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute><Products /></PrivateRoute>} />
      <Route path="/competitors" element={<PrivateRoute><Competitors /></PrivateRoute>} />
      <Route path="/demand-signals" element={<PrivateRoute><DemandSignals /></PrivateRoute>} />
      <Route path="/price-suggestions" element={<PrivateRoute><PriceSuggestions /></PrivateRoute>} />
      <Route path="/price-history" element={<PrivateRoute><PriceHistory /></PrivateRoute>} />
      <Route path="/market-trends" element={<PrivateRoute><MarketTrends /></PrivateRoute>} />
      <Route path="/ai-insights" element={<PrivateRoute><AIInsights /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="/users" element={<PrivateRoute><UserManagement /></PrivateRoute>} />
      {/* New AI Features */}
      <Route path="/competitor-tracking" element={<PrivateRoute><CompetitorTracking /></PrivateRoute>} />
      <Route path="/demand-forecasts" element={<PrivateRoute><DemandForecasts /></PrivateRoute>} />
      <Route path="/bundle-recommendations" element={<PrivateRoute><BundleRecommendations /></PrivateRoute>} />
      <Route path="/discount-optimizations" element={<PrivateRoute><DiscountOptimizations /></PrivateRoute>} />
      <Route path="/price-elasticity" element={<PrivateRoute><PriceElasticity /></PrivateRoute>} />
      <Route path="/price-tracker" element={<PrivateRoute><PriceTracker /></PrivateRoute>} />
      {/* New Audit Features */}
      <Route path="/pricing-simulation" element={<PrivateRoute><PricingSimulation /></PrivateRoute>} />
      <Route path="/ai-usage-stats" element={<PrivateRoute><AIUsageStats /></PrivateRoute>} />
      <Route path="/bulk-price-update" element={<PrivateRoute><BulkPriceUpdate /></PrivateRoute>} />
      {/* Admin Features */}
      <Route path="/password-resets" element={<PrivateRoute><PasswordResets /></PrivateRoute>} />
      <Route path="/password-changes" element={<PrivateRoute><PasswordChanges /></PrivateRoute>} />
      <Route path="/session-logs" element={<PrivateRoute><SessionLogs /></PrivateRoute>} />
      <Route path="/pagination-configs" element={<PrivateRoute><PaginationConfigs /></PrivateRoute>} />
      <Route path="/pdf-exports" element={<PrivateRoute><PdfExports /></PrivateRoute>} />
      <Route path="/confirmation-dialogs" element={<PrivateRoute><ConfirmationDialogs /></PrivateRoute>} />
      <Route path="/error-logs" element={<PrivateRoute><ErrorLogs /></PrivateRoute>} />
      <Route path="/loading-configs" element={<PrivateRoute><LoadingConfigs /></PrivateRoute>} />
      <Route path="/rbac-policies" element={<PrivateRoute><RbacPolicies /></PrivateRoute>} />
      <Route path="/rate-limit-logs" element={<PrivateRoute><RateLimitLogs /></PrivateRoute>} />
      <Route path="/security-headers" element={<PrivateRoute><SecurityHeaders /></PrivateRoute>} />
      <Route path="/email-verifications" element={<PrivateRoute><EmailVerifications /></PrivateRoute>} />
      <Route path="/password-validations" element={<PrivateRoute><PasswordValidations /></PrivateRoute>} />
    
          {/* // === Batch 06 Gaps & Frontend Mounts === */}
          <Route path="/cf-agentic-pricing-optimization" element={<CFAgenticPricingOptimizationPage />} />
          <Route path="/cf-demand-forecasting-ensemble" element={<CFDemandForecastingEnsemblePage />} />
          <Route path="/cf-price-elasticity-modeling" element={<CFPriceElasticityModelingPage />} />
          <Route path="/cf-competitive-intelligence" element={<CFCompetitiveIntelligencePage />} />
          <Route path="/cf-discount-optimization" element={<CFDiscountOptimizationPage />} />
          <Route path="/gap-stronger-price-elasticity-models-per" element={<GapStrongerPriceElasticityModelsPerPage />} />
          <Route path="/gap-no-auto" element={<GapNoAutoPage />} />
          <Route path="/gap-no-customer" element={<GapNoCustomerPage />} />
          <Route path="/gap-no-dedicated-routes-directory-all-inline" element={<GapNoDedicatedRoutesDirectoryAllInlinePage />} />
          <Route path="/gap-no-webhooks-for-price" element={<GapNoWebhooksForPricePage />} />
          <Route path="/gap-limited-integrations-no-shopify-amazon-ebay-adapte" element={<GapLimitedIntegrationsNoShopifyAmazonEbayAdaptePage />} />
          <Route path="/gap-no-notifications-module" element={<GapNoNotificationsModulePage />} />
          <Route path="/gap-no-audit-logging-dedicated-module-despite-session-" element={<GapNoAuditLoggingDedicatedModuleDespiteSessionPage />} />
        </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <NotificationToast />
          <AppRoutes />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
