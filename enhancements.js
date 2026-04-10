/* =============================================
   CashQuest — Enhanced Features
   Inline editing, modals, alerts, themes
   ============================================= */

// ======== MODAL SYSTEM ========
function openModal(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml;
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

// ======== ADD TRANSACTION (MANUAL) ========
function showAddTransactionModal() {
    const cats = [...new Set(APP.transactions.map(t => t.category)), 'Groceries', 'Dining', 'Transportation', 'Subscriptions', 'Utilities', 'Housing', 'Health', 'Shopping', 'Entertainment', 'Travel', 'Other'];
    const uniqueCats = [...new Set(cats)].sort();
    const catOptions = uniqueCats.map(c => `<option value="${c}">${c}</option>`).join('');

    openModal('Add Transaction', `
        <div class="modal-field">
            <label>Date</label>
            <input type="date" id="modalTxDate" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="modal-field">
            <label>Description</label>
            <input type="text" id="modalTxDesc" placeholder="e.g. Grocery run at Loblaws">
        </div>
        <div class="modal-field">
            <label>Amount ($)</label>
            <input type="number" id="modalTxAmount" step="0.01" placeholder="0.00">
        </div>
        <div class="modal-field">
            <label>Category</label>
            <select id="modalTxCategory">${catOptions}</select>
        </div>
        <div class="modal-field">
            <label>Type</label>
            <select id="modalTxType">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
            </select>
        </div>
        <div class="modal-field">
            <label>Merchant (optional)</label>
            <input type="text" id="modalTxMerchant" placeholder="e.g. Loblaws">
        </div>
    `, `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveNewTransaction()">Add Transaction</button>
    `);
}

function saveNewTransaction() {
    const date = document.getElementById('modalTxDate').value;
    const desc = document.getElementById('modalTxDesc').value.trim();
    const amount = parseFloat(document.getElementById('modalTxAmount').value);
    const category = document.getElementById('modalTxCategory').value;
    const type = document.getElementById('modalTxType').value;
    const merchant = document.getElementById('modalTxMerchant').value.trim();

    if (!desc) { showToast('Enter a description', 'warning'); return; }
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'warning'); return; }

    APP.transactions.push({
        id: generateId(),
        date, description: desc, amount, category, type, merchant, raw: {}
    });
    saveState();
    updateCategoryFilters();
    closeModal();
    renderTransactions();
    showToast('Transaction added!', 'success');
    checkBadges();
}

// ======== EDIT TRANSACTION (INLINE) ========
function showEditTransactionModal(txId) {
    const tx = APP.transactions.find(t => t.id === txId);
    if (!tx) return;

    const cats = [...new Set(APP.transactions.map(t => t.category)), 'Groceries', 'Dining', 'Transportation', 'Subscriptions', 'Utilities', 'Housing', 'Health', 'Shopping', 'Entertainment', 'Travel', 'Other'];
    const uniqueCats = [...new Set(cats)].sort();
    const catOptions = uniqueCats.map(c => `<option value="${c}" ${c === tx.category ? 'selected' : ''}>${c}</option>`).join('');

    openModal('Edit Transaction', `
        <div class="modal-field">
            <label>Date</label>
            <input type="date" id="modalTxDate" value="${tx.date}">
        </div>
        <div class="modal-field">
            <label>Description</label>
            <input type="text" id="modalTxDesc" value="${tx.description.replace(/"/g, '&quot;')}">
        </div>
        <div class="modal-field">
            <label>Amount ($)</label>
            <input type="number" id="modalTxAmount" step="0.01" value="${tx.amount}">
        </div>
        <div class="modal-field">
            <label>Category</label>
            <select id="modalTxCategory">${catOptions}</select>
        </div>
        <div class="modal-field">
            <label>Type</label>
            <select id="modalTxType">
                <option value="expense" ${tx.type === 'expense' ? 'selected' : ''}>Expense</option>
                <option value="income" ${tx.type === 'income' ? 'selected' : ''}>Income</option>
            </select>
        </div>
        <div class="modal-field">
            <label>Merchant</label>
            <input type="text" id="modalTxMerchant" value="${(tx.merchant || '').replace(/"/g, '&quot;')}">
        </div>
    `, `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditTransaction('${txId}')">Save Changes</button>
    `);
}

function saveEditTransaction(txId) {
    const tx = APP.transactions.find(t => t.id === txId);
    if (!tx) return;

    const desc = document.getElementById('modalTxDesc').value.trim();
    const amount = parseFloat(document.getElementById('modalTxAmount').value);
    if (!desc) { showToast('Enter a description', 'warning'); return; }
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'warning'); return; }

    tx.date = document.getElementById('modalTxDate').value;
    tx.description = desc;
    tx.amount = amount;
    tx.category = document.getElementById('modalTxCategory').value;
    tx.type = document.getElementById('modalTxType').value;
    tx.merchant = document.getElementById('modalTxMerchant').value.trim();

    saveState();
    closeModal();
    renderTransactions();
    showToast('Transaction updated!', 'success');
}

function deleteTransaction(txId) {
    if (!confirm('Delete this transaction?')) return;
    APP.transactions = APP.transactions.filter(t => t.id !== txId);
    saveState();
    renderTransactions();
    showToast('Transaction deleted', 'info');
}

// ======== EDIT BUDGET ========
function showEditBudgetModal(idx) {
    const b = APP.budgets[idx];
    if (!b) return;

    openModal('Edit Budget — ' + b.category, `
        <div class="modal-field">
            <label>Category</label>
            <input type="text" value="${b.category}" disabled style="opacity:0.5">
        </div>
        <div class="modal-field">
            <label>Monthly Limit ($)</label>
            <input type="number" id="modalBudgetLimit" step="1" value="${b.limit}">
        </div>
    `, `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEditBudget(${idx})">Update Budget</button>
    `);
}

function saveEditBudget(idx) {
    const limit = parseFloat(document.getElementById('modalBudgetLimit').value);
    if (!limit || limit <= 0) { showToast('Enter a valid amount', 'warning'); return; }
    APP.budgets[idx].limit = limit;
    saveState();
    closeModal();
    renderBudgets();
    showToast('Budget updated!', 'success');
}

// ======== MANUAL ALERT CREATION ========
function showAddAlertModal() {
    openModal('Create Custom Alert', `
        <div class="modal-field">
            <label>Alert Title</label>
            <input type="text" id="modalAlertTitle" placeholder="e.g. Unusual subscription charge">
        </div>
        <div class="modal-field">
            <label>Alert Description</label>
            <textarea id="modalAlertDesc" placeholder="e.g. $49.99 charged by Unknown App on Jan 15"></textarea>
        </div>
        <div class="modal-field">
            <label>Severity</label>
            <select id="modalAlertSeverity">
                <option value="warning">⚠️ Warning</option>
                <option value="critical">🚨 Critical</option>
                <option value="info">ℹ️ Info</option>
            </select>
        </div>
    `, `
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveCustomAlert()">Create Alert</button>
    `);
}

function saveCustomAlert() {
    const title = document.getElementById('modalAlertTitle').value.trim();
    const desc = document.getElementById('modalAlertDesc').value.trim();
    const severity = document.getElementById('modalAlertSeverity').value;
    if (!title) { showToast('Enter a title', 'warning'); return; }

    if (!APP.customAlerts) APP.customAlerts = [];
    APP.customAlerts.push({ id: generateId(), title, desc, severity, date: new Date().toISOString() });
    saveState();
    closeModal();
    renderCustomAlerts();
    showToast('Alert created!', 'success');

    const earned = APP.achievements.map(a => a.id);
    if (!earned.includes('anomaly_found')) {
        APP.achievements.push({ id: 'anomaly_found', date: new Date().toISOString() });
        saveState();
        showToast('🏅 Badge earned: Anomaly Hunter!', 'success');
    }
}

function renderCustomAlerts() {
    const container = document.getElementById('anomalyAlerts');
    const alerts = APP.customAlerts || [];

    // Merge with auto-detected anomalies
    let html = '';

    // Auto anomalies first
    const monthTxs = getMonthTransactions();
    const expenses = monthTxs.filter(t => t.type === 'expense');
    if (expenses.length > 0) {
        const amounts = expenses.map(t => t.amount);
        const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length);
        const threshold = mean + 2 * stdDev;
        const anomalies = expenses.filter(t => t.amount > threshold && t.amount > 100).slice(0, 3);
        html += anomalies.map(t => `
            <div class="alert-card">
                <span class="alert-icon">🚨</span>
                <div class="alert-content">
                    <div class="alert-title">${t.description.substring(0, 40)}</div>
                    <div class="alert-desc">${fmt(t.amount)} on ${t.date}</div>
                </div>
            </div>
        `).join('');
    }

    // Custom alerts
    html += alerts.map(a => {
        const icons = { warning: '⚠️', critical: '🚨', info: 'ℹ️' };
        return `
            <div class="alert-card">
                <span class="alert-icon">${icons[a.severity] || '⚠️'}</span>
                <div class="alert-content">
                    <div class="alert-title">${a.title}</div>
                    <div class="alert-desc">${a.desc || ''}</div>
                </div>
                <button class="action-btn delete" onclick="deleteAlert('${a.id}')" title="Remove">✕</button>
            </div>
        `;
    }).join('');

    if (!html) {
        html = '<div class="empty-state">No anomalies detected. Click "+ Add Alert" to create one!</div>';
    }
    container.innerHTML = html;
}

function deleteAlert(id) {
    APP.customAlerts = (APP.customAlerts || []).filter(a => a.id !== id);
    saveState();
    renderCustomAlerts();
    showToast('Alert removed', 'info');
}

// ======== COLOR THEME ========
const DEFAULT_COLORS = {
    primary: '#00D09C',
    secondary: '#6C5CE7',
    bg: '#0F0F23',
    surface: '#1A1A2E'
};

function saveThemeColor(key, value) {
    if (!APP.settings.colors) APP.settings.colors = { ...DEFAULT_COLORS };
    APP.settings.colors[key] = value;
    applyThemeColors();
    saveState();
    showToast('Theme color updated!', 'success');
}

function resetThemeColors() {
    APP.settings.colors = { ...DEFAULT_COLORS };
    applyThemeColors();
    updateColorPickers();
    saveState();
    showToast('Colors reset to defaults', 'info');
}

function applyThemeColors() {
    const c = APP.settings.colors || DEFAULT_COLORS;
    const root = document.documentElement;
    root.style.setProperty('--primary', c.primary);
    root.style.setProperty('--primary-dim', c.primary + '26');
    root.style.setProperty('--secondary', c.secondary);
    root.style.setProperty('--secondary-dim', c.secondary + '26');
    root.style.setProperty('--bg', c.bg);
    root.style.setProperty('--surface', c.surface);
    root.style.setProperty('--surface-hover', lighten(c.surface, 10));
    root.style.setProperty('--income', c.primary);
}

function lighten(hex, pct) {
    let r = parseInt(hex.slice(1, 3), 16);
    let g = parseInt(hex.slice(3, 5), 16);
    let b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + Math.round(pct * 2.55));
    g = Math.min(255, g + Math.round(pct * 2.55));
    b = Math.min(255, b + Math.round(pct * 2.55));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function updateColorPickers() {
    const c = APP.settings.colors || DEFAULT_COLORS;
    const el = (id) => document.getElementById(id);
    if (el('settingsColorPrimary')) el('settingsColorPrimary').value = c.primary;
    if (el('settingsColorSecondary')) el('settingsColorSecondary').value = c.secondary;
    if (el('settingsColorBg')) el('settingsColorBg').value = c.bg;
    if (el('settingsColorSurface')) el('settingsColorSurface').value = c.surface;
}

// ======== PATCH: Update renderTransactions to include actions ========
const _originalRenderTransactions = renderTransactions;
renderTransactions = function () {
    let txs = [...APP.transactions];
    const catFilter = document.getElementById('filterCategory').value;
    const typeFilter = document.getElementById('filterType').value;
    const monthFilter = document.getElementById('filterMonth').value;
    const search = document.getElementById('filterSearch').value.toLowerCase();

    if (catFilter) txs = txs.filter(t => t.category === catFilter);
    if (typeFilter) txs = txs.filter(t => t.type === typeFilter);
    if (monthFilter) txs = txs.filter(t => t.date && t.date.startsWith(monthFilter));
    if (search) txs = txs.filter(t => (t.description + t.category + t.merchant).toLowerCase().includes(search));

    txs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const totalPages = Math.max(1, Math.ceil(txs.length / APP.txPerPage));
    APP.txPage = Math.min(APP.txPage, totalPages);
    const start = (APP.txPage - 1) * APP.txPerPage;
    const pageData = txs.slice(start, start + APP.txPerPage);

    const tbody = document.getElementById('transactionsBody');
    if (pageData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No transactions found.</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(t => `<tr>
            <td>${t.date}</td>
            <td>${t.description.substring(0, 50)}</td>
            <td>${t.category}</td>
            <td><span class="type-badge type-${t.type}">${t.type}</span></td>
            <td class="text-right amount-${t.type}">${t.type === 'expense' ? '-' : '+'}${fmt(t.amount)}</td>
            <td>${t.merchant || '\u2014'}</td>
            <td class="text-center">
                <div class="action-btns">
                    <button class="action-btn" onclick="showEditTransactionModal('${t.id}')" title="Edit">\u270f\ufe0f</button>
                    <button class="action-btn delete" onclick="deleteTransaction('${t.id}')" title="Delete">\ud83d\uddd1\ufe0f</button>
                </div>
            </td>
        </tr>`).join('');
    }

    const pagination = document.getElementById('txPagination');
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = '';
    if (APP.txPage > 1) html += `<button class="page-btn" onclick="APP.txPage--;renderTransactions()">\u2039</button>`;
    for (let i = 1; i <= totalPages && i <= 7; i++) {
        html += `<button class="page-btn ${i === APP.txPage ? 'active' : ''}" onclick="APP.txPage=${i};renderTransactions()">${i}</button>`;
    }
    if (APP.txPage < totalPages) html += `<button class="page-btn" onclick="APP.txPage++;renderTransactions()">\u203a</button>`;
    pagination.innerHTML = html;
};

// ======== PATCH: Update renderBudgets to include edit button ========
const _originalRenderBudgets = renderBudgets;
renderBudgets = function () {
    const container = document.getElementById('budgetsList');
    if (APP.budgets.length === 0) {
        container.innerHTML = '<div class="empty-state">No budgets set. Add a category budget above!</div>';
        return;
    }

    const monthTxs = getMonthTransactions();
    const catSpend = getCategorySpend(monthTxs.filter(t => t.type === 'expense'));

    container.innerHTML = APP.budgets.map((b, i) => {
        const spent = catSpend[b.category] || 0;
        const pct = Math.min(100, Math.round((spent / b.limit) * 100));
        const status = pct > 100 ? 'over' : pct > 80 ? 'warning' : 'under';
        const statusText = pct > 100 ? `Over by ${fmt(spent - b.limit)}` : `${fmt(b.limit - spent)} remaining`;

        return `<div class="budget-card">
            <button class="budget-edit-btn" onclick="showEditBudgetModal(${i})" title="Edit">\u270f\ufe0f</button>
            <button class="budget-delete" onclick="deleteBudget(${i})" title="Delete">\u2715</button>
            <div class="budget-card-header">
                <span class="budget-category">${b.category}</span>
                <div class="budget-amounts">
                    <span class="budget-spent" style="color:var(--${status === 'under' ? 'primary' : status === 'warning' ? 'warning' : 'expense'})">${fmt(spent)}</span>
                    <span class="budget-limit"> / ${fmt(b.limit)}</span>
                </div>
            </div>
            <div class="budget-bar">
                <div class="budget-fill ${status}" style="width:${pct}%"></div>
            </div>
            <span class="budget-status ${status}">${statusText} (${pct}%)</span>
        </div>`;
    }).join('');
};

// ======== PATCH: Update renderDashboard to use custom alerts ========
const _originalRenderDashboard = renderDashboard;
renderDashboard = function () {
    const txs = APP.transactions;
    const monthTxs = getMonthTransactions();

    const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const net = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((net / totalIncome) * 100) : 0;

    document.getElementById('totalIncome').textContent = fmt(totalIncome);
    document.getElementById('totalExpenses').textContent = fmt(totalExpense);
    document.getElementById('netBalance').textContent = (net >= 0 ? '' : '-') + fmt(net);
    document.getElementById('netBalance').style.color = net >= 0 ? 'var(--income)' : 'var(--expense)';
    document.getElementById('savingsRate').textContent = savingsRate + '%';
    document.getElementById('savingsRate').style.color = savingsRate >= 20 ? 'var(--primary)' : savingsRate >= 0 ? 'var(--warning)' : 'var(--expense)';

    renderSpendingScore(monthTxs, totalIncome, totalExpense);
    renderCategoryDonut(monthTxs);
    renderIncomeExpenseBar();
    renderCustomAlerts();
    renderRecommendations(monthTxs, totalIncome, totalExpense);
    renderChallenge(monthTxs);
};

// ======== PATCH: Update saveState to include customAlerts ========
const _originalSaveState = saveState;
saveState = function () {
    try {
        localStorage.setItem('cashquest_data', JSON.stringify({
            transactions: APP.transactions,
            budgets: APP.budgets,
            uploads: APP.uploads,
            achievements: APP.achievements,
            settings: APP.settings,
            customAlerts: APP.customAlerts || []
        }));
    } catch (e) { console.error('Save error:', e); }
};

// ======== INIT: Apply colors on load ========
(function initEnhancements() {
    if (!APP.customAlerts) APP.customAlerts = [];
    applyThemeColors();
    updateColorPickers();
})();
