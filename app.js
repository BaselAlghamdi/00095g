(() => {
  const STORAGE_KEY = 'expense-tracker-data';

  // --- State ---
  let expenses = loadExpenses();

  // --- DOM refs ---
  const form = document.getElementById('expense-form');
  const descriptionInput = document.getElementById('description');
  const amountInput = document.getElementById('amount');
  const categorySelect = document.getElementById('category');
  const dateInput = document.getElementById('date');
  const expenseList = document.getElementById('expense-list');
  const emptyState = document.getElementById('empty-state');
  const totalAmountEl = document.getElementById('total-amount');
  const categorySummaryEl = document.getElementById('category-summary');
  const filterCategory = document.getElementById('filter-category');
  const sortBy = document.getElementById('sort-by');

  // Set default date to today
  dateInput.value = new Date().toISOString().split('T')[0];

  // --- Event listeners ---
  form.addEventListener('submit', handleAddExpense);
  filterCategory.addEventListener('change', render);
  sortBy.addEventListener('change', render);

  // --- Functions ---
  function loadExpenses() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveExpenses() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function handleAddExpense(e) {
    e.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const category = categorySelect.value;
    const date = dateInput.value;

    if (!description || isNaN(amount) || amount <= 0 || !category || !date) return;

    const expense = { id: generateId(), description, amount, category, date };
    expenses.push(expense);
    saveExpenses();
    render();

    // Reset form (keep date)
    descriptionInput.value = '';
    amountInput.value = '';
    categorySelect.value = '';
    descriptionInput.focus();
  }

  function deleteExpense(id) {
    expenses = expenses.filter(exp => exp.id !== id);
    saveExpenses();
    render();
  }

  function getFilteredAndSorted() {
    const catFilter = filterCategory.value;
    const sort = sortBy.value;

    let filtered = catFilter === 'all' ? [...expenses] : expenses.filter(e => e.category === catFilter);

    filtered.sort((a, b) => {
      switch (sort) {
        case 'date-asc':  return a.date.localeCompare(b.date);
        case 'date-desc': return b.date.localeCompare(a.date);
        case 'amount-asc':  return a.amount - b.amount;
        case 'amount-desc': return b.amount - a.amount;
        default: return 0;
      }
    });

    return filtered;
  }

  function formatCurrency(value) {
    return '$' + value.toFixed(2);
  }

  function formatDate(dateStr) {
    // Parse as local date to avoid timezone offset issues
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function renderTotal() {
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    totalAmountEl.textContent = formatCurrency(total);
  }

  function renderCategorySummary() {
    const totals = {};
    expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });

    categorySummaryEl.innerHTML = '';
    Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, total]) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `
          <div class="cat-name">${escapeHtml(cat)}</div>
          <div class="cat-amount">${formatCurrency(total)}</div>
        `;
        categorySummaryEl.appendChild(card);
      });
  }

  function renderExpenses() {
    const items = getFilteredAndSorted();

    // Clear existing expense items (keep empty-state element)
    Array.from(expenseList.querySelectorAll('.expense-item')).forEach(el => el.remove());

    if (items.length === 0) {
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';

    items.forEach(expense => {
      const li = document.createElement('li');
      li.className = 'expense-item';
      li.dataset.id = expense.id;
      li.innerHTML = `
        <div class="expense-info">
          <div class="expense-description">${escapeHtml(expense.description)}</div>
          <div class="expense-meta">${formatDate(expense.date)}</div>
        </div>
        <span class="category-badge">${escapeHtml(expense.category)}</span>
        <span class="expense-amount">${formatCurrency(expense.amount)}</span>
        <button class="btn-delete" aria-label="Delete expense" data-id="${expense.id}">✕</button>
      `;
      expenseList.appendChild(li);
    });

    // Delegate delete clicks
    expenseList.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteExpense(btn.dataset.id));
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render() {
    renderTotal();
    renderCategorySummary();
    renderExpenses();
  }

  // Initial render
  render();
})();
