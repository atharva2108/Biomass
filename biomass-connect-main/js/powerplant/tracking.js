// =========================
// ORDER TRACKING (US030) — view only
// Status and transport details are entered by the logistics team;
// the plant only follows the order here.
// =========================

let statusFilter = "";
let selectedId = null;

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("statusTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (!tab) return;
        statusFilter = tab.dataset.status;
        render();
    });

    document.getElementById("orderList").addEventListener("click", e => {
        const item = e.target.closest(".order-item");
        if (!item) return;
        selectedId = item.dataset.id;
        render();
        if (window.innerWidth <= 1100) document.getElementById("detailCard").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const orders = myOrders();
    const pre = Plant.param("order");
    if (pre) {
        if (orders.some(o => o.id === pre)) selectedId = pre;
        else showToast(`Order ${pre} was not found`, "warning");
    }
    if (!selectedId && orders.length) selectedId = orders[0].id;

    render();
});

// orders still on the way first, then delivered; newest first within each group
function myOrders() {
    return Plant.orders().sort((a, b) =>
        (a.status === "Delivered") - (b.status === "Delivered") ||
        (b.orderDate || "").localeCompare(a.orderDate || "") ||
        String(b.id).localeCompare(String(a.id)));
}

function feedbackFor(orderId) {
    return Store.get("pelletFeedback").find(f => f.orderId === orderId) || null;
}

function render() {
    const orders = myOrders();
    renderTabs(orders);
    renderList(orders);
    renderDetail();
}

function renderTabs(orders) {
    const tabs = [""].concat(Store.ORDER_STEPS);
    document.getElementById("statusTabs").innerHTML = tabs.map(s => {
        const count = s ? orders.filter(o => o.status === s).length : orders.length;
        return `<button type="button" class="tab${s === statusFilter ? " active" : ""}" data-status="${Store.esc(s)}">${s ? Store.esc(s) : "All"} (${count})</button>`;
    }).join("");
}

function renderList(orders) {
    const list = orders.filter(o => !statusFilter || o.status === statusFilter);
    const el = document.getElementById("orderList");

    if (!list.length) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-inbox"></i>${statusFilter ? "No orders with status “" + Store.esc(statusFilter) + "”" : "You haven't placed any pellet orders yet"}
            <div class="mt-2"><a class="btn btn-secondary btn-sm" href="marketplace.html">Browse marketplace</a></div></div>`;
        return;
    }

    el.innerHTML = list.map(o => `
        <button type="button" class="order-item${o.id === selectedId ? " active" : ""}" data-id="${Store.esc(o.id)}">
            <div class="row">
                <strong>${Store.esc(o.id)}</strong>
                ${Store.statusBadge(o.status)}
            </div>
            <small>${Store.esc(o.pelletType)} · ${Plant.num(o.quantity)} t · ${Store.esc(o.manufacturer)}</small>
            <small>${o.status === "Delivered" ? "Delivered " + Store.date(o.deliveredDate) : "Ordered " + Store.date(o.orderDate)}</small>
        </button>
    `).join("");
}

function renderDetail() {
    const card = document.getElementById("detailCard");
    const o = selectedId ? Plant.orders().find(x => x.id === selectedId) : null;

    if (!o) {
        card.innerHTML = `<div class="empty-state"><i class="fa-solid fa-truck-fast"></i>Select an order to view its tracking details.</div>`;
        return;
    }

    card.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Order ${Store.esc(o.id)}</div>
                <div class="card-subtitle">${Store.esc(o.pelletType)} (${Store.esc(o.grade)}) from ${Store.esc(o.manufacturer)}</div>
            </div>
            ${Store.statusBadge(o.status)}
        </div>
        <div class="card-body">

            <div class="detail-section">${Store.trackingHtml(o)}</div>

            <div class="detail-section">
                <h4>Order Details</h4>
                <dl class="detail-list">
                    <div><dt>Quantity</dt><dd>${Plant.num(o.quantity)} tons</dd></div>
                    <div><dt>Order Value</dt><dd>${Store.inr(o.total)}</dd></div>
                    <div><dt>Price</dt><dd>${Store.inr(o.price)} / ton</dd></div>
                    <div><dt>Ordered On</dt><dd>${Store.date(o.orderDate)}</dd></div>
                    <div class="span-full"><dt>Notes</dt><dd>${o.notes ? Store.esc(o.notes) : "—"}</dd></div>
                </dl>
            </div>

            ${feedbackSection(o)}

        </div>`;
}

function feedbackSection(o) {
    if (o.status !== "Delivered") return "";

    const f = feedbackFor(o.id);
    if (f) {
        return `
            <div class="detail-section">
                <div class="notice">
                    <i class="fa-solid fa-circle-check"></i>
                    <div>Batch details submitted on ${Store.date(f.createdAt)} · quality score <strong>${Number(f.score).toFixed(1)} / 5</strong>.
                        <a href="pellet-feedback.html">View batch feedback</a></div>
                </div>
            </div>`;
    }

    return `
        <div class="detail-section">
            <div class="notice">
                <i class="fa-solid fa-clipboard-check"></i>
                <div>
                    <strong>Delivered — batch details needed</strong>
                    <p class="text-muted">Record the measured moisture, ash and calorific value of this batch. It updates the supplier rating of ${Store.esc(o.manufacturer)} in the Pellet Marketplace.</p>
                    <a class="btn btn-primary btn-sm mt-2" href="pellet-feedback.html?order=${encodeURIComponent(o.id)}"><i class="fa-solid fa-clipboard-check"></i> Submit Batch Feedback</a>
                </div>
            </div>
        </div>`;
}
