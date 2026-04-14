'use strict';

/* =============================================
   XBurger Admin Panel — JavaScript
   Powered by sql.js (SQLite in the Browser)
   ============================================= */

/* =============================================
   DATABASE MODULE
   ============================================= */
const Database = (() => {
  let SQL = null;
  let db = null;
  const DB_KEY = 'xburger_admin_db';

  /* ---- Init ---- */
  async function init() {
    try {
      SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
      });
      const saved = localStorage.getItem(DB_KEY);
      if (saved) {
        const buf = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
        db = new SQL.Database(buf);
        runMigrations(); // ensure any new columns exist
      } else {
        db = new SQL.Database();
        createTables();
        seedData();
        save();
      }
      return true;
    } catch (err) {
      console.error('DB init error:', err);
      return false;
    }
  }

  /* ---- Persist to localStorage ---- */
  function save() {
    try {
      const data = db.export();
      const base64 = btoa(String.fromCharCode.apply(null, data));
      localStorage.setItem(DB_KEY, base64);
      
      // Sync products so main site can reflect updates/additions
      try {
        const rows = query('SELECT * FROM products WHERE available=1');
        if (rows && rows.length) {
          localStorage.setItem('xburger_sync_products', JSON.stringify(rows));
        }
      } catch(e) {}
    } catch (err) {
      console.error('DB save error:', err);
    }
  }

  /* ---- Schema ---- */
  function createTables() {
    db.run(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT DEFAULT 'Admin',
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        customer_name TEXT DEFAULT 'Online Customer',
        customer_phone TEXT DEFAULT '',
        customer_email TEXT DEFAULT '',
        items TEXT NOT NULL,
        total REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        payment_method TEXT DEFAULT 'Paystack',
        payment_status TEXT DEFAULT 'pending',
        delivery_address TEXT DEFAULT 'Lagos, Nigeria',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        review TEXT DEFAULT '',
        product_name TEXT DEFAULT 'General',
        approved INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price REAL NOT NULL DEFAULT 0,
        category TEXT DEFAULT 'Burger',
        available INTEGER DEFAULT 1,
        sales_count INTEGER DEFAULT 0,
        image TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT DEFAULT '',
        admin_user TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );
    `);
  }

    function runMigrations() {
    // Safely add columns that may not exist in older DBs
    try { db.run(`ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT ''`); } catch (_) {}
    try { db.run(`ALTER TABLE ratings ADD COLUMN approved INTEGER DEFAULT 1`); } catch (_) {}
    try { db.run(`ALTER TABLE products ADD COLUMN image TEXT DEFAULT ''`); } catch (_) {}
    try { db.run(`CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL, details TEXT DEFAULT '',
        admin_user TEXT DEFAULT 'admin',
        created_at TEXT DEFAULT (datetime('now','localtime')))`); } catch (_) {}
  }

  /* ---- Seed sample data ---- */
  function seedData() {
    // Default admin
    db.run(`INSERT INTO admins (username, password, full_name) VALUES (?,?,?)`,
      ['admin', 'xburger2025', 'XBurger Admin']);

    // Products
    [
      ['Classic Burger',      'Juicy beef patty with fresh lettuce, tomato & secret sauce', 3000, 'Burger', 1, 45],
      ['Cheese Burger',       'Classic burger topped with rich melted cheddar cheese',       3500, 'Burger', 1, 38],
      ['Double Beef Burger',  'Double patty stacked to perfection with all the works',       4500, 'Burger', 1, 62],
      ['Fried Chips',         'Crispy golden fries seasoned with XBurger signature spice',   1500, 'Sides',  1, 89],
      ['Combo Meal',          'Burger + Fries + Drink — the full XBurger experience',        6000, 'Combo',  1,103],
    ].forEach(p => db.run(
      `INSERT INTO products (name,description,price,category,available,sales_count) VALUES (?,?,?,?,?,?)`, p));

    // Sample orders
    [
      ['XB-001','Tunde Kareem',   '08012345678','tunde@email.com',
       JSON.stringify([{name:'Double Beef Burger',qty:1,price:4500},{name:'Fried Chips',qty:1,price:1500}]),
       6000,'delivered','Paystack','paid','Lekki Phase 1, Lagos',''],
      ['XB-002','Amaka Folasade', '08023456789','',
       JSON.stringify([{name:'Combo Meal',qty:2,price:6000}]),
       12000,'delivered','Paystack','paid','Victoria Island, Lagos',''],
      ['XB-003','Emeka Badmus',   '08034567890','emeka@email.com',
       JSON.stringify([{name:'Cheese Burger',qty:1,price:3500}]),
       3500,'processing','Paystack','paid','Ikeja, Lagos','Extra sauce please'],
      ['XB-004','Sade Adekunle',  '07055512345','',
       JSON.stringify([{name:'Classic Burger',qty:2,price:3000},{name:'Fried Chips',qty:2,price:1500}]),
       9000,'pending','Paystack','pending','Surulere, Lagos',''],
      ['XB-005','Kunle Bello',    '09011122334','kunle@gmail.com',
       JSON.stringify([{name:'Combo Meal',qty:1,price:6000},{name:'Classic Burger',qty:1,price:3000}]),
       9000,'delivered','Paystack','paid','Yaba, Lagos',''],
    ].forEach(o => db.run(
      `INSERT INTO orders (order_number,customer_name,customer_phone,customer_email,items,total,status,payment_method,payment_status,delivery_address,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, o));

    // Sample ratings
    [
      ['Tunde Kareem',   5,'Best burger in Lagos! Fast delivery too.',         'Double Beef Burger',1],
      ['Amaka Folasade', 5,'Great value on the combo meal. Will order again!', 'Combo Meal',1],
      ['Emeka Badmus',   5,'The cheese is so melted and perfect!',             'Cheese Burger',1],
      ['Sade Adekunle',  4,'Crispy chips and tasty burger. Very affordable.',  'Classic Burger',1],
      ['Kunle Bello',    5,'XBurger is now my go-to for burgers in Lagos!',    'Combo Meal',1],
    ].forEach(r => db.run(
      `INSERT INTO ratings (customer_name,rating,review,product_name,approved) VALUES (?,?,?,?,?)`, r));

    // Activity log seed
    db.run(`INSERT INTO activity_log (action,details) VALUES (?,?)`,['System','Database initialized']);
  }

  /* ---- Query helpers ---- */
  function query(sql, params = []) {
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    } catch (err) {
      console.error('Query error:', sql, err);
      return [];
    }
  }

  function run(sql, params = [], logAction = '') {
    try {
      db.run(sql, params);
      if (logAction) db.run(
        `INSERT INTO activity_log (action, details) VALUES (?,?)`,
        [logAction, params.map(String).join(' | ')]);
      save();
      return true;
    } catch (err) {
      console.error('Run error:', sql, err);
      return false;
    }
  }

  /* ---- Auth ---- */
  function verifyAdmin(username, password) {
    const rows = query('SELECT * FROM admins WHERE username=? AND password=?', [username, password]);
    return rows[0] || null;
  }
  function changePassword(username, newPass) {
    return run('UPDATE admins SET password=? WHERE username=?', [newPass, username], 'Password changed');
  }

  /* ---- Orders ---- */
  function getOrders(filter = {}) {
    let sql = 'SELECT * FROM orders';
    const params = [], conds = [];
    if (filter.status)  { conds.push('status=?'); params.push(filter.status); }
    if (filter.payment) { conds.push('payment_status=?'); params.push(filter.payment); }
    if (filter.search)  {
      conds.push('(customer_name LIKE ? OR order_number LIKE ? OR customer_phone LIKE ?)');
      params.push(`%${filter.search}%`, `%${filter.search}%`, `%${filter.search}%`);
    }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    return query(sql, params);
  }

  function getOrderById(id) {
    return query('SELECT * FROM orders WHERE id=?', [id])[0] || null;
  }

  function generateOrderNumber() {
    const count = query('SELECT COUNT(*) as c FROM orders')[0]?.c || 0;
    return `XB-${String(count + 1).padStart(3, '0')}`;
  }

  function addOrder(data) {
    const num = generateOrderNumber();
    return run(
      `INSERT INTO orders (order_number,customer_name,customer_phone,customer_email,items,total,status,payment_method,payment_status,delivery_address,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [num, data.customer_name||'Walk-in', data.customer_phone||'', data.customer_email||'',
       data.items||'[]', data.total||0, data.status||'pending',
       data.payment_method||'Cash', data.payment_status||'pending',
       data.delivery_address||'Lagos', data.notes||''],
      'Order added'
    );
  }

  function updateOrder(id, data) {
    return run(
      `UPDATE orders SET customer_name=?,customer_phone=?,customer_email=?,items=?,total=?,
       status=?,payment_method=?,payment_status=?,delivery_address=?,notes=?,
       updated_at=datetime('now','localtime') WHERE id=?`,
      [data.customer_name, data.customer_phone, data.customer_email, data.items,
       data.total, data.status, data.payment_method, data.payment_status,
       data.delivery_address, data.notes, id],
      'Order updated'
    );
  }

  function updateOrderStatus(id, status) {
    return run(
      `UPDATE orders SET status=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [status, id], 'Status: ' + status
    );
  }

  function deleteOrder(id) {
    return run('DELETE FROM orders WHERE id=?', [id], 'Order deleted');
  }

  /* ---- Ratings ---- */
  function getRatings(filter = {}) {
    let sql = 'SELECT * FROM ratings';
    if (filter.approved !== undefined) sql += ` WHERE approved=${filter.approved ? 1 : 0}`;
    sql += ' ORDER BY created_at DESC';
    return query(sql);
  }

  function addRating(data) {
    return run(
      `INSERT INTO ratings (customer_name,rating,review,product_name,approved) VALUES (?,?,?,?,?)`,
      [data.customer_name, data.rating, data.review||'', data.product_name||'General', data.approved?1:0],
      'Rating added'
    );
  }

  function toggleRatingApproval(id, approved) {
    return run('UPDATE ratings SET approved=? WHERE id=?', [approved?1:0, id]);
  }

  function deleteRating(id) {
    return run('DELETE FROM ratings WHERE id=?', [id], 'Rating deleted');
  }

  /* ---- Products ---- */
  function getProducts() {
    return query('SELECT * FROM products ORDER BY sales_count DESC');
  }

  function updateProductAvailability(id, available) {
    return run('UPDATE products SET available=? WHERE id=?', [available?1:0, id]);
  }

  function updateProductPrice(id, price) {
    return run('UPDATE products SET price=? WHERE id=?', [price, id], 'Price updated');
  }

  function addProduct(data) {
    return run(
      `INSERT INTO products (name, description, price, category, available, sales_count, image) VALUES (?,?,?,?,?,?,?)`,
      [data.name, data.description||'', data.price||0, data.category||'Burger', 1, 0, data.image||''],
      'Product added: ' + data.name
    );
  }

  /* ---- Activity Log ---- */
  function getActivityLog() {
    return query('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50');
  }

  /* ---- Stats ---- */
  function getStats() {
    const totalOrders    = query('SELECT COUNT(*) c FROM orders')[0]?.c || 0;
    const paidRevenue    = query("SELECT COALESCE(SUM(total),0) s FROM orders WHERE payment_status='paid'")[0]?.s || 0;
    const pendingRevenue = query("SELECT COALESCE(SUM(total),0) s FROM orders WHERE payment_status='pending'")[0]?.s || 0;
    const avgRating      = query('SELECT ROUND(AVG(rating),1) a FROM ratings')[0]?.a || 0;
    const totalRatings   = query('SELECT COUNT(*) c FROM ratings')[0]?.c || 0;
    const pending        = query("SELECT COUNT(*) c FROM orders WHERE status='pending'")[0]?.c || 0;
    const processing     = query("SELECT COUNT(*) c FROM orders WHERE status='processing'")[0]?.c || 0;
    const delivered      = query("SELECT COUNT(*) c FROM orders WHERE status='delivered'")[0]?.c || 0;
    const cancelled      = query("SELECT COUNT(*) c FROM orders WHERE status='cancelled'")[0]?.c || 0;
    const topProduct     = query('SELECT name,sales_count FROM products ORDER BY sales_count DESC LIMIT 1')[0]
                            || {name:'N/A', sales_count:0};
    const recentOrders   = query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 6');
    const ratingDist     = [5,4,3,2,1].map(r => ({
      rating: r,
      count: query('SELECT COUNT(*) c FROM ratings WHERE rating=?', [r])[0]?.c || 0
    }));
    return {
      totalOrders, paidRevenue, pendingRevenue, avgRating, totalRatings,
      pending, processing, delivered, cancelled, topProduct, recentOrders, ratingDist
    };
  }

  /* ---- Import orders saved by main site ---- */
  function importPendingOrders() {
    try {
      const arr = JSON.parse(localStorage.getItem('xburger_pending_orders') || '[]');
      arr.forEach(o => addOrder(o));
      if (arr.length) { localStorage.removeItem('xburger_pending_orders'); return arr.length; }
    } catch (_) {}
    return 0;
  }

  return {
    init, save,
    verifyAdmin, changePassword,
    getOrders, getOrderById, addOrder, updateOrder, updateOrderStatus, deleteOrder,
    getRatings, addRating, toggleRatingApproval, deleteRating,
    getProducts, updateProductAvailability, updateProductPrice, addProduct,
    getStats, getActivityLog, importPendingOrders, generateOrderNumber
  };
})();

/* =============================================
   UI MODULE
   ============================================= */
const UI = (() => {
  let _currentSection = 'dashboard';
  let _currentAdmin   = null;
  let _editingOrderId = null;
  let _orderFilter    = { status:'', search:'', payment:'' };

  /* ---- Auth views ---- */
  function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-panel').style.display  = 'none';
  }

  function showPanel(admin) {
    _currentAdmin = admin;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display  = 'flex';
    document.getElementById('admin-name').textContent     = admin.full_name || admin.username;
    document.getElementById('admin-username').textContent = '@' + admin.username;
    updateTopDate();
    navigateTo('dashboard');
  }

  /* ---- Navigation ---- */
  function navigateTo(section) {
    _currentSection = section;
    document.querySelectorAll('.nav-item').forEach(el =>
      el.classList.toggle('active', el.dataset.section === section));
    document.querySelectorAll('.section-content').forEach(el => el.style.display = 'none');
    const el = document.getElementById('section-' + section);
    if (el) el.style.display = 'block';
    const titles = {
      dashboard:'📊 Dashboard', orders:'📦 Orders',
      ratings:'⭐ Ratings & Reviews', products:'🍔 Products',
      settings:'⚙️ Settings'
    };
    document.getElementById('section-title').textContent = titles[section] || section;
    document.getElementById('sidebar').classList.remove('open');
    renderSection(section);
  }

  function renderSection(s) {
    ({ dashboard:renderDashboard, orders:renderOrders,
       ratings:renderRatings, products:renderProducts,
       settings:renderSettings })[s]?.();
  }

  function updateTopDate() {
    const el = document.getElementById('top-date');
    if (el) el.textContent = new Date().toLocaleDateString('en-NG',
      { weekday:'short', day:'numeric', month:'short', year:'numeric' });
  }

  /* ---- DASHBOARD ---- */
  function renderDashboard() {
    const s = Database.getStats();

    setText('stat-total-orders', s.totalOrders);
    setText('stat-revenue',      formatPrice(s.paidRevenue));
    setText('stat-avg-rating',   Number(s.avgRating).toFixed(1));
    setText('stat-pending',      s.pending);
    setText('stat-processing',   s.processing);
    setText('stat-delivered',    s.delivered);
    setText('stat-cancelled',    s.cancelled);
    setText('stat-total-ratings',s.totalRatings);
    setText('top-product-name',  s.topProduct.name);
    setText('top-product-sales', s.topProduct.sales_count + ' orders');

    // Pending revenue strip
    const pendingEl = document.getElementById('stat-pending-revenue');
    if (pendingEl) pendingEl.textContent = 'Pending: ' + formatPrice(s.pendingRevenue);

    // Recent orders
    const tbody = document.getElementById('recent-orders-tbody');
    if (tbody) tbody.innerHTML = s.recentOrders.map(o => `
      <tr>
        <td><span class="order-num">${o.order_number}</span></td>
        <td>${esc(o.customer_name)}</td>
        <td class="price-cell">${formatPrice(o.total)}</td>
        <td><span class="badge badge-${o.status}">${cap(o.status)}</span></td>
        <td><span class="badge badge-pay-${o.payment_status}">${cap(o.payment_status)}</span></td>
        <td class="date-cell">${fmtDate(o.created_at)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="empty-row">No orders yet</td></tr>';

    // Rating distribution bar chart
    const chart = document.getElementById('rating-chart');
    if (chart) {
      const max = Math.max(...s.ratingDist.map(r => r.count), 1);
      chart.innerHTML = s.ratingDist.map(r => `
        <div class="rating-row">
          <span class="rating-label">${r.rating}★</span>
          <div class="rating-bar-bg">
            <div class="rating-bar" style="width:${(r.count/max*100).toFixed(1)}%"></div>
          </div>
          <span class="rating-count">${r.count}</span>
        </div>`).join('');
    }
  }

  /* ---- ORDERS ---- */
  function renderOrders() {
    const orders = Database.getOrders(_orderFilter);
    const tbody  = document.getElementById('orders-tbody');
    document.getElementById('order-search').value        = _orderFilter.search || '';
    document.getElementById('order-status-filter').value = _orderFilter.status || '';
    document.getElementById('order-pay-filter').value    = _orderFilter.payment || '';
    setText('orders-count', orders.length + ' order' + (orders.length !== 1 ? 's' : ''));

    if (!tbody) return;
    tbody.innerHTML = orders.map(o => {
      let items = [];
      try { items = JSON.parse(o.items); } catch (_) {}
      const summary = items.map(i => `${i.name} ×${i.qty||i.quantity||1}`).join(', ');
      const shortSummary = summary.length > 30 ? summary.slice(0,30)+'…' : summary;
      return `
        <tr>
          <td><span class="order-num">${o.order_number}</span></td>
          <td>
            <div class="customer-name">${esc(o.customer_name)}</div>
            <div class="customer-sub">${esc(o.customer_phone)}</div>
            <div style="font-size:0.75rem; color:#aaa; margin-top:4px;">📍 ${esc(o.delivery_address || 'Walk-in / None')}</div>
          </td>
          <td class="items-cell" title="${esc(summary)}">${esc(shortSummary)}</td>
          <td class="price-cell">${formatPrice(o.total)}</td>
          <td>
            <select class="status-select status-${o.status}"
              onchange="App.updateOrderStatus(${o.id}, this.value)"
              aria-label="Order status">
              ${['pending','processing','ready','delivered','cancelled'].map(s =>
                `<option value="${s}" ${o.status===s?'selected':''}>${cap(s)}</option>`).join('')}
            </select>
          </td>
          <td><span class="badge badge-pay-${o.payment_status}">${cap(o.payment_status)}</span></td>
          <td class="date-cell">${fmtDate(o.created_at)}</td>
          <td>
            <div class="action-btns">
              <button class="action-btn view-btn" onclick="App.viewOrder(${o.id})" title="View">👁️</button>
              <button class="action-btn edit-btn" onclick="App.editOrder(${o.id})" title="Edit">✏️</button>
              <button class="action-btn delete-btn" onclick="App.deleteOrder(${o.id})" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" class="empty-row">No orders found</td></tr>';
  }

  /* ---- RATINGS ---- */
  function renderRatings() {
    const ratings = Database.getRatings();
    const avg = ratings.length
      ? (ratings.reduce((s,r)=>s+r.rating,0)/ratings.length).toFixed(1) : '0.0';
    setText('ratings-avg-big',   avg);
    setText('ratings-total-big', ratings.length + ' review' + (ratings.length!==1?'s':''));
    const starsEl = document.getElementById('ratings-stars-big');
    if (starsEl) starsEl.textContent = '★'.repeat(Math.round(avg)) + '☆'.repeat(5-Math.round(avg));

    const grid = document.getElementById('ratings-grid');
    if (!grid) return;
    grid.innerHTML = ratings.map(r => `
      <div class="rating-card ${r.approved?'':'unapproved'}">
        <div class="rating-card-header">
          <div>
            <div class="rating-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
            <div class="rating-product">${esc(r.product_name)}</div>
          </div>
          <div class="rating-card-actions">
            <button class="approval-btn" onclick="App.toggleRating(${r.id},${r.approved?0:1})"
              title="${r.approved?'Hide':'Approve'}">${r.approved?'✅':'⏳'}</button>
            <button class="action-btn delete-btn" onclick="App.deleteRating(${r.id})" title="Delete">🗑️</button>
          </div>
        </div>
        <p class="rating-review">"${esc(r.review||'No comment')}"</p>
        <div class="rating-footer">
          <span class="rating-author">— ${esc(r.customer_name)}</span>
          <span class="rating-date">${fmtDate(r.created_at)}</span>
        </div>
      </div>`).join('') || '<div class="empty-state">⭐ No ratings yet.</div>';
  }

  /* ---- PRODUCTS ---- */
  function renderProducts() {
    const products = Database.getProducts();
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = products.map(p => `
      <div class="product-admin-card">
        <div class="product-admin-header">
          <div style="display:flex; gap:10px; align-items:center;">
            ${p.image ? `<img src="${esc(p.image)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"/>` : `<div style="width:40px;height:40px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">🍔</div>`}
            <div>
              <h4 class="product-admin-name">${esc(p.name)}</h4>
              <span class="product-category">${esc(p.category)}</span>
            </div>
          </div>
          <div class="product-admin-price">${formatPrice(p.price)}</div>
        </div>
        <p class="product-admin-desc">${esc(p.description)}</p>
        <div class="product-admin-stats">
          <span>📦 ${p.sales_count} orders</span>
          <div class="product-toggle">
            <label class="toggle-switch">
              <input type="checkbox" ${p.available?'checked':''}
                onchange="App.toggleProduct(${p.id},this.checked)"/>
              <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">${p.available?'Available':'Unavailable'}</span>
          </div>
        </div>
        <div class="product-price-edit">
          <input class="price-input" id="price-${p.id}" type="number"
            value="${p.price}" min="100" step="100" aria-label="Update price"/>
          <button class="save-price-btn" onclick="App.updatePrice(${p.id})">💾 Update</button>
        </div>
      </div>`).join('');
  }

  /* ---- SETTINGS ---- */
  function renderSettings() {
    if (_currentAdmin) setText('settings-username', _currentAdmin.username);
    const log = Database.getActivityLog();
    const logEl = document.getElementById('activity-log-list');
    if (logEl) {
      logEl.innerHTML = log.map(l => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem;">
          <span style="color:var(--text-sub)">${esc(l.action)}</span>
          <span style="color:var(--text-muted)">${fmtDate(l.created_at)}</span>
        </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.8rem;">No activity yet.</p>';
    }
  }

  /* ---- ORDER MODAL ---- */
  function openOrderModal(prefill = null) {
    _editingOrderId = prefill?.id || null;
    setText('order-modal-title', _editingOrderId ? '✏️ Edit Order' : '➕ Add New Order');
    const form = document.getElementById('order-form');
    if (prefill) {
      form.customer_name.value    = prefill.customer_name || '';
      form.customer_phone.value   = prefill.customer_phone || '';
      form.customer_email.value   = prefill.customer_email || '';
      form.delivery_address.value = prefill.delivery_address || '';
      form.total.value            = prefill.total || '';
      form.status.value           = prefill.status || 'pending';
      form.payment_method.value   = prefill.payment_method || 'Paystack';
      form.payment_status.value   = prefill.payment_status || 'pending';
      form.notes.value            = prefill.notes || '';
      try {
        const parsed = JSON.parse(prefill.items || '[]');
        form.items_text.value = parsed.map(i =>
          `${i.name} x${i.qty||i.quantity||1} @ ${i.price}`).join('\n');
      } catch (_) { form.items_text.value = ''; }
    } else {
      form.reset();
    }
    openModal('order-modal');
  }

  function closeOrderModal() { closeModal('order-modal'); _editingOrderId = null; }

  /* ---- RATING MODAL ---- */
  function openRatingModal() {
    document.getElementById('rating-form').reset();
    // populate product select
    const sel = document.getElementById('rating-product-select');
    if (sel) {
      const prods = Database.getProducts();
      sel.innerHTML = '<option value="General">General</option>' +
        prods.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
    }
    openModal('rating-modal');
  }
  function closeRatingModal() { closeModal('rating-modal'); }

  /* ---- PRODUCT MODAL ---- */
  function openProductModal() {
    const f = document.getElementById('product-form');
    if(f) f.reset();
    openModal('product-modal');
  }
  function closeProductModal() { closeModal('product-modal'); }

  /* ---- VIEW ORDER MODAL ---- */
  function openViewOrderModal(order) {
    let items = [];
    try { items = JSON.parse(order.items); } catch (_) {}
    const rows = items.map(i => `
      <tr>
        <td>${esc(i.name)}</td>
        <td style="text-align:center">${i.qty||i.quantity||1}</td>
        <td>${formatPrice(i.price)}</td>
        <td style="color:#FBBF24;font-weight:700">${formatPrice(i.price*(i.qty||i.quantity||1))}</td>
      </tr>`).join('');

    document.getElementById('view-order-content').innerHTML = `
      <div class="view-order-grid">
        <div class="view-detail"><label>Order #</label><span>${esc(order.order_number)}</span></div>
        <div class="view-detail"><label>Date</label><span>${fmtDate(order.created_at)}</span></div>
        <div class="view-detail"><label>Customer</label><span>${esc(order.customer_name)}</span></div>
        <div class="view-detail"><label>Phone</label><span>${esc(order.customer_phone||'—')}</span></div>
        <div class="view-detail"><label>Email</label><span>${esc(order.customer_email||'—')}</span></div>
        <div class="view-detail"><label>Address</label><span>${esc(order.delivery_address||'—')}</span></div>
        <div class="view-detail"><label>Order Status</label>
          <span class="badge badge-${order.status}">${cap(order.status)}</span></div>
        <div class="view-detail"><label>Payment</label>
          <span class="badge badge-pay-${order.payment_status}">${cap(order.payment_status)}</span></div>
        ${order.notes ? `<div class="view-detail full-width"><label>Notes</label><span>${esc(order.notes)}</span></div>` : ''}
      </div>
      <h4 style="color:var(--text-muted);font-size:0.78rem;text-transform:uppercase;letter-spacing:1px;margin:16px 0 10px">Order Items</h4>
      <div class="table-wrapper">
        <table class="view-items-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="3" style="text-align:right;font-weight:700;padding:12px 10px">Grand Total</td>
            <td style="color:#FBBF24;font-weight:800;padding:12px 10px">${formatPrice(order.total)}</td>
          </tr></tfoot>
        </table>
      </div>`;
    openModal('view-order-modal');
  }
  function closeViewOrderModal() { closeModal('view-order-modal'); }

  /* ---- Confirm dialog ---- */
  function showConfirm(msg, onOk) {
    document.getElementById('confirm-message').textContent = msg;
    document.getElementById('confirm-ok-btn').onclick = () => { closeModal('confirm-modal'); onOk(); };
    document.getElementById('confirm-cancel-btn').onclick = () => closeModal('confirm-modal');
    openModal('confirm-modal');
  }

  /* ---- Toast ---- */
  function showToast(msg, type='success') {
    const t = document.getElementById('admin-toast');
    t.textContent = msg;
    t.className = 'admin-toast show toast-' + type;
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  /* ---- Modal open/close helpers ---- */
  function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
  function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

  /* ---- Filter helpers ---- */
  function setOrderFilter(key, val) { _orderFilter[key] = val; renderOrders(); }
  function clearOrderFilters() {
    _orderFilter = { status:'', search:'', payment:'' };
    renderOrders();
  }

  /* ---- Getters ---- */
  function getCurrentAdmin()  { return _currentAdmin; }
  function getEditingOrderId(){ return _editingOrderId; }

  return {
    showLogin, showPanel, navigateTo,
    renderDashboard, renderOrders, renderRatings, renderProducts, renderSettings,
    openOrderModal, closeOrderModal, openRatingModal, closeRatingModal,
    openViewOrderModal, closeViewOrderModal, openProductModal, closeProductModal,
    showConfirm, showToast, setOrderFilter, clearOrderFilters,
    getCurrentAdmin, getEditingOrderId, openModal, closeModal
  };
})();

/* =============================================
   APP — Main Controller
   ============================================= */
const App = {

  async init() {
    document.getElementById('loading-screen').style.display = 'flex';
    const ok = await Database.init();
    if (!ok) {
      document.getElementById('loading-screen').innerHTML =
        '<div style="text-align:center;color:#ef4444"><p style="font-size:3rem">⚠️</p><h2>Database Error</h2><p>Please refresh the page.</p></div>';
      return;
    }
    const imported = Database.importPendingOrders();
    if (imported) console.log('Imported', imported, 'pending orders from main site.');
    document.getElementById('loading-screen').style.display = 'none';
    UI.showLogin();
  },

  /* ---- Auth ---- */
  login() {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');
    if (!u || !p) { err.textContent = 'Please enter username and password.'; err.style.display='block'; return; }
    const admin = Database.verifyAdmin(u, p);
    if (admin) {
      err.style.display = 'none';
      UI.showPanel(admin);
    } else {
      err.textContent = '❌ Invalid username or password.';
      err.style.display = 'block';
      document.getElementById('login-password').value = '';
      const card = document.getElementById('login-card');
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 500);
    }
  },

  logout() {
    UI.showLogin();
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
  },

  /* ---- Orders ---- */
  updateOrderStatus(id, status) {
    Database.updateOrderStatus(id, status);
    // update the select's class without full re-render
    const sel = document.querySelector(`tr:has(select[onchange*="${id},"]) select`);
    if (sel) { sel.className = `status-select status-${status}`; }
    UI.showToast(`Order status → ${status}`);
  },

  viewOrder(id) {
    const o = Database.getOrderById(id);
    if (o) UI.openViewOrderModal(o);
  },

  editOrder(id) {
    const o = Database.getOrderById(id);
    if (o) UI.openOrderModal(o);
  },

  deleteOrder(id) {
    UI.showConfirm('Delete this order permanently?', () => {
      Database.deleteOrder(id);
      UI.renderOrders();
      UI.renderDashboard();
      UI.showToast('Order deleted', 'warning');
    });
  },

  saveOrder() {
    const form = document.getElementById('order-form');
    const editId = UI.getEditingOrderId();

    // Parse items from plain text
    const rawItems = form.items_text.value.trim();
    const items = rawItems ? rawItems.split('\n').filter(Boolean).map(line => {
      const m = line.match(/^(.+?)\s+x(\d+)\s*@?\s*[\u20a6]?\s*(\d+)/i);
      if (m) return { name: m[1].trim(), qty: +m[2], price: +m[3] };
      return { name: line.trim(), qty: 1, price: 0 };
    }) : [];

    const data = {
      customer_name:    form.customer_name.value.trim()    || 'Walk-in Customer',
      customer_phone:   form.customer_phone.value.trim(),
      customer_email:   form.customer_email.value.trim(),
      items:            JSON.stringify(items),
      total:            parseFloat(form.total.value)        || 0,
      status:           form.status.value,
      payment_method:   form.payment_method.value,
      payment_status:   form.payment_status.value,
      delivery_address: form.delivery_address.value.trim(),
      notes:            form.notes.value.trim(),
    };

    if (!data.total) { UI.showToast('Total amount is required', 'error'); return; }

    editId ? Database.updateOrder(editId, data) : Database.addOrder(data);
    UI.closeOrderModal();
    UI.renderOrders();
    UI.renderDashboard();
    UI.showToast(editId ? '✅ Order updated' : '✅ Order added');
  },

  /* ---- Ratings ---- */
  toggleRating(id, approved) {
    Database.toggleRatingApproval(id, approved);
    UI.renderRatings();
    UI.showToast(approved ? '✅ Review approved' : 'Review hidden');
  },

  deleteRating(id) {
    UI.showConfirm('Delete this rating permanently?', () => {
      Database.deleteRating(id);
      UI.renderRatings();
      UI.renderDashboard();
      UI.showToast('Rating deleted', 'warning');
    });
  },

  saveRating() {
    const form = document.getElementById('rating-form');
    const data = {
      customer_name: form.customer_name.value.trim(),
      rating:        parseInt(form.rating.value),
      review:        form.review.value.trim(),
      product_name:  form.product_name.value,
      approved:      form.approved.checked,
    };
    if (!data.customer_name) { UI.showToast('Customer name required', 'error'); return; }
    if (!data.rating || data.rating < 1 || data.rating > 5) { UI.showToast('Rating 1–5 required', 'error'); return; }
    Database.addRating(data);
    UI.closeRatingModal();
    UI.renderRatings();
    UI.renderDashboard();
    UI.showToast('✅ Rating added');
  },

  /* ---- Products ---- */
  saveProduct() {
    const form = document.getElementById('product-form');
    const data = {
      name: form.name.value.trim(),
      price: parseFloat(form.price.value) || 0,
      category: form.category.value.trim(),
      description: form.description.value.trim(),
      image: form.image.value.trim()
    };
    if (!data.name) { UI.showToast('Product name required', 'error'); return; }
    if (!data.price) { UI.showToast('Valid price required', 'error'); return; }
    Database.addProduct(data);
    UI.closeProductModal();
    UI.renderProducts();
    // After adding, we must trigger save to sync xburger_sync_products to frontend
    Database.save();
    UI.showToast('✅ Product added and synced!');
  },

  toggleProduct(id, available) {
    Database.updateProductAvailability(id, available);
    UI.renderProducts();
    UI.showToast(`Product ${available ? 'enabled ✅' : 'disabled'}`);
  },

  updatePrice(id) {
    const val = parseFloat(document.getElementById('price-' + id)?.value);
    if (!val || val < 1) { UI.showToast('Enter a valid price', 'error'); return; }
    Database.updateProductPrice(id, val);
    UI.renderProducts();
    UI.showToast('✅ Price updated');
  },

  /* ---- Settings ---- */
  changePassword() {
    const cur  = document.getElementById('current-password').value;
    const nw   = document.getElementById('new-password').value;
    const conf = document.getElementById('confirm-password').value;
    const admin = UI.getCurrentAdmin();
    if (!cur||!nw||!conf) { UI.showToast('Fill all fields', 'error'); return; }
    if (!Database.verifyAdmin(admin.username, cur)) { UI.showToast('Current password wrong', 'error'); return; }
    if (nw !== conf) { UI.showToast('Passwords do not match', 'error'); return; }
    if (nw.length < 6) { UI.showToast('Min 6 characters', 'error'); return; }
    Database.changePassword(admin.username, nw);
    ['current-password','new-password','confirm-password'].forEach(id =>
      (document.getElementById(id).value = ''));
    UI.showToast('✅ Password changed successfully');
  },

  resetDatabase() {
    UI.showConfirm(
      '⚠️ This will PERMANENTLY delete all orders, ratings and data. Are you sure?',
      () => {
        localStorage.removeItem('xburger_admin_db');
        UI.showToast('Database reset. Reloading…', 'warning');
        setTimeout(() => location.reload(), 1500);
      }
    );
  },

  exportOrders() {
    const orders = Database.getOrders();
    const csv = [
      ['Order#','Customer','Phone','Email','Total','Status','Payment','Date'].join(','),
      ...orders.map(o => [
        o.order_number, `"${o.customer_name}"`, o.customer_phone,
        o.customer_email, o.total, o.status, o.payment_status, o.created_at
      ].join(','))
    ].join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'xburger_orders.csv';
    a.click();
    UI.showToast('✅ Orders exported as CSV');
  },
};

/* =============================================
   UTILITIES
   ============================================= */
function formatPrice(n) { return '₦' + Number(n||0).toLocaleString('en-NG'); }
function fmtDate(s) {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-NG',
      {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  } catch(_) { return s; }
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
function esc(s) {
  const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML;
}
function setText(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

/* =============================================
   BOOTSTRAP
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Login — Enter key
  ['login-username','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (id === 'login-username') document.getElementById('login-password')?.focus();
        else App.login();
      }
    });
  });

  // Mobile sidebar toggle
  document.getElementById('mobile-menu-btn')?.addEventListener('click', () =>
    document.getElementById('sidebar').classList.toggle('open'));

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // Keyboard — Esc closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  });
});
