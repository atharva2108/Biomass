// =========================
// ADMIN — MONITOR ORDERS & TRANSACTIONS
// Combined read-only view of purchaseOrders (biomass) and pelletOrders.
// Delivery details are entered by the logistics team; payment status
// is updated by the buyer. Admin only monitors.
// =========================

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("searchInput").addEventListener("input", render);
    ["typeFilter", "statusFilter", "paymentFilter"].forEach(id => document.getElementById(id).addEventListener("change", render));
    ["fromDate", "toDate"].forEach(id => document.getElementById(id).addEventListener("change", onDateChange));

    document.getElementById("filterForm").addEventListener("submit", e => e.preventDefault());
    document.getElementById("clearFilters").addEventListener("click", clearFilters);
    document.getElementById("orderTable").addEventListener("click", onAction);

    render();
});

/* ---------- filters ---------- */

// Only valid date fields take part in filtering
function dateRange() {
    const from = document.getElementById("fromDate");
    const to = document.getElementById("toDate");
    const okFrom = Validator.validateField(from);
    const okTo = Validator.validateField(to);
    return { from: okFrom ? from.value : "", to: okTo && okFrom ? to.value : "", valid: okFrom && okTo };
}

function onDateChange() {
    const range = dateRange();
    if (!range.valid) showToast("Fix the highlighted date range to filter by date", "error", { title: "Invalid date range" });
    render();
}

function filtered() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const type = document.getElementById("typeFilter").value;
    const status = document.getElementById("statusFilter").value;
    const payment = document.getElementById("paymentFilter").value;
    const { from, to } = dateRange();

    return Admin.allOrders().filter(o =>
        (type === "All" || o.type === type) &&
        (status === "All" || o.status === status) &&
        (payment === "All" || o.paymentStatus === payment) &&
        (!from || o.orderDate >= from) &&
        (!to || o.orderDate <= to) &&
        (!q || [o.id, o.buyer, o.seller, o.product].some(v => String(v || "").toLowerCase().includes(q)))
    );
}

function clearFilters() {
    const form = document.getElementById("filterForm");
    form.reset();
    Validator.reset(form);
    render();
    showToast("Filters cleared", "info");
}

/* ---------- render ---------- */

function render() {
    const list = filtered();
    const value = list.reduce((s, o) => s + o.total, 0);

    document.getElementById("kpiCount").textContent = list.length;
    document.getElementById("kpiActive").textContent = list.filter(Admin.isActiveOrder).length;
    document.getElementById("kpiValue").textContent = Store.inr(value);
    document.getElementById("kpiUnpaid").textContent = list.filter(o => o.status === "Delivered" && o.paymentStatus !== "Paid").length;
    document.getElementById("resultCount").textContent = list.length + (list.length === 1 ? " order" : " orders");

    const table = document.getElementById("orderTable");
    const totals = document.getElementById("orderTotals");

    if (!list.length) {
        table.innerHTML = `<tr><td colspan="11"><div class="empty-state"><i class="fa-solid fa-inbox"></i>No orders match your filters</div></td></tr>`;
        totals.innerHTML = "";
        return;
    }

    table.innerHTML = list.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td><span class="badge">${Store.esc(o.type)}</span></td>
            <td>${Store.esc(o.buyer)}</td>
            <td>${Store.esc(o.seller)}</td>
            <td>${Store.esc(o.product)}</td>
            <td>${Store.esc(o.quantity)} t</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.statusBadge(o.status)}</td>
            <td>${Store.statusBadge(o.paymentStatus)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-secondary btn-sm btn-icon" type="button" data-action="view" data-id="${Store.esc(o.id)}" title="View order" aria-label="View ${Store.esc(o.id)}"><i class="fa-solid fa-eye"></i></button>
                </div>
            </td>
        </tr>
    `).join("");

    const qty = list.reduce((s, o) => s + o.quantity, 0);
    totals.innerHTML = `
        <tr>
            <td colspan="5">Totals · ${list.length} ${list.length === 1 ? "order" : "orders"}</td>
            <td>${Number(qty.toFixed(2))} t</td>
            <td>${Store.inr(value)}</td>
            <td colspan="4"></td>
        </tr>`;
}

/* ---------- view ---------- */

function onAction(e) {
    const btn = e.target.closest("[data-action]");
    if (btn && btn.dataset.action === "view") viewOrder(btn.dataset.id);
}

function viewOrder(id) {
    const o = Admin.allOrders().find(x => x.id === id);
    if (!o) return showToast("Order not found", "error");

    document.getElementById("viewTitle").textContent = o.type + " Order · " + o.id;
    document.getElementById("viewBody").innerHTML = `
        <dl class="detail-list">
            <div><dt>Buyer (${Store.esc(o.buyerRole)})</dt><dd>${Store.esc(o.buyer)}</dd></div>
            <div><dt>Seller (${Store.esc(o.sellerRole)})</dt><dd>${Store.esc(o.seller)}</dd></div>
            <div><dt>Product</dt><dd>${Store.esc(o.product)}</dd></div>
            <div><dt>Quantity</dt><dd>${Store.esc(o.quantity)} tons @ ${Store.inr(o.price)}/ton</dd></div>
            <div><dt>Order Value</dt><dd>${Store.inr(o.total)}</dd></div>
            <div><dt>Order Date</dt><dd>${Store.date(o.orderDate)}</dd></div>
            <div><dt>Payment</dt><dd>${Store.statusBadge(o.paymentStatus)}${o.paidOn ? ` <small class="text-muted">on ${Store.date(o.paidOn)}</small>` : ""}</dd></div>
            <div><dt>Status</dt><dd>${Store.statusBadge(o.status)}</dd></div>
            ${o.notes ? `<div class="span-full"><dt>Buyer Notes</dt><dd>${Store.esc(o.notes)}</dd></div>` : ""}
        </dl>

        <h4 class="section-title">Delivery &amp; Logistics</h4>
        ${Store.trackingHtml(o)}
    `;

    Admin.openModal("viewModal");
}
