// =========================
// PELLET SALES HISTORY (US025)
// Delivered pellet orders + batch quality score (pelletFeedback) + payment status.
// The overall rating is computed by Store.manufacturerRating from the feedback.
// =========================

const MANUFACTURER = "GreenPellet Industries";

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("overallRating").innerHTML = Store.ratingHtml(MANUFACTURER);
    document.getElementById("searchInput").addEventListener("input", renderTable);
    renderKpis();
    renderTable();
});

function allSales() {
    return Store.get("pelletOrders")
        .filter(o => o.manufacturer === MANUFACTURER && o.status === "Delivered")
        .sort((a, b) => String(b.deliveredDate).localeCompare(String(a.deliveredDate)));
}

function feedbackByOrder() {
    const map = {};
    Store.get("pelletFeedback").forEach(f => { map[f.orderId] = f; });
    return map;
}

function tons(n) {
    return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " t";
}

function renderKpis() {
    const sales = allSales();
    const sum = list => list.reduce((s, o) => s + Number(o.total || 0), 0);

    document.getElementById("kpiOrders").textContent = sales.length;
    document.getElementById("kpiTons").textContent = tons(sales.reduce((s, o) => s + Number(o.quantity || 0), 0));
    document.getElementById("kpiRevenue").textContent = Store.inr(sum(sales));
    document.getElementById("kpiPending").textContent = Store.inr(sum(sales.filter(o => o.paymentStatus !== "Paid")));
}

function scoreHtml(fb) {
    if (!fb) return `<span class="text-subtle">Not submitted yet</span>`;
    return `<span class="rating" title="${Store.esc(fb.remarks || "")}"><i class="fa-solid fa-star"></i> ${Number(fb.score).toFixed(1)} <small>/ 5</small></span>`;
}

function paymentHtml(o) {
    const status = o.paymentStatus || "Pending";
    return Store.statusBadge(status) +
        (status === "Paid" && o.paidOn ? `<small class="cell-note">${Store.date(o.paidOn)}</small>` : "");
}

function renderTable() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const all = allSales();
    const rows = all.filter(o =>
        !search || [o.id, o.powerPlant, o.pelletType, o.grade].join(" ").toLowerCase().includes(search));
    const feedback = feedbackByOrder();

    document.getElementById("resultCount").textContent =
        (search ? rows.length + " of " + all.length : all.length) + (all.length === 1 ? " sale" : " sales");

    const table = document.getElementById("salesTable");

    if (!rows.length) {
        table.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-chart-line"></i>${search ? "No sales match your search." : "No delivered pellet orders yet."}</div></td></tr>`;
        return;
    }

    table.innerHTML = rows.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.powerPlant)}</td>
            <td>${Store.esc(o.pelletType)}<small class="cell-note">${Store.esc(o.grade)}</small></td>
            <td>${tons(o.quantity)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td>${scoreHtml(feedback[o.id])}</td>
            <td>${paymentHtml(o)}</td>
        </tr>
    `).join("");
}
