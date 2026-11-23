// =========================
// ADMIN — REPORTS & MONITORING (US044)
// Read-only report built from the shared order and batch feedback data.
// =========================

const CHART_MONTHS = 6;

document.addEventListener("DOMContentLoaded", () => {

    const orders = Admin.allOrders();

    renderKpis(orders);
    renderChart(orders);
    renderStatus(orders);
    renderRatings(orders);

    document.getElementById("chartMetric").addEventListener("change", () => renderChart(orders));
});

/* ---------- helpers ---------- */

function tons(n) {
    return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " t";
}

function sum(list, fn) {
    return list.reduce((s, o) => s + Number(fn(o) || 0), 0);
}

function isDelivered(o) {
    return o.status === "Delivered";
}

function monthKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function monthLabel(key, short) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", short ? { month: "short" } : { month: "short", year: "numeric" });
}

function lastMonths(n) {
    const months = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < n; i++) {
        months.unshift(monthKey(d));
        d.setMonth(d.getMonth() - 1);
    }
    return months;
}

/* ---------- KPIs ---------- */

function renderKpis(orders) {
    const delivered = orders.filter(isDelivered);

    document.getElementById("kpiBiomass").textContent = tons(sum(delivered.filter(o => o.type === "Biomass"), o => o.quantity));
    document.getElementById("kpiPellets").textContent = tons(sum(delivered.filter(o => o.type === "Pellet"), o => o.quantity));
    document.getElementById("kpiPaid").textContent = Store.inr(sum(orders.filter(o => o.paymentStatus === "Paid"), o => o.total));
    document.getElementById("kpiPending").textContent = Store.inr(sum(delivered.filter(o => o.paymentStatus !== "Paid"), o => o.total));
}

/* ---------- monthly deliveries chart ---------- */

function renderChart(orders) {
    const type = document.getElementById("chartMetric").value;
    const months = lastMonths(CHART_MONTHS);
    const delivered = orders.filter(o => isDelivered(o) && o.type === type);
    const values = months.map(mo => sum(delivered.filter(o => String(o.deliveredDate || o.orderDate).slice(0, 7) === mo), o => o.quantity));
    const max = Math.max(...values, 0);

    document.getElementById("chartSubtitle").textContent =
        monthLabel(months[0]) + " – " + monthLabel(months[months.length - 1]) + " · by delivery month";

    document.getElementById("barChart").innerHTML = months.map((mo, i) => {
        const pct = max ? Math.max(Math.round(values[i] / max * 100), 2) : 2;
        const label = Number(values[i]).toLocaleString("en-IN", { maximumFractionDigits: 0 });
        return `<div class="bar${i === months.length - 1 ? " accent" : ""}" style="height:${pct}%" title="${monthLabel(mo)}: ${label} t">
                    <b>${values[i] ? label : ""}</b><span>${monthLabel(mo, true)}</span>
                </div>`;
    }).join("");
}

/* ---------- orders by status ---------- */

function renderStatus(orders) {
    const total = orders.length || 1;

    document.getElementById("statusList").innerHTML = Store.ORDER_STEPS.map(step => {
        const n = orders.filter(o => o.status === step).length;
        return `
            <div>
                <div class="status-row">
                    <span class="text-muted">${Store.esc(step)}</span>
                    <strong>${n}</strong>
                </div>
                <div class="progress"><span style="width:${Math.round(n / total * 100)}%"></span></div>
            </div>`;
    }).join("");
}

/* ---------- manufacturer quality ---------- */

function renderRatings(orders) {
    const pellet = orders.filter(o => o.type === "Pellet");
    const names = [...new Set(
        Admin.get("admin_users").filter(u => u.role === "Manufacturer" && u.status === "Active").map(u => u.name)
            .concat(pellet.map(o => o.seller))
    )].filter(Boolean);

    const rows = names.map(name => {
        const own = pellet.filter(o => o.seller === name);
        return {
            name,
            orders: own.length,
            delivered: sum(own.filter(isDelivered), o => o.quantity),
            score: Store.manufacturerRating(name).score
        };
    }).sort((a, b) => (b.score || 0) - (a.score || 0) || b.orders - a.orders || a.name.localeCompare(b.name));

    const table = document.getElementById("ratingTable");

    if (!rows.length) {
        table.innerHTML = `<tr><td colspan="4"><div class="empty-state"><i class="fa-solid fa-industry"></i>No manufacturers yet</div></td></tr>`;
        return;
    }

    table.innerHTML = rows.map(r => `
        <tr>
            <td class="fw-600">${Store.esc(r.name)}</td>
            <td>${r.orders}</td>
            <td>${tons(r.delivered)}</td>
            <td>${Store.ratingHtml(r.name)}</td>
        </tr>
    `).join("");
}
