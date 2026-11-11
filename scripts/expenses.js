const storageKey = 'expenses';
const amountFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
let toastTimer;

function formatAmount(amount) {
  return amountFormat.format(amount) + ' Lek';
}

function newExpenseId() {
  return crypto.randomUUID();
}

function readExpenses() {
  const saved = JSON.parse(localStorage.getItem(storageKey) ?? '[]');

  if (Array.isArray(saved)) {
    return saved;
  }

  // Week 05 saved one expense object. Give it an ID so it can be edited.
  if (saved && typeof saved === 'object') {
    const expenses = [{ ...saved, amount: Number(saved.amount), id: newExpenseId() }];
    saveExpenses(expenses);
    return expenses;
  }

  return [];
}

function saveExpenses(expenses) {
  localStorage.setItem(storageKey, JSON.stringify(expenses));
}

function showMessage(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function clearValidation(form) {
  for (const field of form.querySelectorAll('[aria-invalid]')) {
    field.removeAttribute('aria-invalid');
    field.classList.remove('is-invalid');
    form.querySelector('[data-for="' + field.name + '"]').textContent = '';
  }
}

function getExpense(form) {
  clearValidation(form);
  const { title, amount, category, date } = form.elements;
  const fields = [
    [title, title.value.trim() !== '', 'Enter a title.'],
    [amount, amount.validity.valid && Number.isSafeInteger(amount.valueAsNumber),
      'Enter a positive whole amount in Lek.'],
    [category, category.validity.valid, 'Choose a category.'],
    [date, date.validity.valid, 'Enter a valid date.']
  ];
  let firstInvalid;

  for (const [field, valid, message] of fields) {
    if (valid) continue;
    field.classList.add('is-invalid');
    field.setAttribute('aria-invalid', 'true');
    form.querySelector('[data-for="' + field.name + '"]').textContent = message;
    firstInvalid ??= field;
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return null;
  }

  return {
    title: title.value.trim(),
    amount: amount.valueAsNumber,
    category: category.value,
    date: date.value
  };
}

function storeExpenses(expenses) {
  try {
    saveExpenses(expenses);
    return true;
  } catch {
    showMessage('Expenses could not be saved. Check your browser storage and try again.');
    return false;
  }
}

function setupAddForm(form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const expense = getExpense(form);
    if (!expense) return;

    const expenses = readExpenses();
    expenses.push({ ...expense, id: newExpenseId() });
    if (!storeExpenses(expenses)) return;

    const item = document.createElement('li');
    item.className = 'list-group-item';
    item.textContent = expense.title + ' · ' + expense.category + ' · ' +
      formatAmount(expense.amount) + ' · ' + expense.date;
    document.getElementById('recent-list').prepend(item);
    document.getElementById('recent').classList.remove('d-none');
    form.reset();
    form.elements.title.focus();
    showMessage('Expense added.');
  });
}

function updateStats(expenses) {
  const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  document.getElementById('stat-count').textContent = expenses.length;
  document.getElementById('stat-total').textContent = formatAmount(total);

  const latest = document.getElementById('stat-latest');
  if (latest) {
    latest.textContent = expenses.at(-1)?.title ?? 'none yet';
    return;
  }

  const biggest = expenses.reduce((largest, expense) =>
    !largest || Number(expense.amount) > Number(largest.amount) ? expense : largest, null);
  document.getElementById('stat-average').textContent =
    formatAmount(expenses.length ? total / expenses.length : 0);
  document.getElementById('stat-biggest').textContent = biggest
    ? biggest.title + ' · ' + formatAmount(biggest.amount)
    : 'none';
}

function actionButton(label, style, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-sm ' + style;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function setupExpensesPage(form) {
  const list = document.getElementById('expense-list');
  const search = document.getElementById('search');
  const category = document.getElementById('filter-category');
  const clearAll = document.getElementById('clear-all');
  const editId = document.getElementById('edit-id');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('edit-modal'));

  function openEdit(expense) {
    clearValidation(form);
    editId.value = expense.id;
    form.elements.title.value = expense.title;
    form.elements.amount.value = expense.amount;
    form.elements.category.value = expense.category;
    form.elements.date.value = expense.date;
    modal.show();
  }

  function deleteExpense(id) {
    if (!confirm('Delete this expense?')) return;
    if (storeExpenses(readExpenses().filter((expense) => expense.id !== id))) {
      render();
      showMessage('Expense deleted.');
    }
  }

  function render() {
    const expenses = readExpenses();
    const query = search.value.trim().toLowerCase();
    const visible = expenses.filter((expense) =>
      expense.title.toLowerCase().includes(query) &&
      (!category.value || expense.category === category.value));

    updateStats(expenses);
    document.getElementById('count').textContent = visible.length;
    document.getElementById('empty-message').classList.toggle('d-none', expenses.length > 0);
    document.getElementById('no-matches').classList.toggle('d-none', !expenses.length || visible.length > 0);
    clearAll.disabled = expenses.length === 0;
    list.replaceChildren();

    visible.sort((a, b) => b.date.localeCompare(a.date));
    for (const expense of visible) {
      const row = list.insertRow();
      for (const value of [expense.date, expense.title, expense.category]) {
        row.insertCell().textContent = value;
      }
      const amount = row.insertCell();
      amount.className = 'text-end text-nowrap';
      amount.textContent = formatAmount(expense.amount);

      const actions = row.insertCell();
      actions.className = 'text-end text-nowrap';
      actions.append(
        actionButton('Edit', 'btn-outline-primary me-2', () => openEdit(expense)),
        actionButton('Delete', 'btn-outline-danger', () => deleteExpense(expense.id))
      );
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const updated = getExpense(form);
    if (!updated) return;

    const expenses = readExpenses();
    const index = expenses.findIndex((expense) => expense.id === editId.value);
    if (index === -1) {
      modal.hide();
      render();
      showMessage('This expense is no longer available.');
      return;
    }

    expenses[index] = { ...expenses[index], ...updated };
    if (!storeExpenses(expenses)) return;

    modal.hide();
    render();
    showMessage('Expense updated.');
  });

  search.addEventListener('input', render);
  category.addEventListener('change', render);
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) render();
  });

  document.getElementById('load-sample').addEventListener('click', () => {
    if (readExpenses().length) return;
    const examples = [
      { title: 'Lunch', amount: 350, category: 'Food', date: '2026-01-12' },
      { title: 'Bus ticket', amount: 40, category: 'Transport', date: '2026-01-13' },
      { title: 'Programming book', amount: 900, category: 'Books', date: '2026-01-14' }
    ];
    if (storeExpenses(examples.map((expense) => ({ ...expense, id: newExpenseId() })))) {
      render();
      showMessage('Sample expenses loaded.');
    }
  });

  clearAll.addEventListener('click', () => {
    if (confirm('Delete all saved expenses?') && storeExpenses([])) {
      render();
      showMessage('All expenses deleted.');
    }
  });

  render();
}

const addForm = document.getElementById('expense-form');
const editForm = document.getElementById('edit-form');

if (addForm) {
  setupAddForm(addForm);
} else if (editForm) {
  setupExpensesPage(editForm);
} else {
  updateStats(readExpenses());
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) updateStats(readExpenses());
  });
}
