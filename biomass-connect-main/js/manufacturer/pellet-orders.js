// =========================
// PELLET ORDERS RECEIVED (US023)
// View only: a power plant buys a whole pellet listing and the manufacturer
// must supply it. Status and transport details are updated by the logistics team.
// =========================

const MANUFACTURER = "GreenPellet Industries";
const TABS = ["All"].concat(Store.ORDER_STEPS);

let activeTab = "All";

document.addEventListener("DOMContentLoaded", () => {

    bindModal();

    document.getElementById("statusTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (!tab) return;
        activeTab = tab.dataset.tab;
        render();
    });

    document.getElementById("searchInput").addEventListener("input", renderTable);

    document.getElementById("orderTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-action='view']");
        if (btn) viewOrder(btn.dataset.id);
    });

    render();
});

function myOrders() {
    return Store.get("pelletOrders")
        .filter(o => o.manufacturer === MANUFACTURER)
        .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)) || String(b.id).localeCompare(String(a.id)));
}

function render() {
    renderTabs();
    renderTable();
}

function renderTabs() {
    const orders = myOrders();
    document.getElementById("statusTabs").innerHTML = TABS.map(t => {
        const count = t === "All" ? orders.length : orders.filter(o => o.status === t).length;
        return `<button type="button" class="tab${t === activeTab ? " active" : ""}" data-tab="${t}">${t}<span class="tab-count">${count}</span></button>`;
    }).join("");
}

function renderTable() {
    const search = document.getElementById("searchInput").value.trim().toLowerCase();
    const list = myOrders().filter(o => {
        if (activeTab !== "All" && o.status !== activeTab) return false;
        if (search && ![o.id, o.powerPlant, o.pelletType, o.grade].join(" ").toLowerCase().includes(search)) return false;
        return true;
    });

    const table = document.getElementById("orderTable");

    if (!list.length) {
        const text = search ? "No orders match your search"
            : activeTab === "All" ? "No pellet orders received yet"
            : "No orders with status " + activeTab;
        table.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-inbox"></i>${text}</div></td></tr>`;
        return;
    }

    table.innerHTML = list.map(o => {
        const id = Store.esc(o.id);
        return `
        <tr>
            <td class="fw-600">${id}</td>
            <td>${Store.esc(o.powerPlant)}</td>
            <td class="order-pellet">${Store.esc(o.pelletType)}<small>${Store.esc(o.grade)}</small></td>
            <td>${Store.esc(o.quantity)} t</td>
            <td>${Store.inr(o.total)}</td>
            <td>${Store.date(o.orderDate)}</td>
            <td>${Store.statusBadge(o.status)}</td>
            <td><button class="btn btn-secondary btn-sm" data-action="view" data-id="${id}" aria-label="View ${id}"><i class="fa-solid fa-eye"></i> View</button></td>
        </tr>`;
    }).join("");
}

/* ---------- View ---------- */

function viewOrder(id) {
    const o = Store.find("pelletOrders", id);
    if (!o || o.manufacturer !== MANUFACTURER) {
        showToast("Order not found.", "error");
        render();
        return;
    }

    const paid = o.paymentStatus === "Paid";

    document.getElementById("viewTitle").textContent = "Order " + o.id;
    document.getElementById("viewBody").innerHTML = `
        <div class="view-section">
            <h4>Order</h4>
            <dl class="detail-list">
                <div><dt>Status</dt><dd>${Store.statusBadge(o.status)}</dd></div>
                <div><dt>Power plant</dt><dd>${Store.esc(o.powerPlant)}</dd></div>
                <div><dt>Pellets</dt><dd>${Store.esc(o.pelletType)} (${Store.esc(o.grade)})</dd></div>
                <div><dt>Listing</dt><dd>${Store.esc(o.listingId || "—")}</dd></div>
                <div><dt>Quantity</dt><dd>${Store.esc(o.quantity)} tons</dd></div>
                <div><dt>Price / ton</dt><dd>${Store.inr(o.price)}</dd></div>
                <div><dt>Order total</dt><dd>${Store.inr(o.total)}</dd></div>
                <div><dt>Order date</dt><dd>${Store.date(o.orderDate)}</dd></div>
                <div><dt>Payment</dt><dd>${Store.statusBadge(o.paymentStatus || "Pending")}${paid && o.paidOn ? ` <small class="text-muted">on ${Store.date(o.paidOn)}</small>` : ""}</dd></div>
                ${o.notes ? `<div class="span-full"><dt>Buyer notes</dt><dd>${Store.esc(o.notes)}</dd></div>` : ""}
            </dl>
        </div>
        <div class="view-section">
            <h4>Delivery</h4>
            ${Store.trackingHtml(o)}
        </div>`;

    document.getElementById("viewModal").classList.add("open");
}

/* ---------- Modal ---------- */

function closeModal() {
    document.getElementById("viewModal").classList.remove("open");
}

function bindModal() {
    const modal = document.getElementById("viewModal");
    modal.addEventListener("click", e => {
        if (e.target === modal || e.target.closest("[data-close]")) closeModal();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeModal();
    });
}
