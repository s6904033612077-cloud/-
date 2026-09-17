// ==========================================================================
// Crispy Crepe - Application Script (script.js)
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  if (page === 'product.html' || page === '' || page === 'index.html') {
    initProductPage();
  }

  if (page === 'order.html') {
    initOrderPage();
  }

  if (page === 'admin.html') {
    initAdminPage();
  }
});

/* ==========================================================================
   1. Product Page Logic (product.html)
   ========================================================================== */
async function initProductPage() {
  const container = document.getElementById('product-container') || document.querySelector('.product-grid');
  const filterBtns = document.querySelectorAll('.filter-btn');

  if (!container) return;

  try {
    const response = await fetch('products.json');
    if (!response.ok) throw new Error('Failed to load products');
    const products = await response.json();

    // Render all products initially
    renderProducts(products, container);

    // Setup filter listeners
    if (filterBtns.length > 0) {
      filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          filterBtns.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');

          const selectedMood = e.target.dataset.mood || e.target.textContent.trim().toLowerCase();

          if (selectedMood === 'all' || selectedMood === 'ทั้งหมด') {
            renderProducts(products, container);
          } else {
            const filtered = products.filter(p => p.mood.toLowerCase() === selectedMood.toLowerCase());
            renderProducts(filtered, container);
          }
        });
      });
    }
  } catch (error) {
    console.error('Error loading products:', error);
    container.innerHTML = '<p class="error-message">ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
  }
}

function renderProducts(items, container) {
  if (items.length === 0) {
    container.innerHTML = '<p class="no-products">ไม่พบสินค้าในหมวดหมู่นี้</p>';
    return;
  }

  container.innerHTML = items.map(product => {
    const orderUrl = `order.html?item=${encodeURIComponent(product.name)}&price=${encodeURIComponent(product.price)}`;
    return `
      <div class="product-card" data-mood="${product.mood}">
        <div class="product-image-wrapper">
          <img src="${product.image}" alt="${product.name}" class="product-image" loading="lazy">
          <span class="mood-badge ${product.mood}">${product.mood}</span>
        </div>
        <div class="product-content">
          <h3 class="product-title">${product.name}</h3>
          <p class="product-description">${product.description || ''}</p>
          <div class="product-footer">
            <span class="product-price">${product.price}</span>
            <a href="${orderUrl}" class="order-btn">สั่งซื้อ</a>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/* ==========================================================================
   2. Order Page Logic (order.html)
   ========================================================================== */
function initOrderPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const itemName = urlParams.get('item');
  const itemPrice = urlParams.get('price');

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');
  const orderForm = document.getElementById('orderForm');

  // Autofill fields from URL query params
  if (itemsInput && itemName) {
    itemsInput.value = itemName;
  }
  if (totalInput && itemPrice) {
    totalInput.value = itemPrice;
  }

  // Handle order form submission
  if (orderForm) {
    orderForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const appsScriptUrl = '[https://script.google.com/macros/s/AKfycbyCx-lj5uck0Oco5_drd0UQEtR0yJLsYZBwfXuPq-5b8royVVTE1AyogZZhR_J1n9NUzQ/exec]';

      const formData = new FormData(orderForm);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });

      // Include explicit fallback/auto-filled items if not present in FormData
      if (!data.items && itemsInput) data.items = itemsInput.value;
      if (!data.total && totalInput) data.total = totalInput.value;

      try {
        // Send raw JSON string without custom headers (avoids CORS preflight)
        const response = await fetch(appsScriptUrl, {
          method: 'POST',
          body: JSON.stringify(data)
        });

        alert('ส่งคำสั่งซื้อเรียบร้อยแล้ว!');
        orderForm.reset();
      } catch (error) {
        console.error('Error submitting order:', error);
        alert('เกิดข้อผิดพลาดในการส่งข้อมูล กรุณาลองใหม่อีกครั้ง');
      }
    });
  }
}

/* ==========================================================================
   3. Admin Page Logic (admin.html)
   ========================================================================== */
async function initAdminPage() {
  const csvUrl = '[https://docs.google.com/spreadsheets/d/e/2PACX-1vRfyNOf4ptqeQPNQN2HVi7UV5OszXoRILjBZodeGokLLwawzD3IkJPpE1uwLrse7gwickfIr7RnhZTZ/pub?gid=0&single=true&output=csv]';
  const tableBody = document.querySelector('#ordersTable tbody');

  if (!tableBody) return;

  try {
    const response = await fetch(csvUrl);
    if (!response.ok) throw new Error('Failed to fetch CSV data');
    const csvText = await response.text();

    const rows = parseCSV(csvText);
    renderAdminTable(rows, tableBody);
  } catch (error) {
    console.error('Error fetching CSV:', error);
    tableBody.innerHTML = '<tr><td colspan="100%" style="text-align:center; color:red;">ไม่สามารถดึงข้อมูลรายการสั่งซื้อได้</td></tr>';
  }
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    // Regex for handling comma separation while considering double quotes
    const regex = /(?:\"([^\"]*(?:\"\"\"[^\"]*)*)\"|([^\",]+)|())(?:,|$)/g;
    const row = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      let val = match[1] !== undefined ? match[1].replace(/\"\"/g, '"') : match[2];
      if (val !== undefined) row.push(val.trim());
    }
    return row;
  }).filter(row => row.length > 0 && row.some(cell => cell !== ''));
}

function renderAdminTable(rows, tbody) {
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="100%" style="text-align:center;">ไม่มีข้อมูลสั่งซื้อ</td></tr>';
    return;
  }

  // Skip header row if present, assuming row 0 is header
  const dataRows = rows.length > 1 ? rows.slice(1) : rows;

  tbody.innerHTML = dataRows.map(row => {
    const cells = row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
