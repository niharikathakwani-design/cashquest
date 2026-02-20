/* =============================================
   CashQuest — Trends, Achievements, Data Mgmt
   ============================================= */

// ======== TRENDS PAGE ========
function renderTrends() {
    renderTrendLine();
    renderCategoryTrend();
}

function renderTrendLine() {
    const canvas = document.getElementById('trendLineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const months = getLastNMonths(6);
    const data = months.map(m => {
        const txs = getMonthTransactions(m);
        return {
            label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
            income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        };
    });

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
    const pad = { l: 70, r: 30, t: 30, b: 45 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.t + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillStyle = '#6B7280'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
        ctx.fillText(APP.settings.currency + Math.round(maxVal - (maxVal / 4) * i).toLocaleString(), pad.l - 8, y + 4);
    }

    // Draw lines
    const drawLine = (key, color) => {
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        data.forEach((d, i) => {
            const x = pad.l + (i / (data.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d[key] / maxVal) * ch;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Dots
        data.forEach((d, i) => {
            const x = pad.l + (i / (data.length - 1 || 1)) * cw;
            const y = pad.t + ch - (d[key] / maxVal) * ch;
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
            ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#1A1A2E'; ctx.fill();
        });
    };

    drawLine('income', '#00D09C');
    drawLine('expense', '#FF6B6B');

    // X labels
    data.forEach((d, i) => {
        const x = pad.l + (i / (data.length - 1 || 1)) * cw;
        ctx.fillStyle = '#9CA3AF'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
        ctx.fillText(d.label, x, h - 12);
    });

    // Legend
    ctx.font = '11px Inter';
    ctx.fillStyle = '#00D09C'; ctx.fillRect(pad.l, h - 12, 10, 10);
    ctx.fillStyle = '#9CA3AF'; ctx.fillText('Income', pad.l + 14, h - 3);
    ctx.fillStyle = '#FF6B6B'; ctx.fillRect(pad.l + 70, h - 12, 10, 10);
    ctx.fillStyle = '#9CA3AF'; ctx.fillText('Expenses', pad.l + 84, h - 3);
}

function renderCategoryTrend() {
    const canvas = document.getElementById('categoryTrendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const months = getLastNMonths(6);
    const allCats = new Set();
    const monthData = months.map(m => {
        const txs = getMonthTransactions(m).filter(t => t.type === 'expense');
        const cs = getCategorySpend(txs);
        Object.keys(cs).forEach(c => allCats.add(c));
        return { month: m, label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }), cats: cs };
    });

    const cats = [...allCats].slice(0, 6);
    if (cats.length === 0) {
        ctx.fillStyle = '#6B7280'; ctx.font = '14px Inter'; ctx.textAlign = 'center';
        ctx.fillText('No data available', w / 2, h / 2);
        return;
    }

    const maxVal = Math.max(1, ...monthData.flatMap(md => cats.map(c => md.cats[c] || 0)));
    const pad = { l: 70, r: 30, t: 30, b: 45 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.t + (ch / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillStyle = '#6B7280'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
        ctx.fillText(APP.settings.currency + Math.round(maxVal - (maxVal / 4) * i).toLocaleString(), pad.l - 8, y + 4);
    }

    cats.forEach((cat, ci) => {
        const color = CHART_COLORS[ci % CHART_COLORS.length];
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        monthData.forEach((md, i) => {
            const x = pad.l + (i / (monthData.length - 1 || 1)) * cw;
            const y = pad.t + ch - ((md.cats[cat] || 0) / maxVal) * ch;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    });

    // X labels
    monthData.forEach((md, i) => {
        const x = pad.l + (i / (monthData.length - 1 || 1)) * cw;
        ctx.fillStyle = '#9CA3AF'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
        ctx.fillText(md.label, x, h - 12);
    });

    // Legend
    let lx = pad.l;
    cats.forEach((cat, ci) => {
        ctx.fillStyle = CHART_COLORS[ci % CHART_COLORS.length]; ctx.fillRect(lx, h - 12, 8, 8);
        ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Inter'; ctx.textAlign = 'left';
        ctx.fillText(cat, lx + 11, h - 4);
        lx += ctx.measureText(cat).width + 22;
    });
}

// ======== ACHIEVEMENTS ========
const ALL_BADGES = [
    { id: 'budget_boss', emoji: '🏆', name: 'Budget Boss', desc: 'Under budget in all categories for a month' },
    { id: 'streak_7', emoji: '🔥', name: 'Streak Master', desc: '7+ uploads completed' },
    { id: 'saver', emoji: '💎', name: 'Savings Champion', desc: 'Saved >20% of income in a month' },
    { id: 'first_upload', emoji: '🚀', name: 'First Step', desc: 'Uploaded your first CSV' },
    { id: 'hundred_tx', emoji: '📊', name: 'Data Pro', desc: 'Logged 100+ transactions' },
    { id: 'budget_set', emoji: '🎯', name: 'Goal Setter', desc: 'Set your first budget' },
    { id: 'anomaly_found', emoji: '🕵️', name: 'Anomaly Hunter', desc: 'Had an anomaly detected' },
    { id: 'five_categories', emoji: '📂', name: 'Diversified', desc: 'Spending across 5+ categories' }
];

function checkBadges() {
    const monthTxs = getMonthTransactions();
    const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const cats = new Set(APP.transactions.map(t => t.category));

    const earned = new Set(APP.achievements.map(a => a.id));
    const earn = (id) => {
        if (!earned.has(id)) {
            APP.achievements.push({ id, date: new Date().toISOString() });
            showToast(`🏅 Badge earned: ${ALL_BADGES.find(b => b.id === id)?.name}!`, 'success');
        }
    };

    if (APP.uploads.length >= 1) earn('first_upload');
    if (APP.uploads.length >= 7) earn('streak_7');
    if (APP.transactions.length >= 100) earn('hundred_tx');
    if (APP.budgets.length >= 1) earn('budget_set');
    if (cats.size >= 5) earn('five_categories');
    if (income > 0 && (income - expense) / income > 0.2) earn('saver');
    if (APP.budgets.length > 0) {
        const catSpend = getCategorySpend(monthTxs.filter(t => t.type === 'expense'));
        const allUnder = APP.budgets.every(b => (catSpend[b.category] || 0) <= b.limit);
        if (allUnder) earn('budget_boss');
    }

    saveState();
}

function renderAchievements() {
    const earned = new Set(APP.achievements.map(a => a.id));
    const container = document.getElementById('badgesList');

    container.innerHTML = ALL_BADGES.map(b => {
        const isEarned = earned.has(b.id);
        const achv = APP.achievements.find(a => a.id === b.id);
        return `<div class="badge-card ${isEarned ? 'earned' : 'locked'}">
            <span class="badge-emoji">${b.emoji}</span>
            <div class="badge-name">${b.name}</div>
            <div class="badge-desc">${b.desc}</div>
            ${isEarned ? `<div class="badge-date">Earned ${new Date(achv.date).toLocaleDateString()}</div>` : ''}
        </div>`;
    }).join('');

    document.getElementById('uploadStreak').textContent = APP.uploads.length;
    renderSpendingScore(getMonthTransactions(),
        getMonthTransactions().filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        getMonthTransactions().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    );
}

// ======== DATA MANAGEMENT ========
function clearAllData() {
    if (!confirm('Are you sure you want to clear ALL transaction data? This cannot be undone!')) return;
    APP.transactions = [];
    APP.budgets = [];
    APP.uploads = [];
    APP.achievements = [];
    saveState();
    renderAll();
    showToast('All data cleared', 'warning');
}

function exportCSV() {
    if (APP.transactions.length === 0) { showToast('No transactions to export', 'warning'); return; }
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Merchant'];
    const rows = APP.transactions.map(t => [t.date, `"${t.description}"`, t.category, t.type, t.amount.toFixed(2), `"${t.merchant}"`]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cashquest_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('CSV exported!', 'success');
}

// ---- PWA Service Worker Registration ----
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { });
    });
}
