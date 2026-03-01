const STORAGE_KEY = 'expense-tracker-transactions';

const categoryIcons = {
  food: '🍔',
  transport: '🚗',
  housing: '🏠',
  entertainment: '🎮',
  health: '🏥',
  shopping: '🛍️',
  salary: '💼',
  other: '📦',
};

let transactions = loadTransactions();

// DOM references
const form = document.getElementById('transaction-form');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const typeSelect = document.getElementById('type');
const categorySelect = document.getElementById('category');
const dateInput = document.getElementById('date');
const transactionList = document.getElementById('transaction-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search');
const filterType = document.getElementById('filter-type');
const filterCategory = document.getElementById('filter-category');
const btnClearAll = document.getElementById('btn-clear-all');

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const balanceEl = document.getElementById('balance');

// Set default date to today (string-based to avoid timezone offset issues)
dateInput.value = new Date().toISOString().split('T')[0];

// --- Data ---

function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function addTransaction(description, amount, type, category, date) {
  const transaction = {
    id: Date.now(),
    description: description.trim(),
    amount: parseFloat(amount),
    type,
    category,
    date,
  };
  transactions.unshift(transaction);
  saveTransactions();
}

function deleteTransaction(id) {
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
}

// --- UI ---

function formatCurrency(value) {
  return '$' + value.toFixed(2);
}

function updateSummary() {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = income - expense;

  totalIncomeEl.textContent = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
  balanceEl.textContent = formatCurrency(balance);
  balanceEl.style.color = balance >= 0 ? '#22c55e' : '#ef4444';
}

function getFilteredTransactions() {
  const search = searchInput.value.toLowerCase();
  const type = filterType.value;
  const category = filterCategory.value;

  return transactions.filter((t) => {
    const matchesSearch =
      !search ||
      t.description.toLowerCase().includes(search) ||
      t.category.toLowerCase().includes(search);
    const matchesType = type === 'all' || t.type === type;
    const matchesCategory = category === 'all' || t.category === category;
    return matchesSearch && matchesType && matchesCategory;
  });
}

function renderTransactions() {
  const filtered = getFilteredTransactions();

  // Remove all existing transaction items (keep empty-state element)
  Array.from(transactionList.querySelectorAll('.transaction-item')).forEach((el) =>
    el.remove()
  );

  if (filtered.length === 0) {
    emptyState.style.display = '';
    return;
  }

  emptyState.style.display = 'none';

  filtered.forEach((t) => {
    const li = document.createElement('li');
    li.className = `transaction-item ${t.type}`;
    li.dataset.id = t.id;

    const icon = categoryIcons[t.category] || '📦';
    const sign = t.type === 'income' ? '+' : '-';
    const formattedDate = new Date(t.date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const categoryLabel = t.category.charAt(0).toUpperCase() + t.category.slice(1);

    li.innerHTML = `
      <span class="category-icon">${icon}</span>
      <div class="details">
        <div class="description">${escapeHtml(t.description)}</div>
        <div class="meta">${categoryLabel} · ${formattedDate}</div>
      </div>
      <span class="tx-amount">${sign}${formatCurrency(t.amount)}</span>
      <button class="btn-delete" aria-label="Delete transaction" data-id="${t.id}">✕</button>
    `;

    transactionList.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function render() {
  updateSummary();
  renderTransactions();
}

// --- Events ---

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const description = descriptionInput.value;
  const amount = amountInput.value;
  const type = typeSelect.value;
  const category = categorySelect.value;
  const date = dateInput.value;

  if (!description || !amount || parseFloat(amount) <= 0 || !date) return;

  addTransaction(description, amount, type, category, date);
  render();

  // Reset form (keep date and type for convenience)
  descriptionInput.value = '';
  amountInput.value = '';
  descriptionInput.focus();
});

transactionList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  deleteTransaction(id);
  render();
});

btnClearAll.addEventListener('click', () => {
  if (transactions.length === 0) return;
  if (!confirm('Are you sure you want to delete all transactions?')) return;
  transactions = [];
  saveTransactions();
  render();
});

searchInput.addEventListener('input', renderTransactions);
filterType.addEventListener('change', renderTransactions);
filterCategory.addEventListener('change', renderTransactions);

// Initial render
render();
