// =========================
// PURCHASE TRACKING (US018) — view only
// Pickup, vehicle and delivery details are entered by the logistics team.
// =========================

const MANUFACTURER = "GreenPellet Industries";

const SORT_ORDER = ["In Transit", "Pickup Scheduled", "Placed", "Delivered"];

let selectedId = null;

document.addEventListener("DOMContentLoaded", () => {

    const orders = myOrders();
    const requested = new URLSearchParams(location.search).get("order");

    if (requested && orders.some(o => o.id === requested)) {
        selectedId = requested;
    } else {
        if (requested) showToast("Order " + requested + " was not found in your purchase orders.", "warning");
        const first = sortOrders(orders)[0];
        selectedId = first ? first.id : null;
    }

    document.getElementById("orderSearch").addEventListener("input", renderList);

    document.getElementById("orderList").addEventListener("click", e => {
        const item = e.target.closest(".order-item");
        if (!item) return;
        selectedId = item.dataset.id;
        renderList();
        renderDetail();
    });

    renderKpis();
    renderList();
    renderDetail();
});

function myOrders() {
    return Store.get("purchaseOrders").filter(o => o.manufacturer === MANUFACTURER);
}

function sortOrders(list) {
    return list.slice().sort((a, b) =>
        (SORT_ORDER.indexOf(a.status) - SORT_ORDER.indexOf(b.status)) ||
        String(b.orderDate).localeCompare(String(a.orderDate)));
}

function renderKpis() {
    const orders = myOrders();
    const count = s => orders.filter(o => o.status === s).length;
    document.getElementById("kpiPlaced").textContent = count("Placed");
    document.getElementById("kpiPickup").textContent = count("Pickup Scheduled");
    document.getElementById("kpiTransit").textContent = count("In Transit");
    document.getElementById("kpiDelivered").textContent = count("Delivered");
}

function renderList() {
    const search = document.getElementById("orderSearch").value.trim().toLowerCase();
    const list = sortOrders(myOrders()).filter(o =>
        !search || [o.id, o.farmer, o.biomassType].join(" ").toLowerCase().includes(search));

    const el = document.getElementById("orderList");

    if (!list.length) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open"></i>No orders found</div>`;
        return;
    }

    el.innerHTML = list.map(o => `
        <button type="button" class="order-item${o.id === selectedId ? " active" : ""}" data-id="${Store.esc(o.id)}">
            <span>
                <strong>${Store.esc(o.id)}</strong>
                <small>${Store.esc(o.biomassType)} · ${Store.esc(o.quantity)} t</small>
                <small>${Store.esc(o.farmer)}</small>
            </span>
            ${Store.statusBadge(o.status)}
        </button>
    `).join("");
}

function renderDetail() {
    const box = document.getElementById("trackDetail");
    const o = selectedId ? Store.find("purchaseOrders", selectedId) : null;

    if (!o) {
        box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-truck-fast"></i>Select an order to see its tracking details.<br>
            <a class="btn btn-primary btn-sm mt-2" href="marketplace.html">Browse biomass</a></div>`;
        return;
    }

    box.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">${Store.esc(o.id)} · ${Store.esc(o.biomassType)}</div>
                <div class="card-subtitle">From ${Store.esc(o.farmer)}</div>
            </div>
            ${Store.statusBadge(o.status)}
        </div>
        <div class="card-body">
            ${Store.trackingHtml(o)}
            <div class="track-subtitle mt-3">Order details</div>
            <dl class="detail-list">
                <div><dt>Quantity</dt><dd>${Store.esc(o.quantity)} tons</dd></div>
                <div><dt>Price / ton</dt><dd>${Store.inr(o.price)}</dd></div>
                <div><dt>Order value</dt><dd>${Store.inr(o.total)}</dd></div>
                <div><dt>Order date</dt><dd>${Store.date(o.orderDate)}</dd></div>
                <div><dt>Listing</dt><dd>${Store.esc(o.listingId || "—")}</dd></div>
                <div><dt>Payment</dt><dd>${Store.statusBadge(o.paymentStatus || "Pending")}${o.paidOn ? " on " + Store.date(o.paidOn) : ""}</dd></div>
                ${o.notes ? `<div class="span-full"><dt>Notes</dt><dd>${Store.esc(o.notes)}</dd></div>` : ""}
            </dl>
        </div>
        <div class="track-actions">
            <a class="btn btn-secondary" href="billing.html?order=${encodeURIComponent(o.id)}"><i class="fa-solid fa-circle-exclamation"></i> Report an Issue</a>
        </div>`;
}
