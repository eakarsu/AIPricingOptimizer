import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    theme: 'dark',
    itemsPerPage: 10,
    emailNotifications: true,
    aiModel: 'anthropic/claude-haiku-4.5',
    currency: 'USD',
    language: 'en',
  });
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }

    // Load profile data
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
    }
  }, [user]);

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleProfileChange = (key, value) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const saveProfile = () => {
    // In a real app, this would call an API
    if (profileData.newPassword && profileData.newPassword !== profileData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Layout>
      <div className="page-header">
        <h1>Settings</h1>
        {saved && <span className="save-indicator">✓ Saved</span>}
      </div>

      <div className="settings-container">
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`settings-tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
          <button
            className={`settings-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Settings
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <h3>General Settings</h3>

              <div className="setting-item">
                <label>Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                  className="form-control"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light (Coming Soon)</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Default Items Per Page</label>
                <select
                  value={settings.itemsPerPage}
                  onChange={(e) => handleSettingChange('itemsPerPage', Number(e.target.value))}
                  className="form-control"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Currency</label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleSettingChange('currency', e.target.value)}
                  className="form-control"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  className="form-control"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>

              <button className="btn btn-primary" onClick={saveSettings}>
                Save Settings
              </button>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="settings-section">
              <h3>Profile Settings</h3>

              <div className="setting-item">
                <label>Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="setting-item">
                <label>Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                  className="form-control"
                />
              </div>

              <h4 style={{ marginTop: '30px' }}>Change Password</h4>

              <div className="setting-item">
                <label>Current Password</label>
                <input
                  type="password"
                  value={profileData.currentPassword}
                  onChange={(e) => handleProfileChange('currentPassword', e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="setting-item">
                <label>New Password</label>
                <input
                  type="password"
                  value={profileData.newPassword}
                  onChange={(e) => handleProfileChange('newPassword', e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="setting-item">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={profileData.confirmPassword}
                  onChange={(e) => handleProfileChange('confirmPassword', e.target.value)}
                  className="form-control"
                />
              </div>

              <button className="btn btn-primary" onClick={saveProfile}>
                Update Profile
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-section">
              <h3>Notification Settings</h3>

              <div className="setting-item toggle">
                <label>Email Notifications</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item toggle">
                <label>New AI Insights Alerts</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.insightAlerts !== false}
                    onChange={(e) => handleSettingChange('insightAlerts', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item toggle">
                <label>Price Change Alerts</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.priceAlerts !== false}
                    onChange={(e) => handleSettingChange('priceAlerts', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="setting-item toggle">
                <label>Competitor Updates</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.competitorAlerts !== false}
                    onChange={(e) => handleSettingChange('competitorAlerts', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <button className="btn btn-primary" onClick={saveSettings}>
                Save Settings
              </button>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="settings-section">
              <h3>AI Settings</h3>

              <div className="setting-item">
                <label>AI Model</label>
                <select
                  value={settings.aiModel}
                  onChange={(e) => handleSettingChange('aiModel', e.target.value)}
                  className="form-control"
                >
                  <option value="anthropic/claude-haiku-4.5">Claude Haiku 4.5 (Fast)</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet (Balanced)</option>
                  <option value="anthropic/claude-3-opus">Claude 3 Opus (Most Capable)</option>
                  <option value="openai/gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Economy)</option>
                </select>
                <p className="setting-help">
                  Select the AI model for pricing analysis and suggestions.
                </p>
              </div>

              <div className="setting-item toggle">
                <label>Auto-generate Insights</label>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.autoInsights !== false}
                    onChange={(e) => handleSettingChange('autoInsights', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <p className="setting-help">
                  Automatically generate AI insights daily.
                </p>
              </div>

              <div className="setting-item">
                <label>Max Tokens per Request</label>
                <select
                  value={settings.maxTokens || 1000}
                  onChange={(e) => handleSettingChange('maxTokens', Number(e.target.value))}
                  className="form-control"
                >
                  <option value={500}>500 (Concise)</option>
                  <option value={1000}>1000 (Standard)</option>
                  <option value={2000}>2000 (Detailed)</option>
                </select>
              </div>

              <button className="btn btn-primary" onClick={saveSettings}>
                Save Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
