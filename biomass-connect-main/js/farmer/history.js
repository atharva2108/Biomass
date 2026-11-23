// =========================
// FARMER — ORDER HISTORY (US013)
// Delivered orders with a date-range filter and sales summary
// =========================

let currentRows = [];

document.addEventListener("DOMContentLoaded", () => {

    const from = document.getElementById("fromDate");
    const to = document.getElementById("toDate");

    document.getElementById("searchInput").addEventListener("input", render);

    // re-filter as soon as the date range is valid
    [from, to].forEach(el => el.addEventListener("change", () => {
        const ok = Validator.validateField(from) & Validator.validateField(to);
        if (ok) render();
    }));

    document.getElementById("filterForm").addEventListener("submit", e => {
        e.preventDefault();
        if (!Validator.validateForm("#filterForm")) return;
        render();
        const range = rangeText();
        showToast("Showing " + currentRows.length + " order" + (currentRows.length === 1 ? "" : "s") + (range ? " " + range : ""), "info");
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
        document.getElementById("filterForm").reset();
        Validator.reset("#filterForm");
        // refresh picker bounds now that the linked dates are empty
        from.dispatchEvent(new Event("change"));
        to.dispatchEvent(new Event("change"));
        Validator.reset("#filterForm");
        render();
        showToast("Filters cleared", "info");
    });

    render();
});

/* ---------- Data ---------- */

function deliveredOrders() {
    return Farmer.orders().filter(o => o.status === "Delivered");
}

function rangeText() {
    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;
    if (from && to) return "from " + Store.date(from) + " to " + Store.date(to);
    if (from) return "from " + Store.date(from);
    if (to) return "up to " + Store.date(to);
    return "";
}

function filteredOrders() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;

    return deliveredOrders()
        .filter(o =>
            (!from || o.orderDate >= from) &&
            (!to || o.orderDate <= to) &&
            (!q || [o.id, o.manufacturer, o.biomassType].join(" ").toLowerCase().includes(q)))
        .sort((a, b) => String(b.deliveredDate || "").localeCompare(String(a.deliveredDate || "")));
}

/* ---------- Rendering ---------- */

function render() {
    currentRows = filteredOrders();
    renderKpis(currentRows);

    const range = rangeText();
    document.getElementById("resultCount").textContent =
        currentRows.length + " order" + (currentRows.length === 1 ? "" : "s") + (range ? " · " + range : "");

    const table = document.getElementById("historyTable");

    if (!currentRows.length) {
        table.innerHTML = Farmer.emptyRow(9, "fa-clock-rotate-left",
            deliveredOrders().length ? "No orders match the selected filters." : "No delivered orders yet. They will appear here once delivered.");
        return;
    }

    table.innerHTML = currentRows.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Farmer.tons(o.quantity)}</td>
            <td>${Store.inr(o.price)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td>${Store.statusBadge(o.paymentStatus || "Pending")}</td>
        </tr>`).join("");
}

function renderKpis(rows) {
    const tons = rows.reduce((s, o) => s + Number(o.quantity || 0), 0);
    const revenue = rows.reduce((s, o) => s + Number(o.total || 0), 0);

    document.getElementById("kpiOrders").textContent = rows.length;
    document.getElementById("kpiTons").textContent = tons.toLocaleString("en-IN", { maximumFractionDigits: 2 });
    document.getElementById("kpiRevenue").textContent = Store.inr(revenue);
    document.getElementById("kpiAvg").textContent = tons ? Store.inr(Math.round(revenue / tons)) : "₹0";
}
