// =========================================================
// LOGISTICS — SHIPMENTS
// The logistics team is the only role that changes an order after it
// is placed. Farmers, manufacturers and power plants only view it.
//
//   Placed ──Schedule Pickup──▶ Pickup Scheduled ──Mark Dispatched──▶
//   In Transit ──Mark Delivered──▶ Delivered
//
// Works on both shared order collections in store.js:
//   purchaseOrders (biomass: farmer → manufacturer)
//   pelletOrders   (pellets: manufacturer → power plant)
// =========================================================

const TABS = [
    { key: "Placed", label: "To Schedule" },
    { key: "Pickup Scheduled", label: "Pickup Scheduled" },
    { key: "In Transit", label: "In Transit" },
    { key: "Delivered", label: "Delivered" },
    { key: "All", label: "All" }
];

let activeTab = "Placed";

document.addEventListener("DOMContentLoaded", () => {

    document.getElementById("searchInput").addEventListener("input", render);
    document.getElementById("typeFilter").addEventListener("change", render);

    document.getElementById("statusTabs").addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (!tab) return;
        activeTab = tab.dataset.tab;
        render();
    });

    document.getElementById("shipmentTable").addEventListener("click", onAction);

    document.getElementById("shipmentForm").addEventListener("submit", e => {
        e.preventDefault();
        saveShipment();
    });

    // close buttons / Escape
    document.addEventListener("click", e => {
        const closer = e.target.closest("[data-close]");
        if (closer) closeModal(closer.closest(".modal-backdrop"));
    });
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape" || document.querySelector(".confirm-dialog")) return;
        document.querySelectorAll(".modal-backdrop.open").forEach(closeModal);
    });

    render();
});

/* ---------------- Data ---------------- */

function shipments() {
    const biomass = Store.get("purchaseOrders").map(o => ({
        key: "purchaseOrders", kind: "biomass", order: o,
        from: o.farmer, to: o.manufacturer, load: o.biomassType
    }));
    const pellets = Store.get("pelletOrders").map(o => ({
        key: "pelletOrders", kind: "pellet", order: o,
        from: o.manufacturer, to: o.powerPlant, load: o.pelletType + (o.grade ? " (" + o.grade + ")" : "")
    }));
    const rank = s => Math.max(0, Store.ORDER_STEPS.indexOf(s));
    return biomass.concat(pellets).sort((a, b) =>
        rank(a.order.status) - rank(b.order.status) ||
        String(a.order.pickupDate || a.order.orderDate).localeCompare(String(b.order.pickupDate || b.order.orderDate)));
}

function findShipment(key, id) {
    return shipments().find(s => s.key === key && s.order.id === id) || null;
}

function tons(n) {
    return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Tons";
}

/* ---------------- Rendering ---------------- */

function render() {
    const all = shipments();
    const count = status => all.filter(s => s.order.status === status).length;

    document.getElementById("kpiPlaced").textContent = count("Placed");
    document.getElementById("kpiScheduled").textContent = count("Pickup Scheduled");
    document.getElementById("kpiTransit").textContent = count("In Transit");
    document.getElementById("kpiDelivered").textContent = count("Delivered");

    document.getElementById("statusTabs").innerHTML = TABS.map(t => {
        const n = t.key === "All" ? all.length : count(t.key);
        return `<button type="button" class="tab${t.key === activeTab ? " active" : ""}" data-tab="${t.key}" role="tab"
                    aria-selected="${t.key === activeTab}">${t.label} <span class="tab-count">${n}</span></button>`;
    }).join("");

    const type = document.getElementById("typeFilter").value;
    const q = document.getElementById("searchInput").value.trim().toLowerCase();

    const rows = all.filter(s =>
        (activeTab === "All" || s.order.status === activeTab) &&
        (type === "all" || s.kind === type) &&
        (!q || [s.order.id, s.from, s.to, s.load, s.order.vehicleNo, s.order.driverName].join(" ").toLowerCase().includes(q)));

    const table = document.getElementById("shipmentTable");

    if (!rows.length) {
        table.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-truck"></i>${
            q || type !== "all" ? "No shipments match your search." : "No shipments in this list."}</div></td></tr>`;
        return;
    }

    table.innerHTML = rows.map(s => {
        const o = s.order;
        return `
        <tr>
            <td>
                <div class="fw-600">${Store.esc(o.id)}</div>
                <small class="text-subtle">${s.kind === "pellet" ? "Pellets" : "Biomass"}</small>
            </td>
            <td>
                <div>${Store.esc(s.from)}</div>
                <small class="text-subtle">${Store.esc(o.pickupAddress || "—")}</small>
            </td>
            <td>
                <div>${Store.esc(s.to)}</div>
                <small class="text-subtle">${Store.esc(o.deliveryAddress || "—")}</small>
            </td>
            <td>
                <div>${tons(o.quantity)}</div>
                <small class="text-subtle">${Store.esc(s.load)}</small>
            </td>
            <td>
                <div>${Store.date(o.pickupDate)}</div>
                ${o.vehicleNo ? `<small class="text-subtle">${Store.esc(o.vehicleNo)}</small>` : ""}
            </td>
            <td>${Store.statusBadge(o.status)}</td>
            <td><div class="table-actions">${actionButtons(s)}</div></td>
        </tr>`;
    }).join("");
}

function actionButtons(s) {
    const o = s.order;
    const data = `data-key="${s.key}" data-id="${Store.esc(o.id)}"`;
    let html = `<button type="button" class="btn btn-secondary btn-sm btn-icon" data-action="view" ${data} title="View details" aria-label="View ${Store.esc(o.id)}"><i class="fa-solid fa-eye"></i></button>`;

    if (o.status === "Placed") {
        html += `<button type="button" class="btn btn-primary btn-sm" data-action="schedule" ${data}><i class="fa-solid fa-calendar-plus"></i> Schedule Pickup</button>`;
    } else if (o.status === "Pickup Scheduled") {
        html += `<button type="button" class="btn btn-secondary btn-sm btn-icon" data-action="edit" ${data} title="Edit details" aria-label="Edit ${Store.esc(o.id)}"><i class="fa-solid fa-pen"></i></button>
                 <button type="button" class="btn btn-primary btn-sm" data-action="dispatch" ${data}><i class="fa-solid fa-truck-fast"></i> Mark Dispatched</button>`;
    } else if (o.status === "In Transit") {
        html += `<button type="button" class="btn btn-secondary btn-sm btn-icon" data-action="edit" ${data} title="Edit details" aria-label="Edit ${Store.esc(o.id)}"><i class="fa-solid fa-pen"></i></button>
                 <button type="button" class="btn btn-primary btn-sm" data-action="deliver" ${data}><i class="fa-solid fa-box-open"></i> Mark Delivered</button>`;
    }
    return html;
}

function onAction(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const s = findShipment(btn.dataset.key, btn.dataset.id);
    if (!s) {
        showToast("Order " + btn.dataset.id + " no longer exists", "error");
        render();
        return;
    }
    const action = btn.dataset.action;
    if (action === "view") openView(s);
    if (action === "schedule" || action === "edit") openShipmentForm(s);
    if (action === "dispatch") markDispatched(s);
    if (action === "deliver") markDelivered(s);
}

/* ---------------- Modals ---------------- */

function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add("open");
    const first = modal.querySelector("input:not([type=hidden]):not([disabled])");
    setTimeout(() => { if (first) first.focus(); }, 60);
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("open");
    modal.querySelectorAll("form").forEach(form => {
        form.reset();
        Validator.reset(form);
    });
}

function summaryHtml(s) {
    const o = s.order;
    return `<strong>${Store.esc(o.id)}</strong> · ${tons(o.quantity)} ${Store.esc(s.load)}<br>
            <span class="text-muted">${Store.esc(s.from)} → ${Store.esc(s.to)}</span>`;
}

function openView(s) {
    const o = s.order;
    document.getElementById("viewTitle").textContent = "Shipment " + o.id;
    document.getElementById("viewBody").innerHTML =
        `<div class="order-summary">${summaryHtml(s)}</div>` +
        `<dl class="detail-list mb-3">
            <div><dt>${s.kind === "pellet" ? "Manufacturer" : "Farmer"}</dt><dd>${Store.esc(s.from)}</dd></div>
            <div><dt>${s.kind === "pellet" ? "Power Plant" : "Manufacturer"}</dt><dd>${Store.esc(s.to)}</dd></div>
            <div><dt>Order Date</dt><dd>${Store.date(o.orderDate)}</dd></div>
            <div><dt>Status</dt><dd>${Store.statusBadge(o.status)}</dd></div>
            ${o.notes ? `<div class="span-full"><dt>Buyer Notes</dt><dd>${Store.esc(o.notes)}</dd></div>` : ""}
        </dl>` +
        Store.trackingHtml(o);
    openModal("viewModal");
}

function openShipmentForm(s) {
    const o = s.order;
    const scheduling = o.status === "Placed";
    const inTransit = o.status === "In Transit";

    document.getElementById("shipmentTitle").textContent = scheduling ? "Schedule Pickup" : "Edit Shipment Details";
    document.getElementById("shipmentSubmit").innerHTML = scheduling
        ? '<i class="fa-solid fa-calendar-check"></i> Schedule Pickup'
        : '<i class="fa-solid fa-check"></i> Save Changes';
    document.getElementById("shipmentKey").value = s.key;
    document.getElementById("shipmentId").value = o.id;
    document.getElementById("shipmentSummary").innerHTML = summaryHtml(s) +
        `<br><small class="text-subtle">Pickup: ${Store.esc(o.pickupAddress || "—")} · Deliver: ${Store.esc(o.deliveryAddress || "—")}</small>`;

    const pickup = document.getElementById("pickupDate");
    // once the load has left, the pickup date is history and can't change
    pickup.disabled = inTransit;

    openModal("shipmentModal");

    // set values after opening (closeModal resets the form)
    const today = Store.iso(0);
    pickup.value = o.pickupDate || Store.iso(1);
    document.getElementById("expectedDelivery").value =
        o.expectedDelivery && o.expectedDelivery >= today ? o.expectedDelivery : "";
    document.getElementById("vehicleNo").value = o.vehicleNo || "";
    document.getElementById("driverName").value = o.driverName || "";
    document.getElementById("driverMobile").value = o.driverMobile || "";
    pickup.dispatchEvent(new Event("change"));
}

function saveShipment() {
    if (!Validator.validateForm("#shipmentForm")) return;

    const key = document.getElementById("shipmentKey").value;
    const id = document.getElementById("shipmentId").value;
    const s = findShipment(key, id);
    if (!s || s.order.status === "Delivered") {
        closeModal(document.getElementById("shipmentModal"));
        showToast(s ? "Order " + id + " is already delivered" : "Order " + id + " no longer exists", "warning");
        render();
        return;
    }

    const pickup = document.getElementById("pickupDate");
    const patch = {
        expectedDelivery: document.getElementById("expectedDelivery").value,
        vehicleNo: document.getElementById("vehicleNo").value.trim().toUpperCase(),
        driverName: document.getElementById("driverName").value.trim(),
        driverMobile: document.getElementById("driverMobile").value.trim()
    };
    if (!pickup.disabled) patch.pickupDate = pickup.value;

    const scheduling = s.order.status === "Placed";
    if (scheduling) patch.status = "Pickup Scheduled";

    Store.update(key, id, patch);
    closeModal(document.getElementById("shipmentModal"));
    render();
    showToast(scheduling
        ? "Pickup for " + id + " scheduled on " + Store.date(patch.pickupDate) + "."
        : "Shipment details for " + id + " updated.", "success");
}

/* ---------------- Status changes ---------------- */

async function markDispatched(s) {
    const o = s.order;
    const ok = await confirmDialog({
        title: "Mark " + o.id + " as dispatched?",
        message: "Confirm that vehicle " + (o.vehicleNo || "") + " has picked up " + tons(o.quantity) + " from " + s.from +
            ". The order will show as In Transit to everyone.",
        confirmText: "Mark Dispatched"
    });
    if (!ok) return;

    Store.update(s.key, o.id, { status: "In Transit", dispatchedDate: Store.iso(0) });
    render();
    showToast(o.id + " is now in transit to " + s.to + ".", "success");
}

async function markDelivered(s) {
    const o = s.order;
    const ok = await confirmDialog({
        title: "Mark " + o.id + " as delivered?",
        message: "Confirm that " + tons(o.quantity) + " of " + s.load + " was delivered to " + s.to + ". This cannot be undone.",
        confirmText: "Mark Delivered"
    });
    if (!ok) return;

    Store.update(s.key, o.id, { status: "Delivered", deliveredDate: Store.iso(0) });
    render();
    showToast(o.id + " delivered to " + s.to + ".", "success");
}
