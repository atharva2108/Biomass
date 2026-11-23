// =========================
// PURCHASE HISTORY (US019) — delivered purchase orders
// =========================

const MANUFACTURER = "GreenPellet Industries";

let range = { from: "", to: "" };

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("filterForm");

    form.addEventListener("submit", e => {
        e.preventDefault();
        if (!Validator.validateForm(form)) return;
        range = {
            from: document.getElementById("fromDate").value,
            to: document.getElementById("toDate").value
        };
        render();
    });

    document.getElementById("resetBtn").addEventListener("click", () => {
        form.reset();
        Validator.reset(form);
        range = { from: "", to: "" };
        render();
    });

    document.getElementById("searchInput").addEventListener("input", render);

    render();
});

function filteredOrders() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();

    return Store.get("purchaseOrders")
        .filter(o => o.manufacturer === MANUFACTURER && o.status === "Delivered")
        .filter(o => {
            if (range.from && o.orderDate < range.from) return false;
            if (range.to && o.orderDate > range.to) return false;
            if (search && ![o.id, o.farmer, o.biomassType].join(" ").toLowerCase().includes(search)) return false;
            return true;
        })
        .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
}

function render() {
    const rows = filteredOrders();

    const tons = rows.reduce((s, o) => s + Number(o.quantity || 0), 0);
    const spent = rows.reduce((s, o) => s + Number(o.total || 0), 0);

    document.getElementById("kpiCompleted").textContent = rows.length;
    document.getElementById("kpiTons").textContent = tons.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " t";
    document.getElementById("kpiSpent").textContent = Store.inr(spent);
    document.getElementById("kpiAvg").textContent = Store.inr(tons ? Math.round(spent / tons) : 0);

    const rangeText = range.from || range.to
        ? " · " + (range.from ? Store.date(range.from) : "start") + " to " + (range.to ? Store.date(range.to) : "today")
        : "";
    document.getElementById("resultCount").textContent =
        rows.length + (rows.length === 1 ? " record" : " records") + rangeText;

    const table = document.getElementById("historyTable");

    if (!rows.length) {
        table.innerHTML = `<tr><td colspan="9"><div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i>No delivered purchase orders for the selected filters.<br><small>Orders appear here once they are delivered.</small></div></td></tr>`;
        return;
    }

    table.innerHTML = rows.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.farmer)}</td>
            <td>${Store.esc(o.biomassType)}</td>
            <td>${Store.esc(o.quantity)} t</td>
            <td>${Store.inr(o.price)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td>${Store.statusBadge(o.paymentStatus || "Pending")}</td>
        </tr>
    `).join("");
}
