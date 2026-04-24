require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pricing_optimizer',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function createTables() {
  const queries = [
    // Admin feature tables
    `DROP TABLE IF EXISTS password_validations CASCADE`,
    `DROP TABLE IF EXISTS security_headers CASCADE`,
    `DROP TABLE IF EXISTS rate_limit_logs CASCADE`,
    `DROP TABLE IF EXISTS rbac_policies CASCADE`,
    `DROP TABLE IF EXISTS loading_configs CASCADE`,
    `DROP TABLE IF EXISTS error_logs CASCADE`,
    `DROP TABLE IF EXISTS confirmation_dialogs CASCADE`,
    `DROP TABLE IF EXISTS pdf_exports CASCADE`,
    `DROP TABLE IF EXISTS pagination_configs CASCADE`,
    `DROP TABLE IF EXISTS session_logs CASCADE`,
    `DROP TABLE IF EXISTS password_changes CASCADE`,
    `DROP TABLE IF EXISTS password_resets CASCADE`,
    `DROP TABLE IF EXISTS email_verifications CASCADE`,

    `DROP TABLE IF EXISTS price_elasticity CASCADE`,
    `DROP TABLE IF EXISTS discount_optimizations CASCADE`,
    `DROP TABLE IF EXISTS bundle_recommendations CASCADE`,
    `DROP TABLE IF EXISTS demand_forecasts CASCADE`,
    `DROP TABLE IF EXISTS competitor_price_tracking CASCADE`,
    `DROP TABLE IF EXISTS ai_insights CASCADE`,
    `DROP TABLE IF EXISTS price_suggestions CASCADE`,
    `DROP TABLE IF EXISTS price_history CASCADE`,
    `DROP TABLE IF EXISTS market_trends CASCADE`,
    `DROP TABLE IF EXISTS demand_signals CASCADE`,
    `DROP TABLE IF EXISTS competitors CASCADE`,
    `DROP TABLE IF EXISTS products CASCADE`,
    `DROP TABLE IF EXISTS users CASCADE`,

    `CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      current_price DECIMAL(10, 2) NOT NULL,
      cost DECIMAL(10, 2) NOT NULL,
      category VARCHAR(100),
      sku VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE competitors (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      website VARCHAR(255),
      product_name VARCHAR(255),
      competitor_price DECIMAL(10, 2),
      our_price DECIMAL(10, 2),
      market_position VARCHAR(50),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE demand_signals (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      signal_type VARCHAR(100),
      signal_strength INTEGER,
      source VARCHAR(255),
      trend VARCHAR(50),
      volume INTEGER,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE price_suggestions (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      current_price DECIMAL(10, 2),
      suggested_price DECIMAL(10, 2),
      confidence INTEGER,
      reason TEXT,
      expected_impact TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE price_history (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      old_price DECIMAL(10, 2),
      new_price DECIMAL(10, 2),
      change_reason TEXT,
      changed_by VARCHAR(255),
      change_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE market_trends (
      id SERIAL PRIMARY KEY,
      trend_name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      direction VARCHAR(50),
      impact_level VARCHAR(50),
      description TEXT,
      data_source VARCHAR(255),
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE ai_insights (
      id SERIAL PRIMARY KEY,
      insight_type VARCHAR(100),
      title VARCHAR(255),
      content TEXT,
      priority VARCHAR(50),
      status VARCHAR(50) DEFAULT 'new',
      related_products TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // NEW FEATURE TABLES
    `CREATE TABLE competitor_price_tracking (
      id SERIAL PRIMARY KEY,
      competitor_name VARCHAR(255) NOT NULL,
      product_name VARCHAR(255) NOT NULL,
      previous_price DECIMAL(10, 2),
      current_price DECIMAL(10, 2),
      price_change DECIMAL(10, 2),
      change_percentage DECIMAL(5, 2),
      tracked_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      alert_status VARCHAR(50) DEFAULT 'normal',
      notes TEXT,
      ai_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE demand_forecasts (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      forecast_period VARCHAR(50),
      predicted_demand INTEGER,
      confidence_level INTEGER,
      seasonality_factor DECIMAL(5, 2),
      trend_direction VARCHAR(50),
      recommended_price DECIMAL(10, 2),
      current_price DECIMAL(10, 2),
      factors TEXT,
      ai_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE bundle_recommendations (
      id SERIAL PRIMARY KEY,
      bundle_name VARCHAR(255) NOT NULL,
      products TEXT NOT NULL,
      individual_total DECIMAL(10, 2),
      bundle_price DECIMAL(10, 2),
      discount_percentage DECIMAL(5, 2),
      expected_margin DECIMAL(5, 2),
      affinity_score INTEGER,
      recommendation_reason TEXT,
      status VARCHAR(50) DEFAULT 'suggested',
      ai_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE discount_optimizations (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      current_price DECIMAL(10, 2),
      optimal_discount DECIMAL(5, 2),
      discounted_price DECIMAL(10, 2),
      expected_volume_increase DECIMAL(5, 2),
      expected_revenue_impact DECIMAL(10, 2),
      break_even_volume INTEGER,
      recommendation VARCHAR(50),
      discount_type VARCHAR(50),
      valid_period VARCHAR(100),
      ai_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE price_elasticity (
      id SERIAL PRIMARY KEY,
      product_name VARCHAR(255) NOT NULL,
      elasticity_coefficient DECIMAL(5, 3),
      elasticity_type VARCHAR(50),
      price_sensitivity VARCHAR(50),
      optimal_price_range_min DECIMAL(10, 2),
      optimal_price_range_max DECIMAL(10, 2),
      current_price DECIMAL(10, 2),
      demand_curve_type VARCHAR(50),
      cross_elasticity TEXT,
      ai_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // PRICE TRACKER TABLES
    `DROP TABLE IF EXISTS price_tracker_alerts CASCADE`,
    `DROP TABLE IF EXISTS price_tracker CASCADE`,
    `DROP TABLE IF EXISTS price_tracker_stores CASCADE`,
    `DROP TABLE IF EXISTS price_tracker_categories CASCADE`,

    `CREATE TABLE price_tracker_categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      icon VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE price_tracker_stores (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      website VARCHAR(255),
      logo_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE price_tracker (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      url VARCHAR(500),
      current_price DECIMAL(10, 2) NOT NULL,
      original_price DECIMAL(10, 2),
      image_url VARCHAR(500),
      category_id INTEGER REFERENCES price_tracker_categories(id),
      store_id INTEGER REFERENCES price_tracker_stores(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE price_tracker_alerts (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES price_tracker(id) ON DELETE CASCADE,
      target_price DECIMAL(10, 2) NOT NULL,
      alert_type VARCHAR(50) DEFAULT 'below',
      is_active BOOLEAN DEFAULT true,
      triggered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // ==================== ADMIN FEATURE TABLES ====================
    `CREATE TABLE password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL,
      used BOOLEAN DEFAULT false,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE password_changes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      change_type VARCHAR(50) DEFAULT 'manual',
      ip_address VARCHAR(45),
      user_agent TEXT,
      status VARCHAR(50) DEFAULT 'success',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE session_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      session_token VARCHAR(255),
      ip_address VARCHAR(45),
      user_agent TEXT,
      login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      logout_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE pagination_configs (
      id SERIAL PRIMARY KEY,
      page_name VARCHAR(255) NOT NULL,
      items_per_page INTEGER DEFAULT 25,
      max_items_per_page INTEGER DEFAULT 100,
      default_sort_field VARCHAR(100),
      default_sort_order VARCHAR(10) DEFAULT 'DESC',
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE pdf_exports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      export_type VARCHAR(100) NOT NULL,
      file_name VARCHAR(255),
      file_size INTEGER,
      page_count INTEGER,
      status VARCHAR(50) DEFAULT 'completed',
      download_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE confirmation_dialogs (
      id SERIAL PRIMARY KEY,
      action_name VARCHAR(255) NOT NULL,
      dialog_title VARCHAR(255),
      dialog_message TEXT,
      confirm_button_text VARCHAR(100) DEFAULT 'Confirm',
      cancel_button_text VARCHAR(100) DEFAULT 'Cancel',
      severity VARCHAR(50) DEFAULT 'warning',
      requires_input BOOLEAN DEFAULT false,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE error_logs (
      id SERIAL PRIMARY KEY,
      error_type VARCHAR(100) NOT NULL,
      error_message TEXT,
      stack_trace TEXT,
      endpoint VARCHAR(255),
      method VARCHAR(10),
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ip_address VARCHAR(45),
      severity VARCHAR(50) DEFAULT 'error',
      resolved BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE loading_configs (
      id SERIAL PRIMARY KEY,
      component_name VARCHAR(255) NOT NULL,
      loading_type VARCHAR(50) DEFAULT 'spinner',
      skeleton_count INTEGER DEFAULT 5,
      timeout_ms INTEGER DEFAULT 30000,
      retry_count INTEGER DEFAULT 3,
      show_progress BOOLEAN DEFAULT false,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE rbac_policies (
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(100) NOT NULL,
      resource VARCHAR(255) NOT NULL,
      action VARCHAR(50) NOT NULL,
      effect VARCHAR(10) DEFAULT 'allow',
      conditions TEXT,
      priority INTEGER DEFAULT 0,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE rate_limit_logs (
      id SERIAL PRIMARY KEY,
      ip_address VARCHAR(45) NOT NULL,
      endpoint VARCHAR(255),
      method VARCHAR(10),
      request_count INTEGER DEFAULT 1,
      window_start TIMESTAMP,
      window_end TIMESTAMP,
      blocked BOOLEAN DEFAULT false,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE security_headers (
      id SERIAL PRIMARY KEY,
      header_name VARCHAR(255) NOT NULL,
      header_value TEXT NOT NULL,
      description TEXT,
      category VARCHAR(100),
      enabled BOOLEAN DEFAULT true,
      applies_to VARCHAR(100) DEFAULT 'all',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE email_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) NOT NULL,
      verified BOOLEAN DEFAULT false,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE password_validations (
      id SERIAL PRIMARY KEY,
      rule_name VARCHAR(255) NOT NULL,
      rule_type VARCHAR(100) NOT NULL,
      rule_value VARCHAR(255),
      error_message TEXT,
      severity VARCHAR(50) DEFAULT 'error',
      enabled BOOLEAN DEFAULT true,
      priority INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    await pool.query(query);
  }

  console.log('Tables created successfully');
}

async function seedData() {
  // Seed Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    ['admin@pricingoptimizer.com', hashedPassword, 'Admin User', 'admin'],
    ['john.doe@example.com', hashedPassword, 'John Doe', 'manager'],
    ['jane.smith@example.com', hashedPassword, 'Jane Smith', 'user'],
    ['mike.wilson@example.com', hashedPassword, 'Mike Wilson', 'user'],
  ];

  for (const u of users) {
    await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
      u
    );
  }
  console.log('Users seeded');

  // Seed Products (15+ items)
  const products = [
    ['Wireless Bluetooth Headphones', 'Premium noise-cancelling headphones with 30hr battery', 149.99, 65.00, 'Electronics', 'WBH-001'],
    ['Smart Watch Pro', 'Advanced fitness tracking with GPS and heart monitor', 299.99, 120.00, 'Electronics', 'SWP-002'],
    ['Organic Coffee Beans 1kg', 'Single-origin Ethiopian Arabica beans', 24.99, 8.50, 'Food & Beverage', 'OCB-003'],
    ['Yoga Mat Premium', 'Extra thick eco-friendly exercise mat', 49.99, 15.00, 'Sports', 'YMP-004'],
    ['LED Desk Lamp', 'Adjustable brightness with USB charging port', 39.99, 12.00, 'Home Office', 'LDL-005'],
    ['Mechanical Keyboard RGB', 'Cherry MX switches with programmable backlighting', 129.99, 55.00, 'Electronics', 'MKR-006'],
    ['Running Shoes Elite', 'Lightweight performance running shoes', 159.99, 60.00, 'Sports', 'RSE-007'],
    ['Portable Power Bank 20000mAh', 'Fast charging with dual USB-C ports', 44.99, 18.00, 'Electronics', 'PPB-008'],
    ['Stainless Steel Water Bottle', 'Vacuum insulated 32oz bottle', 29.99, 8.00, 'Home & Kitchen', 'SSW-009'],
    ['Wireless Mouse Ergonomic', 'Vertical design for comfort, rechargeable', 59.99, 22.00, 'Electronics', 'WME-010'],
    ['Plant-Based Protein Powder', 'Organic pea protein 2lb container', 39.99, 14.00, 'Health', 'PBP-011'],
    ['Bamboo Cutting Board Set', '3-piece eco-friendly cutting boards', 34.99, 10.00, 'Home & Kitchen', 'BCB-012'],
    ['USB-C Hub 7-in-1', 'HDMI, USB-A, SD card reader combo', 49.99, 18.00, 'Electronics', 'UCH-013'],
    ['Resistance Bands Set', '5 levels with door anchor and handles', 24.99, 6.00, 'Sports', 'RBS-014'],
    ['Ceramic Travel Mug', 'Double-walled 16oz with silicone lid', 22.99, 7.00, 'Home & Kitchen', 'CTM-015'],
    ['Noise Machine Sleep', 'White noise generator with 20 sounds', 34.99, 12.00, 'Home', 'NMS-016'],
    ['Laptop Stand Adjustable', 'Aluminum portable laptop riser', 44.99, 15.00, 'Home Office', 'LSA-017'],
  ];

  for (const p of products) {
    await pool.query(
      'INSERT INTO products (name, description, current_price, cost, category, sku) VALUES ($1, $2, $3, $4, $5, $6)',
      p
    );
  }
  console.log('Products seeded');

  // Seed Competitors (15+ items)
  const competitors = [
    ['TechGiant Store', 'techgiant.com', 'Wireless Bluetooth Headphones', 139.99, 149.99, 'premium', 'Major competitor with strong brand'],
    ['BudgetElectronics', 'budgetelectronics.com', 'Wireless Bluetooth Headphones', 99.99, 149.99, 'budget', 'Low-cost alternative'],
    ['FitnessPro Shop', 'fitnesspro.com', 'Smart Watch Pro', 279.99, 299.99, 'premium', 'Fitness-focused retailer'],
    ['AmazonBasics', 'amazon.com', 'Smart Watch Pro', 249.99, 299.99, 'mainstream', 'High volume seller'],
    ['CoffeeWorld', 'coffeeworld.com', 'Organic Coffee Beans 1kg', 22.99, 24.99, 'specialty', 'Coffee specialist retailer'],
    ['GreenMart', 'greenmart.com', 'Organic Coffee Beans 1kg', 26.99, 24.99, 'premium', 'Organic products focus'],
    ['SportsDirect', 'sportsdirect.com', 'Yoga Mat Premium', 44.99, 49.99, 'mainstream', 'Large sports retailer'],
    ['YogaLife', 'yogalife.com', 'Yoga Mat Premium', 54.99, 49.99, 'premium', 'Yoga specialist'],
    ['OfficeMax', 'officemax.com', 'LED Desk Lamp', 35.99, 39.99, 'mainstream', 'Office supplies leader'],
    ['LightingHub', 'lightinghub.com', 'LED Desk Lamp', 42.99, 39.99, 'premium', 'Lighting specialist'],
    ['KeyboardKings', 'keyboardkings.com', 'Mechanical Keyboard RGB', 119.99, 129.99, 'specialty', 'Mechanical keyboard focus'],
    ['GamerZone', 'gamerzone.com', 'Mechanical Keyboard RGB', 134.99, 129.99, 'premium', 'Gaming peripherals'],
    ['RunnerShop', 'runnershop.com', 'Running Shoes Elite', 149.99, 159.99, 'specialty', 'Running specialist'],
    ['MegaSports', 'megasports.com', 'Running Shoes Elite', 164.99, 159.99, 'premium', 'Premium sports retailer'],
    ['PowerTech', 'powertech.com', 'Portable Power Bank 20000mAh', 39.99, 44.99, 'mainstream', 'Electronics accessories'],
    ['MobileWorld', 'mobileworld.com', 'Portable Power Bank 20000mAh', 49.99, 44.99, 'premium', 'Mobile accessories premium'],
  ];

  for (const c of competitors) {
    await pool.query(
      'INSERT INTO competitors (name, website, product_name, competitor_price, our_price, market_position, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      c
    );
  }
  console.log('Competitors seeded');

  // Seed Demand Signals (15+ items)
  const demandSignals = [
    ['Wireless Bluetooth Headphones', 'search_volume', 85, 'Google Trends', 'increasing', 45000, 'Holiday season spike expected'],
    ['Wireless Bluetooth Headphones', 'social_mentions', 72, 'Twitter/X', 'stable', 12000, 'Positive sentiment overall'],
    ['Smart Watch Pro', 'search_volume', 92, 'Google Trends', 'increasing', 68000, 'Fitness trend driving demand'],
    ['Smart Watch Pro', 'reviews', 88, 'Product Reviews', 'increasing', 3500, 'High satisfaction rate'],
    ['Organic Coffee Beans 1kg', 'search_volume', 65, 'Google Trends', 'stable', 28000, 'Consistent demand'],
    ['Organic Coffee Beans 1kg', 'subscription_rate', 78, 'Internal Data', 'increasing', 1200, 'Growing subscription base'],
    ['Yoga Mat Premium', 'search_volume', 70, 'Google Trends', 'seasonal', 35000, 'New Year resolution spike'],
    ['LED Desk Lamp', 'search_volume', 55, 'Google Trends', 'stable', 22000, 'WFH demand stabilized'],
    ['LED Desk Lamp', 'cart_additions', 62, 'Internal Data', 'stable', 890, 'Good conversion rate'],
    ['Mechanical Keyboard RGB', 'search_volume', 78, 'Google Trends', 'increasing', 42000, 'Gaming market growth'],
    ['Mechanical Keyboard RGB', 'social_mentions', 85, 'Reddit', 'increasing', 8500, 'Strong community interest'],
    ['Running Shoes Elite', 'search_volume', 80, 'Google Trends', 'seasonal', 55000, 'Spring running season'],
    ['Running Shoes Elite', 'return_rate', 15, 'Internal Data', 'decreasing', 120, 'Low returns indicate quality'],
    ['Portable Power Bank 20000mAh', 'search_volume', 68, 'Google Trends', 'stable', 38000, 'Travel demand returning'],
    ['Plant-Based Protein Powder', 'search_volume', 75, 'Google Trends', 'increasing', 41000, 'Health trend driving sales'],
    ['USB-C Hub 7-in-1', 'search_volume', 60, 'Google Trends', 'increasing', 25000, 'WFH and new laptop sales'],
  ];

  for (const d of demandSignals) {
    await pool.query(
      'INSERT INTO demand_signals (product_name, signal_type, signal_strength, source, trend, volume, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      d
    );
  }
  console.log('Demand signals seeded');

  // Seed Price Suggestions (15+ items)
  const priceSuggestions = [
    ['Wireless Bluetooth Headphones', 149.99, 139.99, 82, 'Competitor price pressure and high demand', 'Expected 15% volume increase', 'pending'],
    ['Smart Watch Pro', 299.99, 319.99, 75, 'Premium positioning with strong reviews', 'Expected 8% margin improvement', 'pending'],
    ['Organic Coffee Beans 1kg', 24.99, 27.99, 68, 'Rising commodity costs and brand loyalty', 'Expected 5% revenue increase', 'approved'],
    ['Yoga Mat Premium', 49.99, 44.99, 85, 'Seasonal promotion opportunity', 'Expected 25% volume increase', 'pending'],
    ['LED Desk Lamp', 39.99, 37.99, 70, 'Competitor matching strategy', 'Expected 10% volume increase', 'rejected'],
    ['Mechanical Keyboard RGB', 129.99, 124.99, 78, 'Market share gain opportunity', 'Expected 12% volume increase', 'pending'],
    ['Running Shoes Elite', 159.99, 169.99, 72, 'Premium quality justifies higher price', 'Expected 5% margin improvement', 'pending'],
    ['Portable Power Bank 20000mAh', 44.99, 42.99, 80, 'Volume optimization strategy', 'Expected 18% volume increase', 'approved'],
    ['Stainless Steel Water Bottle', 29.99, 32.99, 65, 'Eco-premium positioning', 'Expected 10% margin improvement', 'pending'],
    ['Wireless Mouse Ergonomic', 59.99, 54.99, 77, 'Competitive positioning', 'Expected 20% volume increase', 'pending'],
    ['Plant-Based Protein Powder', 39.99, 44.99, 70, 'Health trend premium pricing', 'Expected 12% margin improvement', 'pending'],
    ['Bamboo Cutting Board Set', 34.99, 31.99, 82, 'Volume driver strategy', 'Expected 22% volume increase', 'approved'],
    ['USB-C Hub 7-in-1', 49.99, 47.99, 75, 'Tech accessory market pressure', 'Expected 15% volume increase', 'pending'],
    ['Resistance Bands Set', 24.99, 22.99, 88, 'Entry price point strategy', 'Expected 30% volume increase', 'pending'],
    ['Ceramic Travel Mug', 22.99, 24.99, 72, 'Quality premium positioning', 'Expected 8% margin improvement', 'pending'],
    ['Laptop Stand Adjustable', 44.99, 49.99, 68, 'WFH premium positioning', 'Expected 10% margin improvement', 'pending'],
  ];

  for (const ps of priceSuggestions) {
    await pool.query(
      'INSERT INTO price_suggestions (product_name, current_price, suggested_price, confidence, reason, expected_impact, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      ps
    );
  }
  console.log('Price suggestions seeded');

  // Seed Price History (15+ items)
  const priceHistory = [
    ['Wireless Bluetooth Headphones', 159.99, 149.99, 'Competitive price adjustment', 'John Smith', '2024-01-15'],
    ['Wireless Bluetooth Headphones', 169.99, 159.99, 'Q4 promotion', 'Jane Doe', '2023-11-20'],
    ['Smart Watch Pro', 279.99, 299.99, 'Premium repositioning', 'John Smith', '2024-02-01'],
    ['Smart Watch Pro', 269.99, 279.99, 'Cost increase pass-through', 'Jane Doe', '2023-12-10'],
    ['Organic Coffee Beans 1kg', 22.99, 24.99, 'Commodity cost increase', 'John Smith', '2024-01-20'],
    ['Yoga Mat Premium', 54.99, 49.99, 'New Year sale pricing', 'Jane Doe', '2024-01-01'],
    ['LED Desk Lamp', 44.99, 39.99, 'Inventory clearance', 'John Smith', '2023-12-15'],
    ['Mechanical Keyboard RGB', 139.99, 129.99, 'Market competition', 'Jane Doe', '2024-01-10'],
    ['Running Shoes Elite', 149.99, 159.99, 'New model launch', 'John Smith', '2024-02-15'],
    ['Portable Power Bank 20000mAh', 49.99, 44.99, 'Volume strategy', 'Jane Doe', '2024-01-25'],
    ['Stainless Steel Water Bottle', 27.99, 29.99, 'Brand premium increase', 'John Smith', '2023-11-15'],
    ['Wireless Mouse Ergonomic', 64.99, 59.99, 'Promotional pricing', 'Jane Doe', '2024-02-01'],
    ['Plant-Based Protein Powder', 34.99, 39.99, 'Health trend premium', 'John Smith', '2024-01-05'],
    ['USB-C Hub 7-in-1', 54.99, 49.99, 'Tech market pressure', 'Jane Doe', '2023-12-20'],
    ['Resistance Bands Set', 29.99, 24.99, 'Entry point optimization', 'John Smith', '2024-02-10'],
    ['Laptop Stand Adjustable', 39.99, 44.99, 'Quality upgrade reflection', 'Jane Doe', '2024-01-30'],
  ];

  for (const ph of priceHistory) {
    await pool.query(
      'INSERT INTO price_history (product_name, old_price, new_price, change_reason, changed_by, change_date) VALUES ($1, $2, $3, $4, $5, $6)',
      ph
    );
  }
  console.log('Price history seeded');

  // Seed Market Trends (15+ items)
  const marketTrends = [
    ['Work From Home Continuation', 'Electronics', 'stable', 'high', 'Remote work remains popular, driving demand for home office equipment', 'Industry Reports', '2024-01-01', '2024-12-31'],
    ['Sustainability Premium', 'General', 'increasing', 'high', 'Consumers willing to pay more for eco-friendly products', 'Consumer Surveys', '2024-01-01', '2024-12-31'],
    ['Health & Wellness Boom', 'Health', 'increasing', 'high', 'Post-pandemic health consciousness driving supplement and fitness sales', 'Market Research', '2024-01-01', '2024-12-31'],
    ['Gaming Market Growth', 'Electronics', 'increasing', 'medium', 'Gaming peripherals seeing steady growth across demographics', 'Industry Data', '2024-01-01', '2024-12-31'],
    ['Coffee Culture Expansion', 'Food & Beverage', 'increasing', 'medium', 'Premium coffee at home trend continues', 'Consumer Data', '2024-01-01', '2024-12-31'],
    ['Fitness Tech Integration', 'Sports', 'increasing', 'high', 'Wearables and smart fitness equipment demand growing', 'Tech Reports', '2024-01-01', '2024-12-31'],
    ['USB-C Universal Adoption', 'Electronics', 'increasing', 'medium', 'USB-C becoming standard, driving accessory demand', 'Industry Standards', '2024-01-01', '2024-12-31'],
    ['Inflation Impact', 'General', 'stable', 'high', 'Price sensitivity increased but premium segment resilient', 'Economic Reports', '2024-01-01', '2024-12-31'],
    ['E-commerce Growth', 'General', 'increasing', 'high', 'Online shopping continues to grow market share', 'Retail Data', '2024-01-01', '2024-12-31'],
    ['Subscription Economy', 'General', 'increasing', 'medium', 'Consumers favor subscriptions for recurring purchases', 'Consumer Research', '2024-01-01', '2024-12-31'],
    ['Audio Quality Premium', 'Electronics', 'increasing', 'medium', 'Consumers investing more in quality audio equipment', 'Market Analysis', '2024-01-01', '2024-12-31'],
    ['Plant-Based Movement', 'Food & Beverage', 'increasing', 'high', 'Plant-based products seeing mainstream adoption', 'Industry Trends', '2024-01-01', '2024-12-31'],
    ['Ergonomic Awareness', 'Home Office', 'increasing', 'medium', 'Increased focus on ergonomic products for health', 'Health Reports', '2024-01-01', '2024-12-31'],
    ['Quick Commerce', 'General', 'increasing', 'medium', 'Same-day delivery expectations rising', 'Logistics Data', '2024-01-01', '2024-12-31'],
    ['Social Commerce Rise', 'General', 'increasing', 'high', 'Social media becoming major sales channel', 'Digital Marketing', '2024-01-01', '2024-12-31'],
    ['AI Shopping Assistants', 'General', 'increasing', 'medium', 'AI-powered recommendations influencing purchases', 'Tech Trends', '2024-01-01', '2024-12-31'],
  ];

  for (const mt of marketTrends) {
    await pool.query(
      'INSERT INTO market_trends (trend_name, category, direction, impact_level, description, data_source, start_date, end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      mt
    );
  }
  console.log('Market trends seeded');

  // Seed AI Insights (15+ items)
  const aiInsights = [
    ['pricing', 'Price Optimization Opportunity in Electronics', 'Analysis shows Wireless Bluetooth Headphones are priced 7% above market average. Consider price reduction to capture market share while maintaining margins.', 'high', 'new', 'Wireless Bluetooth Headphones'],
    ['competitor', 'TechGiant Aggressive Pricing Strategy', 'TechGiant has reduced prices across 3 product categories. Recommend monitoring and selective matching for high-volume items.', 'high', 'new', 'Wireless Bluetooth Headphones, Smart Watch Pro'],
    ['demand', 'Seasonal Demand Spike Predicted', 'Historical data indicates 40% demand increase for fitness products in January. Recommend inventory buildup and promotional pricing.', 'high', 'reviewed', 'Yoga Mat Premium, Running Shoes Elite'],
    ['trend', 'Sustainability Premium Opportunity', 'Market trends show 23% of consumers willing to pay premium for eco-friendly products. Consider highlighting sustainability features.', 'medium', 'new', 'Bamboo Cutting Board Set, Stainless Steel Water Bottle'],
    ['pricing', 'Margin Improvement in Coffee Category', 'Organic Coffee Beans showing strong brand loyalty with low price elasticity. 10% price increase feasible with minimal volume impact.', 'medium', 'new', 'Organic Coffee Beans 1kg'],
    ['competitor', 'New Competitor Entry Alert', 'BudgetElectronics expanding into premium segment. Recommend strengthening value proposition for mid-range products.', 'medium', 'new', 'LED Desk Lamp, USB-C Hub 7-in-1'],
    ['demand', 'Work From Home Demand Stabilizing', 'WFH-related product demand stabilizing at elevated levels. Shift from growth to retention pricing strategies.', 'medium', 'reviewed', 'LED Desk Lamp, Laptop Stand Adjustable'],
    ['trend', 'Gaming Peripherals Growth', 'Gaming market growing 15% YoY. Consider expanding mechanical keyboard and mouse offerings.', 'high', 'new', 'Mechanical Keyboard RGB, Wireless Mouse Ergonomic'],
    ['pricing', 'Bundle Pricing Opportunity', 'Analysis shows complementary purchases between protein powder and fitness accessories. Bundle pricing could increase AOV by 25%.', 'high', 'new', 'Plant-Based Protein Powder, Resistance Bands Set'],
    ['competitor', 'Premium Segment Underserved', 'Gap identified in premium running shoes segment. Running Shoes Elite well-positioned for price increase.', 'medium', 'new', 'Running Shoes Elite'],
    ['demand', 'Subscription Model Potential', 'Coffee and protein products show high repeat purchase rates. Subscription model could increase LTV by 40%.', 'high', 'new', 'Organic Coffee Beans 1kg, Plant-Based Protein Powder'],
    ['trend', 'USB-C Transition Accelerating', 'EU regulations driving USB-C adoption. Expect increased demand for USB-C accessories through 2024.', 'medium', 'new', 'USB-C Hub 7-in-1, Portable Power Bank 20000mAh'],
    ['pricing', 'Dynamic Pricing Recommendation', 'High-demand products could benefit from time-based pricing. Implement higher prices during peak hours (12-2pm, 7-9pm).', 'medium', 'new', 'Multiple products'],
    ['competitor', 'Amazon Pricing Pattern Detected', 'Amazon adjusting prices 3-5 times daily on competing products. Recommend automated price monitoring system.', 'high', 'new', 'Portable Power Bank 20000mAh, Wireless Bluetooth Headphones'],
    ['demand', 'Gift Season Preparation', 'Q4 gift-giving season approaching. Recommend gift-bundle creation and promotional pricing for gifting-suitable items.', 'high', 'new', 'Ceramic Travel Mug, Wireless Bluetooth Headphones'],
    ['trend', 'Health Consciousness Driving Sales', 'Post-pandemic health trend continuing strong. Protein, fitness, and wellness products showing above-average growth.', 'high', 'new', 'Plant-Based Protein Powder, Yoga Mat Premium'],
  ];

  for (const ai of aiInsights) {
    await pool.query(
      'INSERT INTO ai_insights (insight_type, title, content, priority, status, related_products) VALUES ($1, $2, $3, $4, $5, $6)',
      ai
    );
  }
  console.log('AI insights seeded');

  // ==================== NEW FEATURE DATA ====================

  // Seed Competitor Price Tracking (15+ items)
  const competitorPriceTracking = [
    ['TechGiant Store', 'Wireless Bluetooth Headphones', 145.99, 139.99, -6.00, -4.11, 'price_drop', 'Significant price reduction detected'],
    ['BudgetElectronics', 'Wireless Bluetooth Headphones', 99.99, 94.99, -5.00, -5.00, 'price_drop', 'Aggressive pricing strategy'],
    ['FitnessPro Shop', 'Smart Watch Pro', 289.99, 279.99, -10.00, -3.45, 'price_drop', 'Promotional pricing detected'],
    ['AmazonBasics', 'Smart Watch Pro', 259.99, 249.99, -10.00, -3.85, 'price_drop', 'Flash sale pricing'],
    ['CoffeeWorld', 'Organic Coffee Beans 1kg', 21.99, 22.99, 1.00, 4.55, 'price_increase', 'Cost pass-through'],
    ['GreenMart', 'Organic Coffee Beans 1kg', 25.99, 26.99, 1.00, 3.85, 'price_increase', 'Premium positioning'],
    ['SportsDirect', 'Yoga Mat Premium', 47.99, 44.99, -3.00, -6.25, 'price_drop', 'Seasonal sale'],
    ['YogaLife', 'Yoga Mat Premium', 52.99, 54.99, 2.00, 3.77, 'price_increase', 'Quality upgrade'],
    ['OfficeMax', 'LED Desk Lamp', 37.99, 35.99, -2.00, -5.26, 'price_drop', 'Clearance pricing'],
    ['KeyboardKings', 'Mechanical Keyboard RGB', 124.99, 119.99, -5.00, -4.00, 'price_drop', 'Competition response'],
    ['GamerZone', 'Mechanical Keyboard RGB', 129.99, 134.99, 5.00, 3.85, 'price_increase', 'Premium features added'],
    ['RunnerShop', 'Running Shoes Elite', 154.99, 149.99, -5.00, -3.23, 'price_drop', 'New model incoming'],
    ['MegaSports', 'Running Shoes Elite', 159.99, 164.99, 5.00, 3.13, 'price_increase', 'Demand-based pricing'],
    ['PowerTech', 'Portable Power Bank 20000mAh', 42.99, 39.99, -3.00, -6.98, 'price_drop', 'Volume strategy'],
    ['MobileWorld', 'Portable Power Bank 20000mAh', 47.99, 49.99, 2.00, 4.17, 'price_increase', 'Premium positioning'],
    ['TechGiant Store', 'USB-C Hub 7-in-1', 52.99, 47.99, -5.00, -9.44, 'alert', 'Major price cut - action required'],
  ];

  for (const cpt of competitorPriceTracking) {
    await pool.query(
      'INSERT INTO competitor_price_tracking (competitor_name, product_name, previous_price, current_price, price_change, change_percentage, alert_status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      cpt
    );
  }
  console.log('Competitor price tracking seeded');

  // Seed Demand Forecasts (15+ items)
  const demandForecasts = [
    ['Wireless Bluetooth Headphones', 'Q1 2024', 2500, 85, 1.15, 'increasing', 144.99, 149.99, 'Holiday hangover, gift card redemptions'],
    ['Smart Watch Pro', 'Q1 2024', 1800, 82, 1.25, 'increasing', 289.99, 299.99, 'New Year fitness resolutions driving demand'],
    ['Organic Coffee Beans 1kg', 'Q1 2024', 3200, 78, 0.95, 'stable', 25.99, 24.99, 'Consistent demand, slight winter uptick'],
    ['Yoga Mat Premium', 'Q1 2024', 2100, 88, 1.45, 'increasing', 47.99, 49.99, 'Strong January fitness trend'],
    ['LED Desk Lamp', 'Q1 2024', 1500, 72, 0.90, 'decreasing', 37.99, 39.99, 'Post-holiday slowdown expected'],
    ['Mechanical Keyboard RGB', 'Q1 2024', 1200, 80, 1.10, 'increasing', 127.99, 129.99, 'Gaming season continues'],
    ['Running Shoes Elite', 'Q1 2024', 900, 75, 0.85, 'seasonal', 154.99, 159.99, 'Pre-spring running preparation'],
    ['Portable Power Bank 20000mAh', 'Q1 2024', 2800, 77, 1.05, 'stable', 43.99, 44.99, 'Travel season beginning'],
    ['Stainless Steel Water Bottle', 'Q1 2024', 1600, 70, 1.20, 'increasing', 31.99, 29.99, 'Fitness trend spillover'],
    ['Wireless Mouse Ergonomic', 'Q1 2024', 1100, 73, 0.95, 'stable', 57.99, 59.99, 'WFH demand normalized'],
    ['Plant-Based Protein Powder', 'Q1 2024', 2400, 86, 1.35, 'increasing', 42.99, 39.99, 'Health trend peak season'],
    ['Bamboo Cutting Board Set', 'Q1 2024', 800, 68, 0.90, 'stable', 33.99, 34.99, 'Steady kitchen category'],
    ['USB-C Hub 7-in-1', 'Q1 2024', 1900, 79, 1.15, 'increasing', 48.99, 49.99, 'New device adoption cycle'],
    ['Resistance Bands Set', 'Q1 2024', 3500, 90, 1.50, 'increasing', 23.99, 24.99, 'Home workout trend strong'],
    ['Ceramic Travel Mug', 'Q1 2024', 1400, 71, 0.85, 'decreasing', 21.99, 22.99, 'Post-gift season decline'],
    ['Laptop Stand Adjustable', 'Q1 2024', 1300, 74, 1.00, 'stable', 44.99, 44.99, 'Ergonomic awareness steady'],
  ];

  for (const df of demandForecasts) {
    await pool.query(
      'INSERT INTO demand_forecasts (product_name, forecast_period, predicted_demand, confidence_level, seasonality_factor, trend_direction, recommended_price, current_price, factors) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      df
    );
  }
  console.log('Demand forecasts seeded');

  // Seed Bundle Recommendations (15+ items)
  const bundleRecommendations = [
    ['Home Office Essentials', 'LED Desk Lamp, Laptop Stand Adjustable, Wireless Mouse Ergonomic', 144.97, 119.99, 17.24, 32.5, 92, 'High cross-purchase rate among WFH customers', 'suggested'],
    ['Fitness Starter Pack', 'Yoga Mat Premium, Resistance Bands Set, Plant-Based Protein Powder', 114.97, 94.99, 17.38, 28.7, 88, 'New Year resolution bundle opportunity', 'active'],
    ['Tech Travel Kit', 'Portable Power Bank 20000mAh, USB-C Hub 7-in-1, Wireless Bluetooth Headphones', 244.97, 199.99, 18.36, 35.2, 85, 'Frequent co-purchases for travelers', 'suggested'],
    ['Coffee Lovers Bundle', 'Organic Coffee Beans 1kg, Ceramic Travel Mug, Stainless Steel Water Bottle', 77.97, 64.99, 16.65, 38.4, 90, 'Strong affinity in beverage category', 'active'],
    ['Gaming Setup', 'Mechanical Keyboard RGB, Wireless Mouse Ergonomic, LED Desk Lamp', 229.97, 189.99, 17.39, 30.1, 87, 'Gaming peripherals bundle', 'suggested'],
    ['Runner Premium Pack', 'Running Shoes Elite, Smart Watch Pro, Stainless Steel Water Bottle', 489.97, 419.99, 14.28, 28.9, 82, 'Premium athletic bundle', 'suggested'],
    ['Eco-Friendly Kitchen', 'Bamboo Cutting Board Set, Stainless Steel Water Bottle, Ceramic Travel Mug', 87.97, 74.99, 14.76, 42.1, 84, 'Sustainability-focused customers', 'active'],
    ['Work From Home Pro', 'Laptop Stand Adjustable, Mechanical Keyboard RGB, Noise Machine Sleep', 209.97, 179.99, 14.28, 31.8, 86, 'Premium WFH setup', 'suggested'],
    ['Fitness Tech Bundle', 'Smart Watch Pro, Resistance Bands Set, Yoga Mat Premium', 374.97, 319.99, 14.66, 27.5, 83, 'Tech-enabled fitness', 'suggested'],
    ['Daily Essentials', 'Ceramic Travel Mug, Portable Power Bank 20000mAh, Wireless Bluetooth Headphones', 217.97, 184.99, 15.13, 33.6, 89, 'Everyday carry bundle', 'active'],
    ['Health & Wellness', 'Plant-Based Protein Powder, Yoga Mat Premium, Resistance Bands Set', 114.97, 97.99, 14.77, 35.2, 91, 'Complete wellness package', 'suggested'],
    ['Student Starter', 'LED Desk Lamp, USB-C Hub 7-in-1, Stainless Steel Water Bottle', 119.97, 99.99, 16.65, 40.3, 88, 'Back to school bundle', 'suggested'],
    ['Audio Experience', 'Wireless Bluetooth Headphones, Noise Machine Sleep', 184.98, 159.99, 13.51, 36.8, 80, 'Audio quality focused', 'suggested'],
    ['Kitchen Hydration', 'Stainless Steel Water Bottle, Ceramic Travel Mug, Bamboo Cutting Board Set', 87.97, 72.99, 17.03, 44.2, 85, 'Eco kitchen starter', 'suggested'],
    ['Ultimate Productivity', 'Laptop Stand Adjustable, LED Desk Lamp, Mechanical Keyboard RGB, Wireless Mouse Ergonomic, Noise Machine Sleep', 309.95, 259.99, 16.12, 29.4, 79, 'Complete office setup', 'suggested'],
    ['Outdoor Active', 'Running Shoes Elite, Portable Power Bank 20000mAh, Stainless Steel Water Bottle', 234.97, 199.99, 14.89, 31.7, 81, 'Active lifestyle bundle', 'suggested'],
  ];

  for (const br of bundleRecommendations) {
    await pool.query(
      'INSERT INTO bundle_recommendations (bundle_name, products, individual_total, bundle_price, discount_percentage, expected_margin, affinity_score, recommendation_reason, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      br
    );
  }
  console.log('Bundle recommendations seeded');

  // Seed Discount Optimizations (15+ items)
  const discountOptimizations = [
    ['Wireless Bluetooth Headphones', 149.99, 15, 127.49, 28, 2450.00, 180, 'recommended', 'percentage', '2 weeks'],
    ['Smart Watch Pro', 299.99, 10, 269.99, 18, 3200.00, 95, 'recommended', 'percentage', '1 week'],
    ['Organic Coffee Beans 1kg', 24.99, 20, 19.99, 45, 890.00, 320, 'highly_recommended', 'percentage', '1 month'],
    ['Yoga Mat Premium', 49.99, 25, 37.49, 55, 1650.00, 150, 'highly_recommended', 'percentage', '2 weeks'],
    ['LED Desk Lamp', 39.99, 12, 35.19, 22, 540.00, 85, 'optional', 'percentage', '1 week'],
    ['Mechanical Keyboard RGB', 129.99, 8, 119.59, 15, 1100.00, 65, 'optional', 'percentage', '2 weeks'],
    ['Running Shoes Elite', 159.99, 18, 131.19, 32, 2800.00, 120, 'recommended', 'percentage', '1 month'],
    ['Portable Power Bank 20000mAh', 44.99, 22, 35.09, 48, 1200.00, 220, 'highly_recommended', 'percentage', '2 weeks'],
    ['Stainless Steel Water Bottle', 29.99, 15, 25.49, 35, 680.00, 145, 'recommended', 'percentage', '1 month'],
    ['Wireless Mouse Ergonomic', 59.99, 10, 53.99, 20, 450.00, 70, 'optional', 'percentage', '1 week'],
    ['Plant-Based Protein Powder', 39.99, 12, 35.19, 25, 720.00, 95, 'recommended', 'percentage', '2 weeks'],
    ['Bamboo Cutting Board Set', 34.99, 20, 27.99, 40, 550.00, 110, 'recommended', 'percentage', '1 month'],
    ['USB-C Hub 7-in-1', 49.99, 15, 42.49, 30, 980.00, 130, 'recommended', 'percentage', '2 weeks'],
    ['Resistance Bands Set', 24.99, 30, 17.49, 65, 1100.00, 280, 'highly_recommended', 'percentage', '1 month'],
    ['Ceramic Travel Mug', 22.99, 18, 18.85, 38, 420.00, 160, 'recommended', 'percentage', '2 weeks'],
    ['Laptop Stand Adjustable', 44.99, 10, 40.49, 18, 380.00, 55, 'optional', 'percentage', '1 week'],
  ];

  for (const dopt of discountOptimizations) {
    await pool.query(
      'INSERT INTO discount_optimizations (product_name, current_price, optimal_discount, discounted_price, expected_volume_increase, expected_revenue_impact, break_even_volume, recommendation, discount_type, valid_period) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      dopt
    );
  }
  console.log('Discount optimizations seeded');

  // Seed Price Elasticity (15+ items)
  const priceElasticity = [
    ['Wireless Bluetooth Headphones', -1.45, 'elastic', 'high', 129.99, 169.99, 149.99, 'linear', 'Smart Watch Pro: 0.3, Mechanical Keyboard RGB: 0.2'],
    ['Smart Watch Pro', -0.85, 'inelastic', 'low', 279.99, 349.99, 299.99, 'convex', 'Running Shoes Elite: 0.4, Wireless Bluetooth Headphones: 0.3'],
    ['Organic Coffee Beans 1kg', -0.65, 'inelastic', 'low', 22.99, 29.99, 24.99, 'convex', 'Ceramic Travel Mug: 0.5, Stainless Steel Water Bottle: 0.3'],
    ['Yoga Mat Premium', -1.25, 'elastic', 'medium', 39.99, 59.99, 49.99, 'linear', 'Resistance Bands Set: 0.6, Plant-Based Protein Powder: 0.4'],
    ['LED Desk Lamp', -1.55, 'elastic', 'high', 32.99, 47.99, 39.99, 'linear', 'Laptop Stand Adjustable: 0.5, USB-C Hub 7-in-1: 0.3'],
    ['Mechanical Keyboard RGB', -0.95, 'unit_elastic', 'medium', 119.99, 149.99, 129.99, 'concave', 'Wireless Mouse Ergonomic: 0.7, LED Desk Lamp: 0.2'],
    ['Running Shoes Elite', -0.75, 'inelastic', 'low', 149.99, 189.99, 159.99, 'convex', 'Smart Watch Pro: 0.4, Yoga Mat Premium: 0.3'],
    ['Portable Power Bank 20000mAh', -1.65, 'elastic', 'high', 34.99, 54.99, 44.99, 'linear', 'USB-C Hub 7-in-1: 0.6, Wireless Bluetooth Headphones: 0.3'],
    ['Stainless Steel Water Bottle', -1.15, 'elastic', 'medium', 24.99, 36.99, 29.99, 'linear', 'Ceramic Travel Mug: 0.7, Bamboo Cutting Board Set: 0.4'],
    ['Wireless Mouse Ergonomic', -1.05, 'elastic', 'medium', 49.99, 69.99, 59.99, 'linear', 'Mechanical Keyboard RGB: 0.7, Laptop Stand Adjustable: 0.4'],
    ['Plant-Based Protein Powder', -0.70, 'inelastic', 'low', 34.99, 49.99, 39.99, 'convex', 'Resistance Bands Set: 0.5, Yoga Mat Premium: 0.4'],
    ['Bamboo Cutting Board Set', -1.35, 'elastic', 'medium', 27.99, 42.99, 34.99, 'linear', 'Stainless Steel Water Bottle: 0.4, Ceramic Travel Mug: 0.3'],
    ['USB-C Hub 7-in-1', -1.50, 'elastic', 'high', 39.99, 59.99, 49.99, 'linear', 'Portable Power Bank 20000mAh: 0.6, Laptop Stand Adjustable: 0.4'],
    ['Resistance Bands Set', -1.75, 'elastic', 'high', 18.99, 32.99, 24.99, 'linear', 'Yoga Mat Premium: 0.6, Plant-Based Protein Powder: 0.5'],
    ['Ceramic Travel Mug', -1.40, 'elastic', 'high', 17.99, 28.99, 22.99, 'linear', 'Organic Coffee Beans 1kg: 0.5, Stainless Steel Water Bottle: 0.7'],
    ['Laptop Stand Adjustable', -1.10, 'elastic', 'medium', 37.99, 54.99, 44.99, 'linear', 'LED Desk Lamp: 0.5, Wireless Mouse Ergonomic: 0.4'],
  ];

  for (const pe of priceElasticity) {
    await pool.query(
      'INSERT INTO price_elasticity (product_name, elasticity_coefficient, elasticity_type, price_sensitivity, optimal_price_range_min, optimal_price_range_max, current_price, demand_curve_type, cross_elasticity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      pe
    );
  }
  console.log('Price elasticity seeded');

  // Seed Price Tracker Categories
  const priceTrackerCategories = [
    ['Electronics', 'Phones, tablets, laptops, and gadgets', '📱'],
    ['Home & Kitchen', 'Appliances, cookware, and home essentials', '🏠'],
    ['Fashion', 'Clothing, shoes, and accessories', '👕'],
    ['Sports & Outdoors', 'Fitness equipment and outdoor gear', '⚽'],
    ['Beauty & Health', 'Skincare, makeup, and wellness products', '💄'],
    ['Books & Media', 'Books, music, movies, and games', '📚'],
    ['Toys & Games', 'Toys, board games, and entertainment', '🎮'],
    ['Automotive', 'Car accessories and parts', '🚗'],
  ];

  for (const cat of priceTrackerCategories) {
    await pool.query(
      'INSERT INTO price_tracker_categories (name, description, icon) VALUES ($1, $2, $3)',
      cat
    );
  }
  console.log('Price tracker categories seeded');

  // Seed Price Tracker Stores
  const priceTrackerStores = [
    ['Amazon', 'https://amazon.com', 'https://logo.clearbit.com/amazon.com'],
    ['Best Buy', 'https://bestbuy.com', 'https://logo.clearbit.com/bestbuy.com'],
    ['Walmart', 'https://walmart.com', 'https://logo.clearbit.com/walmart.com'],
    ['Target', 'https://target.com', 'https://logo.clearbit.com/target.com'],
    ['Newegg', 'https://newegg.com', 'https://logo.clearbit.com/newegg.com'],
    ['eBay', 'https://ebay.com', 'https://logo.clearbit.com/ebay.com'],
    ['Costco', 'https://costco.com', 'https://logo.clearbit.com/costco.com'],
    ['Home Depot', 'https://homedepot.com', 'https://logo.clearbit.com/homedepot.com'],
  ];

  for (const store of priceTrackerStores) {
    await pool.query(
      'INSERT INTO price_tracker_stores (name, website, logo_url) VALUES ($1, $2, $3)',
      store
    );
  }
  console.log('Price tracker stores seeded');

  // Seed Price Tracker Products (15+ items)
  const priceTrackerProducts = [
    ['Apple iPhone 15 Pro 256GB', 'Latest iPhone with A17 Pro chip and titanium design', 'https://amazon.com/iphone15pro', 999.00, 1199.00, 'https://picsum.photos/seed/iphone/400/400', 1, 1],
    ['Samsung Galaxy S24 Ultra', 'Premium Android smartphone with S Pen', 'https://bestbuy.com/s24ultra', 1099.00, 1299.00, 'https://picsum.photos/seed/samsung/400/400', 1, 2],
    ['Sony WH-1000XM5 Headphones', 'Industry-leading noise canceling wireless headphones', 'https://amazon.com/sonywh1000xm5', 328.00, 399.00, 'https://picsum.photos/seed/sony/400/400', 1, 1],
    ['MacBook Air M3 15-inch', 'Thin and light laptop with M3 chip', 'https://amazon.com/macbookairm3', 1199.00, 1299.00, 'https://picsum.photos/seed/macbook/400/400', 1, 1],
    ['LG C3 65" OLED TV', '4K OLED Smart TV with Dolby Vision', 'https://bestbuy.com/lgc3', 1496.00, 1799.00, 'https://picsum.photos/seed/lgtv/400/400', 1, 2],
    ['Dyson V15 Detect Vacuum', 'Cordless vacuum with laser dust detection', 'https://amazon.com/dysonv15', 649.00, 749.00, 'https://picsum.photos/seed/dyson/400/400', 2, 1],
    ['Instant Pot Duo Plus 8Qt', '9-in-1 Electric Pressure Cooker', 'https://amazon.com/instantpot', 89.00, 139.00, 'https://picsum.photos/seed/instantpot/400/400', 2, 1],
    ['KitchenAid Stand Mixer', 'Professional 5-quart stand mixer', 'https://walmart.com/kitchenaid', 349.00, 449.00, 'https://picsum.photos/seed/kitchenaid/400/400', 2, 3],
    ['Nike Air Max 270', 'Comfortable lifestyle running shoes', 'https://nike.com/airmax270', 129.00, 160.00, 'https://picsum.photos/seed/nike/400/400', 3, 4],
    ['Levi 501 Original Jeans', 'Classic straight fit jeans', 'https://amazon.com/levis501', 59.00, 79.00, 'https://picsum.photos/seed/levis/400/400', 3, 1],
    ['Peloton Bike+', 'Smart exercise bike with rotating screen', 'https://peloton.com/bikeplus', 1995.00, 2495.00, 'https://picsum.photos/seed/peloton/400/400', 4, 4],
    ['Yeti Tundra 45 Cooler', 'Premium hard cooler for outdoor adventures', 'https://yeti.com/tundra45', 299.00, 349.00, 'https://picsum.photos/seed/yeti/400/400', 4, 1],
    ['The Ordinary Skincare Set', 'Complete skincare routine bundle', 'https://amazon.com/ordinary', 45.00, 65.00, 'https://picsum.photos/seed/ordinary/400/400', 5, 1],
    ['Olaplex Hair Repair Kit', 'Professional hair repair treatment', 'https://sephora.com/olaplex', 89.00, 120.00, 'https://picsum.photos/seed/olaplex/400/400', 5, 4],
    ['PlayStation 5 Console', 'Next-gen gaming console with 4K graphics', 'https://walmart.com/ps5', 449.00, 499.00, 'https://picsum.photos/seed/ps5/400/400', 7, 3],
    ['Nintendo Switch OLED', 'Handheld gaming console with OLED screen', 'https://target.com/switcholed', 329.00, 349.00, 'https://picsum.photos/seed/switch/400/400', 7, 4],
    ['Kindle Paperwhite 11th Gen', 'E-reader with adjustable warm light', 'https://amazon.com/kindlepw', 129.00, 149.00, 'https://picsum.photos/seed/kindle/400/400', 6, 1],
    ['Apple AirPods Pro 2', 'Wireless earbuds with active noise cancellation', 'https://amazon.com/airpodspro2', 199.00, 249.00, 'https://picsum.photos/seed/airpods/400/400', 1, 1],
    ['Garmin Fenix 7 Watch', 'Premium multisport GPS smartwatch', 'https://amazon.com/garminfenix7', 549.00, 699.00, 'https://picsum.photos/seed/garmin/400/400', 4, 1],
    ['iRobot Roomba j7+', 'Self-emptying robot vacuum with obstacle avoidance', 'https://amazon.com/roombaj7', 599.00, 799.00, 'https://picsum.photos/seed/roomba/400/400', 2, 1],
  ];

  for (const prod of priceTrackerProducts) {
    await pool.query(
      'INSERT INTO price_tracker (name, description, url, current_price, original_price, image_url, category_id, store_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      prod
    );
  }
  console.log('Price tracker products seeded (20 items)');

  // Seed Price Tracker Alerts (15+ items)
  const priceTrackerAlerts = [
    [1, 899.00, 'below'],
    [2, 999.00, 'below'],
    [3, 299.00, 'below'],
    [5, 1400.00, 'below'],
    [6, 599.00, 'below'],
    [11, 1800.00, 'below'],
    [15, 400.00, 'below'],
    [18, 179.00, 'below'],
    [4, 1100.00, 'below'],
    [7, 79.00, 'below'],
    [9, 100.00, 'below'],
    [12, 279.00, 'below'],
    [14, 79.00, 'below'],
    [16, 299.00, 'below'],
    [20, 500.00, 'below'],
  ];

  for (const alert of priceTrackerAlerts) {
    await pool.query(
      'INSERT INTO price_tracker_alerts (product_id, target_price, alert_type) VALUES ($1, $2, $3)',
      alert
    );
  }
  console.log('Price tracker alerts seeded (15 items)');

  // ==================== ADMIN FEATURE SEED DATA ====================

  // Seed Password Resets (15+ items)
  const passwordResets = [
    [1, 'abc123token001', false, '2025-03-01 12:00:00'],
    [2, 'abc123token002', true, '2025-02-15 12:00:00'],
    [3, 'abc123token003', true, '2025-02-10 12:00:00'],
    [1, 'abc123token004', true, '2025-01-20 12:00:00'],
    [4, 'abc123token005', false, '2025-03-05 12:00:00'],
    [2, 'abc123token006', true, '2025-01-15 12:00:00'],
    [3, 'abc123token007', true, '2025-01-10 12:00:00'],
    [1, 'abc123token008', true, '2024-12-20 12:00:00'],
    [4, 'abc123token009', true, '2024-12-15 12:00:00'],
    [2, 'abc123token010', false, '2025-03-10 12:00:00'],
    [3, 'abc123token011', true, '2024-11-20 12:00:00'],
    [1, 'abc123token012', true, '2024-11-15 12:00:00'],
    [4, 'abc123token013', true, '2024-10-20 12:00:00'],
    [2, 'abc123token014', true, '2024-10-15 12:00:00'],
    [3, 'abc123token015', true, '2024-09-20 12:00:00'],
    [1, 'abc123token016', true, '2024-09-15 12:00:00'],
  ];

  for (const pr of passwordResets) {
    await pool.query(
      'INSERT INTO password_resets (user_id, token, used, expires_at) VALUES ($1, $2, $3, $4)',
      pr
    );
  }
  console.log('Password resets seeded');

  // Seed Password Changes (15+ items)
  const passwordChanges = [
    [1, 'manual', '192.168.1.10', 'Mozilla/5.0 Chrome/120', 'success'],
    [2, 'reset', '192.168.1.20', 'Mozilla/5.0 Firefox/119', 'success'],
    [3, 'manual', '10.0.0.15', 'Mozilla/5.0 Safari/17', 'success'],
    [4, 'forced', '172.16.0.5', 'Mozilla/5.0 Chrome/120', 'success'],
    [1, 'manual', '192.168.1.10', 'Mozilla/5.0 Chrome/119', 'success'],
    [2, 'reset', '192.168.1.25', 'Mozilla/5.0 Edge/119', 'success'],
    [3, 'manual', '10.0.0.20', 'Mozilla/5.0 Safari/16', 'failed'],
    [4, 'manual', '172.16.0.10', 'Mozilla/5.0 Chrome/118', 'success'],
    [1, 'forced', '192.168.1.15', 'Mozilla/5.0 Firefox/118', 'success'],
    [2, 'manual', '192.168.1.30', 'Mozilla/5.0 Chrome/117', 'success'],
    [3, 'reset', '10.0.0.25', 'Mozilla/5.0 Safari/16', 'success'],
    [4, 'manual', '172.16.0.15', 'Mozilla/5.0 Edge/118', 'failed'],
    [1, 'manual', '192.168.1.20', 'Mozilla/5.0 Chrome/116', 'success'],
    [2, 'forced', '192.168.1.35', 'Mozilla/5.0 Firefox/117', 'success'],
    [3, 'manual', '10.0.0.30', 'Mozilla/5.0 Chrome/115', 'success'],
    [4, 'reset', '172.16.0.20', 'Mozilla/5.0 Safari/15', 'success'],
  ];

  for (const pc of passwordChanges) {
    await pool.query(
      'INSERT INTO password_changes (user_id, change_type, ip_address, user_agent, status) VALUES ($1, $2, $3, $4, $5)',
      pc
    );
  }
  console.log('Password changes seeded');

  // Seed Session Logs (15+ items)
  const sessionLogs = [
    [1, 'sess_token_001', '192.168.1.10', 'Mozilla/5.0 Chrome/120', '2025-02-10 08:00:00', '2025-02-10 17:30:00', 'completed'],
    [2, 'sess_token_002', '192.168.1.20', 'Mozilla/5.0 Firefox/119', '2025-02-10 09:15:00', null, 'active'],
    [3, 'sess_token_003', '10.0.0.15', 'Mozilla/5.0 Safari/17', '2025-02-09 10:00:00', '2025-02-09 12:00:00', 'completed'],
    [4, 'sess_token_004', '172.16.0.5', 'Mozilla/5.0 Chrome/120', '2025-02-09 14:00:00', '2025-02-09 14:05:00', 'expired'],
    [1, 'sess_token_005', '192.168.1.11', 'Mozilla/5.0 Chrome/120', '2025-02-08 08:00:00', '2025-02-08 18:00:00', 'completed'],
    [2, 'sess_token_006', '192.168.1.25', 'Mozilla/5.0 Edge/119', '2025-02-08 10:30:00', '2025-02-08 16:45:00', 'completed'],
    [3, 'sess_token_007', '10.0.0.20', 'Mozilla/5.0 Safari/16', '2025-02-07 11:00:00', '2025-02-07 11:02:00', 'failed'],
    [4, 'sess_token_008', '172.16.0.10', 'Mozilla/5.0 Chrome/118', '2025-02-07 13:00:00', '2025-02-07 17:00:00', 'completed'],
    [1, 'sess_token_009', '192.168.1.15', 'Mozilla/5.0 Firefox/118', '2025-02-06 08:30:00', '2025-02-06 17:00:00', 'completed'],
    [2, 'sess_token_010', '192.168.1.30', 'Mozilla/5.0 Chrome/117', '2025-02-06 09:00:00', '2025-02-06 12:30:00', 'completed'],
    [3, 'sess_token_011', '10.0.0.25', 'Mozilla/5.0 Safari/16', '2025-02-05 10:00:00', null, 'active'],
    [4, 'sess_token_012', '172.16.0.15', 'Mozilla/5.0 Edge/118', '2025-02-05 14:00:00', '2025-02-05 14:01:00', 'expired'],
    [1, 'sess_token_013', '192.168.1.20', 'Mozilla/5.0 Chrome/116', '2025-02-04 08:00:00', '2025-02-04 17:30:00', 'completed'],
    [2, 'sess_token_014', '192.168.1.35', 'Mozilla/5.0 Firefox/117', '2025-02-04 09:30:00', '2025-02-04 18:00:00', 'completed'],
    [3, 'sess_token_015', '10.0.0.30', 'Mozilla/5.0 Chrome/115', '2025-02-03 10:00:00', '2025-02-03 15:00:00', 'completed'],
    [4, 'sess_token_016', '172.16.0.20', 'Mozilla/5.0 Safari/15', '2025-02-03 11:00:00', '2025-02-03 11:30:00', 'completed'],
  ];

  for (const sl of sessionLogs) {
    await pool.query(
      'INSERT INTO session_logs (user_id, session_token, ip_address, user_agent, login_at, logout_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      sl
    );
  }
  console.log('Session logs seeded');

  // Seed Pagination Configs (15+ items)
  const paginationConfigs = [
    ['Products', 25, 100, 'created_at', 'DESC', true],
    ['Competitors', 20, 50, 'name', 'ASC', true],
    ['Demand Signals', 25, 100, 'signal_strength', 'DESC', true],
    ['Price Suggestions', 15, 50, 'created_at', 'DESC', true],
    ['Price History', 30, 100, 'change_date', 'DESC', true],
    ['Market Trends', 20, 50, 'impact_level', 'DESC', true],
    ['AI Insights', 10, 30, 'priority', 'DESC', true],
    ['Competitor Tracking', 25, 100, 'tracked_date', 'DESC', true],
    ['Demand Forecasts', 20, 50, 'confidence_level', 'DESC', true],
    ['Bundle Recommendations', 15, 50, 'affinity_score', 'DESC', true],
    ['Discount Optimizations', 20, 50, 'optimal_discount', 'DESC', true],
    ['Price Elasticity', 25, 100, 'elasticity_coefficient', 'ASC', true],
    ['User Management', 20, 50, 'created_at', 'DESC', true],
    ['Error Logs', 50, 200, 'created_at', 'DESC', true],
    ['Session Logs', 30, 100, 'login_at', 'DESC', true],
    ['Password Resets', 25, 100, 'created_at', 'DESC', true],
  ];

  for (const pg of paginationConfigs) {
    await pool.query(
      'INSERT INTO pagination_configs (page_name, items_per_page, max_items_per_page, default_sort_field, default_sort_order, enabled) VALUES ($1, $2, $3, $4, $5, $6)',
      pg
    );
  }
  console.log('Pagination configs seeded');

  // Seed PDF Exports (15+ items)
  const pdfExports = [
    [1, 'products_report', 'products_report_2025-02-10.pdf', 245000, 12, 'completed'],
    [2, 'competitor_analysis', 'competitor_analysis_2025-02-09.pdf', 189000, 8, 'completed'],
    [1, 'price_history', 'price_history_2025-02-08.pdf', 312000, 15, 'completed'],
    [3, 'market_trends', 'market_trends_2025-02-07.pdf', 156000, 6, 'completed'],
    [4, 'demand_forecast', 'demand_forecast_2025-02-06.pdf', 278000, 10, 'completed'],
    [1, 'bundle_report', 'bundle_report_2025-02-05.pdf', 198000, 7, 'completed'],
    [2, 'discount_analysis', 'discount_analysis_2025-02-04.pdf', 167000, 5, 'completed'],
    [3, 'elasticity_report', 'elasticity_report_2025-02-03.pdf', 234000, 9, 'completed'],
    [4, 'ai_insights', 'ai_insights_2025-02-02.pdf', 145000, 4, 'completed'],
    [1, 'monthly_summary', 'monthly_summary_jan_2025.pdf', 456000, 22, 'completed'],
    [2, 'quarterly_report', 'quarterly_report_Q4_2024.pdf', 567000, 28, 'completed'],
    [3, 'products_report', 'products_report_2025-01-15.pdf', 234000, 11, 'completed'],
    [4, 'competitor_analysis', 'competitor_analysis_2025-01-10.pdf', 178000, 7, 'failed'],
    [1, 'price_suggestions', 'price_suggestions_2025-01-05.pdf', 123000, 5, 'completed'],
    [2, 'session_audit', 'session_audit_2025-01-01.pdf', 345000, 16, 'completed'],
    [3, 'security_report', 'security_report_2024-12-31.pdf', 289000, 13, 'completed'],
  ];

  for (const pe of pdfExports) {
    await pool.query(
      'INSERT INTO pdf_exports (user_id, export_type, file_name, file_size, page_count, status) VALUES ($1, $2, $3, $4, $5, $6)',
      pe
    );
  }
  console.log('PDF exports seeded');

  // Seed Confirmation Dialogs (15+ items)
  const confirmationDialogs = [
    ['delete_product', 'Delete Product', 'Are you sure you want to delete this product? This action cannot be undone.', 'Delete', 'Cancel', 'danger', false, true],
    ['delete_competitor', 'Delete Competitor', 'Are you sure you want to remove this competitor?', 'Delete', 'Cancel', 'danger', false, true],
    ['approve_suggestion', 'Approve Price Suggestion', 'Do you want to approve this price change?', 'Approve', 'Cancel', 'warning', false, true],
    ['reject_suggestion', 'Reject Price Suggestion', 'Do you want to reject this price suggestion?', 'Reject', 'Cancel', 'warning', true, true],
    ['bulk_delete', 'Bulk Delete', 'Are you sure you want to delete the selected items?', 'Delete All', 'Cancel', 'danger', false, true],
    ['export_pdf', 'Export to PDF', 'Generate a PDF report for the current view?', 'Export', 'Cancel', 'info', false, true],
    ['reset_password', 'Reset Password', 'Send a password reset link to this user?', 'Send Reset', 'Cancel', 'warning', false, true],
    ['deactivate_user', 'Deactivate User', 'Are you sure you want to deactivate this user account?', 'Deactivate', 'Cancel', 'danger', true, true],
    ['apply_discount', 'Apply Discount', 'Apply the recommended discount to this product?', 'Apply', 'Cancel', 'warning', false, true],
    ['activate_bundle', 'Activate Bundle', 'Make this bundle recommendation active?', 'Activate', 'Cancel', 'info', false, true],
    ['clear_logs', 'Clear Logs', 'Clear all error logs older than 30 days?', 'Clear', 'Cancel', 'warning', false, true],
    ['terminate_session', 'Terminate Session', 'Force terminate this active session?', 'Terminate', 'Cancel', 'danger', false, true],
    ['update_security', 'Update Security Headers', 'Apply new security header configuration?', 'Update', 'Cancel', 'warning', false, true],
    ['revoke_access', 'Revoke Access', 'Revoke this RBAC policy? Users may lose access.', 'Revoke', 'Cancel', 'danger', true, true],
    ['change_rate_limit', 'Update Rate Limit', 'Modify rate limiting rules for this endpoint?', 'Update', 'Cancel', 'warning', false, true],
    ['verify_email', 'Manual Email Verification', 'Manually verify this email address?', 'Verify', 'Cancel', 'info', false, true],
  ];

  for (const cd of confirmationDialogs) {
    await pool.query(
      'INSERT INTO confirmation_dialogs (action_name, dialog_title, dialog_message, confirm_button_text, cancel_button_text, severity, requires_input, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      cd
    );
  }
  console.log('Confirmation dialogs seeded');

  // Seed Error Logs (15+ items)
  const errorLogs = [
    ['DatabaseError', 'Connection timeout after 30000ms', 'Error: Connection timeout\n  at Pool.query (pool.js:45)', '/api/products', 'GET', 1, '192.168.1.10', 'error', false],
    ['ValidationError', 'Invalid email format provided', 'ValidationError: email must be valid\n  at validate (validator.js:12)', '/api/auth/register', 'POST', null, '10.0.0.5', 'warning', true],
    ['AuthenticationError', 'Invalid token signature', 'JsonWebTokenError: invalid signature\n  at verify (jwt.js:88)', '/api/products', 'GET', 2, '192.168.1.20', 'error', true],
    ['RateLimitError', 'Too many requests from IP 10.0.0.100', 'RateLimitError: Rate limit exceeded\n  at limiter (rate-limit.js:25)', '/api/auth/login', 'POST', null, '10.0.0.100', 'warning', false],
    ['NotFoundError', 'Product with ID 999 not found', 'Error: Product not found\n  at getProduct (products.js:34)', '/api/products/999', 'GET', 3, '10.0.0.15', 'warning', true],
    ['DatabaseError', 'Unique constraint violation on email', 'Error: duplicate key value violates unique constraint\n  at insert (pg.js:67)', '/api/auth/register', 'POST', null, '172.16.0.5', 'error', true],
    ['ServerError', 'Unexpected server error during PDF generation', 'Error: ENOMEM out of memory\n  at generatePDF (pdf.js:120)', '/api/exports/pdf', 'POST', 1, '192.168.1.10', 'critical', false],
    ['AuthorizationError', 'User lacks admin privileges', 'ForbiddenError: Insufficient permissions\n  at authorize (auth.js:55)', '/api/users', 'DELETE', 4, '172.16.0.10', 'warning', true],
    ['TimeoutError', 'AI API request timed out after 60s', 'Error: Request timeout\n  at callOpenRouter (server.js:124)', '/api/ai/analyze', 'POST', 2, '192.168.1.20', 'error', false],
    ['DatabaseError', 'Dead lock detected on table products', 'Error: deadlock detected\n  at Pool.query (pool.js:78)', '/api/products', 'PUT', 1, '192.168.1.15', 'critical', false],
    ['ValidationError', 'Price must be greater than zero', 'ValidationError: current_price must be positive\n  at validate (products.js:22)', '/api/products', 'POST', 3, '10.0.0.15', 'warning', true],
    ['NetworkError', 'External API unreachable: openrouter.ai', 'Error: ECONNREFUSED\n  at fetch (network.js:45)', '/api/ai/insights', 'GET', null, '192.168.1.10', 'error', false],
    ['CacheError', 'Redis connection lost', 'Error: Redis connection to 127.0.0.1:6379 failed\n  at RedisClient (redis.js:12)', '/api/dashboard/stats', 'GET', 1, '192.168.1.10', 'error', true],
    ['FileError', 'PDF export file exceeds max size', 'Error: File size exceeds 10MB limit\n  at exportPDF (pdf.js:88)', '/api/exports/pdf', 'POST', 4, '172.16.0.20', 'warning', true],
    ['SecurityError', 'CSRF token mismatch', 'Error: CSRF token validation failed\n  at csrfCheck (security.js:34)', '/api/settings', 'PUT', 2, '192.168.1.25', 'critical', false],
    ['DatabaseError', 'Migration script failed on table creation', 'Error: relation already exists\n  at migrate (migrate.js:56)', '/api/admin/migrate', 'POST', 1, '192.168.1.10', 'error', true],
  ];

  for (const el of errorLogs) {
    await pool.query(
      'INSERT INTO error_logs (error_type, error_message, stack_trace, endpoint, method, user_id, ip_address, severity, resolved) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      el
    );
  }
  console.log('Error logs seeded');

  // Seed Loading Configs (15+ items)
  const loadingConfigs = [
    ['Dashboard', 'skeleton', 6, 15000, 3, true, true],
    ['ProductsTable', 'spinner', 10, 30000, 3, false, true],
    ['CompetitorsList', 'spinner', 8, 30000, 3, false, true],
    ['PriceHistory', 'skeleton', 12, 20000, 2, true, true],
    ['AIInsights', 'pulse', 5, 60000, 5, true, true],
    ['DemandForecasts', 'skeleton', 8, 45000, 3, true, true],
    ['BundleRecommendations', 'spinner', 6, 30000, 3, false, true],
    ['DiscountOptimizations', 'skeleton', 8, 30000, 3, true, true],
    ['PriceElasticity', 'spinner', 10, 30000, 2, false, true],
    ['MarketTrends', 'pulse', 6, 20000, 3, false, true],
    ['UserManagement', 'spinner', 5, 15000, 3, false, true],
    ['Settings', 'skeleton', 4, 10000, 2, false, true],
    ['PDFExport', 'progress', 1, 120000, 1, true, true],
    ['ChartWidgets', 'skeleton', 3, 20000, 3, true, true],
    ['SearchResults', 'spinner', 10, 15000, 2, false, true],
    ['ModalForms', 'spinner', 1, 10000, 2, false, true],
  ];

  for (const lc of loadingConfigs) {
    await pool.query(
      'INSERT INTO loading_configs (component_name, loading_type, skeleton_count, timeout_ms, retry_count, show_progress, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      lc
    );
  }
  console.log('Loading configs seeded');

  // Seed RBAC Policies (15+ items)
  const rbacPolicies = [
    ['admin', 'products', 'create', 'allow', null, 10, true],
    ['admin', 'products', 'read', 'allow', null, 10, true],
    ['admin', 'products', 'update', 'allow', null, 10, true],
    ['admin', 'products', 'delete', 'allow', null, 10, true],
    ['manager', 'products', 'create', 'allow', null, 5, true],
    ['manager', 'products', 'read', 'allow', null, 5, true],
    ['manager', 'products', 'update', 'allow', null, 5, true],
    ['manager', 'products', 'delete', 'deny', null, 5, true],
    ['user', 'products', 'read', 'allow', null, 1, true],
    ['admin', 'users', 'create', 'allow', null, 10, true],
    ['admin', 'users', 'delete', 'allow', null, 10, true],
    ['admin', 'settings', 'update', 'allow', null, 10, true],
    ['manager', 'reports', 'read', 'allow', null, 5, true],
    ['manager', 'reports', 'export', 'allow', null, 5, true],
    ['user', 'reports', 'read', 'allow', 'own_data_only', 1, true],
    ['admin', 'audit_logs', 'read', 'allow', null, 10, true],
  ];

  for (const rp of rbacPolicies) {
    await pool.query(
      'INSERT INTO rbac_policies (role_name, resource, action, effect, conditions, priority, enabled) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      rp
    );
  }
  console.log('RBAC policies seeded');

  // Seed Rate Limit Logs (15+ items)
  const rateLimitLogs = [
    ['192.168.1.10', '/api/auth/login', 'POST', 5, '2025-02-10 08:00:00', '2025-02-10 08:15:00', false, 1],
    ['10.0.0.100', '/api/auth/login', 'POST', 21, '2025-02-10 09:00:00', '2025-02-10 09:15:00', true, null],
    ['172.16.0.5', '/api/products', 'GET', 150, '2025-02-10 10:00:00', '2025-02-10 10:15:00', false, 4],
    ['10.0.0.50', '/api/auth/login', 'POST', 25, '2025-02-09 14:00:00', '2025-02-09 14:15:00', true, null],
    ['192.168.1.20', '/api/ai/analyze', 'POST', 8, '2025-02-09 11:00:00', '2025-02-09 11:15:00', false, 2],
    ['10.0.0.75', '/api/auth/register', 'POST', 15, '2025-02-09 16:00:00', '2025-02-09 16:15:00', true, null],
    ['172.16.0.10', '/api/products', 'GET', 180, '2025-02-08 09:00:00', '2025-02-08 09:15:00', false, 3],
    ['192.168.1.30', '/api/dashboard/stats', 'GET', 45, '2025-02-08 12:00:00', '2025-02-08 12:15:00', false, 2],
    ['10.0.0.200', '/api/auth/login', 'POST', 30, '2025-02-07 22:00:00', '2025-02-07 22:15:00', true, null],
    ['172.16.0.15', '/api/competitors', 'GET', 95, '2025-02-07 10:00:00', '2025-02-07 10:15:00', false, 4],
    ['192.168.1.40', '/api/price-suggestions', 'POST', 12, '2025-02-06 15:00:00', '2025-02-06 15:15:00', false, 1],
    ['10.0.0.150', '/api/auth/forgot-password', 'POST', 20, '2025-02-06 03:00:00', '2025-02-06 03:15:00', true, null],
    ['172.16.0.20', '/api/exports/pdf', 'POST', 3, '2025-02-05 14:00:00', '2025-02-05 14:15:00', false, 3],
    ['192.168.1.50', '/api/ai/insights', 'GET', 55, '2025-02-05 11:00:00', '2025-02-05 11:15:00', false, 2],
    ['10.0.0.250', '/api/auth/login', 'POST', 50, '2025-02-04 01:00:00', '2025-02-04 01:15:00', true, null],
    ['192.168.1.60', '/api/products', 'POST', 35, '2025-02-04 16:00:00', '2025-02-04 16:15:00', false, 1],
  ];

  for (const rl of rateLimitLogs) {
    await pool.query(
      'INSERT INTO rate_limit_logs (ip_address, endpoint, method, request_count, window_start, window_end, blocked, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      rl
    );
  }
  console.log('Rate limit logs seeded');

  // Seed Security Headers (15+ items)
  const securityHeaders = [
    ['Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'", 'Controls resources the browser is allowed to load', 'Content Security', true, 'all'],
    ['X-Content-Type-Options', 'nosniff', 'Prevents MIME type sniffing', 'Content Security', true, 'all'],
    ['X-Frame-Options', 'DENY', 'Prevents clickjacking by disabling iframes', 'Framing Protection', true, 'all'],
    ['X-XSS-Protection', '1; mode=block', 'Enables browser XSS filtering', 'XSS Protection', true, 'all'],
    ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains', 'Forces HTTPS connections', 'Transport Security', true, 'all'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin', 'Controls referrer information sent', 'Privacy', true, 'all'],
    ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()', 'Controls browser feature access', 'Permissions', true, 'all'],
    ['Cache-Control', 'no-store, no-cache, must-revalidate', 'Prevents caching of sensitive data', 'Caching', true, 'api'],
    ['X-DNS-Prefetch-Control', 'off', 'Disables DNS prefetching', 'Privacy', true, 'all'],
    ['Cross-Origin-Opener-Policy', 'same-origin', 'Isolates browsing context', 'Cross-Origin', true, 'all'],
    ['Cross-Origin-Resource-Policy', 'same-origin', 'Restricts resource loading to same origin', 'Cross-Origin', true, 'all'],
    ['Cross-Origin-Embedder-Policy', 'require-corp', 'Prevents loading cross-origin resources', 'Cross-Origin', true, 'all'],
    ['X-Permitted-Cross-Domain-Policies', 'none', 'Restricts Adobe Flash and PDF access', 'Legacy Protection', true, 'all'],
    ['X-Download-Options', 'noopen', 'Prevents IE from opening downloads directly', 'Legacy Protection', true, 'all'],
    ['X-Request-Id', 'auto-generated', 'Adds unique request ID for tracing', 'Monitoring', true, 'api'],
    ['Access-Control-Allow-Origin', 'http://localhost:3000', 'CORS header for allowed origins', 'CORS', true, 'api'],
  ];

  for (const sh of securityHeaders) {
    await pool.query(
      'INSERT INTO security_headers (header_name, header_value, description, category, enabled, applies_to) VALUES ($1, $2, $3, $4, $5, $6)',
      sh
    );
  }
  console.log('Security headers seeded');

  // Seed Email Verifications (15+ items)
  const emailVerifications = [
    [1, 'verify_token_001', true, '2025-03-01 12:00:00'],
    [2, 'verify_token_002', true, '2025-02-28 12:00:00'],
    [3, 'verify_token_003', false, '2025-03-05 12:00:00'],
    [4, 'verify_token_004', true, '2025-02-25 12:00:00'],
    [1, 'verify_token_005', true, '2025-02-20 12:00:00'],
    [2, 'verify_token_006', false, '2025-03-10 12:00:00'],
    [3, 'verify_token_007', true, '2025-02-15 12:00:00'],
    [4, 'verify_token_008', true, '2025-02-10 12:00:00'],
    [1, 'verify_token_009', true, '2025-02-05 12:00:00'],
    [2, 'verify_token_010', true, '2025-01-30 12:00:00'],
    [3, 'verify_token_011', false, '2025-03-15 12:00:00'],
    [4, 'verify_token_012', true, '2025-01-20 12:00:00'],
    [1, 'verify_token_013', true, '2025-01-15 12:00:00'],
    [2, 'verify_token_014', true, '2025-01-10 12:00:00'],
    [3, 'verify_token_015', true, '2025-01-05 12:00:00'],
    [4, 'verify_token_016', true, '2024-12-30 12:00:00'],
  ];

  for (const ev of emailVerifications) {
    await pool.query(
      'INSERT INTO email_verifications (user_id, token, verified, expires_at) VALUES ($1, $2, $3, $4)',
      ev
    );
  }
  console.log('Email verifications seeded');

  // Seed Password Validations (15+ items)
  const passwordValidations = [
    ['Minimum Length', 'length', '8', 'Password must be at least 8 characters long', 'error', true, 10],
    ['Maximum Length', 'length', '128', 'Password must not exceed 128 characters', 'error', true, 9],
    ['Uppercase Required', 'pattern', '[A-Z]', 'Password must contain at least one uppercase letter', 'error', true, 8],
    ['Lowercase Required', 'pattern', '[a-z]', 'Password must contain at least one lowercase letter', 'error', true, 7],
    ['Number Required', 'pattern', '[0-9]', 'Password must contain at least one number', 'error', true, 6],
    ['Special Char Required', 'pattern', '[!@#$%^&*]', 'Password must contain at least one special character', 'error', true, 5],
    ['No Common Passwords', 'dictionary', 'common_passwords.txt', 'Password is too common and easily guessable', 'error', true, 4],
    ['No Username in Password', 'custom', 'no_username', 'Password must not contain your username', 'error', true, 3],
    ['No Repeated Characters', 'pattern', '(.)\\1{2,}', 'Password must not have 3+ repeated characters', 'warning', true, 2],
    ['No Sequential Numbers', 'pattern', '(012|123|234|345|456|567|678|789)', 'Password should not contain sequential numbers', 'warning', true, 1],
    ['Password History', 'history', '5', 'Cannot reuse last 5 passwords', 'error', true, 10],
    ['Minimum Entropy', 'entropy', '40', 'Password entropy must be at least 40 bits', 'warning', false, 0],
    ['No Spaces', 'pattern', '^\\S+$', 'Password must not contain spaces', 'error', true, 5],
    ['Mixed Case Required', 'custom', 'mixed_case', 'Password must contain both upper and lower case', 'error', true, 7],
    ['Expiry Period', 'expiry', '90', 'Password expires after 90 days', 'info', true, 0],
    ['Breach Check', 'api', 'haveibeenpwned', 'Password found in known data breaches', 'error', false, 10],
  ];

  for (const pv of passwordValidations) {
    await pool.query(
      'INSERT INTO password_validations (rule_name, rule_type, rule_value, error_message, severity, enabled, priority) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      pv
    );
  }
  console.log('Password validations seeded');
}

async function main() {
  try {
    console.log('Starting database seed...');
    await createTables();
    await seedData();
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

main();
