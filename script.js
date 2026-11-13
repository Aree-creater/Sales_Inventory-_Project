'use strict'
const KEYS = { products: 'sims.products', sales: 'sims.sales' };
const DISCOUNT_THRESHOLD = 10000, DISCOUNT_RATE = 0.10, TAX_RATE = 0.05;
const SAMPLE = [
  { id: 'P-1001', name: 'Basmati Rice 5kg', category: 'Grocery', buy: 1450, sell: 1700, qty: 40, min: 10 },
  { id: 'P-1002', name: 'Cooking Oil 3L', category: 'Grocery', buy: 1900, sell: 2250, qty: 6, min: 8 },
  { id: 'P-1003', name: 'Wireless Mouse', category: 'Electronics', buy: 750, sell: 1200, qty: 25, min: 5 },
  { id: 'P-1004', name: 'USB-C Cable', category: 'Electronics', buy: 220, sell: 450, qty: 0, min: 10 },
  { id: 'P-1005', name: 'Notebook A4', category: 'Stationery', buy: 90, sell: 150, qty: 120, min: 30 },
  { id: 'P-1006', name: 'Office Chair', category: 'Furniture', buy: 11500, sell: 14500, qty: 4, min: 3 }
].map(p => ({ ...p, sample: true }));

let products = [], sales = [], cart = [];
let dataWarning = false;


const $ = (s) => document.querySelector(s);
const esc = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const money = (n) => 'PKR ' + Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (iso) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const find = (id) => products.find(p => p.id === id);
const statusOf = (p) => p.qty === 0 ? 'out' : p.qty <= p.min ? 'low' : 'ok';
const badge = (p) => { const s = statusOf(p); return `<span class="badge ${s}">${{ out: 'Out of stock', low: 'Low stock', ok: 'In stock' }[s]}</span>`; };

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 3500);
}

function confirmBox(msg, okText = 'Confirm') {
  return new Promise(resolve => {
    const d = $('#confirmDlg');
    $('#confirmMsg').textContent = msg; $('#confirmOk').textContent = okText;
    d.returnValue = ''; d.onclose = () => resolve(d.returnValue === 'ok'); d.showModal();
  });
}


function calc(subtotal) {
  subtotal = r2(subtotal);
  const discount = subtotal >= DISCOUNT_THRESHOLD ? r2(subtotal * DISCOUNT_RATE) : 0;
  const taxable = r2(subtotal - discount);
  const tax = r2(taxable * TAX_RATE);
  return { subtotal, discount, taxable, tax, total: r2(taxable + tax) };
}
const cartSubtotal = () => r2(cart.reduce((a, i) => a + (find(i.id)?.sell || 0) * i.qty, 0));


const validProduct = (p) => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.category === 'string'
  && [p.buy, p.sell, p.min].every(Number.isFinite) && Number.isInteger(p.qty) && p.qty >= 0 && Number.isInteger(p.min) && p.min >= 0;
const validSale = (s) => s && typeof s.id === 'string' && Array.isArray(s.items) && typeof s.date === 'string'
  && [s.subtotal, s.discount, s.tax, s.total].every(Number.isFinite);

function readList(key, check) {
  let raw;
  try { raw = localStorage.getItem(key); } catch { dataWarning = true; return []; }
  if (raw === null) return null;                       // nothing saved yet
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('not a list');
    const good = data.filter(check);
    if (good.length !== data.length) dataWarning = true;
    return good;
  } catch { dataWarning = true; return []; }
}

function save() {
  try {
    localStorage.setItem(KEYS.products, JSON.stringify(products));
    localStorage.setItem(KEYS.sales, JSON.stringify(sales));
    return true;
  } catch { toast('Could not save data. Storage may be full or blocked.', 'error'); return false; }
}

/** Apply new state and persist; roll back if saving fails. */
function commit(nextProducts, nextSales = sales) {
  const oldP = products, oldS = sales;
  products = nextProducts; sales = nextSales;
  if (save()) return true;
  products = oldP; sales = oldS; return false;
}

function loadData() {
  const p = readList(KEYS.products, validProduct), s = readList(KEYS.sales, validSale);
  sales = s || [];
  if (p === null) { products = SAMPLE.map(x => ({ ...x })); save(); } // sample data only on first run
  else products = p;
}


const TITLES = { dashboard: 'Dashboard', products: 'Products', sale: 'New Sale', history: 'Sales History' };
function nav(view) {
  document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'view-' + view);
  document.querySelectorAll('.sidebar nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#title').textContent = TITLES[view];
  $('#sidebar').classList.remove('open');
}


function renderAll() {
  syncCart(); renderDashboard(); renderProducts(); renderSale(); renderHistory();
  $('#sampleBanner').hidden = !products.some(p => p.sample);
}

function renderDashboard() {
  const revenue = r2(sales.reduce((a, s) => a + s.total, 0));
  const inv = r2(products.reduce((a, p) => a + p.buy * p.qty, 0));
  const tally = {};
  sales.forEach(s => s.items.forEach(i => { tally[i.name] = (tally[i.name] || 0) + i.qty; }));
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const items = [
    ['📦', 'Total products', products.length],
    ['💰', 'Total sales revenue', money(revenue)],
    ['🧾', 'Completed orders', sales.length],
    ['⚠️', 'Low stock products', products.filter(p => p.qty <= p.min).length],
    ['🏷️', 'Total inventory cost value', money(inv)],
    ['🏆', 'Top-selling product', top ? `${top[0]} (${top[1]} sold)` : 'No sales yet']
  ];
  $('#cards').innerHTML = items.map(([i, l, v]) => `<div class="card"><div class="ico">${i}</div><div><small>${l}</small><strong>${esc(v)}</strong></div></div>`).join('');
}

function renderProducts() {
  const catSel = $('#pCat'), keep = catSel.value;
  const cats = [...new Set(products.map(p => p.category))].sort();
  catSel.innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  catSel.value = cats.includes(keep) ? keep : '';
  const q = $('#pSearch').value.trim().toLowerCase();
  const sorters = { name: (a, b) => a.name.localeCompare(b.name), 'sell-asc': (a, b) => a.sell - b.sell, 'sell-desc': (a, b) => b.sell - a.sell, 'qty-asc': (a, b) => a.qty - b.qty, 'qty-desc': (a, b) => b.qty - a.qty };
  const list = products.filter(p => (!q || p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) && (!catSel.value || p.category === catSel.value)).sort(sorters[$('#pSort').value]);
  if (!list.length) {
    $('#productsBox').innerHTML = `<div class="empty">${products.length ? 'No products match your search or filter.' : 'No products yet. Use “Add product” to create your first one.'}</div>`;
    return;
  }
  $('#productsBox').innerHTML = `<div class="table-wrap"><table class="stack"><thead><tr><th>ID</th><th>Name</th><th>Category</th><th class="num">Purchase</th><th class="num">Selling</th><th class="num">Qty</th><th class="num">Min</th><th>Status</th><th>Actions</th></tr></thead><tbody>` +
    list.map(p => `<tr><td data-label="ID">${esc(p.id)}</td><td data-label="Name">${esc(p.name)}${p.sample ? '<span class="tag">sample</span>' : ''}</td><td data-label="Category">${esc(p.category)}</td><td class="num" data-label="Purchase">${money(p.buy)}</td><td class="num" data-label="Selling">${money(p.sell)}</td><td class="num" data-label="Qty">${p.qty}</td><td class="num" data-label="Min">${p.min}</td><td data-label="Status">${badge(p)}</td><td data-label="Actions"><button class="btn sm" data-action="edit" data-id="${esc(p.id)}">Edit</button> <button class="btn sm danger" data-action="delete" data-id="${esc(p.id)}">Delete</button></td></tr>`).join('') +
    '</tbody></table></div>';
}

function renderSale() {
  const sel = $('#saleProduct'), keep = sel.value;
  const avail = products.filter(p => p.qty > 0);
  sel.innerHTML = avail.length ? avail.map(p => `<option value="${esc(p.id)}">${esc(p.name)} — ${money(p.sell)} (${p.qty} in stock)</option>`).join('') : '<option value="">No products in stock</option>';
  if (avail.some(p => p.id === keep)) sel.value = keep;

  $('#cartBox').innerHTML = !cart.length ? '<div class="empty">Your cart is empty. Pick a product above to start a sale.</div>' :
    `<div class="table-wrap"><table class="stack"><thead><tr><th>Product</th><th class="num">Price</th><th>Quantity</th><th class="num">Line total</th><th></th></tr></thead><tbody>` +
    cart.map(i => { const p = find(i.id); return `<tr><td data-label="Product">${esc(p.name)}</td><td class="num" data-label="Price">${money(p.sell)}</td><td data-label="Quantity"><span class="qty-ctl"><button data-action="cart-dec" data-id="${esc(i.id)}" aria-label="Decrease">−</button>${i.qty}<button data-action="cart-inc" data-id="${esc(i.id)}" aria-label="Increase">+</button></span></td><td class="num" data-label="Line total">${money(p.sell * i.qty)}</td><td><button class="btn sm danger" data-action="cart-del" data-id="${esc(i.id)}">Remove</button></td></tr>`; }).join('') + '</tbody></table></div>';

  const t = calc(cartSubtotal());
  $('#summary').innerHTML = `<h2>Order summary</h2><div class="totals">
    <span>Subtotal</span><span>${money(t.subtotal)}</span>
    <span>Discount${t.discount ? ' (10%)' : ''}</span><span>− ${money(t.discount)}</span>
    <span>Taxable amount</span><span>${money(t.taxable)}</span>
    <span>Tax (5%)</span><span>${money(t.tax)}</span>
    <span class="grand">Grand total</span><span class="grand">${money(t.total)}</span></div>
    ${t.discount || !cart.length ? '' : `<p class="empty" style="padding:10px 0 0">Add ${money(DISCOUNT_THRESHOLD - t.subtotal)} more to get 10% off.</p>`}
    <button class="btn primary" data-action="checkout" ${cart.length ? '' : 'disabled'}>Checkout</button>
    <button class="btn" data-action="clear-cart" ${cart.length ? '' : 'disabled'}>Clear cart</button>`;
}

function renderHistory() {
  const q = $('#hSearch').value.trim().toLowerCase(), day = $('#hDate').value;
  const list = sales.filter(s => (!q || s.id.toLowerCase().includes(q)) && (!day || dayKey(s.date) === day));
  if (!list.length) {
    $('#historyBox').innerHTML = `<div class="empty">${sales.length ? 'No sales match your search or date.' : 'No sales yet. Completed sales will appear here.'}</div>`;
    return;
  }
  $('#historyBox').innerHTML = `<div class="table-wrap"><table class="stack"><thead><tr><th>Sale ID</th><th>Date &amp; time</th><th>Products</th><th class="num">Subtotal</th><th class="num">Discount</th><th class="num">Tax</th><th class="num">Final amount</th><th></th></tr></thead><tbody>` +
    list.map(s => `<tr><td data-label="Sale ID">${esc(s.id)}</td><td data-label="Date">${fmtDate(s.date)}</td><td data-label="Products">${s.items.map(i => `${esc(i.name)} × ${i.qty}`).join(', ')}</td><td class="num" data-label="Subtotal">${money(s.subtotal)}</td><td class="num" data-label="Discount">${money(s.discount)}</td><td class="num" data-label="Tax">${money(s.tax)}</td><td class="num" data-label="Final"><strong>${money(s.total)}</strong></td><td><button class="btn sm" data-action="view-sale" data-id="${esc(s.id)}">Details</button></td></tr>`).join('') + '</tbody></table></div>';
}

function showSale(id) {
  const s = sales.find(x => x.id === id); if (!s) return;
  $('#saleDetail').innerHTML = `<h2>Sale ${esc(s.id)}</h2><p>${fmtDate(s.date)}</p>
    <div class="table-wrap"><table><thead><tr><th>Product</th><th class="num">Price</th><th class="num">Qty</th><th class="num">Line total</th></tr></thead><tbody>${s.items.map(i => `<tr><td>${esc(i.name)}</td><td class="num">${money(i.price)}</td><td class="num">${i.qty}</td><td class="num">${money(i.line)}</td></tr>`).join('')}</tbody></table></div>
    <div class="totals" style="margin-top:14px"><span>Subtotal</span><span>${money(s.subtotal)}</span><span>Discount</span><span>− ${money(s.discount)}</span><span>Taxable amount</span><span>${money(s.subtotal - s.discount)}</span><span>Tax</span><span>${money(s.tax)}</span><span class="grand">Final amount</span><span class="grand">${money(s.total)}</span></div>`;
  $('#saleDlg').showModal();
}


const nextId = () => 'P-' + (products.reduce((m, p) => Math.max(m, +(/^P-(\d+)$/.exec(p.id) || [0, 0])[1]), 1000) + 1);

function openForm(id) {
  const f = $('#pForm'), p = id ? find(id) : null;
  f.reset(); f.dataset.edit = p ? p.id : '';
  $('#formTitle').textContent = p ? 'Edit product' : 'Add product';
  $('#formErr').textContent = ''; f.elements['id'].readOnly = !!p;
  const v = p || { id: nextId(), name: '', category: '', buy: '', sell: '', qty: '', min: '' };
  ['id', 'name', 'category', 'buy', 'sell', 'qty', 'min'].forEach(k => { f.elements[k].value = v[k]; });
  $('#catList').innerHTML = [...new Set(products.map(x => x.category))].map(c => `<option value="${esc(c)}">`).join('');
  $('#productDlg').showModal();
}

function validateForm(f, editing) {
  const g = (n) => f.elements[n].value.trim();
  const req = [['id', 'Product ID'], ['name', 'Product name'], ['category', 'Category'], ['buy', 'Purchase price'], ['sell', 'Selling price'], ['qty', 'Current quantity'], ['min', 'Minimum stock threshold']];
  for (const [n, l] of req) if (!g(n)) return `${l} is required.`;
  if (!(Number(g('buy')) > 0)) return 'Purchase price must be a positive number.';
  if (!(Number(g('sell')) > 0)) return 'Selling price must be a positive number.';
  if (!/^\d+$/.test(g('qty'))) return 'Quantity must be a non-negative whole number.';
  if (!/^\d+$/.test(g('min'))) return 'Minimum stock must be a non-negative whole number.';
  if (!editing && products.some(p => p.id.toLowerCase() === g('id').toLowerCase())) return 'This Product ID already exists. Use a unique ID.';
  return '';
}

$('#pForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, editing = f.dataset.edit, g = (n) => f.elements[n].value.trim();
  const err = validateForm(f, editing);
  $('#formErr').textContent = err; if (err) return;
  const rec = { id: g('id'), name: g('name'), category: g('category'), buy: Number(g('buy')), sell: Number(g('sell')), qty: Number(g('qty')), min: Number(g('min')), sample: false };
  if (rec.sell < rec.buy && !await confirmBox(`The selling price (${money(rec.sell)}) is lower than the purchase price (${money(rec.buy)}). You will lose money on each sale. Save anyway?`, 'Save anyway')) return;
  const next = editing ? products.map(p => p.id === editing ? rec : p) : [...products, rec];
  if (!commit(next)) return;
  $('#productDlg').close(); renderAll();
  toast(editing ? 'Product updated.' : 'Product added.');
});

async function deleteProduct(id) {
  const p = find(id); if (!p) return;
  if (!await confirmBox(`Delete “${p.name}”? Past sales keep their records.`, 'Delete')) return;
  if (commit(products.filter(x => x.id !== id))) { renderAll(); toast('Product deleted.'); }
}


function syncCart() {
  cart = cart.filter(i => { const p = find(i.id); if (!p || p.qty < 1) return false; i.qty = Math.min(i.qty, p.qty); return true; });
}

function addToCart() {
  const p = find($('#saleProduct').value), qty = Number($('#saleQty').value);
  if (!p) return toast('Select a product first.', 'error');
  if (p.qty === 0) return toast(`${p.name} is out of stock.`, 'error');
  if (!Number.isInteger(qty) || qty < 1) return toast('Quantity must be a whole number of 1 or more.', 'error');
  const line = cart.find(i => i.id === p.id), have = line ? line.qty : 0;
  if (have + qty > p.qty) return toast(`Only ${p.qty} of ${p.name} in stock (${have} already in cart).`, 'error');
  if (line) line.qty += qty; else cart.push({ id: p.id, qty });
  $('#saleQty').value = 1; renderSale();
}

function changeQty(id, delta) {
  const line = cart.find(i => i.id === id), p = find(id); if (!line || !p) return;
  if (line.qty + delta > p.qty) return toast(`Only ${p.qty} of ${p.name} in stock.`, 'error');
  if (line.qty + delta < 1) return toast('Use Remove to take the item out of the cart.', 'warning');
  line.qty += delta; renderSale();
}

const newSaleId = () => { let id; do { id = 'SL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(); } while (sales.some(s => s.id === id)); return id; };
const stockProblem = () => cart.map(i => { const p = find(i.id); return !p ? 'A product in your cart no longer exists.' : i.qty > p.qty ? `Not enough stock for ${p.name} (only ${p.qty} left).` : ''; }).find(Boolean);

async function checkout() {
  if (!cart.length) return toast('Your cart is empty. Add at least one product.', 'error');
  const t = calc(cartSubtotal());
  if (!await confirmBox(`Complete this sale for ${money(t.total)}?`, 'Complete sale')) return;
  const problem = stockProblem();                      // validate again right before saving
  if (problem) { toast(problem, 'error'); return renderAll(); }
  const sale = {
    id: newSaleId(), date: new Date().toISOString(),
    items: cart.map(i => { const p = find(i.id); return { id: p.id, name: p.name, price: p.sell, qty: i.qty, line: r2(p.sell * i.qty) }; }),
    ...t
  };
  const nextProducts = products.map(p => { const i = cart.find(c => c.id === p.id); return i ? { ...p, qty: p.qty - i.qty } : p; });
  if (!commit(nextProducts, [sale, ...sales])) return; // all-or-nothing
  cart = []; renderAll();
  toast(`Sale ${sale.id} completed — ${money(sale.total)}.`);
}


async function clearSample() {
  if (!await confirmBox('Remove all sample products? Your own products and all sales stay.', 'Remove')) return;
  if (commit(products.filter(p => !p.sample))) { renderAll(); toast('Sample data removed.'); }
}
async function clearAll() {
  if (!await confirmBox('Delete ALL products and sales? This cannot be undone.', 'Delete everything')) return;
  cart = [];
  if (commit([], [])) { renderAll(); toast('All data cleared.', 'warning'); }
}


document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const id = b.dataset.id;
  const actions = {
    nav: () => nav(b.dataset.view), menu: () => $('#sidebar').classList.toggle('open'),
    'add-product': () => openForm(), edit: () => openForm(id), delete: () => deleteProduct(id),
    'add-cart': addToCart, 'cart-inc': () => changeQty(id, 1), 'cart-dec': () => changeQty(id, -1),
    'cart-del': () => { cart = cart.filter(i => i.id !== id); renderSale(); },
    'clear-cart': () => { cart = []; renderSale(); }, checkout,
    'view-sale': () => showSale(id), 'clear-sample': clearSample, 'clear-all': clearAll,
    close: () => b.closest('dialog').close()
  };
  actions[b.dataset.action]?.();
});

document.addEventListener('input', (e) => {
  if (e.target.closest('#view-products .toolbar')) renderProducts();
  else if (e.target.closest('#view-history .toolbar')) renderHistory();
});


loadData(); renderAll(); nav('dashboard');
if (dataWarning) toast('Some saved data was unreadable and was skipped.', 'warning');
