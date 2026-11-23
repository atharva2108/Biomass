// =========================
// PELLET ORDER TRACKING (US024)
// View only: Placed → Pickup Scheduled → In Transit → Delivered.
// The logistics team updates the status and transport details.
// =========================

const MANUFACTURER = "GreenPellet Industries";

let selectedId = null;

document.addEventListener("DOMContentLoaded", () => {

    const orders = myOrders();
    const requested = new URLSearchParams(location.search).get("order");

    if (requested && orders.some(o => o.id === requested)) {
        selectedId = requested;
    } else {
        if (requested) showToast("Order " + requested + " was not found.", "warning");
        selectedId = orders[0] ? orders[0].id : null;
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

// open orders first (in delivery order), newest first within a status
function myOrders() {
    const step = s => Store.ORDER_STEPS.indexOf(s);
    return Store.get("pelletOrders")
        .filter(o => o.manufacturer === MANUFACTURER)
        .sort((a, b) => (step(a.status) - step(b.status)) || String(b.orderDate).localeCompare(String(a.orderDate)));
}

function renderKpis() {
    const orders = myOrders();
    const count = status => orders.filter(o => o.status === status).length;
    document.getElementById("kpiPlaced").textContent = count("Placed");
    document.getElementById("kpiPickup").textContent = count("Pickup Scheduled");
    document.getElementById("kpiTransit").textContent = count("In Transit");
    document.getElementById("kpiDelivered").textContent = count("Delivered");
}

function renderList() {
    const search = document.getElementById("orderSearch").value.trim().toLowerCase();
    const list = myOrders().filter(o =>
        !search || [o.id, o.powerPlant, o.pelletType].join(" ").toLowerCase().includes(search));

    const el = document.getElementById("orderList");

    if (!list.length) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-route"></i>${search ? "No orders match your search." : "No pellet orders yet."}</div>`;
        return;
    }

    el.innerHTML = list.map(o => `
        <button type="button" class="order-item${o.id === selectedId ? " active" : ""}" data-id="${Store.esc(o.id)}">
            <span>
                <strong>${Store.esc(o.id)}</strong>
                <small>${Store.esc(o.pelletType)} · ${Store.esc(o.quantity)} t</small>
                <small>${Store.esc(o.powerPlant)}</small>
            </span>
            ${Store.statusBadge(o.status)}
        </button>
    `).join("");
}

function renderDetail() {
    const box = document.getElementById("trackDetail");
    const o = selectedId ? Store.find("pelletOrders", selectedId) : null;

    if (!o || o.manufacturer !== MANUFACTURER) {
        box.innerHTML = `<div class="empty-state"><i class="fa-solid fa-route"></i>Select an order to see its delivery status.</div>`;
        return;
    }

    box.innerHTML = `
        <div class="card-header">
            <div>
                <div class="card-title">${Store.esc(o.id)} · ${Store.esc(o.pelletType)}</div>
                <div class="card-subtitle">To ${Store.esc(o.powerPlant)} · ${Store.esc(o.quantity)} t (${Store.esc(o.grade)}) · ${Store.inr(o.total)} · Ordered ${Store.date(o.orderDate)}</div>
            </div>
            ${Store.statusBadge(o.status)}
        </div>
        <div class="card-body">
            ${Store.trackingHtml(o)}
        </div>`;
}
