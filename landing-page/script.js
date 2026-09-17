/* ==========================================================================
   Crispy Crepe - script.js
   ใช้ร่วมกันทุกหน้า: product.html, order.html, admin.html
   ========================================================================== */

// ⚠️ ต้องแก้ 2 ค่านี้ก่อนใช้งานจริง
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXi-tdkopU1X3Kq5BjkicKpxw3ulN5RgN6HaJoiPm2H6WRf0Fc7Z4aAaDetsedYjHk/exec'; // URL ของ Google Apps Script (Web App)
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRfyNOf4ptqeQPNQN2HVi7UV5OszXoRILjBZodeGokLLwawzD3IkJPpE1uwLrse7gwickfIr7RnhZTZ/pub?gid=0&single=true&output=csv'; // URL export CSV ของ Google Sheets

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) {
    initProductPage();
  }
  if (document.getElementById('orderForm')) {
    initOrderPage();
  }
  if (document.querySelector('#ordersTable tbody')) {
    initAdminPage();
  }
});


/* ==========================================================================
   1. product.html - โหลดสินค้าจาก products.json มาแสดงเป็นการ์ด + ฟิลเตอร์ Mood
   ========================================================================== */

function initProductPage() {
  const productList = document.getElementById('product-list');
  const filterBar = document.getElementById('filter-bar');
  let allProducts = [];

  fetch('products.json')
    .then(res => res.json())
    .then(data => {
      allProducts = data;

      // เช็ค URL parameter ?mood=xxx (มาจากหน้า index.html) เพื่อตั้งค่าฟิลเตอร์เริ่มต้น
      const params = new URLSearchParams(window.location.search);
      const moodParam = params.get('mood');

      if (moodParam && filterBar) {
        const targetBtn = filterBar.querySelector(`.filter-btn[data-mood="${moodParam}"]`);
        if (targetBtn) {
          filterBar.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
          targetBtn.classList.add('active');
          renderProducts(allProducts.filter(p => p.mood === moodParam));
          return;
        }
      }

      renderProducts(allProducts);
    })
    .catch(error => {
      console.error(error);
      productList.innerHTML = '<p class="loading-cell">ไม่สามารถโหลดข้อมูลสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
    });

  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mood = btn.dataset.mood;
      const filtered = mood === 'all' ? allProducts : allProducts.filter(p => p.mood === mood);
      renderProducts(filtered);
    });
  }

  function renderProducts(products) {
    if (!products.length) {
      productList.innerHTML = '<p class="loading-cell">ไม่พบสินค้าในหมวดหมู่นี้</p>';
      return;
    }

    productList.innerHTML = products.map(p => `
      <div class="product-card">
        <div class="product-image-wrapper">
          <img class="product-image" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}">
          <span class="mood-badge ${escapeHtml(p.mood)}">${escapeHtml(p.mood)}</span>
        </div>
        <div class="product-content">
          <h3 class="product-title">${escapeHtml(p.name)}</h3>
          <p class="product-description">${escapeHtml(p.description)}</p>
          <div class="product-footer">
            <span class="product-price">${p.price}</span>
            <a href="order.html?item=${encodeURIComponent(p.name)}&price=${encodeURIComponent(p.price)}" class="order-btn">สั่งซื้อ</a>
          </div>
        </div>
      </div>
    `).join('');
  }
}


/* ==========================================================================
   2. order.html - เติม item/price จาก URL parameter ลงฟอร์ม + ส่งคำสั่งซื้อ
   ========================================================================== */

function initOrderPage() {
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item') || '';
  const price = params.get('price') || '';

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // สำคัญ: ต้องเติมทั้งสองช่องนี้ทันทีที่โหลดหน้า
  if (itemsInput) itemsInput.value = item;
  if (totalInput) totalInput.value = price;

  const orderForm = document.getElementById('orderForm');
  orderForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const submitBtn = orderForm.querySelector('.submit-btn');
    const originalBtnText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังส่งคำสั่งซื้อ...';
    }

    const payload = {
      customerName: document.getElementById('customerName').value,
      contact: document.getElementById('contact').value,
      items: document.getElementById('items').value,
      total: document.getElementById('total').value,
      note: document.getElementById('note').value
    };

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(() => {
        window.location.href = 'thankyou.html';
      })
      .catch(error => {
        console.error(error);
        alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      });
  });
}


/* ==========================================================================
   3. admin.html - ดึง CSV จาก Google Sheets มาแสดงเป็นตาราง (parse CSV เอง)
   ========================================================================== */

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');

  fetch(CSV_URL)
    .then(res => res.text())
    .then(csvText => {
      const rows = parseCSV(csvText);

      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">ยังไม่มีรายการสั่งซื้อ</td></tr>';
        return;
      }

      // แถวแรกคือ header -> ตัดทิ้ง แล้วเรียงข้อมูลจากล่าสุดขึ้นก่อน
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim() !== ''));
      const sortedRows = dataRows.reverse();

      if (!sortedRows.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">ยังไม่มีรายการสั่งซื้อ</td></tr>';
        return;
      }

      // ลำดับคอลัมน์ที่คาดว่ามาจาก Google Sheets:
      // [0] วันที่/เวลา, [1] ชื่อผู้สั่งซื้อ, [2] ช่องทางติดต่อ,
      // [3] รายการสินค้า, [4] ราคารวม, [5] หมายเหตุ
      tbody.innerHTML = sortedRows.map(row => `
        <tr>
          <td>${escapeHtml(row[0] || '')}</td>
          <td>${escapeHtml(row[1] || '')}</td>
          <td>${escapeHtml(row[2] || '')}</td>
          <td>${escapeHtml(row[3] || '')}</td>
          <td>${escapeHtml(row[4] || '')}</td>
          <td>${escapeHtml(row[5] || '')}</td>
        </tr>
      `).join('');
    })
    .catch(error => {
      console.error(error);
      tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง</td></tr>';
    });
}

/**
 * Parse CSV text เป็น array ของแถว (แต่ละแถวเป็น array ของ string)
 * รองรับ field ที่ครอบด้วย double quotes ("...") ซึ่งอาจมี comma หรือ newline อยู่ข้างใน
 * และ double quotes ที่ escape ด้วย "" ภายใน field
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  // ตัด BOM ที่ Google Sheets มักแนบมาหน้าไฟล์ CSV
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        // ข้าม \r ปล่อยให้ \n จัดการขึ้นบรรทัดใหม่ (รองรับทั้ง \r\n และ \n)
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  // เติมข้อมูลที่เหลือของแถวสุดท้าย (กรณีไฟล์ไม่ได้ลงท้ายด้วย newline)
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}


/* ==========================================================================
   Utility - ป้องกัน XSS เมื่อนำข้อความจากภายนอก (JSON/CSV) มาแทรกลงใน HTML
   ========================================================================== */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
