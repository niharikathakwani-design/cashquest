/* =============================================
   CashQuest — Dashboard, Charts & Rendering
   ============================================= */

// ---- Color Palette for Charts ----
const CHART_COLORS = [
    '#00D09C', '#6C5CE7', '#FF6B6B', '#FFD93D', '#60A5FA',
    '#F472B6', '#34D399', '#FB923C', '#A78BFA', '#38BDF8',
    '#E879F9', '#FCA5A5', '#86EFAC', '#FDE68A', '#67E8F9'
];

// ======== DASHBOARD ========
function renderDashboard() {
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
    renderAnomalies(monthTxs);
    renderRecommendations(monthTxs, totalIncome, totalExpense);
    renderChallenge(monthTxs);
}

// ---- Spending Score ----
function renderSpendingScore(monthTxs, income, expense) {
    let score = 50; // base
    if (APP.transactions.length === 0) {
        updateScoreUI(0);
        return;
    }

    const ratio = income > 0 ? (income - expense) / income : 0;
    score += Math.round(ratio * 30);

    // Budget adherence
    if (APP.budgets.length > 0) {
        const catSpend = getCategorySpend(monthTxs);
        let adherent = 0;
        APP.budgets.forEach(b => {
            if ((catSpend[b.category] || 0) <= b.limit) adherent++;
        });
        score += Math.round((adherent / APP.budgets.length) * 20);
    }

    // Trend: improving vs last month?
    const lastMonth = getPrevMonth(getCurrentMonth());
    const lastTxs = getMonthTransactions(lastMonth);
    const lastExpense = lastTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    if (lastExpense > 0 && expense < lastExpense) score += 10;
    else if (lastExpense > 0 && expense > lastExpense * 1.1) score -= 10;

    score = Math.max(0, Math.min(100, score));
    updateScoreUI(score);
}

function updateScoreUI(score) {
    const color = score >= 80 ? 'var(--primary)' : score >= 50 ? 'var(--warning)' : 'var(--expense)';
    const tier = score >= 80 ? '🟢 Financial Rockstar' : score >= 50 ? '🟡 On Track' : '🔴 Needs Attention';

    ['scoreArc', 'scoreArcLarge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.setAttribute('stroke-dasharray', `${score}, 100`); el.style.stroke = color; }
    });
    ['scoreValue', 'scoreValueLarge'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = score;
    });
    const tierEl = document.getElementById('scoreTier');
    if (tierEl) tierEl.textContent = tier;
}

// ---- Category Donut Chart ----
function renderCategoryDonut(monthTxs) {
    const canvas = document.getElementById('categoryDonut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const expenses = monthTxs.filter(t => t.type === 'expense');
    const catSpend = getCategorySpend(expenses);
    const cats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]);
    const total = cats.reduce((s, c) => s + c[1], 0);

    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 20, inner = r * 0.6;
    ctx.clearRect(0, 0, w, h);

    if (cats.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.arc(cx, cy, inner, 0, Math.PI * 2, true); ctx.fill();
        ctx.fillStyle = '#6B7280'; ctx.font = '14px Inter'; ctx.textAlign = 'center';
        ctx.fillText('No data yet', cx, cy);
        document.getElementById('categoryLegend').innerHTML = '';
        return;
    }

    let angle = -Math.PI / 2;
    cats.forEach(([cat, amt], i) => {
        const sweep = (amt / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, angle, angle + sweep);
        ctx.arc(cx, cy, inner, angle + sweep, angle, true);
        ctx.closePath();
        ctx.fillStyle = CHART_COLORS[i % CHART_COLORS.length];
        ctx.fill();
        angle += sweep;
    });

    // Center text
    ctx.fillStyle = '#E8E8E8'; ctx.font = 'bold 18px Inter'; ctx.textAlign = 'center';
    ctx.fillText(fmt(total), cx, cy - 4);
    ctx.fillStyle = '#9CA3AF'; ctx.font = '11px Inter';
    ctx.fillText('Total Spent', cx, cy + 14);

    // Legend
    const legend = document.getElementById('categoryLegend');
    legend.innerHTML = cats.map(([cat, amt], i) => `
        <div class="legend-item">
            <span class="legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span>
            ${cat} (${Math.round(amt / total * 100)}%)
        </div>
    `).join('');
}

// ---- Income vs Expense Bar Chart ----
function renderIncomeExpenseBar() {
    const canvas = document.getElementById('incomeExpenseBar');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const months = getLastNMonths(6);
    const data = months.map(m => {
        const txs = getMonthTransactions(m);
        return {
            month: m,
            label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short' }),
            income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
            expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        };
    });

    const maxVal = Math.max(1, ...data.map(d => Math.max(d.income, d.expense)));
    const chartLeft = 60, chartRight = 20, chartTop = 20, chartBottom = 40;
    const chartW = w - chartLeft - chartRight;
    const chartH = h - chartTop - chartBottom;
    const barGroupW = chartW / data.length;
    const barW = barGroupW * 0.3;
    const gap = 4;

    // Y-axis
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = chartTop + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(chartLeft, y); ctx.lineTo(w - chartRight, y); ctx.stroke();
        const val = maxVal - (maxVal / 4) * i;
        ctx.fillStyle = '#6B7280'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
        ctx.fillText(APP.settings.currency + Math.round(val).toLocaleString(), chartLeft - 8, y + 4);
    }

    data.forEach((d, i) => {
        const x = chartLeft + i * barGroupW + barGroupW / 2;
        const incH = (d.income / maxVal) * chartH;
        const expH = (d.expense / maxVal) * chartH;

        // Income bar
        ctx.fillStyle = '#00D09C';
        roundRect(ctx, x - barW - gap / 2, chartTop + chartH - incH, barW, incH, 4);
        // Expense bar
        ctx.fillStyle = '#FF6B6B';
        roundRect(ctx, x + gap / 2, chartTop + chartH - expH, barW, expH, 4);

        // Label
        ctx.fillStyle = '#9CA3AF'; ctx.font = '11px Inter'; ctx.textAlign = 'center';
        ctx.fillText(d.label, x, h - 12);
    });

    // Simple legend
    ctx.font = '10px Inter';
    ctx.fillStyle = '#00D09C'; ctx.fillRect(chartLeft, h - 12, 8, 8);
    ctx.fillStyle = '#9CA3AF'; ctx.fillText('Income', chartLeft + 12, h - 4);
    ctx.fillStyle = '#FF6B6B'; ctx.fillRect(chartLeft + 60, h - 12, 8, 8);
    ctx.fillStyle = '#9CA3AF'; ctx.fillText('Expenses', chartLeft + 72, h - 4);
}

function roundRect(ctx, x, y, w, h, r) {
    if (h <= 0) return;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
}

// ---- Anomaly Detection ----
function renderAnomalies(monthTxs) {
    const container = document.getElementById('anomalyAlerts');
    const expenses = monthTxs.filter(t => t.type === 'expense');
    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state">No anomalies detected. Upload a CSV to get started!</div>';
        return;
    }

    const amounts = expenses.map(t => t.amount);
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((s, a) => s + Math.pow(a - mean, 2), 0) / amounts.length);
    const threshold = mean + 2 * stdDev;

    const anomalies = expenses.filter(t => t.amount > threshold && t.amount > 100).slice(0, 5);

    if (anomalies.length === 0) {
        container.innerHTML = '<div class="empty-state" style="color:var(--primary)">✅ No anomalies this month!</div>';
        return;
    }

    container.innerHTML = anomalies.map(t => `
        <div class="alert-card">
            <span class="alert-icon">🚨</span>
            <div class="alert-content">
                <div class="alert-title">${t.description.substring(0, 40)}</div>
                <div class="alert-desc">${fmt(t.amount)} on ${t.date} — ${Math.round(t.amount / mean)}x your average spend</div>
            </div>
        </div>
    `).join('');
}

// ---- Recommendations Engine ----
function renderRecommendations(monthTxs, income, expense) {
    const container = document.getElementById('recommendations');
    const recs = [];
    const catSpend = getCategorySpend(monthTxs.filter(t => t.type === 'expense'));
    const total = Object.values(catSpend).reduce((s, v) => s + v, 0);

    // Compare with last month
    const lastMonth = getPrevMonth(getCurrentMonth());
    const lastTxs = getMonthTransactions(lastMonth);
    const lastCatSpend = getCategorySpend(lastTxs.filter(t => t.type === 'expense'));

    Object.entries(catSpend).forEach(([cat, amt]) => {
        const lastAmt = lastCatSpend[cat] || 0;
        const pct = lastAmt > 0 ? ((amt - lastAmt) / lastAmt) * 100 : 0;
        if (pct > 25 && lastAmt > 0) {
            recs.push({ icon: '⚠️', title: `${cat} spending up ${Math.round(pct)}%`, desc: `${fmt(amt)} this month vs ${fmt(lastAmt)} last month. Review recent charges.`, priority: pct });
        }
        if (total > 0 && (amt / total) > 0.35) {
            recs.push({ icon: '🎯', title: `${cat} is ${Math.round(amt / total * 100)}% of spending`, desc: `Consider if any ${cat.toLowerCase()} costs are reducible.`, priority: 50 });
        }
    });

    // Income vs Expense
    if (income > 0 && expense > income) {
        recs.push({ icon: '🚨', title: 'Spending exceeds income!', desc: `You've spent ${fmt(expense)} against ${fmt(income)} income. Time to reassess.`, priority: 100 });
    }

    // Under budget opportunities
    APP.budgets.forEach(b => {
        const spent = catSpend[b.category] || 0;
        const remaining = b.limit - spent;
        if (remaining > 50 && remaining > b.limit * 0.3) {
            recs.push({ icon: '🌟', title: `${fmt(remaining)} under ${b.category} budget`, desc: `Consider moving the surplus to savings!`, priority: 20 });
        }
    });

    // Recurring detection
    const descCounts = {};
    monthTxs.filter(t => t.type === 'expense').forEach(t => {
        const key = t.description.toLowerCase().substring(0, 20);
        descCounts[key] = (descCounts[key] || { count: 0, total: 0 });
        descCounts[key].count++;
        descCounts[key].total += t.amount;
    });
    const recurring = Object.entries(descCounts).filter(([_, v]) => v.count >= 2 && v.total > 30);
    if (recurring.length > 0) {
        const totalRec = recurring.reduce((s, [_, v]) => s + v.total, 0);
        recs.push({ icon: '💡', title: `${recurring.length} recurring charges found`, desc: `Totaling ${fmt(totalRec)} this month. Review if all are needed.`, priority: 40 });
    }

    recs.sort((a, b) => b.priority - a.priority);

    if (recs.length === 0) {
        container.innerHTML = '<div class="empty-state">Upload your first CSV to get personalized tips!</div>';
        return;
    }

    container.innerHTML = recs.slice(0, 5).map(r => `
        <div class="recommendation-card">
            <span class="rec-icon">${r.icon}</span>
            <div class="rec-content">
                <div class="rec-title">${r.title}</div>
                <div class="rec-desc">${r.desc}</div>
            </div>
        </div>
    `).join('');
}

// ---- Challenge ----
function renderChallenge(monthTxs) {
    const card = document.getElementById('challengeCard');
    if (APP.budgets.length === 0) { card.style.display = 'none'; return; }

    const topBudget = APP.budgets[0];
    const catSpend = getCategorySpend(monthTxs.filter(t => t.type === 'expense'));
    const spent = catSpend[topBudget.category] || 0;
    const pct = Math.min(100, Math.round((spent / topBudget.limit) * 100));

    card.style.display = 'block';
    document.getElementById('challengeTitle').textContent = `Stay under ${fmt(topBudget.limit)} in ${topBudget.category}`;
    document.getElementById('challengeFill').style.width = pct + '%';
    document.getElementById('challengePct').textContent = pct + '%';
    document.getElementById('challengeDesc').textContent = `${fmt(spent)} spent of ${fmt(topBudget.limit)} budget — ${pct <= 100 ? fmt(topBudget.limit - spent) + ' remaining' : 'Over budget!'}`;
}

// ======== TRANSACTIONS PAGE ========
function renderTransactions() {
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
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No transactions found.</td></tr>';
    } else {
        tbody.innerHTML = pageData.map(t => `<tr>
            <td>${t.date}</td>
            <td>${t.description.substring(0, 50)}</td>
            <td>${t.category}</td>
            <td><span class="type-badge type-${t.type}">${t.type}</span></td>
            <td class="text-right amount-${t.type}">${t.type === 'expense' ? '-' : '+'}${fmt(t.amount)}</td>
            <td>${t.merchant || '—'}</td>
        </tr>`).join('');
    }

    // Pagination
    const pagination = document.getElementById('txPagination');
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }
    let html = '';
    if (APP.txPage > 1) html += `<button class="page-btn" onclick="APP.txPage--;renderTransactions()">‹</button>`;
    for (let i = 1; i <= totalPages && i <= 7; i++) {
        html += `<button class="page-btn ${i === APP.txPage ? 'active' : ''}" onclick="APP.txPage=${i};renderTransactions()">${i}</button>`;
    }
    if (APP.txPage < totalPages) html += `<button class="page-btn" onclick="APP.txPage++;renderTransactions()">›</button>`;
    pagination.innerHTML = html;
}

// ======== BUDGETS PAGE ========
function renderBudgets() {
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
            <button class="budget-delete" onclick="deleteBudget(${i})">✕</button>
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
}

function addBudget() {
    const cat = document.getElementById('budgetCategory').value;
    const limit = parseFloat(document.getElementById('budgetAmount').value);
    if (!cat) { showToast('Select a category', 'warning'); return; }
    if (!limit || limit <= 0) { showToast('Enter a valid amount', 'warning'); return; }
    if (APP.budgets.find(b => b.category === cat)) { showToast('Budget already exists for ' + cat, 'warning'); return; }

    APP.budgets.push({ category: cat, limit: limit });
    saveState();
    renderBudgets();
    document.getElementById('budgetCategory').value = '';
    document.getElementById('budgetAmount').value = '';
    showToast(`Budget set: ${fmt(limit)} for ${cat}`, 'success');
}

function deleteBudget(idx) {
    APP.budgets.splice(idx, 1);
    saveState();
    renderBudgets();
    showToast('Budget removed', 'info');
}

// ======== UPLOAD HISTORY ========
function renderUploadHistory() {
    const container = document.getElementById('uploadHistoryList');
    if (APP.uploads.length === 0) {
        container.innerHTML = '<div class="empty-state">No uploads yet.</div>';
        return;
    }
    container.innerHTML = APP.uploads.slice().reverse().map(u => `
        <div class="upload-history-item">
            <span>📤 ${u.count} transactions imported${u.dupes ? ` (${u.dupes} dupes skipped)` : ''}</span>
            <span class="upload-date">${new Date(u.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `).join('');
}

// ======== HELPERS ========
function getCategorySpend(txs) {
    const map = {};
    (txs || []).forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
}

function getLastNMonths(n) {
    const months = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    return months;
}

function getPrevMonth(ym) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
