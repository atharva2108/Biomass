// =========================
// PELLET BATCH FEEDBACK
// After delivery the plant records the measured quality of the batch.
// Store.batchScore() compares it with the listing's declared spec and
// the score feeds the manufacturer rating shown in the marketplace.
// =========================

const MEASURED_IDS = ["moisture", "ashContent", "calorificValue"];

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("feedbackForm");
    Plant.counter("remarks", "remarksCount");

    document.getElementById("orderSelect").addEventListener("change", onOrderChange);
    MEASURED_IDS.forEach(id => document.getElementById(id).addEventListener("input", updateScore));
    form.addEventListener("submit", submitFeedback);
    form.addEventListener("reset", () => setTimeout(() => {
        Validator.reset(form);
        onOrderChange();
    }, 0));

    document.getElementById("awaitingTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-order]");
        if (btn) selectOrder(btn.dataset.order);
    });

    refresh();

    // preselect from tracking / history (?order=PP-3008)
    const pre = Plant.param("order");
    if (pre) {
        if (awaitingOrders().some(o => o.id === pre)) selectOrder(pre);
        else if (feedbackFor(pre)) showToast(`Batch details for ${pre} have already been submitted`, "info");
        else if (Plant.orders().some(o => o.id === pre)) showToast(`Order ${pre} has not been delivered yet`, "warning");
        else showToast(`Order ${pre} was not found`, "warning");
    }
});

/* ---------------- Data ---------------- */

function myFeedback() {
    return Store.get("pelletFeedback").filter(f => f.powerPlant === Plant.NAME);
}

function feedbackFor(orderId) {
    return Store.get("pelletFeedback").find(f => f.orderId === orderId) || null;
}

function awaitingOrders() {
    const done = new Set(Store.get("pelletFeedback").map(f => f.orderId));
    return Plant.orders()
        .filter(o => o.status === "Delivered" && !done.has(o.id))
        .sort((a, b) => (b.deliveredDate || "").localeCompare(a.deliveredDate || ""));
}

function selectedOrder() {
    const id = document.getElementById("orderSelect").value;
    return id ? awaitingOrders().find(o => o.id === id) || null : null;
}

function declaredSpec(o) {
    const l = o ? Store.find("pelletListings", o.listingId) : null;
    if (!l) return null;
    return { moisture: Number(l.moisture), ashContent: Number(l.ashContent), calorificValue: Number(l.calorificValue) };
}

function measuredValues() {
    const values = {};
    for (const id of MEASURED_IDS) {
        const raw = document.getElementById(id).value.trim();
        const n = Number(raw);
        if (raw === "" || !isFinite(n) || n < 0) return null;
        values[id] = n;
    }
    return values;
}

/* ---------------- Render ---------------- */

function refresh() {
    renderAwaiting();
    renderOrderOptions();
    renderSubmitted();
    onOrderChange();
}

function renderAwaiting() {
    const list = awaitingOrders();
    const table = document.getElementById("awaitingTable");

    if (!list.length) {
        table.innerHTML = Plant.emptyRow(6, "fa-circle-check", "All delivered batches have their details recorded");
        return;
    }

    table.innerHTML = list.map(o => `
        <tr>
            <td class="fw-600">${Store.esc(o.id)}</td>
            <td>${Store.esc(o.manufacturer)}</td>
            <td>${Store.esc(o.pelletType)} <span class="text-subtle">· ${Store.esc(o.grade)}</span></td>
            <td>${Plant.num(o.quantity)} t</td>
            <td>${Store.date(o.deliveredDate)}</td>
            <td><button class="btn btn-primary btn-sm" type="button" data-order="${Store.esc(o.id)}"><i class="fa-solid fa-pen-to-square"></i> Enter details</button></td>
        </tr>
    `).join("");
}

function renderOrderOptions() {
    const select = document.getElementById("orderSelect");
    const current = select.value;
    const list = awaitingOrders();

    select.innerHTML = `<option value="">Select a delivered order</option>` + (list.length
        ? list.map(o => `<option value="${Store.esc(o.id)}">${Store.esc(o.id)} — ${Store.esc(o.pelletType)} · ${Plant.num(o.quantity)} t · ${Store.esc(o.manufacturer)}</option>`).join("")
        : `<option value="" disabled>No delivered orders awaiting details</option>`);

    if (list.some(o => o.id === current)) select.value = current;
}

function renderSubmitted() {
    const table = document.getElementById("submittedTable");
    const list = myFeedback().sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "") || String(b.id).localeCompare(String(a.id)));

    if (!list.length) {
        table.innerHTML = Plant.emptyRow(10, "fa-clipboard-list", "No batch feedback submitted yet");
        return;
    }

    table.innerHTML = list.map(f => {
        const d = f.declared || {};
        return `
        <tr>
            <td class="fw-600">${Store.esc(f.orderId)}</td>
            <td>${Store.esc(f.manufacturer)}</td>
            <td>${Store.esc(f.pelletType)}</td>
            <td>${Store.date(f.receivedDate)}</td>
            <td>${Plant.num(f.quantityReceived)} t</td>
            <td>${Plant.num(f.moisture)}% <span class="text-subtle">(${Plant.num(d.moisture)}%)</span></td>
            <td>${Plant.num(f.ashContent)}% <span class="text-subtle">(${Plant.num(d.ashContent)}%)</span></td>
            <td>${Plant.num(f.calorificValue, 0)} <span class="text-subtle">(${Plant.num(d.calorificValue, 0)})</span></td>
            <td><span class="rating"><i class="fa-solid fa-star"></i> ${Number(f.score).toFixed(1)} <small>/ 5</small></span></td>
            <td class="remarks-cell">${f.remarks ? Store.esc(f.remarks) : "—"}</td>
        </tr>`;
    }).join("");
}

/* ---------------- Form ---------------- */

function selectOrder(id) {
    document.getElementById("orderSelect").value = id;
    onOrderChange();
    document.getElementById("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("moisture").focus({ preventScroll: true });
}

function onOrderChange() {
    const o = selectedOrder();
    const spec = declaredSpec(o);

    const minDate = document.getElementById("fbMinDate");
    const date = document.getElementById("receivedDate");
    const qty = document.getElementById("quantityReceived");

    minDate.value = o ? (o.deliveredDate || o.orderDate || "") : "";
    minDate.dispatchEvent(new Event("change"));   // refresh the date picker bounds

    if (o) {
        date.value = o.deliveredDate && o.deliveredDate <= Store.iso(0) ? o.deliveredDate : Store.iso(0);
        date.dataset.msgMinDate = "Received date cannot be before the delivery date (" + Store.date(minDate.value) + ")";
        qty.dataset.rules = `required|number|positive|decimals:2|max:${Number(o.quantity)}`;
        qty.dataset.msgMax = `Quantity received cannot exceed the ordered ${Plant.num(o.quantity)} tons`;
        qty.value = o.quantity;
        document.getElementById("quantityHint").textContent = "Ordered: " + Plant.num(o.quantity) + " t";
        Validator.validateField(date);
        Validator.validateField(qty);
    } else {
        qty.dataset.rules = "required|number|positive|decimals:2|max:10000";
        delete qty.dataset.msgMax;
        delete date.dataset.msgMinDate;
        document.getElementById("quantityHint").textContent = "";
    }

    const na = o ? "Declared: not available" : "";
    document.getElementById("moistureDeclared").textContent = spec ? `Declared: ${Plant.num(spec.moisture)}% (lower is better)` : na;
    document.getElementById("ashDeclared").textContent = spec ? `Declared: ${Plant.num(spec.ashContent)}% (lower is better)` : na;
    document.getElementById("cvDeclared").textContent = spec ? `Declared: ${Plant.num(spec.calorificValue, 0)} kcal/kg (higher is better)` : na;

    const summary = document.getElementById("orderSummary");
    summary.classList.toggle("hidden", !o);
    summary.innerHTML = o ? `
        <div><dt>Supplier</dt><dd>${Store.esc(o.manufacturer)}</dd></div>
        <div><dt>Current Rating</dt><dd>${Store.ratingHtml(o.manufacturer)}</dd></div>
        <div><dt>Pellet Type</dt><dd>${Store.esc(o.pelletType)} (${Store.esc(o.grade)})</dd></div>
        <div><dt>Delivered On</dt><dd>${Store.date(o.deliveredDate)}</dd></div>` : "";

    updateScore();
}

function scoreLabel(score) {
    if (score >= 5) return "Matches the declared specification";
    if (score >= 4) return "Close to the declared specification";
    if (score >= 3) return "Below the declared specification";
    return "Well below the declared specification";
}

function updateScore() {
    const spec = declaredSpec(selectedOrder());
    const measured = measuredValues();
    const value = document.getElementById("scoreValue");
    const bar = document.getElementById("scoreBar");
    const hint = document.getElementById("scoreHint");

    if (!spec || !measured) {
        value.textContent = "—";
        bar.style.width = "0%";
        hint.textContent = selectedOrder() && !spec
            ? "The declared specification for this order is not available, so it cannot be scored."
            : "Select an order and enter the measured values to see the score.";
        return;
    }

    const score = Store.batchScore(spec, measured);
    value.textContent = score.toFixed(1);
    bar.style.width = (score / 5 * 100) + "%";
    hint.textContent = scoreLabel(score);
}

function submitFeedback(e) {
    e.preventDefault();

    if (!Validator.validateForm("#feedbackForm")) return;

    const o = selectedOrder();
    if (!o) {
        showToast("This order is no longer awaiting batch details", "error");
        refresh();
        return;
    }
    if (feedbackFor(o.id)) {
        showToast(`Batch details for ${o.id} have already been submitted`, "warning");
        refresh();
        return;
    }

    const declared = declaredSpec(o);
    if (!declared) {
        showToast("The declared specification for this order is not available, so the batch cannot be scored.", "error");
        return;
    }

    const measured = {
        moisture: Plant.round(Number(document.getElementById("moisture").value), 2),
        ashContent: Plant.round(Number(document.getElementById("ashContent").value), 2),
        calorificValue: Math.round(Number(document.getElementById("calorificValue").value))
    };
    const score = Store.batchScore(declared, measured);

    Store.add("pelletFeedback", {
        orderId: o.id,
        manufacturer: o.manufacturer,
        powerPlant: Plant.NAME,
        pelletType: o.pelletType,
        receivedDate: document.getElementById("receivedDate").value,
        quantityReceived: Plant.round(Number(document.getElementById("quantityReceived").value), 2),
        moisture: measured.moisture,
        ashContent: measured.ashContent,
        calorificValue: measured.calorificValue,
        declared,
        score,
        remarks: document.getElementById("remarks").value.trim()
    });

    const rating = Store.manufacturerRating(o.manufacturer);
    showToast(`Batch details saved for ${o.id} (score ${score.toFixed(1)} / 5). The supplier rating of ${o.manufacturer} is now ${rating.score.toFixed(1)}.`, "success");

    const form = document.getElementById("feedbackForm");
    form.reset();
    Validator.reset(form);
    refresh();
}
