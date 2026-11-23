// =========================
// FARMER — ORDER TRACKING (US012)
// View only: Placed → Pickup Scheduled → In Transit → Delivered.
// Only the logistics team changes the status and transport details.
// =========================

let selectedId = null;

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("searchInput").addEventListener("input", render);
    document.getElementById("viewFilter").addEventListener("change", render);

    document.getElementById("trackList").addEventListener("click", e => {
        const item = e.target.closest(".track-item");
        if (!item) return;
        selectedId = item.dataset.id;
        render();
    });

    render();
});

/* ---------- Data ---------- */

function findOrder(id) {
    const o = Store.find("purchaseOrders", id);
    return o && o.farmer === FARMER_NAME ? o : null;
}

// open orders first (furthest along on top), then delivered, newest first
function sortedOrders() {
    const rank = s => (s === "Delivered" ? 9 : -Store.ORDER_STEPS.indexOf(s));
    return Farmer.orders().sort((a, b) =>
        rank(a.status) - rank(b.status) || String(b.orderDate).localeCompare(String(a.orderDate)));
}

function statusLine(o) {
    if (o.status === "Delivered") return "Delivered on " + Store.date(o.deliveredDate);
    if (o.status === "In Transit") return "Expected delivery " + Store.date(o.expectedDelivery);
    if (o.status === "Pickup Scheduled") return "Pickup on " + Store.date(o.pickupDate);
    return "Waiting for the logistics team to schedule pickup";
}

/* ---------- Rendering ---------- */

function render() {
    const view = document.getElementById("viewFilter").value;
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const all = sortedOrders();

    const list = all.filter(o =>
        (view === "all" || (view === "delivered") === (o.status === "Delivered")) &&
        (!q || [o.id, o.manufacturer, o.biomassType].join(" ").toLowerCase().includes(q)));

    if (!selectedId || !list.some(o => o.id === selectedId)) selectedId = list.length ? list[0].id : null;

    document.getElementById("listCount").textContent = list.length + " order" + (list.length === 1 ? "" : "s");

    document.getElementById("trackList").innerHTML = list.length
        ? list.map(o => `
            <button type="button" class="track-item${o.id === selectedId ? " active" : ""}" data-id="${Store.esc(o.id)}">
                <span class="track-item-top">
                    <strong>${Store.esc(o.id)}</strong>
                    ${Store.statusBadge(o.status)}
                </span>
                <span class="track-item-meta">${Store.esc(o.manufacturer)}</span>
                <span class="track-item-meta">${Farmer.tons(o.quantity)} · ${Store.esc(o.biomassType)}</span>
                <small class="text-subtle">${Store.esc(statusLine(o))}</small>
            </button>`).join("")
        : `<div class="empty-state"><i class="fa-solid fa-truck"></i>${
            all.length ? "No orders match this view." : "No orders yet. Orders placed on your listings will appear here."}</div>`;

    renderDetail(selectedId ? findOrder(selectedId) : null);
}

function renderDetail(o) {
    const el = document.getElementById("trackDetail");

    if (!o) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-route"></i>Select an order to see its tracking details.</div>`;
        return;
    }

    const details = [
        ["Manufacturer", Store.esc(o.manufacturer)],
        ["Order Date", Store.date(o.orderDate)],
        ["Quantity", Farmer.tons(o.quantity)],
        ["Order Amount", Store.inr(o.total)]
    ];

    el.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">Order ${Store.esc(o.id)} ${Store.statusBadge(o.status)}</div>
                <div class="card-subtitle">${Farmer.tons(o.quantity)} of ${Store.esc(o.biomassType)} for ${Store.esc(o.manufacturer)}</div>
            </div>
        </div>
        <div class="card-body">
            <dl class="detail-list order-facts">
                ${details.map(d => `<div><dt>${d[0]}</dt><dd>${d[1]}</dd></div>`).join("")}
            </dl>
            ${Store.trackingHtml(o)}
        </div>`;
}
