/* =========================================================
   POWER PLANT — shared helpers for every power plant page
   ---------------------------------------------------------
   Loaded after the common scripts (toast, validation, store,
   layout) and before the page script.

   Plant.NAME                 logged-in plant ("NTPC Nashik Unit")
   Plant.orders()             pelletOrders placed by this plant
   Plant.profile()            saved profile merged with defaults
   Plant.saveProfile(data)    localStorage "bc_profile_powerplant"
                              (layout.js shows its `name` in the topbar)
     { name, contactPerson, designation, mobile, email, gst, capacity (MW),
       address, city, state, pincode,
       gstCertificate (file name), gstStatus: "Verified" | "Pending" | "Rejected",
       memberSince, updatedAt }
   Plant.consumption()        powerplant_consumption (seeded)
     { id, date, unit, pellets (t), coal (t), ratio (%), energy (MWh), remarks, createdAt }
   Plant.monthly(entries)     { "YYYY-MM": { pellets, coal, energy, ratio, entries } }
   Plant.impact(pellets)      { co2, coal, stubble, trees }
   Plant.openModal(id) / Plant.closeModal(id)
   Plant.param(name)          query-string value
========================================================= */

(function () {

    const NAME = "NTPC Nashik Unit";
    const CONSUMPTION_KEY = "powerplant_consumption";
    const PROFILE_KEY = "bc_profile_powerplant";

    const UNITS = ["Unit 3 (210 MW)", "Unit 4 (210 MW)", "Unit 5 (210 MW)"];

    // Emission / displacement factors used across the sustainability pages
    const FACTORS = {
        co2PerTon: 1.5,        // t CO2 avoided per ton of pellets co-fired
        coalPerTon: 1.15,      // t coal displaced per ton of pellets (≈4,000 vs 3,500 kcal/kg)
        stubblePerTon: 1.2,    // t crop residue diverted from open burning per ton of pellets
        co2PerTree: 0.022      // t CO2 absorbed by one tree per year
    };

    const DEFAULT_PROFILE = {
        name: NAME,
        contactPerson: "Anil Deshmukh",
        designation: "Deputy General Manager (Fuel)",
        mobile: "9876543213",
        email: "powerplant@gmail.com",
        gst: "27AABCN1234F1Z5",
        capacity: 630,
        address: "Nashik Thermal Power Station, Eklahare, Nashik Road",
        city: "Nashik",
        state: "Maharashtra",
        pincode: "422105",
        gstCertificate: "gst-registration-certificate.pdf",
        gstStatus: "Verified",
        memberSince: "2025-02-03"
    };

    /* ---------------- Data ---------------- */

    function orders() {
        return Store.get("pelletOrders").filter(o => o.powerPlant === NAME);
    }

    function profile() {
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem(PROFILE_KEY)); } catch (e) { stored = null; }
        return Object.assign({}, DEFAULT_PROFILE, stored || {});
    }

    function saveProfile(data) {
        Store.set(PROFILE_KEY, data);
    }

    function round(n, d) {
        const f = Math.pow(10, d == null ? 2 : d);
        return Math.round(Number(n) * f) / f;
    }

    function ratio(pellets, coal) {
        const total = Number(pellets) + Number(coal);
        return total > 0 ? round(Number(pellets) / total * 100, 2) : 0;
    }

    // ~6 months of daily log entries; co-firing improves over time
    function seedConsumption() {
        const offsets = [1, 5, 9, 16, 22, 29, 36, 44, 51, 58, 66, 73, 81, 89, 97, 106, 114, 123, 132, 141, 150, 160, 170];
        return offsets.map((off, i) => {
            const pellets = round(158 - i * 3.6 + (i * 7 % 11), 2);
            const coal = round(2380 + (i * 53 % 260), 2);
            const energy = round(4620 + (i * 71 % 380), 2);
            return {
                id: "CE-" + (1001 + offsets.length - 1 - i),
                date: Store.iso(-off),
                unit: UNITS[i % UNITS.length],
                pellets,
                coal,
                ratio: ratio(pellets, coal),
                energy,
                remarks: "",
                createdAt: Store.iso(-off)
            };
        });
    }

    function consumption() {
        if (localStorage.getItem(CONSUMPTION_KEY) === null) {
            Store.set(CONSUMPTION_KEY, seedConsumption());
        }
        return Store.get(CONSUMPTION_KEY).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    }

    /* ---------------- Months ---------------- */

    function monthKey(iso) {
        return String(iso || "").slice(0, 7);
    }

    function monthLabel(key) {
        const parts = String(key).split("-").map(Number);
        return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    }

    // last n month keys, oldest first, ending with the current month
    function lastMonths(n) {
        const now = new Date();
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
        }
        return out;
    }

    // month keys between two ISO dates (inclusive)
    function monthsBetween(from, to) {
        const out = [];
        const a = String(from).split("-").map(Number);
        const b = String(to).split("-").map(Number);
        let y = a[0], m = a[1];
        while (y < b[0] || (y === b[0] && m <= b[1])) {
            out.push(y + "-" + String(m).padStart(2, "0"));
            m++;
            if (m > 12) { m = 1; y++; }
            if (out.length > 240) break;
        }
        return out;
    }

    function monthly(entries) {
        const map = {};
        entries.forEach(e => {
            const k = monthKey(e.date);
            if (!map[k]) map[k] = { pellets: 0, coal: 0, energy: 0, entries: 0 };
            map[k].pellets += Number(e.pellets) || 0;
            map[k].coal += Number(e.coal) || 0;
            map[k].energy += Number(e.energy) || 0;
            map[k].entries++;
        });
        Object.keys(map).forEach(k => { map[k].ratio = ratio(map[k].pellets, map[k].coal); });
        return map;
    }

    function impact(pellets) {
        const p = Number(pellets) || 0;
        const co2 = p * FACTORS.co2PerTon;
        return {
            co2: round(co2, 2),
            coal: round(p * FACTORS.coalPerTon, 2),
            stubble: round(p * FACTORS.stubblePerTon, 2),
            trees: Math.round(co2 / FACTORS.co2PerTree)
        };
    }

    /* ---------------- Formatting ---------------- */

    function num(n, digits) {
        const v = Number(n);
        if (isNaN(v)) return "—";
        return v.toLocaleString("en-IN", { maximumFractionDigits: digits == null ? 2 : digits });
    }

    function addDays(iso, days) {
        const p = String(iso).split("-").map(Number);
        const d = new Date(p[0], p[1] - 1, p[2] + days);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }

    function daysUntil(iso) {
        const p = String(iso).split("-").map(Number);
        const day = new Date(p[0], p[1] - 1, p[2]);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.round((day - today) / 86400000);
    }

    function fileSize(bytes) {
        if (!bytes && bytes !== 0) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1024 / 1024).toFixed(2) + " MB";
    }

    // badge class with extra statuses used on power plant pages
    function badge(status) {
        const s = String(status || "").toLowerCase();
        if (["within spec"].includes(s)) return "badge badge-success";
        if (["delayed", "deviation"].includes(s)) return "badge badge-warning";
        return Store.badge(status);
    }

    function param(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    /* ---------------- Modals ---------------- */

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add("open");
        const first = modal.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
        if (first) setTimeout(() => first.focus(), 60);
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove("open");
        Validator.reset(modal);
    }

    document.addEventListener("click", e => {
        const closer = e.target.closest("[data-close-modal]");
        if (closer) {
            const modal = closer.closest(".modal-backdrop");
            if (modal && modal.id) closeModal(modal.id);
            return;
        }
        if (e.target.classList && e.target.classList.contains("modal-backdrop") && e.target.id) {
            closeModal(e.target.id);
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key !== "Escape" || document.querySelector(".confirm-dialog")) return;
        document.querySelectorAll(".modal-backdrop.open[id]").forEach(m => closeModal(m.id));
    });

    /* ---------------- Misc UI ---------------- */

    // live "0 / 500" character counter for a textarea
    function counter(fieldId, counterId) {
        const field = document.getElementById(fieldId);
        const out = document.getElementById(counterId);
        if (!field || !out) return;
        const max = (String(field.dataset.rules || "").match(/maxlen:(\d+)/) || [])[1] || field.getAttribute("maxlength") || "";
        const update = () => { out.textContent = field.value.length + (max ? " / " + max : "") + " characters"; };
        field.addEventListener("input", update);
        field.form && field.form.addEventListener("reset", () => setTimeout(update, 0));
        update();
    }

    function emptyRow(cols, icon, text) {
        return '<tr><td colspan="' + cols + '"><div class="empty-state"><i class="fa-solid ' + icon + '"></i>' + Store.esc(text) + "</div></td></tr>";
    }

    window.Plant = {
        NAME,
        UNITS,
        FACTORS,
        orders,
        profile,
        saveProfile,
        consumption,
        CONSUMPTION_KEY,
        ratio,
        round,
        monthKey,
        monthLabel,
        lastMonths,
        monthsBetween,
        monthly,
        impact,
        num,
        addDays,
        daysUntil,
        fileSize,
        badge,
        param,
        openModal,
        closeModal,
        counter,
        emptyRow
    };

})();
