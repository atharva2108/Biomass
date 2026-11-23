// =========================
// FARMER — MANAGE BIOMASS LISTINGS (US010)
// A listing becomes "Sold Out" when a manufacturer buys it; it is then locked
// (no edit, activate / deactivate or delete).
// =========================

let updateEditCount = () => {};

document.addEventListener("DOMContentLoaded", () => {

    Farmer.fillSelect("typeFilter", BIOMASS_TYPES, "All biomass types");
    Farmer.fillSelect("editType", BIOMASS_TYPES, "Select biomass type");
    Farmer.fillSelect("editState", INDIAN_STATES, "Select state");
    updateEditCount = Farmer.counter("editDescription", "editDescCount", 500);

    ["searchInput", "statusFilter", "typeFilter"].forEach(id =>
        document.getElementById(id).addEventListener(id === "searchInput" ? "input" : "change", render));

    document.getElementById("clearFilters").addEventListener("click", () => {
        document.getElementById("searchInput").value = "";
        document.getElementById("statusFilter").value = "";
        document.getElementById("typeFilter").value = "";
        render();
        showToast("Filters cleared", "info");
    });

    document.getElementById("listingTable").addEventListener("click", onTableClick);

    document.getElementById("editForm").addEventListener("submit", e => {
        e.preventDefault();
        saveEdit();
    });

    render();
});

/* ---------- Rendering ---------- */

function render() {
    const listings = Farmer.listings();
    renderKpis(listings);

    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const status = document.getElementById("statusFilter").value;
    const type = document.getElementById("typeFilter").value;

    const rows = listings.filter(l =>
        (!status || l.status === status) &&
        (!type || l.biomassType === type) &&
        (!q || [l.id, l.biomassType, l.location, l.district, l.state].join(" ").toLowerCase().includes(q)));

    document.getElementById("resultCount").textContent =
        rows.length + " of " + listings.length + " listing" + (listings.length === 1 ? "" : "s");

    const table = document.getElementById("listingTable");

    if (!listings.length) {
        table.innerHTML = Farmer.emptyRow(8, "fa-seedling", "You have not created any listings yet. Click \"New Listing\" to get started.");
        return;
    }
    if (!rows.length) {
        table.innerHTML = Farmer.emptyRow(8, "fa-filter-circle-xmark", "No listings match your filters.");
        return;
    }

    table.innerHTML = rows.map(l => `
        <tr>
            <td class="fw-600">${Store.esc(l.id)}</td>
            <td>${Store.esc(l.biomassType)}</td>
            <td>${Farmer.tons(l.quantity)}</td>
            <td>${Store.inr(l.price)}</td>
            <td>${Store.esc(l.location)}<div class="text-subtle cell-sub">${Store.esc(l.district)}, ${Store.esc(l.state)}</div></td>
            <td>${Store.date(l.availableFrom)}</td>
            <td>${Store.statusBadge(l.status)}</td>
            <td>${actionsHtml(l)}</td>
        </tr>`).join("");
}

function actionsHtml(l) {
    if (isLocked(l)) {
        return `<span class="text-subtle" title="Sold out listings cannot be changed"><i class="fa-solid fa-lock"></i> Locked</span>`;
    }
    const id = Store.esc(l.id);
    const toggleLabel = l.status === "Active" ? "Deactivate" : "Activate";
    const toggleIcon = l.status === "Active" ? "fa-toggle-on" : "fa-toggle-off";
    return `
        <div class="table-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit" data-id="${id}" title="Edit listing">
                <i class="fa-solid fa-pen"></i> Edit
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="toggle" data-id="${id}" title="${toggleLabel} listing">
                <i class="fa-solid ${toggleIcon}"></i> ${toggleLabel}
            </button>
            <button type="button" class="btn btn-danger btn-sm btn-icon" data-action="delete" data-id="${id}" title="Delete listing" aria-label="Delete listing ${id}">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>`;
}

function renderKpis(listings) {
    const active = listings.filter(l => l.status === "Active");
    document.getElementById("kpiTotal").textContent = listings.length;
    document.getElementById("kpiActive").textContent = active.length;
    document.getElementById("kpiInactive").textContent = listings.length - active.length;
    document.getElementById("kpiTons").textContent =
        active.reduce((sum, l) => sum + Number(l.quantity || 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function onTableClick(e) {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === "edit") openEdit(id);
    if (btn.dataset.action === "toggle") toggleStatus(id);
    if (btn.dataset.action === "delete") deleteListing(id);
}

/* ---------- Guards ---------- */

function isLocked(l) {
    return l.status === "Sold Out";
}

// returns the listing if it can still be changed, otherwise explains why and re-renders
function editableListing(id) {
    const l = Store.find("biomassListings", id);
    if (!l || l.farmer !== FARMER_NAME) {
        showToast("Listing " + id + " no longer exists", "error");
    } else if (isLocked(l)) {
        showToast("Listing " + id + " is sold out and can no longer be changed", "warning");
    } else {
        return l;
    }
    render();
    return null;
}

/* ---------- Edit ---------- */

function openEdit(id) {
    const l = editableListing(id);
    if (!l) return;

    document.getElementById("editTitle").textContent = "Edit Listing " + l.id;
    document.getElementById("editId").value = l.id;
    Farmer.fillSelect("editType", BIOMASS_TYPES, "Select biomass type", l.biomassType);
    Farmer.fillSelect("editState", INDIAN_STATES, "Select state", l.state);
    document.getElementById("editQuantity").value = l.quantity;
    document.getElementById("editPrice").value = l.price;
    document.getElementById("editLocation").value = l.location || "";
    document.getElementById("editDistrict").value = l.district || "";
    document.getElementById("editDescription").value = l.description || "";

    // the date may stay where it is, but can't be moved further into the past
    const today = Farmer.today();
    Farmer.setRef("editMinDate", l.availableFrom && l.availableFrom < today ? l.availableFrom : today);
    document.getElementById("editAvailable").value = l.availableFrom || "";

    updateEditCount();
    Validator.reset("#editForm");
    Farmer.openModal("editModal");
}

function saveEdit() {

    if (!Validator.validateForm("#editForm")) return;

    const id = document.getElementById("editId").value;
    const current = editableListing(id);
    if (!current) {
        Farmer.closeModal("editModal");
        return;
    }

    const val = elId => document.getElementById(elId).value.trim();
    const patch = {
        biomassType: val("editType"),
        quantity: Number(val("editQuantity")),
        price: Number(val("editPrice")),
        availableFrom: val("editAvailable"),
        location: val("editLocation"),
        district: val("editDistrict"),
        state: val("editState"),
        description: val("editDescription")
    };

    const changed = Object.keys(patch).some(k => String(patch[k]) !== String(current[k] == null ? "" : current[k]));
    if (!changed) {
        showToast("No changes to save", "info");
        return;
    }

    Store.update("biomassListings", id, patch);
    Farmer.closeModal("editModal");
    render();
    showToast("Listing " + id + " updated successfully", "success");
}

/* ---------- Toggle / Delete ---------- */

function toggleStatus(id) {
    const l = editableListing(id);
    if (!l) return;

    const next = l.status === "Active" ? "Inactive" : "Active";

    if (next === "Active" && Number(l.quantity) <= 0) {
        showToast("Add quantity before activating this listing", "warning");
        return;
    }

    Store.update("biomassListings", id, { status: next });
    render();
    showToast(next === "Active"
        ? "Listing " + id + " is now active and visible to buyers"
        : "Listing " + id + " deactivated and hidden from buyers", "success");
}

async function deleteListing(id) {
    const l = editableListing(id);
    if (!l) return;

    const ok = await confirmDialog({
        title: "Delete listing " + id + "?",
        message: Farmer.tons(l.quantity) + " of " + l.biomassType + " will be removed permanently. This cannot be undone.",
        confirmText: "Delete",
        danger: true
    });
    if (!ok) return;

    // it may have been bought while the dialog was open
    if (!editableListing(id)) return;

    Store.remove("biomassListings", id);
    render();
    showToast("Listing " + id + " deleted", "success");
}
