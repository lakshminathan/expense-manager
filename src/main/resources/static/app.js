const API = '/api/expense-tracker';
const state = { metadata: null, summary: null, expenses: [], budgets: [] };

const rupee = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupee2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

const TAB_META = {
  overview: ['Overview', "A clean read on this month's spending."],
  expenses: ['Expenses', 'Every expense in the workspace.'],
  budgets:  ['Budgets', 'Set limits and watch category pressure.'],
  reports:  ['Reports', 'How this month breaks down.'],
};

const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const b = await res.json(); msg = b.message || b.error || msg; } catch (e) {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

function toast(message, isError) {
  const t = $('toast');
  t.textContent = message;
  t.classList.toggle('error', !!isError);
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

function defaultMonth() { return new Date().toISOString().slice(0, 7); }
function titleCase(s) { return (s || '').toLowerCase().replace(/(^|_)([a-z])/g, (_, p, c) => (p ? ' ' : '') + c.toUpperCase()); }

function fillSelect(el, values, withAll) {
  if (!el) return;
  const opts = [];
  if (withAll) opts.push('<option value="">All categories</option>');
  values.forEach((v) => opts.push(`<option value="${v}">${titleCase(v)}</option>`));
  el.innerHTML = opts.join('');
}

/* ---------------- data ---------------- */
async function loadMetadata() {
  state.metadata = await api('/metadata');
  fillSelect($('category-filter'), state.metadata.categories, true);
  fillSelect($('expense-category'), state.metadata.categories);
  fillSelect($('budget-category'), state.metadata.categories);
  fillSelect($('payment-method'), state.metadata.paymentMethods);
  fillSelect($('expense-status'), state.metadata.statuses);
}

async function loadData() {
  const month = $('month-filter').value;
  const category = $('category-filter').value;
  const expenseParams = new URLSearchParams();
  if (month) expenseParams.set('month', month);
  if (category) expenseParams.set('category', category);

  const [expenses, budgets, summary] = await Promise.all([
    api(`/expenses?${expenseParams.toString()}`),
    api(`/budgets?month=${encodeURIComponent(month)}`),
    api(`/summary?month=${encodeURIComponent(month)}`),
  ]);
  state.expenses = expenses;
  state.budgets = budgets;
  state.summary = summary;

  renderOverview();
  renderExpenses(expenses);
  renderBudgets();
  renderReports();
  renderSidebar();
}

/* ---------------- renders ---------------- */
function renderSidebar() {
  const s = state.summary || {};
  $('side-spend').textContent = rupee.format(s.totalSpent || 0);
  const pct = Math.round(s.budgetConsumptionPercent || 0);
  $('side-budget').textContent = `${pct}% of budget used`;
  $('side-meter').style.width = Math.min(pct, 100) + '%';
}

function renderOverview() {
  const s = state.summary || {};
  $('ov-total').textContent = rupee.format(s.totalSpent || 0);
  $('ov-count').textContent = `${s.expenseCount || 0} expenses`;
  $('ov-budget').textContent = `${Math.round(s.budgetConsumptionPercent || 0)}%`;
  $('ov-budgeted').textContent = `of ${rupee.format(s.budgetedTotal || 0)} budgeted`;
  $('ov-reimb').textContent = rupee.format(s.reimbursableTotal || 0);
  $('ov-approved').textContent = rupee.format(s.approvedTotal || 0);

  const breakdown = (s.categoryBreakdown || []).slice();
  const top = breakdown[0];
  $('ov-top').textContent = top ? `${titleCase(top.category)} leads` : 'No spend yet';
  renderBars('category-breakdown', breakdown.map((b) => ({ label: titleCase(b.category), value: b.amount })));

  const recent = state.expenses.slice(0, 6);
  $('recent-activity').innerHTML = recent.length ? recent.map((e) => `
    <li>
      <span class="act-dot"></span>
      <div class="act-main"><strong>${escapeHtml(e.description)}</strong><small>${escapeHtml(e.ownerName)} · ${titleCase(e.category)}</small></div>
      <span class="act-amt">${rupee.format(e.amount)}</span>
    </li>`).join('') : '<div class="empty-state">No recent activity.</div>';
}

function renderExpenses(expenses) {
  $('expenses-count').textContent = `${expenses.length} item${expenses.length === 1 ? '' : 's'}`;
  const body = $('expense-table-body');
  if (!expenses.length) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty-state">No expenses match this view.</div></td></tr>';
    return;
  }
  body.innerHTML = expenses.map((e) => `
    <tr>
      <td><span class="cell-title">${escapeHtml(e.description)}</span><span class="cell-sub">${escapeHtml(e.merchant)}</span></td>
      <td>${escapeHtml(e.ownerName)}</td>
      <td><span class="pill cat">${titleCase(e.category)}</span></td>
      <td><span class="pill ${e.status}">${titleCase(e.status)}</span></td>
      <td>${dateFmt.format(new Date(e.expenseDate))}</td>
      <td class="num amount">${rupee2.format(e.amount)}</td>
      <td><div class="row-actions">
        <button class="icon-btn" data-edit="${e.id}" title="Edit">✎</button>
        <button class="icon-btn" data-del="${e.id}" title="Delete">🗑</button>
      </div></td>
    </tr>`).join('');
}

function renderBudgets() {
  const spendByCat = {};
  (state.summary?.categoryBreakdown || []).forEach((b) => { spendByCat[b.category] = b.amount; });
  const list = $('budget-list');
  list.innerHTML = state.budgets.length ? state.budgets.map((b) => {
    const spend = spendByCat[b.category] || 0;
    const pct = b.limitAmount > 0 ? Math.round((spend / b.limitAmount) * 100) : 0;
    return `<div class="budget-item">
      <div class="bi-head"><strong>${titleCase(b.category)}</strong><span class="muted">${rupee.format(spend)} / ${rupee.format(b.limitAmount)}</span></div>
      <div class="bar-track"><div class="bar-fill ${pct > 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>
    </div>`;
  }).join('') : '<div class="empty-state">No budgets set for this month.</div>';

  renderBars('budget-pressure', state.budgets.map((b) => ({
    label: titleCase(b.category),
    value: spendByCat[b.category] || 0,
    max: b.limitAmount,
    over: (spendByCat[b.category] || 0) > b.limitAmount,
  })));
}

function renderReports() {
  const s = state.summary || {};
  const count = s.expenseCount || 0;
  $('rp-count').textContent = count;
  $('rp-avg').textContent = rupee.format(count ? (s.totalSpent || 0) / count : 0);
  const share = s.totalSpent > 0 ? Math.round((s.reimbursableTotal / s.totalSpent) * 100) : 0;
  $('rp-reimb').textContent = `${share}%`;
  $('rp-cats').textContent = (s.categoryBreakdown || []).length;
  renderBars('report-breakdown', (s.categoryBreakdown || []).map((b) => ({ label: titleCase(b.category), value: b.amount })));
}

function renderBars(elId, rows) {
  const el = $(elId);
  if (!rows.length) { el.innerHTML = '<div class="empty-state">No data yet.</div>'; return; }
  const max = Math.max(...rows.map((r) => r.max || r.value), 1);
  el.innerHTML = rows.map((r) => {
    const w = Math.min(Math.round((r.value / max) * 100), 100);
    return `<div class="bar-row"><span>${r.label}</span><div class="bar-track"><div class="bar-fill ${r.over ? 'over' : ''}" style="width:${w}%"></div></div><span class="bar-val">${rupee.format(r.value)}</span></div>`;
  }).join('');
}

function escapeHtml(s) { return (s ?? '').toString().replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- tabs ---------------- */
function switchTab(tab) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('is-active', n.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.id === `tab-${tab}`;
    t.classList.toggle('is-active', on);
    t.hidden = !on;
  });
  const [title, sub] = TAB_META[tab];
  $('page-title').textContent = title;
  $('page-sub').textContent = sub;
}

/* ---------------- drawers ---------------- */
function openDrawer(id) { $(id).hidden = false; }
function closeDrawer(id) { $(id).hidden = true; }

function resetExpenseForm() {
  $('expense-form').reset();
  $('expense-id').value = '';
  $('expense-form-title').textContent = 'New expense';
  $('delete-expense-btn').hidden = true;
  $('expense-date').value = new Date().toISOString().slice(0, 10);
}

function openExpenseForEdit(id) {
  const e = state.expenses.find((x) => String(x.id) === String(id));
  if (!e) return;
  $('expense-id').value = e.id;
  $('expense-form-title').textContent = 'Edit expense';
  $('description').value = e.description;
  $('merchant').value = e.merchant;
  $('amount').value = e.amount;
  $('expense-date').value = e.expenseDate;
  $('expense-category').value = e.category;
  $('payment-method').value = e.paymentMethod;
  $('expense-status').value = e.status;
  $('owner-name').value = e.ownerName;
  $('note').value = e.note || '';
  $('reimbursable').checked = !!e.reimbursable;
  $('delete-expense-btn').hidden = false;
  $('delete-expense-btn').dataset.id = e.id;
  openDrawer('expense-drawer');
}

async function submitExpense(ev) {
  ev.preventDefault();
  const id = $('expense-id').value;
  const payload = {
    description: $('description').value.trim(),
    merchant: $('merchant').value.trim(),
    amount: Number($('amount').value),
    expenseDate: $('expense-date').value,
    category: $('expense-category').value,
    paymentMethod: $('payment-method').value,
    status: $('expense-status').value,
    ownerName: $('owner-name').value.trim(),
    note: $('note').value.trim(),
    reimbursable: $('reimbursable').checked,
  };
  try {
    await api(id ? `/expenses/${id}` : '/expenses', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
    closeDrawer('expense-drawer');
    toast(id ? 'Expense updated' : 'Expense added');
    await loadData();
  } catch (e) { toast(e.message, true); }
}

async function deleteExpense(id) {
  try { await api(`/expenses/${id}`, { method: 'DELETE' }); toast('Expense deleted'); await loadData(); }
  catch (e) { toast(e.message, true); }
}

async function submitBudget(ev) {
  ev.preventDefault();
  const payload = {
    budgetMonth: $('budget-month').value,
    category: $('budget-category').value,
    limitAmount: Number($('budget-limit').value),
    alertThresholdPercent: Number($('budget-threshold').value),
    notes: $('budget-notes').value.trim(),
  };
  try {
    await api('/budgets', { method: 'POST', body: JSON.stringify(payload) });
    closeDrawer('budget-drawer');
    toast('Budget saved');
    await loadData();
  } catch (e) { toast(e.message, true); }
}

/* ---------------- wire-up ---------------- */
function init() {
  $('month-filter').value = defaultMonth();
  $('budget-month').value = defaultMonth();

  $('nav').addEventListener('click', (e) => { const b = e.target.closest('.nav-item'); if (b) switchTab(b.dataset.tab); });
  $('month-filter').addEventListener('change', () => loadData().catch((e) => toast(e.message, true)));
  $('category-filter').addEventListener('change', () => loadData().catch((e) => toast(e.message, true)));

  $('add-expense-btn').addEventListener('click', () => { resetExpenseForm(); openDrawer('expense-drawer'); });
  $('add-budget-btn').addEventListener('click', () => openDrawer('budget-drawer'));
  $('expense-form').addEventListener('submit', submitExpense);
  $('budget-form').addEventListener('submit', submitBudget);
  $('delete-expense-btn').addEventListener('click', (e) => { deleteExpense(e.target.dataset.id); closeDrawer('expense-drawer'); });

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeDrawer(b.dataset.close)));
  document.querySelectorAll('.drawer-backdrop').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.hidden = true; }));

  $('expense-table-body').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]'); const del = e.target.closest('[data-del]');
    if (edit) openExpenseForEdit(edit.dataset.edit);
    if (del) deleteExpense(del.dataset.del);
  });

  loadMetadata().then(loadData).catch((e) => toast(e.message, true));
}

document.addEventListener('DOMContentLoaded', init);
