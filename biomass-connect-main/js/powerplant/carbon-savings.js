// =========================
// CARBON SAVINGS (US033)
// =========================

let report = null;

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("periodForm");
    const preset = document.getElementById("preset");

    preset.addEventListener("change", () => {
        if (preset.value === "custom") {
            document.getElementById("fromDate").focus();
            return;
        }
        setPreset(preset.value);
        apply();
    });

    ["fromDate", "toDate"].forEach(id => document.getElementById(id).addEventListener("change", e => {
        if (e.isTrusted) preset.value = "custom";
    }));

    form.addEventListener("submit", e => {
        e.preventDefault();
        if (!Validator.validateForm(form)) return;
        apply();
        showToast(`Showing carbon savings from ${Store.date(report.from)} to ${Store.date(report.to)}`, "info");
    });

    renderMethodology();
    setPreset(preset.value);
    apply();
});

function setPreset(value) {
    const to = Store.iso(0);
    let from;
    if (value === "fy") {
        const now = new Date();
        const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        from = startYear + "-04-01";
    } else {
        from = Store.iso(-(Number(value) - 1));
    }

    const fromEl = document.getElementById("fromDate");
    fromEl.value = from;
    document.getElementById("toDate").value = to;
    fromEl.dispatchEvent(new Event("change"));   // keep the "To" picker bounds in sync
    Validator.reset("#periodForm");
}

function apply() {
    const from = document.getElementById("fromDate").value;
    const to = document.getElementById("toDate").value;
    if (!Validator.validateForm("#periodForm", { toast: false, focus: false })) return;

    const entries = Plant.consumption().filter(e => e.date >= from && e.date <= to);
    const months = Plant.monthsBetween(from, to);
    const agg = Plant.monthly(entries);

    const pellets = entries.reduce((s, e) => s + Number(e.pellets || 0), 0);
    const coal = entries.reduce((s, e) => s + Number(e.coal || 0), 0);
    const energy = entries.reduce((s, e) => s + Number(e.energy || 0), 0);
    const green = entries.reduce((s, e) => s + Number(e.energy || 0) * Number(e.ratio || 0) / 100, 0);

    report = {
        from, to, entries, months, agg,
        pellets, coal, energy, green,
        ratio: Plant.ratio(pellets, coal),
        impact: Plant.impact(pellets)
    };

    loadKpis();
    renderChart();
    renderSummary();
    renderTable();
}

function loadKpis() {
    const i = report.impact;
    document.getElementById("kpiCo2").textContent = Plant.num(i.co2, 0) + " t";
    document.getElementById("kpiCoal").textContent = Plant.num(i.coal, 0) + " t";
    document.getElementById("kpiStubble").textContent = Plant.num(i.stubble, 0) + " t";
    document.getElementById("kpiTrees").textContent = Plant.num(i.trees, 0);
}

function monthCo2(key) {
    return report.agg[key] ? Plant.impact(report.agg[key].pellets).co2 : 0;
}

function renderChart() {
    const values = report.months.map(monthCo2);
    const max = Math.max(...values) || 1;
    const current = Plant.monthKey(Store.iso(0));

    document.getElementById("periodLabel").textContent = Store.date(report.from) + " – " + Store.date(report.to);
    document.getElementById("co2Chart").innerHTML = report.months.map((k, idx) => {
        const v = values[idx];
        const label = Plant.monthLabel(k);
        return `<div class="bar${k === current ? " accent" : ""}" style="height:${Math.max(2, Math.round(v / max * 100))}%" title="${label}: ${Plant.num(v)} t CO₂">
                    <b>${v ? Plant.num(v, 0) : "–"}</b><span>${label}</span>
                </div>`;
    }).join("");
}

function renderSummary() {
    const rows = [
        ["Pellets co-fired", Plant.num(report.pellets) + " t"],
        ["Coal consumed", Plant.num(report.coal, 0) + " t"],
        ["Average co-firing ratio", Plant.num(report.ratio) + "%"],
        ["Energy generated", Plant.num(report.energy, 0) + " MWh"],
        ["Green energy from biomass", Plant.num(report.green, 0) + " MWh"],
        ["Log entries in period", report.entries.length]
    ];
    document.getElementById("summaryList").innerHTML =
        rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join("");
}

function monthRow(k) {
    const m = report.agg[k] || { pellets: 0, ratio: 0 };
    const i = Plant.impact(m.pellets);
    const green = report.entries
        .filter(e => Plant.monthKey(e.date) === k)
        .reduce((s, e) => s + Number(e.energy || 0) * Number(e.ratio || 0) / 100, 0);
    return { label: Plant.monthLabel(k), pellets: m.pellets, ratio: m.ratio, co2: i.co2, coal: i.coal, stubble: i.stubble, green };
}

function renderTable() {
    const table = document.getElementById("breakdownTable");

    if (!report.entries.length) {
        table.innerHTML = Plant.emptyRow(7, "fa-leaf", "No consumption logged in the selected period");
        return;
    }

    table.innerHTML = report.months.slice().reverse().map(k => {
        const r = monthRow(k);
        return `
            <tr>
                <td class="fw-600">${r.label}</td>
                <td>${Plant.num(r.pellets)}</td>
                <td>${Plant.num(r.ratio)}%</td>
                <td>${Plant.num(r.co2)}</td>
                <td>${Plant.num(r.coal)}</td>
                <td>${Plant.num(r.stubble)}</td>
                <td>${Plant.num(r.green, 0)}</td>
            </tr>`;
    }).join("");
}

function renderMethodology() {
    const f = Plant.FACTORS;
    const items = [
        `CO₂ avoided = pellets co-fired × ${f.co2PerTon} t CO₂ per ton (emissions from the coal that the biomass displaces; biomass carbon is treated as neutral).`,
        `Coal saved = pellets co-fired × ${f.coalPerTon} (pellet GCV ≈ 4,000 kcal/kg vs. Indian coal ≈ 3,500 kcal/kg).`,
        `Stubble burning avoided = pellets co-fired × ${f.stubblePerTon} t of crop residue diverted from open-field burning.`,
        `Tree equivalent = CO₂ avoided ÷ ${f.co2PerTree} t absorbed by one tree in a year.`,
        "Green energy = energy generated × co-firing ratio for each log entry."
    ];
    document.getElementById("methodList").innerHTML = items.map(t => `<li>${Store.esc(t)}</li>`).join("");
}
