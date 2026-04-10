/* =============================================
   CashQuest — Core Application Logic
   ============================================= */

// ---- State ----
const APP = {
    transactions: [],
    budgets: [],
    uploads: [],
    achievements: [],
    settings: {
        userName: 'Nia',
        partnerName: 'Vivek',
        householdName: 'Thakwani Household',
        currency: '$'
    },
    currentPage: 'dashboard',
    txPage: 1,
    txPerPage: 20
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initUploadZone();
    renderAll();
    updateSettingsUI();
    const now = new Date();
    document.getElementById('dashboardDate').textContent = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
});

// ---- Persistence ----
function loadState() {
    try {
        const saved = localStorage.getItem('cashquest_data');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(APP, { ...APP, ...data });
        }
    } catch(e) { console.error('Load error:', e); }
}

function saveState() {
    try {
        localStorage.setItem('cashquest_data', JSON.stringify({
            transactions: APP.transactions,
            budgets: APP.budgets,
            uploads: APP.uploads,
            achievements: APP.achievements,
            settings: APP.settings
        }));
    } catch(e) { console.error('Save error:', e); }
}

// ---- Navigation ----
function navigateTo(page) {
    APP.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelector(`[data-page="${page}"]`).classList.add('active');
    if (page === 'dashboard') renderDashboard();
    if (page === 'transactions') renderTransactions();
    if (page === 'budgets') renderBudgets();
    if (page === 'trends') renderTrends();
    if (page === 'achievements') renderAchievements();
    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('active');
}

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.querySelector('.sidebar-overlay').classList.toggle('active');
}

// ---- Settings ----
function saveSetting(key, value) {
    APP.settings[key] = value;
    saveState();
    applySettings();
    showToast('Setting saved!', 'success');
}

function applySettings() {
    document.getElementById('greetingName').textContent = APP.settings.userName;
    document.getElementById('userName').textContent = APP.settings.userName;
    document.getElementById('userAvatar').textContent = APP.settings.userName[0].toUpperCase();
    document.getElementById('userAvatarMobile').textContent = APP.settings.userName[0].toUpperCase();
    const hh = document.querySelector('.user-household');
    if (hh) hh.textContent = '🏠 ' + APP.settings.householdName;
}

function updateSettingsUI() {
    document.getElementById('settingsName').value = APP.settings.userName;
    document.getElementById('settingsPartner').value = APP.settings.partnerName;
    document.getElementById('settingsHousehold').value = APP.settings.householdName;
    document.getElementById('settingsCurrency').value = APP.settings.currency;
    applySettings();
}

// ---- Toast ----
function showToast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ---- CSV Upload ----
let pendingCSVData = [];

function initUploadZone() {
    const zone = document.getElementById('uploadZone');
    const input = document.getElementById('csvFileInput');

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) parseCSVFile(file);
        else showToast('Please upload a .csv file', 'error');
    });
    input.addEventListener('change', e => {
        if (e.target.files[0]) parseCSVFile(e.target.files[0]);
    });
}

function parseCSVFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { showToast('CSV is empty or has no data rows', 'error'); return; }

        const headers = parseCSVLine(lines[0]);
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            if (vals.length >= 2) {
                const row = {};
                headers.forEach((h, idx) => row[h.trim()] = (vals[idx] || '').trim());
                rows.push(row);
            }
        }

        pendingCSVData = mapBankColumns(rows, headers);
        showPreview(headers, rows, pendingCSVData);
    };
    reader.readAsText(file);
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
        else { current += ch; }
    }
    result.push(current);
    return result;
}

function mapBankColumns(rows, headers) {
    // Auto-detect columns from Canadian bank CSV format
    const hLower = headers.map(h => h.trim().toLowerCase());
    const find = (...keywords) => {
        for (const kw of keywords) {
            const idx = hLower.findIndex(h => h.includes(kw));
            if (idx >= 0) return headers[idx].trim();
        }
        return null;
    };

    const dateCol = find('transactiondate', 'transaction date', 'posted', 'date');
    const descCol = find('description', 'desc', 'memo', 'details', 'narrative');
    const debitCol = find('debit');
    const creditCol = find('credit');
    const amountCol = find('amount');
    const catCol = find('category', 'cat');
    const merchantCol = find('merchant', 'payee');
    const memoCol = find('memo');
    const typeCol = find('transactiontype', 'transaction type', 'type');

    return rows.map(row => {
        let amount = 0;
        let txType = 'expense';

        if (debitCol && creditCol) {
            const debit = parseFloat((row[debitCol] || '').replace(/[^0-9.\-]/g, '')) || 0;
            const credit = parseFloat((row[creditCol] || '').replace(/[^0-9.\-]/g, '')) || 0;
            if (credit > 0) { amount = credit; txType = 'income'; }
            else { amount = Math.abs(debit); txType = 'expense'; }
        } else if (amountCol) {
            amount = parseFloat((row[amountCol] || '').replace(/[^0-9.\-]/g, '')) || 0;
            txType = amount >= 0 ? 'income' : 'expense';
            amount = Math.abs(amount);
        }

        let category = (catCol && row[catCol]) ? row[catCol] : guessCategory(row[descCol] || '', row[memoCol] || '');
        let description = (descCol ? row[descCol] : '') || '';
        if (memoCol && row[memoCol] && row[memoCol] !== description) {
            description += (description ? ' — ' : '') + row[memoCol];
        }

        return {
            id: generateId(),
            date: parseDate(dateCol ? row[dateCol] : ''),
            description: description,
            amount: amount,
            category: category,
            type: txType,
            merchant: merchantCol ? (row[merchantCol] || '') : '',
            raw: row
        };
    }).filter(t => t.amount > 0);
}

function parseDate(str) {
    if (!str) return new Date().toISOString().split('T')[0];
    // Try common formats
    const d = new Date(str);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
    // Try DD/MM/YYYY
    const parts = str.split(/[\/\-\.]/);
    if (parts.length === 3) {
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        return `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    }
    return str;
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function guessCategory(desc, memo) {
    const text = (desc + ' ' + memo).toLowerCase();
    const rules = [
        [['grocery', 'supermarket', 'walmart', 'costco', 'loblaws', 'no frills', 'metro', 'food basics', 'sobeys'], 'Groceries'],
        [['restaurant', 'dining', 'uber eats', 'doordash', 'skip', 'mcdonald', 'starbucks', 'tim horton', 'coffee'], 'Dining'],
        [['gas', 'fuel', 'shell', 'esso', 'petro', 'petroleum'], 'Transportation'],
        [['uber', 'lyft', 'taxi', 'transit', 'presto', 'parking'], 'Transportation'],
        [['netflix', 'spotify', 'amazon prime', 'disney', 'apple', 'subscription', 'youtube'], 'Subscriptions'],
        [['hydro', 'electric', 'water', 'gas bill', 'utility', 'enbridge', 'internet', 'phone', 'mobile', 'bell', 'rogers', 'telus'], 'Utilities'],
        [['rent', 'mortgage', 'property', 'condo'], 'Housing'],
        [['insurance', 'life insurance', 'home insurance', 'car insurance'], 'Insurance'],
        [['pharmacy', 'drug', 'shoppers', 'medical', 'doctor', 'dental', 'health'], 'Health'],
        [['gym', 'fitness', 'sport'], 'Fitness'],
        [['clothing', 'apparel', 'shoes', 'fashion', 'zara', 'h&m', 'winners'], 'Shopping'],
        [['amazon', 'online', 'ebay', 'shop'], 'Shopping'],
        [['transfer', 'e-transfer', 'interac', 'etransfer'], 'Transfer'],
        [['salary', 'payroll', 'deposit', 'income'], 'Income'],
        [['interest', 'dividend'], 'Interest'],
        [['atm', 'withdrawal', 'cash'], 'Cash'],
        [['entertainment', 'movie', 'theatre', 'concert', 'ticket'], 'Entertainment'],
        [['travel', 'hotel', 'flight', 'airbnb', 'booking', 'airline', 'air canada'], 'Travel'],
        [['education', 'tuition', 'course', 'book', 'school'], 'Education'],
        [['childcare', 'daycare', 'baby', 'kids'], 'Childcare'],
        [['pet', 'vet', 'veterinary'], 'Pets']
    ];
    for (const [keywords, cat] of rules) {
        if (keywords.some(kw => text.includes(kw))) return cat;
    }
    return 'Other';
}

function showPreview(headers, rawRows, mapped) {
    document.getElementById('uploadPreview').style.display = 'block';
    document.getElementById('previewCount').textContent = `(${mapped.length} transactions)`;

    const thead = document.getElementById('previewHead');
    thead.innerHTML = '<tr>' + ['Date','Description','Category','Type','Amount'].map(h => `<th>${h}</th>`).join('') + '</tr>';

    const tbody = document.getElementById('previewBody');
    const preview = mapped.slice(0, 10);
    tbody.innerHTML = preview.map(t => `<tr>
        <td>${t.date}</td>
        <td>${t.description.substring(0, 50)}</td>
        <td>${t.category}</td>
        <td><span class="type-badge type-${t.type}">${t.type}</span></td>
        <td class="text-right amount-${t.type}">${APP.settings.currency}${t.amount.toFixed(2)}</td>
    </tr>`).join('');

    if (mapped.length > 10) {
        tbody.innerHTML += `<tr><td colspan="5" class="empty-state">...and ${mapped.length - 10} more</td></tr>`;
    }
}

function cancelUpload() {
    pendingCSVData = [];
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
}

function confirmUpload() {
    if (!pendingCSVData.length) return;
    // Deduplicate
    const existing = new Set(APP.transactions.map(t => `${t.date}_${t.amount}_${t.description}`));
    const newTx = pendingCSVData.filter(t => !existing.has(`${t.date}_${t.amount}_${t.description}`));
    const dupes = pendingCSVData.length - newTx.length;

    APP.transactions.push(...newTx);
    APP.uploads.push({
        date: new Date().toISOString(),
        count: newTx.length,
        dupes: dupes
    });

    saveState();
    cancelUpload();
    renderUploadHistory();
    updateCategoryFilters();
    checkBadges();

    showToast(`✅ Imported ${newTx.length} transactions!${dupes ? ` (${dupes} duplicates skipped)` : ''}`, 'success');
}

// ---- Render All ----
function renderAll() {
    applySettings();
    updateCategoryFilters();
    renderDashboard();
    renderUploadHistory();
    renderBudgets();
    renderAchievements();
}

// ---- Category Filters ----
function updateCategoryFilters() {
    const cats = [...new Set(APP.transactions.map(t => t.category))].sort();
    const selects = [document.getElementById('filterCategory'), document.getElementById('budgetCategory')];
    selects.forEach(sel => {
        if (!sel) return;
        const val = sel.value;
        const isFilter = sel.id === 'filterCategory';
        sel.innerHTML = isFilter ? '<option value="">All Categories</option>' : '<option value="">Select Category</option>';
        cats.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
        sel.value = val;
    });
}

// ---- Format Helpers ----
function fmt(n) {
    return APP.settings.currency + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getMonthTransactions(month) {
    // month: 'YYYY-MM' or null for current
    if (!month) {
        const now = new Date();
        month = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    return APP.transactions.filter(t => t.date && t.date.startsWith(month));
}

function getCurrentMonth() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}
