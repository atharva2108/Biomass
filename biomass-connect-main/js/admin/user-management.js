// =========================
// ADMIN — USER MANAGEMENT (US038)
// Admin can view users and block / unblock accounts.
// User details cannot be modified by the admin.
// =========================

const USERS_KEY = "admin_users";

let blockingId = null;

document.addEventListener("DOMContentLoaded", () => {

    // allow deep links such as user-management.html?role=Farmer
    const params = new URLSearchParams(location.search);
    if (params.get("role")) setSelect("roleFilter", params.get("role"));
    if (params.get("status")) setSelect("statusFilter", params.get("status"));

    document.getElementById("searchInput").addEventListener("input", renderUsers);
    document.getElementById("roleFilter").addEventListener("change", renderUsers);
    document.getElementById("statusFilter").addEventListener("change", renderUsers);
    document.getElementById("clearFilters").addEventListener("click", clearFilters);
    document.getElementById("blockForm").addEventListener("submit", blockUser);
    document.getElementById("userTable").addEventListener("click", onTableAction);
    document.getElementById("viewFooter").addEventListener("click", onTableAction);

    renderUsers();
});

function setSelect(id, value) {
    const el = document.getElementById(id);
    if ([...el.options].some(o => o.value === value)) el.value = value;
}

/* ---------- list ---------- */

function filteredUsers() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const role = document.getElementById("roleFilter").value;
    const status = document.getElementById("statusFilter").value;

    return Admin.get(USERS_KEY).filter(u =>
        (role === "All" || u.role === role) &&
        (status === "All" || u.status === status) &&
        (!q || [u.name, u.email, u.mobile, u.id, u.location].some(v => String(v || "").toLowerCase().includes(q)))
    );
}

function renderKpis() {
    const users = Admin.get(USERS_KEY);
    document.getElementById("kpiTotal").textContent = users.length;
    document.getElementById("kpiActive").textContent = users.filter(u => u.status === "Active").length;
    document.getElementById("kpiPending").textContent = users.filter(u => u.status === "Pending").length;
    document.getElementById("kpiBlocked").textContent = users.filter(u => u.status === "Blocked").length;
}

function renderUsers() {
    renderKpis();

    const list = filteredUsers();
    const table = document.getElementById("userTable");
    document.getElementById("resultCount").textContent = list.length + (list.length === 1 ? " user" : " users");

    if (!list.length) {
        table.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-user-slash"></i>No users match your filters</div></td></tr>`;
        return;
    }

    table.innerHTML = list.map(u => `
        <tr>
            <td>
                <div class="user-cell">
                    <span class="avatar">${Store.esc(Admin.initials(u.name))}</span>
                    <div>
                        <div class="fw-600">${Store.esc(u.name)}</div>
                        <small class="text-muted">${Store.esc(u.id)} · ${Store.esc(u.location || "—")}</small>
                    </div>
                </div>
            </td>
            <td>${Store.esc(u.role)}</td>
            <td>${Store.esc(u.email)}</td>
            <td>${Store.esc(u.mobile)}</td>
            <td>${Store.statusBadge(u.status)}</td>
            <td>${Store.date(u.joined)}</td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-secondary btn-sm btn-icon" type="button" data-action="view" data-id="${Store.esc(u.id)}" title="View details" aria-label="View ${Store.esc(u.name)}"><i class="fa-solid fa-eye"></i></button>
                    ${u.status === "Blocked"
                        ? `<button class="btn btn-secondary btn-sm btn-icon" type="button" data-action="unblock" data-id="${Store.esc(u.id)}" title="Unblock user" aria-label="Unblock ${Store.esc(u.name)}"><i class="fa-solid fa-unlock"></i></button>`
                        : `<button class="btn btn-danger btn-sm btn-icon" type="button" data-action="block" data-id="${Store.esc(u.id)}" title="Block user" aria-label="Block ${Store.esc(u.name)}"><i class="fa-solid fa-ban"></i></button>`}
                </div>
            </td>
        </tr>
    `).join("");
}

function clearFilters() {
    document.getElementById("searchInput").value = "";
    document.getElementById("roleFilter").value = "All";
    document.getElementById("statusFilter").value = "All";
    renderUsers();
    showToast("Filters cleared", "info");
}

function onTableAction(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    switch (btn.dataset.action) {
        case "view": viewUser(id); break;
        case "block": Admin.closeModal("viewModal"); openBlockForm(id); break;
        case "unblock": Admin.closeModal("viewModal"); unblockUser(id); break;
    }
}

/* ---------- view (read-only) ---------- */

function viewUser(id) {
    const u = Store.find(USERS_KEY, id);
    if (!u) return showToast("User not found", "error");

    document.getElementById("viewTitle").textContent = u.name;
    document.getElementById("viewBody").innerHTML = `
        <div class="user-cell mb-3">
            <span class="avatar avatar-lg">${Store.esc(Admin.initials(u.name))}</span>
            <div>
                <div class="fw-600">${Store.esc(u.name)}</div>
                ${Store.statusBadge(u.status)}
            </div>
        </div>
        <dl class="detail-list">
            <div><dt>User ID</dt><dd>${Store.esc(u.id)}</dd></div>
            <div><dt>Role</dt><dd>${Store.esc(u.role)}</dd></div>
            <div><dt>Email</dt><dd>${Store.esc(u.email)}</dd></div>
            <div><dt>Mobile</dt><dd>${Store.esc(u.mobile)}</dd></div>
            <div><dt>Location</dt><dd>${Store.esc(u.location || "—")}, ${Store.esc(u.state || "—")}</dd></div>
            <div><dt>Joined</dt><dd>${Store.date(u.joined)}</dd></div>
            ${u.role === "Manufacturer" ? `<div><dt>Pellet Quality Rating</dt><dd>${Store.ratingHtml(u.name)}</dd></div>` : ""}
        </dl>
        ${u.status === "Blocked" ? `
            <div class="note-box mt-2">
                <strong>Blocked on ${Store.date(u.blockedOn)}${u.blockCategory ? " · " + Store.esc(u.blockCategory) : ""}</strong>
                <p>${Store.esc(u.blockReason || "No reason recorded")}</p>
            </div>` : ""}
    `;

    document.getElementById("viewFooter").innerHTML = `
        <button class="btn btn-secondary" type="button" data-close>Close</button>
        ${u.status === "Blocked"
            ? `<button class="btn btn-primary" type="button" data-action="unblock" data-id="${Store.esc(u.id)}"><i class="fa-solid fa-unlock"></i> Unblock</button>`
            : `<button class="btn btn-danger" type="button" data-action="block" data-id="${Store.esc(u.id)}"><i class="fa-solid fa-ban"></i> Block</button>`}
    `;

    Admin.openModal("viewModal");
}

/* ---------- block / unblock ---------- */

function openBlockForm(id) {
    const u = Store.find(USERS_KEY, id);
    if (!u) return showToast("User not found", "error");
    if (u.status === "Blocked") return showToast(u.name + " is already blocked", "warning");

    blockingId = id;
    const form = document.getElementById("blockForm");
    form.reset();
    Validator.reset(form);
    document.getElementById("blockTitle").textContent = "Block " + u.name;
    document.getElementById("blockIntro").textContent =
        "Blocking " + u.name + " (" + u.role + ") will immediately stop them from signing in, listing or placing orders.";
    Admin.openModal("blockModal");
}

async function blockUser(e) {
    e.preventDefault();
    if (!Validator.validateForm("#blockForm")) return;

    const u = Store.find(USERS_KEY, blockingId);
    if (!u) return showToast("User not found", "error");

    const ok = await confirmDialog({
        title: "Block " + u.name + "?",
        message: "They will lose access to Biomass Connect until an admin unblocks the account.",
        confirmText: "Block User",
        danger: true
    });
    if (!ok) return;

    Store.update(USERS_KEY, u.id, {
        status: "Blocked",
        previousStatus: u.status,
        blockCategory: document.getElementById("blockCategory").value,
        blockReason: document.getElementById("blockReason").value.trim(),
        blockedOn: Store.iso(0)
    });
    Admin.log("Blocked user " + u.name + " (" + u.id + ")", "Users");
    Admin.closeModal("blockModal");
    renderUsers();
    showToast(u.name + " has been blocked", "success");
}

async function unblockUser(id) {
    const u = Store.find(USERS_KEY, id);
    if (!u) return showToast("User not found", "error");
    if (u.status !== "Blocked") return showToast(u.name + " is not blocked", "warning");

    const ok = await confirmDialog({
        title: "Unblock " + u.name + "?",
        message: "The user will be able to sign in and trade on the platform again.",
        confirmText: "Unblock"
    });
    if (!ok) return;

    Store.update(USERS_KEY, id, {
        status: u.previousStatus && u.previousStatus !== "Blocked" ? u.previousStatus : "Active",
        previousStatus: "", blockCategory: "", blockReason: "", blockedOn: ""
    });
    Admin.log("Unblocked user " + u.name + " (" + u.id + ")", "Users");
    renderUsers();
    showToast(u.name + " has been unblocked", "success");
}
