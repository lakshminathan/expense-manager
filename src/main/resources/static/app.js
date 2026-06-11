const state = {
  metadata: null,
  summary: null,
  expenses: [],
  budgets: [],
};

const dom = {
  monthFilter: document.getElementById('month-filter'),
  categoryFilter: document.getElementById('category-filter'),
  queryFilter: document.getElementById('query-filter'),
  refreshButton: document.getElementById('refresh-button'),
  expenseForm: document.getElementById('expense-form'),
  budgetForm: document.getElementById('budget-form'),
  expenseTableBody: document.getElementById('expense-table-body'),
  categoryBreakdown: document.getElementById('category-breakdown'),
  budgetList: document.getElementById('budget-list'),
  recentActivity: document.getElementById('recent-activity'),
  toast: document.getElementById('toast'),
  resetExpenseButton: document.getElementById('reset-expense-button'),
  resetBudgetButton: document.getElementById('reset-budget-button'),
};

const rupee = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function defaultMonth() {
  return new Date().toISOString().slice(0, 7);
}

function startCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toNumber(value) {
  return Number(value || 0);
}

function statusClass(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
}

function showToast(message, isError = false) {
  dom.toast.textContent = message;
  dom.toast.style.background = isError ? 'rgba(140, 32, 41, 0.95)' : 'rgba(20, 34, 28, 0.94)';
  dom.toast.classList.add('visible');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => dom.toast.classList.remove('visible'), 2400);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function populateSelect(select, values, includeAll = false) {
  select.innerHTML = '';
  if (includeAll) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'All categories';
    select.appendChild(option);
  }

  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = startCase(value);
    select.appendChild(option);
  });
}

function fillForm(expense) {
  document.getElementById('expense-id').value = expense.id;
  document.getElementById('description').value = expense.description;
  document.getElementById('merchant').value = expense.merchant;
  document.getElementById('amount').value = expense.amount;
  document.getElementById('expense-date').value = expense.expenseDate;
  document.getElementById('expense-category').value = expense.category;
  document.getElementById('payment-method').value = expense.paymentMethod;
  document.getElementById('expense-status').value = expense.status;
  document.getElementById('owner-name').value = expense.ownerName;
  document.getElementById('receipt-url').value = expense.receiptUrl || '';
  document.getElementById('expense-note').value = expense.note || '';
  document.getElementById('reimbursable').checked = expense.reimbursable;
}

function resetExpenseForm() {
  dom.expenseForm.reset();
  document.getElementById('expense-id').value = '';
  document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
}

function resetBudgetForm() {
  dom.budgetForm.reset();
  document.getElementById('budget-month').value = defaultMonth();
  document.getElementById('budget-threshold').value = 80;
}

function computePendingClaims(expenses) {
  return expenses.filter((expense) => expense.reimbursable && !['approved', 'reimbursed'].includes(String(expense.status).toLowerCase()));
}

function computeTopCategory(summary) {
  const items = [...(summary?.categoryBreakdown || [])].sort((left, right) => toNumber(right.amount) - toNumber(left.amount));
  return items[0] || null;
}

function computeBudgetAttention(summary, budgets) {
  if (!budgets.length) {
    return {
      title: 'No budgets yet',
      copy: 'Set category budgets to unlock threshold monitoring and attention guidance.',
      ledgerHealth: 'Planning needed',
      ledgerHealthCopy: 'The ledger is active, but budget guardrails have not been defined yet.',
    };
  }

  const spendByCategory = new Map((summary?.categoryBreakdown || []).map((item) => [item.category, toNumber(item.amount)]));
  const budgetSignals = budgets.map((budget) => {
    const limit = toNumber(budget.limitAmount);
    const spent = spendByCategory.get(budget.category) || 0;
    const threshold = toNumber(budget.alertThresholdPercent);
    const usage = limit > 0 ? (spent / limit) * 100 : 0;
    return {
      category: budget.category,
      threshold,
      usage,
      spent,
      limit,
    };
  }).sort((left, right) => right.usage - left.usage);

  const hottest = budgetSignals[0];
  if (!hottest) {
    return {
      title: 'Stable',
      copy: 'No categories are close to their threshold.',
      ledgerHealth: 'Balanced month',
      ledgerHealthCopy: 'Spend, budget pressure, and approval flow are healthy.',
    };
  }

  if (hottest.usage >= 100) {
    return {
      title: `${startCase(hottest.category)} exceeded`,
      copy: `${startCase(hottest.category)} is over budget at ${Math.round(hottest.usage)}% utilization.`,
      ledgerHealth: 'Action required',
      ledgerHealthCopy: 'At least one category is above budget and needs intervention or approval.',
    };
  }

  if (hottest.usage >= hottest.threshold) {
    return {
      title: `${startCase(hottest.category)} nearing limit`,
      copy: `${startCase(hottest.category)} crossed its ${hottest.threshold}% alert threshold.`,
      ledgerHealth: 'Watch closely',
      ledgerHealthCopy: 'Budget pressure is rising and the month needs active steering.',
    };
  }

  return {
    title: 'Stable',
    copy: 'No categories are close to their threshold.',
    ledgerHealth: 'Balanced month',
    ledgerHealthCopy: 'Spend, budget pressure, and approval flow are healthy.',
  };
}

function renderSummary(summary) {
  const topCategory = computeTopCategory(summary);
  const pendingClaims = computePendingClaims(state.expenses);
  const pendingClaimsTotal = pendingClaims.reduce((total, expense) => total + toNumber(expense.amount), 0);
  const runway = Math.max(toNumber(summary.budgetedTotal) - toNumber(summary.totalSpent), 0);
  const attention = computeBudgetAttention(summary, state.budgets);
  const budgetPressure = Math.max(0, Math.min(100, toNumber(summary.budgetConsumptionPercent)));

  document.getElementById('current-month-label').textContent = summary.month;
  document.getElementById('hero-total-spend').textContent = rupee.format(summary.totalSpent);
  document.getElementById('hero-budget-usage').textContent = `${summary.budgetConsumptionPercent}%`;
  document.getElementById('hero-attention-note').textContent = attention.copy;
  document.getElementById('top-category-label').textContent = topCategory ? startCase(topCategory.category) : 'No spend yet';
  document.getElementById('top-category-value').textContent = topCategory ? rupee.format(topCategory.amount) : rupee.format(0);

  document.getElementById('total-spent').textContent = rupee.format(summary.totalSpent);
  document.getElementById('reimbursable-total').textContent = rupee.format(summary.reimbursableTotal);
  document.getElementById('approved-total').textContent = rupee.format(summary.approvedTotal);
  document.getElementById('budgeted-total').textContent = rupee.format(summary.budgetedTotal);
  document.getElementById('budget-percent').textContent = `${summary.budgetConsumptionPercent}% used`;
  document.getElementById('expense-count').textContent = `${summary.expenseCount} expenses`;

  document.getElementById('runway-left').textContent = rupee.format(runway);
  document.getElementById('runway-copy').textContent = runway > 0
    ? `You still have ${rupee.format(runway)} available before this month's budget cap.`
    : 'The current month has used the full available budget.';
  document.getElementById('pending-claims-count').textContent = String(pendingClaims.length);
  document.getElementById('pending-claims-value').textContent = `${rupee.format(pendingClaimsTotal)} awaiting decision`;
  document.getElementById('attention-title').textContent = attention.title;
  document.getElementById('attention-copy').textContent = attention.copy;
  document.getElementById('ledger-health').textContent = attention.ledgerHealth;
  document.getElementById('ledger-health-copy').textContent = attention.ledgerHealthCopy;
  document.getElementById('budget-pressure-label').textContent = `${summary.budgetConsumptionPercent}%`;
  document.getElementById('budget-pressure-copy').textContent = attention.copy;
  document.getElementById('budget-pressure-bar').style.width = `${budgetPressure}%`;

  const sortedBreakdown = [...(summary.categoryBreakdown || [])].sort((left, right) => toNumber(right.amount) - toNumber(left.amount));
  if (!sortedBreakdown.length) {
    dom.categoryBreakdown.innerHTML = '<div class="empty-state">No spend recorded for this month yet.</div>';
    return;
  }

  const max = Math.max(...sortedBreakdown.map((item) => toNumber(item.amount)));
  dom.categoryBreakdown.innerHTML = sortedBreakdown.map((item) => {
    const width = max > 0 ? (toNumber(item.amount) / max) * 100 : 0;
    return `
      <div class="breakdown-row">
        <div class="breakdown-meta">
          <div>
            <strong>${startCase(item.category)}</strong>
          </div>
          <span>${rupee.format(item.amount)}</span>
        </div>
        <div class="breakdown-bar-shell">
          <div class="breakdown-bar" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderBudgets(budgets) {
  if (!budgets.length) {
    dom.budgetList.innerHTML = '<div class="empty-state">No budgets set for this month yet.</div>';
    return;
  }

  const spendByCategory = new Map((state.summary?.categoryBreakdown || []).map((item) => [item.category, toNumber(item.amount)]));

  dom.budgetList.innerHTML = budgets.map((budget) => {
    const spent = spendByCategory.get(budget.category) || 0;
    const limit = toNumber(budget.limitAmount);
    const usage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
    return `
      <article class="budget-row">
        <div class="budget-meta">
          <div>
            <strong>${startCase(budget.category)}</strong>
            <div class="muted">${budget.notes || 'No notes added yet.'}</div>
          </div>
          <span class="budget-pill">Alert at ${budget.alertThresholdPercent}%</span>
        </div>
        <div class="budget-meta">
          <span>${rupee.format(spent)} spent</span>
          <span>${rupee.format(budget.limitAmount)} budget</span>
        </div>
        <div class="budget-bar-shell">
          <div class="budget-bar" style="width:${usage}%"></div>
        </div>
      </article>
    `;
  }).join('');
}

function renderRecentActivity(expenses) {
  if (!expenses.length) {
    dom.recentActivity.innerHTML = '<div class="empty-state">No recent activity for the selected view.</div>';
    return;
  }

  const recent = [...expenses]
    .sort((left, right) => String(right.expenseDate).localeCompare(String(left.expenseDate)))
    .slice(0, 5);

  dom.recentActivity.innerHTML = recent.map((expense) => `
    <article class="activity-row">
      <div class="activity-header">
        <div>
          <strong>${expense.description}</strong>
          <div class="activity-copy">${expense.ownerName} · ${expense.merchant}</div>
        </div>
        <span class="activity-kicker">${startCase(expense.category)}</span>
      </div>
      <div class="budget-meta">
        <span class="status-pill ${statusClass(expense.status)}">${startCase(expense.status)}</span>
        <span>${expense.expenseDate} · ${rupee.format(expense.amount)}</span>
      </div>
    </article>
  `).join('');
}

function renderExpenses(expenses) {
  if (!expenses.length) {
    dom.expenseTableBody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No expenses match the current filter.</div></td></tr>';
    return;
  }

  dom.expenseTableBody.innerHTML = expenses.map((expense) => `
    <tr>
      <td>
        <div class="expense-title">
          <strong>${expense.description}</strong>
          <small>${expense.merchant}${expense.note ? ` · ${expense.note}` : ''}</small>
        </div>
      </td>
      <td>${expense.ownerName}</td>
      <td><span class="category-pill">${startCase(expense.category)}</span></td>
      <td><span class="status-pill ${statusClass(expense.status)}">${startCase(expense.status)}</span></td>
      <td>${expense.expenseDate}</td>
      <td>${rupee.format(expense.amount)}</td>
      <td>
        <button class="table-action" type="button" data-action="edit" data-id="${expense.id}">Edit</button>
        <button class="table-action delete" type="button" data-action="delete" data-id="${expense.id}">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function loadMetadata() {
  state.metadata = await api('/api/expense-tracker/metadata');
  populateSelect(dom.categoryFilter, state.metadata.categories, true);
  populateSelect(document.getElementById('expense-category'), state.metadata.categories);
  populateSelect(document.getElementById('budget-category'), state.metadata.categories);
  populateSelect(document.getElementById('payment-method'), state.metadata.paymentMethods);
  populateSelect(document.getElementById('expense-status'), state.metadata.statuses);
}

async function loadData() {
  const month = dom.monthFilter.value;
  const category = dom.categoryFilter.value;
  const query = dom.queryFilter.value.trim();

  const expenseParams = new URLSearchParams();
  if (month) expenseParams.set('month', month);
  if (category) expenseParams.set('category', category);
  if (query) expenseParams.set('query', query);

  const [expenses, budgets, summary] = await Promise.all([
    api(`/api/expense-tracker/expenses?${expenseParams.toString()}`),
    api(`/api/expense-tracker/budgets?month=${encodeURIComponent(month)}`),
    api(`/api/expense-tracker/summary?month=${encodeURIComponent(month)}`),
  ]);

  state.expenses = expenses;
  state.budgets = budgets;
  state.summary = summary;
  renderExpenses(expenses);
  renderBudgets(budgets);
  renderRecentActivity(expenses);
  renderSummary(summary);
}

async function handleExpenseSubmit(event) {
  event.preventDefault();

  const expenseId = document.getElementById('expense-id').value;
  const payload = {
    description: document.getElementById('description').value.trim(),
    merchant: document.getElementById('merchant').value.trim(),
    amount: Number(document.getElementById('amount').value),
    expenseDate: document.getElementById('expense-date').value,
    category: document.getElementById('expense-category').value,
    paymentMethod: document.getElementById('payment-method').value,
    status: document.getElementById('expense-status').value,
    ownerName: document.getElementById('owner-name').value.trim(),
    note: document.getElementById('expense-note').value.trim() || null,
    receiptUrl: document.getElementById('receipt-url').value.trim() || null,
    reimbursable: document.getElementById('reimbursable').checked,
  };

  try {
    await api(expenseId ? `/api/expense-tracker/expenses/${expenseId}` : '/api/expense-tracker/expenses', {
      method: expenseId ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    resetExpenseForm();
    await loadData();
    showToast(expenseId ? 'Expense updated.' : 'Expense saved.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleBudgetSubmit(event) {
  event.preventDefault();

  const payload = {
    budgetMonth: document.getElementById('budget-month').value,
    category: document.getElementById('budget-category').value,
    limitAmount: Number(document.getElementById('budget-limit').value),
    alertThresholdPercent: Number(document.getElementById('budget-threshold').value),
    notes: document.getElementById('budget-notes').value.trim() || null,
  };

  try {
    await api('/api/expense-tracker/budgets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadData();
    showToast('Budget saved.');
  } catch (error) {
    showToast(error.message, true);
  }
}

async function handleTableAction(event) {
  const action = event.target.dataset.action;
  const id = event.target.dataset.id;
  if (!action || !id) {
    return;
  }

  const expense = state.expenses.find((item) => String(item.id) === String(id));
  if (!expense) {
    return;
  }

  if (action === 'edit') {
    fillForm(expense);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  if (action === 'delete') {
    if (!window.confirm(`Delete expense "${expense.description}"?`)) {
      return;
    }
    try {
      await api(`/api/expense-tracker/expenses/${id}`, { method: 'DELETE' });
      await loadData();
      showToast('Expense deleted.');
    } catch (error) {
      showToast(error.message, true);
    }
  }
}

function attachEvents() {
  dom.refreshButton.addEventListener('click', () => loadData().catch((error) => showToast(error.message, true)));
  dom.expenseForm.addEventListener('submit', handleExpenseSubmit);
  dom.budgetForm.addEventListener('submit', handleBudgetSubmit);
  dom.expenseTableBody.addEventListener('click', handleTableAction);
  dom.resetExpenseButton.addEventListener('click', resetExpenseForm);
  dom.resetBudgetButton.addEventListener('click', resetBudgetForm);
  dom.monthFilter.addEventListener('change', () => loadData().catch((error) => showToast(error.message, true)));
  dom.categoryFilter.addEventListener('change', () => loadData().catch((error) => showToast(error.message, true)));
  dom.queryFilter.addEventListener('input', debounce(() => loadData().catch((error) => showToast(error.message, true)), 250));
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

async function init() {
  dom.monthFilter.value = defaultMonth();
  document.getElementById('budget-month').value = defaultMonth();
  document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('budget-threshold').value = 80;
  await loadMetadata();
  await loadData();
  attachEvents();
}

init().catch((error) => {
  showToast(error.message, true);
  console.error(error);
});
