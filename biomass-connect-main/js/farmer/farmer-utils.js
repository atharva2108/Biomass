/* =========================================================
   FARMER — shared helpers for the farmer pages
   Load after the common scripts and before the page script:
     toast.js → validation.js → store.js → layout.js → farmer-utils.js → <page>.js
========================================================= */

const FARMER_NAME = "Ramesh Patil";

const BIOMASS_TYPES = [
    "Rice Husk", "Rice Straw", "Wheat Straw", "Sugarcane Bagasse", "Cotton Stalk",
    "Soybean Husk", "Corn Cob", "Maize Stover", "Groundnut Shell", "Mustard Stalk", "Coconut Husk"
];

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan",
    "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

const Farmer = (function () {

    /* ---------- Data ---------- */

    function listings() {
        return Store.get("biomassListings").filter(l => l.farmer === FARMER_NAME);
    }

    function orders() {
        return Store.get("purchaseOrders").filter(o => o.farmer === FARMER_NAME);
    }

    function readJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (e) { /* ignore */ }
        return fallback;
    }

    function writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    /* ---------- Formatting ---------- */

    function today() {
        return Store.iso(0);
    }

    function tons(n) {
        return Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " Tons";
    }

    function emptyRow(colspan, icon, text) {
        return '<tr><td colspan="' + colspan + '"><div class="empty-state"><i class="fa-solid ' + icon + '"></i>' +
            Store.esc(text) + "</div></td></tr>";
    }

    function param(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    /* ---------- Form helpers ---------- */

    // fills a <select> with options; keeps a current value even if it isn't in the list
    function fillSelect(select, items, placeholder, current) {
        if (typeof select === "string") select = document.getElementById(select);
        if (!select) return;
        const list = items.slice();
        if (current && !list.includes(current)) list.push(current);
        select.innerHTML = (placeholder ? '<option value="">' + Store.esc(placeholder) + "</option>" : "") +
            list.map(v => '<option value="' + Store.esc(v) + '">' + Store.esc(v) + "</option>").join("");
        if (current) select.value = current;
    }

    // live "n / max" character counter for a textarea
    function counter(fieldId, outId, max) {
        const field = document.getElementById(fieldId);
        const out = document.getElementById(outId);
        if (!field || !out) return () => {};
        const update = () => {
            const len = field.value.length;
            out.textContent = len + " / " + max;
            out.classList.toggle("text-danger", len > max);
        };
        field.addEventListener("input", update);
        update();
        return update;
    }

    // set a value on a hidden "reference" input and refresh linked date pickers
    function setRef(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = value || "";
        el.dispatchEvent(new Event("change"));
    }

    // show an error on a field that the declarative rules can't know about (e.g. wrong password)
    function fieldError(id, message) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add("is-invalid");
        el.classList.remove("is-valid");
        el.dataset.touched = "1";
        const err = document.getElementById(id + "Error") ||
            (el.closest(".form-group") && el.closest(".form-group").querySelector(".error"));
        if (err) err.textContent = message;
        el.focus();
    }

    /* ---------- Modals ---------- */

    function openModal(id) {
        const modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add("open");
        const first = modal.querySelector("input:not([type=hidden]):not([disabled]):not([readonly]), select:not([disabled]), textarea");
        setTimeout(() => { if (first) first.focus(); }, 60);
    }

    function closeModal(id) {
        const modal = typeof id === "string" ? document.getElementById(id) : id;
        if (!modal) return;
        modal.classList.remove("open");
        modal.querySelectorAll("form").forEach(form => {
            form.reset();
            Validator.reset(form);
        });
    }

    document.addEventListener("click", e => {
        const closer = e.target.closest("[data-close]");
        if (closer) {
            closeModal(closer.closest(".modal-backdrop"));
            return;
        }
        // backdrop click closes read-only modals (forms stay open to protect typed data)
        if (e.target.classList && e.target.classList.contains("modal-backdrop") &&
            !e.target.classList.contains("confirm-dialog") && !e.target.querySelector("form")) {
            closeModal(e.target);
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key !== "Escape" || document.querySelector(".confirm-dialog")) return;
        const open = Array.from(document.querySelectorAll(".modal-backdrop.open:not(.confirm-dialog)")).pop();
        if (open) closeModal(open);
    });

    return {
        name: FARMER_NAME,
        listings, orders, readJSON, writeJSON,
        today, tons, emptyRow, param,
        fillSelect, counter, setRef, fieldError,
        openModal, closeModal
    };

})();
