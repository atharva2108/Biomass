/* =========================================================
   BIOMASS CONNECT — TOAST + CONFIRM DIALOG
   ---------------------------------------------------------
   showToast(message, type?, options?)
     type:    "success" | "error" | "warning" | "info" (default "info")
     options: { title, duration (ms), onClose }  — or a callback function
   Examples:
     showToast("Listing created", "success");
     showToast("Please fix the highlighted fields", "error");
     showToast("Login successful", "success", () => location.href = "...");

   Toast.success / .error / .warning / .info (message, options)
   Toast.flash(message, type)      → show on the NEXT page (after redirect)
   Toast.redirect(url, message, type) → flash + navigate immediately

   confirmDialog({ title, message, confirmText, cancelText, danger })
     → Promise<boolean>   (replacement for window.confirm)
========================================================= */

(function () {

    const ICONS = {
        success: "fa-circle-check",
        error: "fa-circle-xmark",
        warning: "fa-triangle-exclamation",
        info: "fa-circle-info"
    };

    const TITLES = {
        success: "Success",
        error: "Error",
        warning: "Warning",
        info: "Notice"
    };

    const FLASH_KEY = "bc_flash_toast";

    function container() {
        let el = document.querySelector(".toast-container");
        if (!el) {
            el = document.createElement("div");
            el.className = "toast-container";
            el.setAttribute("aria-live", "polite");
            document.body.appendChild(el);
        }
        return el;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function showToast(message, type, options) {

        // Backward compatible signatures:
        // showToast(msg, callback) | showToast(msg, type, callback)
        if (typeof type === "function") {
            options = { onClose: type };
            type = "success";
        }
        if (typeof options === "function") {
            options = { onClose: options };
        }

        options = options || {};
        type = ICONS[type] ? type : "info";

        const duration = options.duration || (type === "error" ? 4000 : 3000);
        const title = options.title || TITLES[type];

        const toast = document.createElement("div");
        toast.className = "toast-item " + type;
        toast.setAttribute("role", type === "error" ? "alert" : "status");
        toast.innerHTML =
            '<i class="fa-solid ' + ICONS[type] + ' toast-icon"></i>' +
            '<div class="toast-content">' +
                '<div class="toast-title">' + escapeHtml(title) + '</div>' +
                '<div class="toast-message">' + escapeHtml(message) + '</div>' +
            '</div>' +
            '<button class="toast-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '<span class="toast-progress" style="animation-duration:' + duration + 'ms"></span>';

        const box = container();

        // keep at most 4 toasts on screen
        while (box.children.length >= 4) {
            box.removeChild(box.firstChild);
        }

        box.appendChild(toast);

        let closed = false;

        function close() {
            if (closed) return;
            closed = true;
            toast.classList.add("leaving");
            setTimeout(() => {
                toast.remove();
                if (typeof options.onClose === "function") {
                    options.onClose();
                }
            }, 200);
        }

        const timer = setTimeout(close, duration);

        toast.querySelector(".toast-close").addEventListener("click", () => {
            clearTimeout(timer);
            close();
        });

        return { close };
    }

    function flash(message, type) {
        try {
            sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type: type || "success" }));
        } catch (e) { /* storage unavailable */ }
    }

    function redirect(url, message, type) {
        if (message) flash(message, type);
        window.location.href = url;
    }

    function consumeFlash() {
        try {
            const raw = sessionStorage.getItem(FLASH_KEY);
            if (!raw) return;
            sessionStorage.removeItem(FLASH_KEY);
            const data = JSON.parse(raw);
            if (data && data.message) showToast(data.message, data.type);
        } catch (e) { /* ignore */ }
    }

    /* ---------------- Confirm dialog ---------------- */

    function confirmDialog(opts) {

        if (typeof opts === "string") opts = { message: opts };
        opts = opts || {};

        return new Promise(resolve => {

            const wrap = document.createElement("div");
            wrap.className = "modal-backdrop confirm-dialog open" + (opts.danger ? " danger" : "");
            wrap.innerHTML =
                '<div class="modal" role="dialog" aria-modal="true">' +
                    '<div class="modal-body">' +
                        '<div class="confirm-icon"><i class="fa-solid ' +
                            (opts.danger ? "fa-trash-can" : "fa-circle-question") + '"></i></div>' +
                        '<div>' +
                            '<h3 style="font-size:16px;margin-bottom:6px">' + escapeHtml(opts.title || "Are you sure?") + '</h3>' +
                            '<p class="text-muted" style="font-size:14px">' + escapeHtml(opts.message || "") + '</p>' +
                        '</div>' +
                    '</div>' +
                    '<div class="modal-footer">' +
                        '<button class="btn btn-secondary btn-cancel">' + escapeHtml(opts.cancelText || "Cancel") + '</button>' +
                        '<button class="btn btn-primary btn-confirm">' + escapeHtml(opts.confirmText || "Confirm") + '</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(wrap);

            function done(value) {
                document.removeEventListener("keydown", onKey);
                wrap.remove();
                resolve(value);
            }

            function onKey(e) {
                if (e.key === "Escape") done(false);
            }

            wrap.querySelector(".btn-cancel").addEventListener("click", () => done(false));
            wrap.querySelector(".btn-confirm").addEventListener("click", () => done(true));
            wrap.addEventListener("click", e => { if (e.target === wrap) done(false); });
            document.addEventListener("keydown", onKey);
            wrap.querySelector(".btn-confirm").focus();
        });
    }

    /* ---------------- Expose ---------------- */

    window.showToast = showToast;
    window.confirmDialog = confirmDialog;
    window.Toast = {
        show: showToast,
        success: (m, o) => showToast(m, "success", o),
        error: (m, o) => showToast(m, "error", o),
        warning: (m, o) => showToast(m, "warning", o),
        info: (m, o) => showToast(m, "info", o),
        flash: flash,
        redirect: redirect,
        confirm: confirmDialog
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", consumeFlash);
    } else {
        consumeFlash();
    }

})();
