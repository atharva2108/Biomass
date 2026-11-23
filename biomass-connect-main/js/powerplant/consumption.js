// =========================
// BIOMASS CONSUMPTION TRACKING (US032)
// =========================

const MAX_ENERGY = 100000;

document.addEventListener("DOMContentLoaded", () => {

    const unitOptions = Plant.UNITS.map(u => `<option value="${Store.esc(u)}">${Store.esc(u)}</option>`).join("");
    document.getElementById("unit").insertAdjacentHTML("beforeend", unitOptions);
    document.getElementById("unitFilter").insertAdjacentHTML("beforeend", unitOptions);

    const form = document.getElementById("entryForm");
    document.getElementById("entryDate").value = Store.iso(0);

    ["pellets", "coal"].forEach(id => document.getElementById(id).addEventListener("input", computeRatio));
    document.getElementById("unit").addEventListener("change", updateEnergyLimit);

    form.addEventListener("submit", saveEntry);
    form.addEventListener("reset", () => setTimeout(() => {
        Validator.reset(form);
        document.getElementById("entryDate").value = Store.iso(0);
        updateEnergyLimit();
        computeRatio();
    }, 0));

    document.getElementById("unitFilter").addEventListener("change", renderTable);
    document.getElementById("entryTable").addEventListener("click", e => {
        const btn = e.target.closest("button[data-delete]");
        if (btn) deleteEntry(btn.dataset.delete);
    });

    refresh();
});

function refresh() {
    const entries = Plant.consumption();
    loadKpis(entries);
    renderChart(entries);
    renderTable();
}

/* ---------------- Form ---------------- */

function computeRatio() {
    const pellets = document.getElementById("pellets");
    const coal = document.getElementById("coal");
    const ratio = document.getElementById("ratio");
    const p = Number(pellets.value);
    const c = Number(coal.value);

    ratio.value = pellets.value && coal.value && p > 0 && c > 0 ? Plant.ratio(p, c).toFixed(2) : "";
    Validator.validateField(ratio);
}

// a unit cannot generate more than capacity × 24 h in a day
function updateEnergyLimit() {
    const unit = document.getElementById("unit").value;
    const energy = document.getElementById("energy");
    const mw = Number((unit.match(/(\d+)\s*MW/) || [])[1]);
    const max = mw ? Math.min(mw * 24, MAX_ENERGY) : MAX_ENERGY;

    energy.dataset.rules = `required|number|positive|max:${max}|decimals:2`;
    if (mw) energy.dataset.msgMax = `A ${mw} MW unit can generate at most ${Plant.num(max)} MWh in a day`;
    else delete energy.dataset.msgMax;

    if (energy.value) Validator.validateField(energy);
}

function saveEntry(e) {
    e.preventDefault();
    computeRatio();

    if (!Validator.validateForm("#entryForm")) return;

    const date = document.getElementById("entryDate").value;
    const unit = document.getElementById("unit").value;

    if (Plant.consumption().some(x => x.date === date && x.unit === unit)) {
        showToast(`An entry for ${unit} on ${Store.date(date)} already exists. Delete it first to log a correction.`, "error");
        return;
    }

    const pellets = Plant.round(Number(document.getElementById("pellets").value), 2);
    const coal = Plant.round(Number(document.getElementById("coal").value), 2);
    const ratio = Plant.ratio(pellets, coal);

    Store.add(Plant.CONSUMPTION_KEY, {
        date,
        unit,
        pellets,
        coal,
        ratio,
        energy: Plant.round(Number(document.getElementById("energy").value), 2),
        remarks: document.getElementById("remarks").value.trim()
    }, "CE-");

    showToast(`Entry saved for ${unit} on ${Store.date(date)} — co-firing ${ratio.toFixed(2)}%`, "success");

    document.getElementById("entryForm").reset();
    refresh();
}

async function deleteEntry(id) {
    const entry = Plant.consumption().find(x => x.id === id);
    if (!entry) {
        showToast("Entry not found", "error");
        return;
    }

    const ok = await confirmDialog({
        title: "Delete this entry?",
        message: `${entry.unit} on ${Store.date(entry.date)} (${Plant.num(entry.pellets)} t pellets) will be removed from the consumption log and carbon reports.`,
        confirmText: "Delete",
        danger: true
    });
    if (!ok) return;

    Store.remove(Plant.CONSUMPTION_KEY, id);
    showToast("Consumption entry deleted", "success");
    refresh();
}

/* ---------------- KPIs / chart / table ---------------- */

function loadKpis(entries) {
    const month = Plant.monthly(entries)[Plant.monthKey(Store.iso(0))] || { pellets: 0, coal: 0, energy: 0, ratio: 0 };

    document.getElementById("kpiPellets").textContent = Plant.num(month.pellets) + " t";
    document.getElementById("kpiCoal").textContent = Plant.num(month.coal, 0) + " t";
    document.getElementById("kpiRatio").textContent = Plant.num(month.ratio) + "%";
    document.getElementById("kpiEnergy").textContent = Plant.num(month.energy, 0);
}

function renderChart(entries) {
    const months = Plant.lastMonths(6);
    const agg = Plant.monthly(entries);
    const current = Plant.monthKey(Store.iso(0));
    const values = months.map(k => agg[k] ? agg[k].ratio : 0);
    const scale = Math.max(...values) || 1;

    document.getElementById("ratioChart").innerHTML = months.map((k, i) => {
        const v = values[i];
        const label = Plant.monthLabel(k);
        return `<div class="bar${k === current ? " accent" : ""}" style="height:${Math.max(2, Math.round(v / scale * 100))}%" title="${label}: ${v.toFixed(2)}%">
                    <b>${v ? v.toFixed(1) + "%" : "–"}</b><span>${label}</span>
                </div>`;
    }).join("");

    const withData = values.filter(v => v > 0);
    const avg = withData.length ? withData.reduce((s, v) => s + v, 0) / withData.length : 0;
    document.getElementById("chartNote").textContent = withData.length
        ? `6-month average ${avg.toFixed(2)}%. The highlighted bar is the current month.`
        : "No consumption logged in the last 6 months.";
}

function renderTable() {
    const unit = document.getElementById("unitFilter").value;
    const all = Plant.consumption();
    const list = all.filter(e => !unit || e.unit === unit);
    const table = document.getElementById("entryTable");

    document.getElementById("entryCount").textContent =
        list.length + " entr" + (list.length === 1 ? "y" : "ies") + (unit ? " for " + unit : "");

    if (!list.length) {
        table.innerHTML = Plant.emptyRow(8, "fa-fire-flame-curved", "No consumption entries logged yet");
        return;
    }

    table.innerHTML = list.map(e => `
        <tr>
            <td class="fw-600">${Store.date(e.date)}</td>
            <td>${Store.esc(e.unit)}</td>
            <td>${Plant.num(e.pellets)}</td>
            <td>${Plant.num(e.coal)}</td>
            <td class="fw-600">${Number(e.ratio).toFixed(2)}%</td>
            <td>${Plant.num(e.energy)}</td>
            <td class="text-muted">${e.remarks ? Store.esc(e.remarks) : "—"}</td>
            <td><button class="btn btn-danger btn-icon" type="button" data-delete="${Store.esc(e.id)}" title="Delete entry" aria-label="Delete entry"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `).join("");
}
