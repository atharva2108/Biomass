/* =========================================================
   BIOMASS CONNECT — FORM VALIDATION
   ---------------------------------------------------------
   Declarative: add data-rules to any input / select / textarea.

     <input id="qty" type="number" data-label="Quantity"
            data-rules="required|number|min:1|max:10000">

     <input id="pickup" type="date" data-rules="required|date|notPast|maxDate:+90">
     <input id="dropoff" type="date" data-rules="required|date|after:#pickup">
     <input id="confirm" type="password" data-rules="required|match:#password">
     <input id="doc" type="file" data-rules="required|fileTypes:pdf,jpg,jpeg,png|maxSize:5">

   Rules (combine with "|", params after ":"):
     required, name, alpha, alphanumeric, text, email, mobile, emailOrMobile,
     password, match:#id, different:#id, minlen:n, maxlen:n, words:n,
     number, integer, positive, min:n, max:n, decimals:n,
     pincode, gst, pan, aadhaar, ifsc, account, upi, vehicle, url, batch,
     date, time, minDate:X, maxDate:X, after:#id, sameOrAfter:#id, before:#id,
     futureDate, notPast, pastDate, notFuture, age:n,
     fileTypes:a,b,c, maxSize:MB, checked, pattern (uses data-pattern)
       X for minDate / maxDate = today | +N | -N (days) | YYYY-MM-DD | #fieldId

   Optional attributes:
     data-label="Full Name"            name used in messages
     data-msg-<rule>="Custom message"  override a rule's message
     data-pattern="^[A-Z]{3}$"         custom regex for the "pattern" rule
     data-filter="digits|decimal|letters|alphanumeric|upper|nospace"
     data-error="#someId"              element that shows the error
     data-novalidate                   skip this field entirely

   Inputs without data-rules still get sensible defaults from their
   type / required / min / max / minlength / maxlength attributes.

   JS API:
     Validator.validateForm(rootOrSelector, { toast: true }) → boolean
     Validator.validateField(el) → boolean
     Validator.reset(rootOrSelector)
     Validator.check("email", "a@b.com") → "" or error message
     Validator.addRule(name, (value, param, el, label) => "error" | "")
     Validator.today() → "YYYY-MM-DD" (local)
     Validator.init(root) → bind live validation (auto on page load)
========================================================= */

(function () {

    const FIELD_SELECTOR = "input, select, textarea";
    const SKIP_TYPES = ["hidden", "button", "submit", "reset", "image", "radio"];

    /* ---------------- Date helpers ---------------- */

    function pad(n) { return String(n).padStart(2, "0"); }

    function toISO(d) {
        return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    }

    function today() { return toISO(new Date()); }

    function addDays(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return toISO(d);
    }

    function parseISO(str) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
        const [y, m, d] = str.split("-").map(Number);
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
        return date;
    }

    function formatDate(iso) {
        const d = parseISO(iso);
        if (!d) return iso;
        return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    // resolves "today", "+30", "-7", "2026-01-01", "#otherField"
    function resolveDate(param) {
        if (!param) return "";
        param = String(param).trim();
        if (param === "today") return today();
        if (/^[+-]\d+$/.test(param)) return addDays(parseInt(param, 10));
        if (param.startsWith("#")) {
            const other = document.querySelector(param);
            return other && other.value ? other.value : "";
        }
        return param;
    }

    /* ---------------- Utilities ---------------- */

    function getValue(el) {
        if (el.type === "checkbox") return el.checked ? "on" : "";
        if (el.type === "file") return el.files && el.files.length ? el.files[0].name : "";
        return (el.value || "").trim();
    }

    function getLabel(el) {
        if (el.dataset.label) return el.dataset.label;
        let labelEl = el.id ? document.querySelector('label[for="' + el.id + '"]') : null;
        if (!labelEl) {
            const group = el.closest(".form-group, .input-group, .field");
            if (group) labelEl = group.querySelector("label");
        }
        if (labelEl) {
            const text = labelEl.textContent.replace(/\*/g, "").replace(/\s+/g, " ").trim();
            if (text) return text;
        }
        if (el.placeholder) return el.placeholder.replace(/^(enter|select)\s+/i, "");
        return "This field";
    }

    function parseRules(str) {
        if (!str) return [];
        return str.split("|").map(part => {
            const idx = part.indexOf(":");
            if (idx === -1) return { name: part.trim(), param: null };
            return { name: part.slice(0, idx).trim(), param: part.slice(idx + 1).trim() };
        }).filter(r => r.name);
    }

    // Rules implied by HTML attributes when data-rules is absent / partial
    function implicitRules(el) {
        const rules = [];
        const has = name => rules.some(r => r.name === name);

        if (el.required) rules.push({ name: "required" });

        switch (el.type) {
            case "email": rules.push({ name: "email" }); break;
            case "tel": rules.push({ name: "mobile" }); break;
            case "url": rules.push({ name: "url" }); break;
            case "number": rules.push({ name: "number" }); break;
            case "date": rules.push({ name: "date" }); break;
            case "time": rules.push({ name: "time" }); break;
        }

        if (el.type === "number") {
            if (el.min !== "" && !has("min")) rules.push({ name: "min", param: el.min });
            if (el.max !== "" && !has("max")) rules.push({ name: "max", param: el.max });
        }
        if (el.type === "date") {
            if (el.getAttribute("min")) rules.push({ name: "minDate", param: el.getAttribute("min") });
            if (el.getAttribute("max")) rules.push({ name: "maxDate", param: el.getAttribute("max") });
        }
        if (el.getAttribute("minlength")) rules.push({ name: "minlen", param: el.getAttribute("minlength") });
        if (el.getAttribute("maxlength") && el.tagName !== "SELECT") {
            rules.push({ name: "maxlen", param: el.getAttribute("maxlength") });
        }
        if (el.tagName === "TEXTAREA") rules.push({ name: "text" });

        return rules;
    }

    function rulesFor(el) {
        const explicit = parseRules(el.dataset.rules);
        const implicit = implicitRules(el);
        const names = new Set(explicit.map(r => r.name));
        implicit.forEach(r => { if (!names.has(r.name)) explicit.push(r); });
        return explicit;
    }

    /* ---------------- Rules ---------------- */

    const RE = {
        name: /^[A-Za-z][A-Za-z .'-]*$/,
        alpha: /^[A-Za-z ]+$/,
        alphanumeric: /^[A-Za-z0-9 ]+$/,
        email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
        mobile: /^[6-9]\d{9}$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,20}$/,
        pincode: /^[1-9]\d{5}$/,
        gst: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        pan: /^[A-Z]{5}\d{4}[A-Z]$/,
        aadhaar: /^[2-9]\d{11}$/,
        ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
        account: /^\d{9,18}$/,
        upi: /^[\w.-]{2,256}@[A-Za-z]{2,64}$/,
        vehicle: /^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{0,3}[ -]?\d{4}$/,
        url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
        batch: /^[A-Za-z0-9][A-Za-z0-9\-\/]{2,29}$/,
        time: /^([01]\d|2[0-3]):[0-5]\d$/,
        html: /[<>]/
    };

    const RULES = {

        required(v, p, el, label) {
            if (el && el.type === "checkbox") return el.checked ? "" : "Please check " + label.toLowerCase();
            if (el && el.type === "file") return v ? "" : "Please upload " + label.toLowerCase();
            if (el && el.tagName === "SELECT") return v ? "" : "Please select " + label.toLowerCase();
            return v ? "" : label + " is required";
        },

        checked(v, p, el, label) {
            return el.checked ? "" : "Please accept " + label.toLowerCase();
        },

        name(v, p, el, label) {
            if (!RE.name.test(v)) return label + " can contain only letters, spaces, dots and hyphens";
            if (v.replace(/[^A-Za-z]/g, "").length < 2) return label + " must have at least 2 letters";
            if (v.length > 60) return label + " must be at most 60 characters";
            if (/\s{2,}/.test(v)) return label + " cannot contain consecutive spaces";
            return "";
        },

        alpha(v, p, el, label) {
            return RE.alpha.test(v) ? "" : label + " can contain only letters and spaces";
        },

        alphanumeric(v, p, el, label) {
            return RE.alphanumeric.test(v) ? "" : label + " can contain only letters, numbers and spaces";
        },

        text(v, p, el, label) {
            return RE.html.test(v) ? label + " cannot contain < or > characters" : "";
        },

        email(v, p, el, label) {
            if (!RE.email.test(v)) return "Enter a valid email address (e.g. name@example.com)";
            if (v.length > 100) return "Email must be at most 100 characters";
            if (/\.\./.test(v)) return "Email cannot contain consecutive dots";
            return "";
        },

        mobile(v) {
            if (!/^\d+$/.test(v)) return "Mobile number can contain only digits";
            if (v.length !== 10) return "Mobile number must be exactly 10 digits";
            if (!RE.mobile.test(v)) return "Mobile number must start with 6, 7, 8 or 9";
            return "";
        },

        emailOrMobile(v) {
            if (/^\d+$/.test(v)) return RULES.mobile(v);
            return RE.email.test(v) ? "" : "Enter a valid email or 10-digit mobile number";
        },

        password(v) {
            if (/\s/.test(v)) return "Password cannot contain spaces";
            if (v.length < 8) return "Password must be at least 8 characters";
            if (v.length > 20) return "Password must be at most 20 characters";
            if (!/[A-Z]/.test(v)) return "Password needs at least one uppercase letter";
            if (!/[a-z]/.test(v)) return "Password needs at least one lowercase letter";
            if (!/\d/.test(v)) return "Password needs at least one number";
            if (!/[^A-Za-z0-9]/.test(v)) return "Password needs at least one special character";
            return "";
        },

        match(v, p, el, label) {
            const other = document.querySelector(p);
            if (!other) return "";
            return v === other.value.trim() ? "" : (label.toLowerCase().includes("password") ? "Passwords do not match" : label + " does not match");
        },

        different(v, p, el, label) {
            const other = document.querySelector(p);
            if (!other || !other.value) return "";
            return v !== other.value.trim() ? "" : label + " must be different from " + getLabel(other).toLowerCase();
        },

        minlen(v, p, el, label) {
            return v.length >= +p ? "" : label + " must be at least " + p + " characters";
        },

        maxlen(v, p, el, label) {
            return v.length <= +p ? "" : label + " must be at most " + p + " characters";
        },

        words(v, p, el, label) {
            return v.split(/\s+/).filter(Boolean).length >= +p ? "" : label + " must have at least " + p + " words";
        },

        number(v, p, el, label) {
            if (el && el.validity && el.validity.badInput) return label + " must be a valid number";
            return /^-?\d+(\.\d+)?$/.test(v) ? "" : label + " must be a valid number";
        },

        integer(v, p, el, label) {
            return /^-?\d+$/.test(v) ? "" : label + " must be a whole number";
        },

        positive(v, p, el, label) {
            return Number(v) > 0 ? "" : label + " must be greater than 0";
        },

        min(v, p, el, label) {
            if (isNaN(Number(v))) return "";
            return Number(v) >= Number(p) ? "" : label + " must be at least " + p;
        },

        max(v, p, el, label) {
            if (isNaN(Number(v))) return "";
            return Number(v) <= Number(p) ? "" : label + " cannot exceed " + p;
        },

        decimals(v, p, el, label) {
            const parts = v.split(".");
            return !parts[1] || parts[1].length <= +p ? "" : label + " can have at most " + p + " decimal places";
        },

        pincode(v) { return RE.pincode.test(v) ? "" : "Enter a valid 6-digit PIN code"; },
        gst(v) { return RE.gst.test(v.toUpperCase()) ? "" : "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5)"; },
        pan(v) { return RE.pan.test(v.toUpperCase()) ? "" : "Enter a valid PAN (e.g. ABCDE1234F)"; },
        aadhaar(v) { return RE.aadhaar.test(v.replace(/\s/g, "")) ? "" : "Enter a valid 12-digit Aadhaar number"; },
        ifsc(v) { return RE.ifsc.test(v.toUpperCase()) ? "" : "Enter a valid IFSC code (e.g. SBIN0001234)"; },
        account(v) { return RE.account.test(v) ? "" : "Account number must be 9 to 18 digits"; },
        upi(v) { return RE.upi.test(v) ? "" : "Enter a valid UPI ID (e.g. name@bank)"; },
        vehicle(v) { return RE.vehicle.test(v.toUpperCase()) ? "" : "Enter a valid vehicle number (e.g. MH12AB1234)"; },
        url(v) { return RE.url.test(v) ? "" : "Enter a valid URL starting with http:// or https://"; },
        batch(v, p, el, label) { return RE.batch.test(v) ? "" : label + " must be 3-30 letters, numbers, - or /"; },
        time(v) { return RE.time.test(v) ? "" : "Enter a valid time (HH:MM)"; },

        pattern(v, p, el, label) {
            const src = (el && el.dataset.pattern) || p;
            if (!src) return "";
            return new RegExp(src).test(v) ? "" : label + " format is invalid";
        },

        /* ----- Dates ----- */

        date(v, p, el, label) {
            if (el && el.validity && el.validity.badInput) return "Enter a complete, valid date";
            const d = parseISO(v);
            if (!d) return "Enter a valid date";
            const y = d.getFullYear();
            if (y < 1900 || y > 2100) return "Year must be between 1900 and 2100";
            return "";
        },

        minDate(v, p, el, label) {
            const min = resolveDate(p);
            if (!min || !parseISO(v)) return "";
            return v >= min ? "" : label + " cannot be before " + formatDate(min);
        },

        maxDate(v, p, el, label) {
            const max = resolveDate(p);
            if (!max || !parseISO(v)) return "";
            return v <= max ? "" : label + " cannot be after " + formatDate(max);
        },

        after(v, p, el, label) {
            const other = document.querySelector(p);
            if (!other || !other.value || !parseISO(v)) return "";
            return v > other.value ? "" : label + " must be after " + getLabel(other).toLowerCase();
        },

        sameOrAfter(v, p, el, label) {
            const other = document.querySelector(p);
            if (!other || !other.value || !parseISO(v)) return "";
            return v >= other.value ? "" : label + " cannot be before " + getLabel(other).toLowerCase();
        },

        before(v, p, el, label) {
            const other = document.querySelector(p);
            if (!other || !other.value || !parseISO(v)) return "";
            return v < other.value ? "" : label + " must be before " + getLabel(other).toLowerCase();
        },

        futureDate(v, p, el, label) {
            if (!parseISO(v)) return "";
            return v > today() ? "" : label + " must be a future date";
        },

        notPast(v, p, el, label) {
            if (!parseISO(v)) return "";
            return v >= today() ? "" : label + " cannot be in the past";
        },

        pastDate(v, p, el, label) {
            if (!parseISO(v)) return "";
            return v < today() ? "" : label + " must be a past date";
        },

        notFuture(v, p, el, label) {
            if (!parseISO(v)) return "";
            return v <= today() ? "" : label + " cannot be in the future";
        },

        age(v, p) {
            const d = parseISO(v);
            if (!d) return "";
            const limit = new Date();
            limit.setFullYear(limit.getFullYear() - Number(p));
            return d <= limit ? "" : "You must be at least " + p + " years old";
        },

        /* ----- Files ----- */

        fileTypes(v, p, el) {
            if (!el || !el.files || !el.files.length) return "";
            const allowed = p.toLowerCase().split(",").map(s => s.trim());
            for (const file of el.files) {
                const ext = file.name.split(".").pop().toLowerCase();
                if (!allowed.includes(ext)) return "Only " + allowed.join(", ").toUpperCase() + " files are allowed";
            }
            return "";
        },

        maxSize(v, p, el) {
            if (!el || !el.files || !el.files.length) return "";
            for (const file of el.files) {
                if (file.size > Number(p) * 1024 * 1024) return "File must be smaller than " + p + " MB";
                if (file.size === 0) return "The selected file is empty";
            }
            return "";
        }
    };

    /* ---------------- Error display ---------------- */

    function errorElement(el, create) {
        if (el.dataset.error) return document.querySelector(el.dataset.error);
        if (el.id) {
            const byId = document.getElementById(el.id + "Error");
            if (byId) return byId;
        }
        const group = el.closest(".form-group, .input-group, .field");
        if (group) {
            const inGroup = group.querySelector(".error, .field-error");
            if (inGroup) return inGroup;
        }
        if (!create) return null;
        const small = document.createElement("small");
        small.className = "error";
        const anchor = el.closest(".password-wrap") || el;
        if (group) group.appendChild(small);
        else anchor.insertAdjacentElement("afterend", small);
        return small;
    }

    function setState(el, message) {
        const err = errorElement(el, !!message);
        if (message) {
            el.classList.add("is-invalid");
            el.classList.remove("is-valid");
            el.setAttribute("aria-invalid", "true");
            if (err) err.textContent = message;
        } else {
            el.classList.remove("is-invalid");
            el.removeAttribute("aria-invalid");
            if (getValue(el)) el.classList.add("is-valid");
            else el.classList.remove("is-valid");
            if (err) err.textContent = "";
        }
    }

    function shouldSkip(el) {
        if (el.hasAttribute("data-novalidate")) return true;
        if (SKIP_TYPES.includes(el.type)) return true;
        if (el.disabled) return true;
        // skip fields hidden from the user (inactive tabs, collapsed sections)
        if (el.type !== "file" && el.offsetParent === null && !el.closest(".modal-backdrop.open, .modal-overlay.open")) return true;
        return false;
    }

    function fieldError(el) {
        const rules = rulesFor(el);
        if (!rules.length) return "";
        const value = getValue(el);
        const label = getLabel(el);

        const isRequired = rules.some(r => r.name === "required" || r.name === "checked");

        for (const rule of rules) {
            if (!value && rule.name !== "required" && rule.name !== "checked") {
                if (!isRequired) return "";
                continue;
            }
            const fn = RULES[rule.name];
            if (!fn) continue;
            const msg = fn(value, rule.param, el, label);
            if (msg) return el.dataset["msg" + rule.name.charAt(0).toUpperCase() + rule.name.slice(1)] || msg;
        }
        return "";
    }

    function validateField(el) {
        if (shouldSkip(el)) {
            setState(el, "");
            return true;
        }
        const msg = fieldError(el);
        setState(el, msg);
        return !msg;
    }

    function resolveRoot(root) {
        if (!root) return document;
        if (typeof root === "string") return document.querySelector(root) || document;
        return root;
    }

    function validateForm(root, options) {
        options = Object.assign({ toast: true, focus: true }, options);
        const scope = resolveRoot(root);
        const fields = Array.from(scope.querySelectorAll(FIELD_SELECTOR));
        let firstInvalid = null;
        let firstMessage = "";
        let count = 0;

        fields.forEach(el => {
            el.dataset.touched = "1";
            if (!validateField(el)) {
                count++;
                if (!firstInvalid) {
                    firstInvalid = el;
                    firstMessage = fieldError(el);
                }
            }
        });

        if (firstInvalid) {
            if (options.focus) {
                firstInvalid.focus({ preventScroll: true });
                firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            if (options.toast && window.showToast) {
                const msg = options.message ||
                    (count === 1 ? firstMessage : firstMessage + " (and " + (count - 1) + " more field" + (count > 2 ? "s" : "") + ")");
                window.showToast(msg, "error", { title: "Please check the form" });
            }
            return false;
        }
        return true;
    }

    function reset(root) {
        const scope = resolveRoot(root);
        scope.querySelectorAll(FIELD_SELECTOR).forEach(el => {
            delete el.dataset.touched;
            el.classList.remove("is-invalid", "is-valid");
            el.removeAttribute("aria-invalid");
            const err = errorElement(el, false);
            if (err) err.textContent = "";
        });
    }

    /* ---------------- Input filters ---------------- */

    const FILTERS = {
        digits: v => v.replace(/\D/g, ""),
        decimal: v => {
            v = v.replace(/[^\d.]/g, "");
            const i = v.indexOf(".");
            return i === -1 ? v : v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, "");
        },
        letters: v => v.replace(/[^A-Za-z .'-]/g, "").replace(/^\s+/, ""),
        alphanumeric: v => v.replace(/[^A-Za-z0-9 ]/g, ""),
        upper: v => v.toUpperCase(),
        code: v => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
        nospace: v => v.replace(/\s/g, "")
    };

    // Filters implied by rules, with max length
    const AUTO_FILTER = {
        mobile: ["digits", 10],
        pincode: ["digits", 6],
        aadhaar: ["digits", 12],
        account: ["digits", 18],
        gst: ["code", 15],
        pan: ["code", 10],
        ifsc: ["code", 11],
        name: ["letters", 60],
        alpha: ["letters", null],
        email: ["nospace", 100],
        password: ["nospace", 20]
    };

    function setupFilter(el, rules) {
        let filters = (el.dataset.filter || "").split("|").filter(Boolean);
        let maxLen = null;

        rules.forEach(r => {
            const auto = AUTO_FILTER[r.name];
            if (auto) {
                if (!el.dataset.filter) filters.push(auto[0]);
                if (auto[1] && !el.getAttribute("maxlength")) maxLen = auto[1];
            }
            if (r.name === "maxlen" && !el.getAttribute("maxlength")) maxLen = Number(r.param);
        });

        if (maxLen && el.type !== "number" && el.type !== "date") el.setAttribute("maxlength", maxLen);

        // block e, E, + (and - when negatives aren't allowed) in number inputs
        if (el.type === "number") {
            const minRule = rules.find(r => r.name === "min");
            const allowNegative = minRule ? Number(minRule.param) < 0 : false;
            const allowDecimal = !rules.some(r => r.name === "integer");
            el.addEventListener("keydown", e => {
                const blocked = ["e", "E", "+"];
                if (!allowNegative) blocked.push("-");
                if (!allowDecimal) blocked.push(".");
                if (blocked.includes(e.key)) e.preventDefault();
            });
            el.addEventListener("wheel", () => el.blur(), { passive: true });
        }

        filters = [...new Set(filters)].filter(f => FILTERS[f]);
        if (!filters.length) return;

        el.addEventListener("input", () => {
            const start = el.selectionStart;
            const before = el.value;
            let v = before;
            filters.forEach(f => { v = FILTERS[f](v); });
            if (v !== before) {
                el.value = v;
                try {
                    const pos = Math.max(0, start - (before.length - v.length));
                    el.setSelectionRange(pos, pos);
                } catch (e) { /* not supported for this type */ }
            }
        });
    }

    /* ---------------- Date constraints for pickers ---------------- */

    function applyDateBounds(el, rules) {
        if (el.type !== "date") return;

        function update() {
            let min = "1900-01-01";
            let max = "2100-12-31";
            rules.forEach(r => {
                let val = "";
                switch (r.name) {
                    case "minDate": val = resolveDate(r.param); if (val && val > min) min = val; break;
                    case "maxDate": val = resolveDate(r.param); if (val && val < max) max = val; break;
                    case "notPast": if (today() > min) min = today(); break;
                    case "futureDate": if (addDays(1) > min) min = addDays(1); break;
                    case "notFuture": if (today() < max) max = today(); break;
                    case "pastDate": if (addDays(-1) < max) max = addDays(-1); break;
                    case "sameOrAfter": val = resolveDate(r.param); if (val && val > min) min = val; break;
                    case "after": {
                        val = resolveDate(r.param);
                        if (val) {
                            const d = parseISO(val);
                            if (d) { d.setDate(d.getDate() + 1); const next = toISO(d); if (next > min) min = next; }
                        }
                        break;
                    }
                    case "before": {
                        val = resolveDate(r.param);
                        if (val) {
                            const d = parseISO(val);
                            if (d) { d.setDate(d.getDate() - 1); const prev = toISO(d); if (prev < max) max = prev; }
                        }
                        break;
                    }
                    case "age": {
                        const d = new Date();
                        d.setFullYear(d.getFullYear() - Number(r.param));
                        if (toISO(d) < max) max = toISO(d);
                        break;
                    }
                }
            });
            el.min = min;
            el.max = max;
        }

        update();

        // keep bounds in sync with linked fields (#id params)
        rules.forEach(r => {
            if (r.param && String(r.param).startsWith("#")) {
                const other = document.querySelector(r.param);
                if (other) other.addEventListener("change", update);
            }
        });
    }

    /* ---------------- Binding ---------------- */

    function bindField(el) {
        if (el.dataset.vBound || SKIP_TYPES.includes(el.type) || el.hasAttribute("data-novalidate")) return;
        el.dataset.vBound = "1";

        const rules = rulesFor(el);
        setupFilter(el, rules);
        applyDateBounds(el, rules);

        // Mark required fields' labels with an asterisk if missing
        if (rules.some(r => r.name === "required")) {
            const group = el.closest(".form-group, .input-group, .field");
            const label = (el.id && document.querySelector('label[for="' + el.id + '"]')) || (group && group.querySelector("label"));
            if (label && !label.textContent.includes("*") && !label.querySelector(".req") && el.type !== "checkbox") {
                label.insertAdjacentHTML("beforeend", ' <span class="req">*</span>');
            }
        }

        const evt = (el.tagName === "SELECT" || el.type === "file" || el.type === "checkbox" || el.type === "date") ? "change" : "input";

        el.addEventListener(evt, () => {
            if (el.dataset.touched || el.classList.contains("is-invalid") || evt === "change") {
                el.dataset.touched = "1";
                validateField(el);
            }
            revalidateDependents(el);
        });

        el.addEventListener("blur", () => {
            if (getValue(el) || el.dataset.touched) {
                el.dataset.touched = "1";
                validateField(el);
            }
        });
    }

    // re-check fields that reference this one (match:#id, after:#id ...)
    function revalidateDependents(el) {
        if (!el.id) return;
        document.querySelectorAll('[data-rules*="#' + el.id + '"]').forEach(dep => {
            if (dep.dataset.touched && getValue(dep)) validateField(dep);
        });
    }

    function init(root) {
        const scope = resolveRoot(root);
        scope.querySelectorAll(FIELD_SELECTOR).forEach(bindField);

        // forms opting into automatic submit handling
        scope.querySelectorAll("form[data-validate]").forEach(form => {
            if (form.dataset.vBound) return;
            form.dataset.vBound = "1";
            form.setAttribute("novalidate", "");
            form.addEventListener("submit", e => {
                if (!validateForm(form)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true);
        });
    }

    /* ---------------- Expose ---------------- */

    window.Validator = {
        init,
        validateForm,
        validateField,
        reset,
        rules: RULES,
        check(rule, value, param) {
            const fn = RULES[rule];
            return fn ? fn(String(value || "").trim(), param, null, "This field") : "";
        },
        addRule(name, fn) { RULES[name] = fn; },
        today,
        addDays,
        formatDate,
        parseDate: parseISO
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => init(document));
    } else {
        init(document);
    }

    // pick up fields added dynamically (modals, rendered forms)
    if (window.MutationObserver) {
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (node.matches && node.matches(FIELD_SELECTOR)) bindField(node);
                    else if (node.querySelectorAll) node.querySelectorAll(FIELD_SELECTOR).forEach(bindField);
                });
            }
        });
        const start = () => observer.observe(document.body, { childList: true, subtree: true });
        if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
    }

})();
