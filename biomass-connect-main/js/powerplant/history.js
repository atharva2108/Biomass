// =========================
// PURCHASE HISTORY (US031) — delivered pellet orders
// =========================

let feedback = {};

document.addEventListener("DOMContentLoaded", () => {

    Store.get("pelletFeedback").forEach(f => { feedback[f.orderId] = f; });

    const form = document.getElementById("filterForm");
    const suppliers = [...new Set(deliveredOrders().map(o => o.manufacturer))].sort();
    const select = document.getElementById("supplierFilter");
    suppliers.forEach(s => select.insertAdjacentHTML("beforeend", `<option value="${Store.esc(s)}">${Store.esc(s)}</option>`));

    ["fromDate", "toDate", "supplierFilter"].forEach(id =>
        document.getElementById(id).addEventListener("change", applyFilters));

    form.addEventListener("submit", e => { e.preventDefault(); applyFilters(); });
    form.addEventListener("reset", () => setTimeout(() => {
        Validator.reset(form);
        applyFilters();
    }, 0));

    document.getElementById("historyTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-view]");
        if (btn) viewOrder(btn.dataset.view);
    });

    applyFilters();
});

function deliveredOrders() {
    return Plant.orders().filter(o => o.status === "Delivered");
}

function applyFilters() {
    if (!Validator.validateForm("#filterForm", { toast: false, focus: false })) {
        document.getElementById("resultCount").textContent = "Correct the date range to update the results";
        return;
    }

    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;
    const supplier = document.getElementById("supplierFilter").value;

    const list = deliveredOrders()
        .filter(o => !from || (o.deliveredDate || "") >= from)
        .filter(o => !to || (o.deliveredDate || "") <= to)
        .filter(o => !supplier || o.manufacturer === supplier)
        .sort((a, b) => (b.deliveredDate || "").localeCompare(a.deliveredDate || "") || String(b.id).localeCompare(String(a.id)));

    loadKpis(list);
    renderTable(list);

    document.getElementById("resultCount").textContent =
        list.length + " order" + (list.length === 1 ? "" : "s") + (from || to || supplier ? " match the filters" : " in total");
}

function loadKpis(list) {
    const tons = list.reduce((s, o) => s + Number(o.quantity || 0), 0);
    const spend = list.reduce((s, o) => s + Number(o.total || 0), 0);

    document.getElementById("kpiOrders").textContent = list.length;
    document.getElementById("kpiTons").textContent = Plant.num(tons) + " t";
    document.getElementById("kpiSpend").textContent = Store.inr(spend);
    document.getElementById("kpiAvg").textContent = Store.inr(tons ? Math.round(spend / tons) : 0);
}

function scoreHtml(f) {
    return `<span class="rating"><i class="fa-solid fa-star"></i> ${Number(f.score).toFixed(1)} <small>/ 5</small></span>`;
}

function renderTable(list) {
    const table = document.getElementById("historyTable");

    if (!list.length) {
        table.innerHTML = Plant.emptyRow(10, "fa-clock-rotate-left", "No delivered orders for the selected filters");
        return;
    }

    table.innerHTML = list.map(o => {
        const f = feedback[o.id];
        return `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.pelletType)} <span class="text-subtle">· ${Store.esc(o.grade)}</span></td>
            <td>${Plant.num(o.quantity)} t</td>
            <td>${Store.inr(o.price)}</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td>${f ? scoreHtml(f) : `<a class="btn btn-secondary btn-sm" href="pellet-feedback.html?order=${encodeURIComponent(o.id)}">Add details</a>`}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-ghost btn-icon" type="button" data-view="${Store.esc(o.id)}" title="View details" aria-label="View ${Store.esc(o.id)}"><i class="fa-solid fa-eye"></i></button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function viewOrder(id) {
    const o = Plant.orders().find(x => x.id === id);
    if (!o) {
        showToast("Order not found", "error");
        return;
    }

    const f = feedback[o.id];
    const d = f ? f.declared || {} : {};
    const batch = f ? `
        <h4>Batch Feedback</h4>
        <dl class="detail-list">
            <div><dt>Received On</dt><dd>${Store.date(f.receivedDate)}</dd></div>
            <div><dt>Quantity Received</dt><dd>${Plant.num(f.quantityReceived)} tons</dd></div>
            <div><dt>Moisture (declared)</dt><dd>${Plant.num(f.moisture)}% <span class="text-subtle">(${Plant.num(d.moisture)}%)</span></dd></div>
            <div><dt>Ash Content (declared)</dt><dd>${Plant.num(f.ashContent)}% <span class="text-subtle">(${Plant.num(d.ashContent)}%)</span></dd></div>
            <div><dt>Calorific Value (declared)</dt><dd>${Plant.num(f.calorificValue, 0)} <span class="text-subtle">(${Plant.num(d.calorificValue, 0)})</span> kcal/kg</dd></div>
            <div><dt>Batch Score</dt><dd>${scoreHtml(f)}</dd></div>
            <div class="span-full"><dt>Remarks</dt><dd>${f.remarks ? Store.esc(f.remarks) : "—"}</dd></div>
        </dl>` : `
        <p class="form-hint mt-3"><i class="fa-solid fa-circle-info"></i> Batch details have not been submitted for this order yet.
            <a href="pellet-feedback.html?order=${encodeURIComponent(o.id)}">Add them now</a>.</p>`;

    document.getElementById("viewModalTitle").textContent = "Order " + o.id;
    document.getElementById("viewModalBody").innerHTML = `
        <dl class="detail-list">
            <div><dt>Supplier</dt><dd>${Store.esc(o.manufacturer)}</dd></div>
            <div><dt>Pellet Type</dt><dd>${Store.esc(o.pelletType)} (${Store.esc(o.grade)})</dd></div>
            <div><dt>Quantity</dt><dd>${Plant.num(o.quantity)} tons</dd></div>
            <div><dt>Price</dt><dd>${Store.inr(o.price)} / ton</dd></div>
            <div><dt>Order Value</dt><dd>${Store.inr(o.total)}</dd></div>
            <div><dt>Status</dt><dd>${Store.statusBadge(o.status)}</dd></div>
            <div><dt>Ordered On</dt><dd>${Store.date(o.orderDate)}</dd></div>
            <div><dt>Delivered On</dt><dd>${Store.date(o.deliveredDate)}</dd></div>
            <div class="span-full"><dt>Delivery Address</dt><dd>${Store.esc(o.deliveryAddress || "—")}</dd></div>
            <div class="span-full"><dt>Notes</dt><dd>${o.notes ? Store.esc(o.notes) : "—"}</dd></div>
        </dl>
        ${batch}`;
    Plant.openModal("viewModal");
}
