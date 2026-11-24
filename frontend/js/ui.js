export const icons = {
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v6h-6"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  wifiOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M8.5 8.5A10 10 0 0 1 21 9"/><path d="M5 12.5a10 10 0 0 1 4-2.2"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M12 20h.01"/></svg>`,
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 6.5v11"/><path d="M3.5 9v6"/><path d="M17.5 6.5v11"/><path d="M20.5 9v6"/><path d="M6.5 12h11"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M6 20v-6"/><path d="M11 20V8"/><path d="M16 20v-9"/><path d="M21 20V4"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>`,
  arrowLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v6a5 5 0 0 1-10 0Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4"/><path d="M17 6h3v2a4 4 0 0 1-4 4"/></svg>`,
  weight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11l2.5 13H4Z"/><path d="M9 6.5V5a3 3 0 0 1 6 0v1.5"/></svg>`,
};

const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export function fmtNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtKg(value) {
  const number = Number(value);
  const digits = Number.isInteger(number) ? 0 : 1;
  return `${fmtNumber(number, digits)} kg`;
}

export function fmtVolume(value) {
  const number = Number(value) || 0;
  if (number >= 10000) {
    return `${fmtNumber(number / 1000, 1)} t`;
  }
  return `${fmtNumber(number)} kg`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const [year, month, day] = String(iso).split("-");
  const monthName = MONTHS[Number(month) - 1] || "";
  return `${day} ${monthName} ${year}`;
}

export function fmtDay(iso) {
  if (!iso) return "—";
  return String(iso).split("-")[2] || "—";
}

export function fmtMonth(iso) {
  if (!iso) return "";
  const month = Number(String(iso).split("-")[1]);
  return (MONTHS[month - 1] || "").toUpperCase();
}

export function fmtShortDate(iso) {
  if (!iso) return "—";
  const [, month, day] = String(iso).split("-");
  return `${day}/${month}`;
}

export function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function isoDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

let toastTimer = null;

export function toast(message, type = "info", duration = 3200) {
  const element = document.getElementById("toast");
  if (!element) return;
  element.textContent = message;
  element.className = `toast show${type === "info" ? "" : ` ${type}`}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.classList.remove("show");
  }, duration);
}

let escapeHandler = null;

export function openModal(contentHtml, { onClose } = {}) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `<div class="modal-backdrop"><div class="modal-card" role="dialog" aria-modal="true">${contentHtml}</div></div>`;
  const backdrop = root.firstElementChild;

  const close = () => {
    root.innerHTML = "";
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
    onClose?.();
  };

  escapeHandler = (event) => {
    if (event.key === "Escape") close();
  };
  document.addEventListener("keydown", escapeHandler);

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  root.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", close);
  });

  const focusable = root.querySelector("input, select, textarea, button");
  focusable?.focus({ preventScroll: true });

  return { root, close, backdrop };
}

export function confirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const modal = openModal(
      `<h2>${esc(title)}</h2>
       <p class="muted small" style="line-height:1.55">${esc(message)}</p>
       <div class="modal-actions">
         <button type="button" class="btn btn-ghost" data-cancel>${esc(cancelLabel)}</button>
         <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm>${esc(confirmLabel)}</button>
       </div>`,
      { onClose: () => settle(false) }
    );

    modal.root.querySelector("[data-cancel]").addEventListener("click", () => {
      settle(false);
      modal.close();
    });
    modal.root.querySelector("[data-confirm]").addEventListener("click", () => {
      settle(true);
      modal.close();
    });
  });
}

export function loadingList(count = 3) {
  return `<div class="list">${Array.from(
    { length: count },
    () => '<div class="skeleton skeleton-card"></div>'
  ).join("")}</div>`;
}

export function renderError(container, message, retry) {
  container.innerHTML = `<div class="empty">
      <div class="empty-icon">${icons.wifiOff}</div>
      <h3>Não foi possível carregar</h3>
      <p>${esc(message)}</p>
      ${
        retry
          ? `<button type="button" class="btn btn-ghost" data-retry>${icons.refresh} Tentar novamente</button>`
          : ""
      }
    </div>`;
  if (retry) {
    container.querySelector("[data-retry]")?.addEventListener("click", retry);
  }
}

export function emptyState({ icon = "dumbbell", title, text, actionLabel, actionHref }) {
  return `<div class="empty">
      <div class="empty-icon">${icons[icon] || icons.dumbbell}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${
        actionLabel && actionHref
          ? `<a class="btn btn-primary" href="${esc(actionHref)}">${esc(actionLabel)}</a>`
          : ""
      }
    </div>`;
}
