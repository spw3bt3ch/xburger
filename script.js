/* =============================================
   XBurger - Cart & App JavaScript
   Version: 1.0.0
   Author: XBurger Dev Team
   ============================================= */

'use strict';

/* =============================================
   PRODUCT CATALOG
   ============================================= */
const PRODUCTS = [
  {
    id: 1,
    name: 'Classic Burger',
    description: 'Juicy beef patty with fresh lettuce, tomato & our secret sauce',
    price: 3000,
    image: 'images/classic_burger.png',
    emoji: '🍔',
    bestSeller: false,
  },
  {
    id: 2,
    name: 'Cheese Burger',
    description: 'All the classics topped with rich melted cheddar cheese',
    price: 3500,
    image: 'images/cheese_burger.png',
    emoji: '🧀',
    bestSeller: false,
  },
  {
    id: 3,
    name: 'Double Beef Burger',
    description: 'Double the beef, double the flavour — stacked to perfection',
    price: 4500,
    image: 'images/double_beef_burger.png',
    emoji: '🥩',
    bestSeller: false,
  },
  {
    id: 4,
    name: 'Fried Chips',
    description: 'Crispy golden fries seasoned with our signature XBurger spice',
    price: 1500,
    image: 'images/fried_chips.png',
    emoji: '🍟',
    bestSeller: false,
  },
  {
    id: 5,
    name: 'Combo Meal',
    description: 'Best value! Burger + Fries + Drink — the full XBurger experience',
    price: 6000,
    image: 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Fast_food_meal.jpg',  // Includes burger, fries, and a drink
    emoji: '',
    bestSeller: true,
  },
];

// Sync dynamically updated prices or new products from Admin database
try {
  const syncedProds = JSON.parse(localStorage.getItem('xburger_sync_products'));
  if (syncedProds && Array.isArray(syncedProds) && syncedProds.length > 0) {
    // Overwrite PRODUCTS with database rows
    PRODUCTS = syncedProds.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      image: p.image && p.image.trim() !== '' ? p.image 
             : p.name.includes('Combo') ? 'https://upload.wikimedia.org/wikipedia/commons/c/cd/Fast_food_meal.jpg'
             : p.name.includes('Double') ? 'images/double_beef_burger.png'
             : p.name.includes('Cheese') ? 'images/cheese_burger.png'
             : p.name.includes('Classic') ? 'images/classic_burger.png'
             : p.name.includes('Chips') ? 'images/fried_chips.png'
             : 'images/classic_burger.png',
      emoji: '',
      bestSeller: p.sales_count > 40
    }));
  } else {
    const syncedPrices = JSON.parse(localStorage.getItem('xburger_sync_prices'));
    if (syncedPrices) {
      PRODUCTS.forEach(p => { if (syncedPrices[p.id]) p.price = syncedPrices[p.id]; });
    }
  }
} catch (e) {}

/* =============================================
   STATE
   ============================================= */

/**
 * Cart items array — each item: { id, name, price, image, emoji, quantity }
 * Persisted in localStorage under key 'xburger_cart'
 */
let cart = [];

/** Per-card quantity selectors state */
const cardQty = {}; // { productId: quantity }

/* =============================================
   CART PERSISTENCE (localStorage)
   ============================================= */

/** Load cart from localStorage on page load */
function loadCart() {
  try {
    const saved = localStorage.getItem('xburger_cart');
    if (saved) {
      cart = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Failed to load cart from localStorage:', e);
    cart = [];
  }
}

/** Persist cart to localStorage */
function saveCart() {
  try {
    localStorage.setItem('xburger_cart', JSON.stringify(cart));
  } catch (e) {
    console.warn('Failed to save cart to localStorage:', e);
  }
}

/* =============================================
   CART FUNCTIONS
   ============================================= */

/**
 * Add a product to the cart.
 * If it already exists, increment quantity by the card's qty selector value.
 * @param {Object} product - Product object from PRODUCTS array
 */
function addToCart(product) {
  const qty = cardQty[product.id] || 1;
  const existingIndex = cart.findIndex(item => item.id === product.id);

  if (existingIndex !== -1) {
    // Product already in cart — increase quantity
    cart[existingIndex].quantity += qty;
  } else {
    // New item
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      emoji: product.emoji,
      quantity: qty,
    });
  }

  saveCart();
  renderCart();
  updateCartBadge();
  animateCartButton();
  showToast(`✅ ${product.name} added to cart!`);
}

/**
 * Remove an item from the cart by its array index.
 * @param {number} index - Index in cart array
 */
function removeFromCart(index) {
  const name = cart[index]?.name;
  cart.splice(index, 1);
  saveCart();
  renderCart();
  updateCartBadge();
  showToast(`🗑️ ${name} removed`);
}

/**
 * Update the quantity of a cart item.
 * If quantity drops to 0, remove the item.
 * @param {number} index - Index in cart array
 * @param {number} change - +1 or -1
 */
function updateQuantity(index, change) {
  if (!cart[index]) return;
  cart[index].quantity += change;

  if (cart[index].quantity <= 0) {
    removeFromCart(index);
    return;
  }

  saveCart();
  renderCart();
  updateCartBadge();
}

/**
 * Calculate the grand total of the cart.
 * @returns {number} Total price in Naira
 */
function calculateTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Calculate total number of items (sum of quantities).
 * @returns {number}
 */
function calculateItemCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

/* =============================================
   RENDER FUNCTIONS
   ============================================= */

/**
 * Render the cart drawer UI — items list, totals, empty state.
 */
function renderCart() {
  const cartItemsList = document.getElementById('cart-items-list');
  const cartFooter = document.getElementById('cart-footer');
  const cartEmptyMsg = document.getElementById('cart-empty');
  const grandTotalEl = document.getElementById('grand-total');
  const itemCountEl = document.getElementById('item-count');

  if (!cartItemsList) return;

  // Empty state
  if (cart.length === 0) {
    cartItemsList.innerHTML = '';
    cartEmptyMsg && (cartEmptyMsg.style.display = 'flex');
    cartFooter && (cartFooter.style.display = 'none');
    return;
  }

  cartEmptyMsg && (cartEmptyMsg.style.display = 'none');
  cartFooter && (cartFooter.style.display = 'block');

  // Render items
  cartItemsList.innerHTML = cart.map((item, index) => {
    const imageHTML = item.image
      ? `<img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : '';
    const emojiHTML = `<div class="cart-item-emoji" style="${item.image ? 'display:none' : ''}">${item.emoji}</div>`;
    const itemTotal = formatPrice(item.price * item.quantity);

    return `
      <div class="cart-item" id="cart-item-${index}">
        ${imageHTML}
        ${emojiHTML}
        <div style="flex:1; min-width:0;">
          <p style="font-weight:600; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</p>
          <p style="color:rgba(255,255,255,0.45); font-size:0.75rem; margin:2px 0;">${formatPrice(item.price)} each</p>
          <!-- Qty controls -->
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <button class="qty-btn" style="background:rgba(255,255,255,0.08); color:#fff;"
              onclick="updateQuantity(${index}, -1)" aria-label="Decrease quantity">−</button>
            <span class="qty-display" style="font-size:0.9rem;">${item.quantity}</span>
            <button class="qty-btn" style="background:rgba(220,38,38,0.2); color:#f87171;"
              onclick="updateQuantity(${index}, 1)" aria-label="Increase quantity">+</button>
            <span style="margin-left:auto; font-weight:700; color:#FBBF24; font-size:0.85rem;">${itemTotal}</span>
          </div>
        </div>
        <!-- Remove button -->
        <button class="remove-btn" onclick="removeFromCart(${index})" title="Remove item" aria-label="Remove ${item.name}">✕</button>
      </div>
    `;
  }).join('');

  // Update grand total
  const total = calculateTotal();
  if (grandTotalEl) grandTotalEl.textContent = formatPrice(total);
  if (itemCountEl) itemCountEl.textContent = `${calculateItemCount()} item${calculateItemCount() !== 1 ? 's' : ''}`;

  // Show promo highlight if eligible
  const promoEl = document.getElementById('cart-promo');
  if (promoEl) {
    promoEl.style.display = total >= 10000 ? 'flex' : 'none';
  }
}

/**
 * Update the floating cart badge count.
 */
function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  const count = calculateItemCount();

  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* =============================================
   CARD QUANTITY SELECTOR
   ============================================= */

/**
 * Change the qty on a product card selector (not the cart).
 * @param {number} productId - Product ID
 * @param {number} change - +1 or -1
 */
function changeCardQty(productId, change) {
  const current = cardQty[productId] || 1;
  const next = Math.max(1, current + change);
  cardQty[productId] = next;

  const el = document.getElementById(`card-qty-${productId}`);
  if (el) el.textContent = next;
}

/* =============================================
   CART DRAWER TOGGLE
   ============================================= */

function openCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  drawer?.classList.add('open');
  overlay?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  drawer?.classList.remove('open');
  overlay?.classList.remove('open');
  document.body.style.overflow = '';
}

/* =============================================
   CHECKOUT FLOW
   ============================================= */

/**
 * Show the checkout confirmation modal with order summary,
 * then redirect to Paystack on confirmation.
 */
function proceedToCheckout() {
  if (cart.length === 0) {
    showToast('⚠️ Your cart is empty!');
    return;
  }

  // Build summary HTML
  const summaryEl = document.getElementById('modal-summary');
  if (summaryEl) {
    const itemsHTML = cart.map(item => `
      <div class="modal-summary-item">
        <span>${item.name} × ${item.quantity}</span>
        <span style="color:#FBBF24; font-weight:600;">${formatPrice(item.price * item.quantity)}</span>
      </div>
    `).join('');

    summaryEl.innerHTML = `
      ${itemsHTML}
      <div style="display:flex; justify-content:space-between; padding: 14px 0 4px; font-weight:700; font-size:1rem; border-top: 1px solid rgba(220,38,38,0.3); margin-top:8px;">
        <span>Grand Total</span>
        <span style="color:#DC2626;">${formatPrice(calculateTotal())}</span>
      </div>
    `;
  }

  // Open modal
  const modal = document.getElementById('checkout-modal');
  modal?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  modal?.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Save order to localStorage so the Admin Panel can import it,
 * then redirect to Paystack payment page.
 */
function confirmAndPay() {
  const name = document.getElementById('cust-name').value.trim();
  const email = document.getElementById('cust-email').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  if (!name || !email || !phone || !address) {
    showToast('Please fill all delivery details before paying.', 'error');
    return;
  }

  const btn = document.getElementById('pay-now-btn');
  if (btn) {
    btn.innerHTML = '<span>Initializing Secure Payment... ⏳</span>';
    btn.disabled = true;
  }

  const total = calculateTotal();
  const totalKobo = total * 100;

  var handler = PaystackPop.setup({
    key: 'pk_live_5eb198656a56a2bc19f52b527c84d557fa3b7b33', // Live Public key provided by user
    email: email,
    amount: totalKobo,
    currency: 'NGN',
    callback: function(response){
      // Payment successful
      const orderData = {
        customer_name:    name,
        customer_phone:   phone,
        customer_email:   email,
        items:            JSON.stringify(cart.map(i => ({ name: i.name, qty: i.quantity, price: i.price }))),
        total:            total,
        status:           'pending',
        payment_method:   'Paystack',
        payment_status:   'paid',
        delivery_address: address,
        notes:            `Ref: ${response.reference}`,
      };

      try {
        const existing = JSON.parse(localStorage.getItem('xburger_pending_orders') || '[]');
        existing.push(orderData);
        localStorage.setItem('xburger_pending_orders', JSON.stringify(existing));
      } catch (e) {}

      // Clear the cart
      cart = [];
      saveCart();
      updateCartBadge();
      renderCart();
      closeCheckoutModal();
      
      showToast('Payment successful! Your order has been placed. 🎉', 'success');
      
      if (btn) {
        btn.innerHTML = '<span>Pay Now via Paystack 💳</span>';
        btn.disabled = false;
      }
    },
    onClose: function(){
      showToast('Payment window closed. Order wasn\'t completed.', 'error');
      if (btn) {
        btn.innerHTML = '<span>Pay Now via Paystack 💳</span>';
        btn.disabled = false;
      }
    }
  });

  handler.openIframe();
}

/* =============================================
   DARK MODE TOGGLE
   ============================================= */
let isDark = true;

function toggleDarkMode() {
  isDark = !isDark;
  document.body.classList.toggle('light-mode', !isDark);
  const icon = document.getElementById('dark-icon');
  const label = document.getElementById('dark-label');
  if (icon) icon.textContent = isDark ? '🌙' : '☀️';
  if (label) label.textContent = isDark ? 'Dark' : 'Light';
  localStorage.setItem('xburger_theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
  const saved = localStorage.getItem('xburger_theme');
  if (saved === 'light') {
    isDark = false;
    document.body.classList.add('light-mode');
    const icon = document.getElementById('dark-icon');
    const label = document.getElementById('dark-label');
    if (icon) icon.textContent = '☀️';
    if (label) label.textContent = 'Light';
  }
}

/* =============================================
   ANIMATIONS & UI HELPERS
   ============================================= */

/** Animate the floating cart button (bounce effect) */
function animateCartButton() {
  const btn = document.getElementById('cart-btn-float');
  if (!btn) return;
  btn.classList.add('bounce');
  setTimeout(() => btn.classList.remove('bounce'), 400);
}

/**
 * Show a toast notification.
 * @param {string} message - Message to show
 * @param {number} duration - ms to show (default: 2500)
 */
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/* =============================================
   SCROLL ANIMATIONS (Intersection Observer)
   ============================================= */
function initScrollAnimations() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // animate once
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  );

  document.querySelectorAll('.reveal, .reveal-left, .reveal-scale').forEach(el => {
    observer.observe(el);
  });
}

/* =============================================
   NAVBAR SCROLL EFFECT
   ============================================= */
function initNavbarScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
}

/* =============================================
   MENU RENDERING (Dynamic from PRODUCTS array)
   ============================================= */
function renderMenu() {
  const menuGrid = document.getElementById('menu-grid');
  if (!menuGrid) return;

  menuGrid.innerHTML = PRODUCTS.map(product => {
    // Initialize card quantity
    cardQty[product.id] = 1;

    const imageHTML = product.image
      ? `<img src="${product.image}" alt="${product.name}" loading="lazy"
             onerror="this.style.display='none'; this.parentElement.querySelector('.emoji-fallback').style.display='flex';">`
      : '';

    const emojiFallbackStyle = product.image ? 'display:none;' : '';

    return `
      <div class="product-card reveal delay-${((product.id - 1) % 3) * 100 + 100}">
        <!-- Product Image -->
        <div class="product-image-wrapper">
          ${imageHTML}
          <div class="emoji-fallback combo-bg" style="${emojiFallbackStyle} height:100%; width:100%; position:absolute; top:0; left:0; font-size:4rem; display:${product.image ? 'none' : 'flex'}; align-items:center; justify-content:center;">
            ${product.emoji}
          </div>
          ${product.bestSeller ? `
            <div class="best-seller-badge">
              ⭐ Best Seller
            </div>
          ` : ''}
        </div>

        <!-- Product Info -->
        <div style="padding: 18px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
            <h3 style="font-size:1rem; font-weight:700; line-height:1.3;">${product.name}</h3>
            <span style="color:#FBBF24; font-weight:800; font-size:1rem; white-space:nowrap;">${formatPrice(product.price)}</span>
          </div>
          <p style="color:rgba(255,255,255,0.5); font-size:0.8rem; line-height:1.5; margin-bottom:16px;">${product.description}</p>

          <!-- Quantity Selector -->
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:14px;">
            <span style="font-size:0.8rem; color:rgba(255,255,255,0.4); font-weight:500;">Qty</span>
            <button class="qty-btn" style="background:rgba(255,255,255,0.08); color:#fff;"
              onclick="changeCardQty(${product.id}, -1)" aria-label="Decrease">−</button>
            <span class="qty-display" id="card-qty-${product.id}">1</span>
            <button class="qty-btn" style="background:rgba(220,38,38,0.15); color:#f87171;"
              onclick="changeCardQty(${product.id}, 1)" aria-label="Increase">+</button>
          </div>

          <!-- Add to Cart Button -->
          <button class="add-to-cart-btn" id="add-btn-${product.id}"
            onclick="handleAddToCart(${product.id})">
            <span>🛒 Add to Cart</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Re-attach scroll animations for rendered cards
  initScrollAnimations();
}

/**
 * Handle "Add to Cart" button click with animation feedback.
 * @param {number} productId
 */
function handleAddToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  addToCart(product);

  // Brief visual feedback on button
  const btn = document.getElementById(`add-btn-${productId}`);
  if (btn) {
    btn.classList.add('added');
    btn.querySelector('span').textContent = '✅ Added!';
    btn.disabled = true;
    setTimeout(() => {
      btn.classList.remove('added');
      btn.querySelector('span').textContent = '🛒 Add to Cart';
      btn.disabled = false;
    }, 1500);
  }
}

/* =============================================
   UTILITY FUNCTIONS
   ============================================= */

/**
 * Format a number as Nigerian Naira currency.
 * @param {number} amount
 * @returns {string} e.g. "₦3,000"
 */
function formatPrice(amount) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

/**
 * Smooth scroll to a section by ID.
 * @param {string} sectionId
 */
function scrollTo(sectionId) {
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* =============================================
   INITIALISE ON DOM READY
   ============================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Load persisted data
  loadCart();
  loadTheme();

  // Render UI
  renderMenu();
  renderCart();
  updateCartBadge();

  // Init behaviours
  initScrollAnimations();
  initNavbarScroll();

  // Close cart overlay on overlay click
  document.getElementById('cart-overlay')?.addEventListener('click', closeCart);

  // Close checkout modal on overlay click
  document.getElementById('checkout-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeCheckoutModal();
  });

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Close mobile menu on nav link click
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu?.classList.add('hidden');
    });
  });

  console.log('🍔 XBurger loaded! Cart:', cart.length, 'items');
});
