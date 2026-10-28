import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Trash2,
  Calendar,
  Paperclip,
  Camera,
  Store,
  FileText,
  ArrowRight,
  LayoutGrid,
  List,
  Download,
  X,
  ChevronDown,
  Clock,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Edit2,
} from "lucide-react";

const cleanList = (arr) => {
  const seen = new Set();
  return (arr || [])
    .map((x) => String(x).replace(/\s+/g, " ").trim())
    .filter((x) => x && !seen.has(x) && seen.add(x));
};

/* ================= SCHEME CONFIGS & HELPERS ================= */
const TYPES = [
  "Scheme",
  "Launching",
  "Visibility",
  "Burst",
  "Payout",
  "Credit note",
  "CSM",
];

const TYPE_COLORS = {
  Scheme: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-300", bar: "#d97706" },
  Launching: { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-300", bar: "#e11d48" },
  Visibility: { bg: "bg-teal-50", text: "text-teal-800", border: "border-teal-300", bar: "#0d9488" },
  Burst: { bg: "bg-orange-50", text: "text-orange-800", border: "border-orange-300", bar: "#ea580c" },
  Payout: { bg: "bg-purple-50", text: "text-purple-800", border: "border-purple-300", bar: "#9333ea" },
  "Credit note": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-300", bar: "#2563eb" },
  CSM: { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-300", bar: "#059669" },
};

const getTypeColor = (t) =>
  TYPE_COLORS[t] || { bg: "bg-slate-50", text: "text-slate-800", border: "border-slate-300", bar: "#64748b" };

const BASIS_TYPES = new Set(["Scheme", "Launching"]);
const BASIS_LABEL = {
  bottle: "Bottle wise",
  box: "Box wise",
  amount: "Amount wise",
};
const UNIT_LABEL = {
  bottle: "Per bottle",
  box: "Per box",
  flat: "Flat amount",
};
const TYPE_HELP = {
  Scheme: "Buy and get free by bottle or box, or an amount per bottle or per box.",
  Launching: "Offer on a newly launched product, entered the same way as a scheme.",
  Visibility: "Amount for visibility. Flat, or per bottle, or per box.",
  Burst: "Amount earned when a target quantity of bottles or boxes is reached.",
  Payout: "Flat amount in rupees.",
  "Credit note": "Flat amount in rupees.",
  CSM: "Flat amount in rupees.",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const money = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const rupee = (n) => "\u20B9" + money.format(n);
const MAX_FILES = 6, MAX_BYTES = 20 * 1024 * 1024;

function todayISO() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}
function isoOf(dt) {
  return (
    dt.getFullYear() +
    "-" +
    String(dt.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(dt.getDate()).padStart(2, "0")
  );
}
function addDaysISO(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return isoOf(new Date(y, m - 1, d + n));
}
function endOfMonthISO(iso) {
  const [y, m] = iso.split("-").map(Number);
  return isoOf(new Date(y, m, 0));
}
function fmt(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return String(d).padStart(2, "0") + " " + MONTHS[m - 1] + " " + y;
}
function dayName(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
}
function utc(s) {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function diffDays(a, b) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}
function spanDays(a, b) {
  return diffDays(a, b) + 1;
}
function statusOf(r) {
  const t = todayISO();
  const f = r.fromDate || r.from_date;
  const to = r.toDate || r.to_date;
  return t < f ? "Upcoming" : t > to ? "Ended" : "Active";
}
function bytes(n) {
  return n > 1048576
    ? (n / 1048576).toFixed(1) + " MB"
    : Math.max(1, Math.round(n / 1024)) + " KB";
}
function unitOf(basis, n) {
  return basis === "box" ? (n === 1 ? "box" : "boxes") : n === 1 ? "bottle" : "bottles";
}
function plural(n, one, many) {
  return n + " " + (n === 1 ? one : many);
}
function lifeOf(r) {
  const t = todayISO(), st = statusOf(r);
  const f = r.fromDate || r.from_date;
  const to = r.toDate || r.to_date;
  if (st === "Upcoming") {
    const d = diffDays(t, f);
    return { text: d === 1 ? "Starts tomorrow" : `Starts in ${d} days`, pct: 0, warn: false };
  }
  if (st === "Ended") {
    const d = diffDays(to, t);
    return { text: d === 1 ? "Ended yesterday" : `Ended ${d} days ago`, pct: 100, warn: false };
  }
  const left = diffDays(t, to),
    pct = Math.round((spanDays(f, t) / spanDays(f, to)) * 100);
  return {
    text: left === 0 ? "Last day today" : left === 1 ? "1 day left" : `${left} days left`,
    pct,
    warn: left <= 3,
  };
}
function endingSoon(r) {
  const to = r.toDate || r.to_date;
  return statusOf(r) === "Active" && diffDays(todayISO(), to) <= 7;
}
function amtUnitOf(r) {
  const amtU = r.amtUnit || r.amt_unit;
  const b = r.basis;
  return amtU === "bottle" || amtU === "box" ? amtU : b === "box" || b === "bottle" ? b : "";
}
function basisText(r) {
  const targetQ = r.targetQty != null ? r.targetQty : r.target_qty;
  const targetU = r.targetUnit || r.target_unit;
  const stype = r.schemeType || r.scheme_type;
  const amtU = r.amtUnit || r.amt_unit;

  if (targetQ != null) return `Target in ${targetU === "box" ? "boxes" : "bottles"}`;
  if (r.basis === "amount") {
    const u = amtUnitOf(r);
    return `Amount wise${u ? ", per " + u : ""}`;
  }
  if (r.basis && BASIS_LABEL[r.basis]) return BASIS_LABEL[r.basis];
  if (stype === "Visibility") return amtU === "bottle" || amtU === "box" ? `Per ${amtU}` : "Flat amount";
  return "";
}
function uid() {
  return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
const isWhole = (v) =>
  v !== "" && !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0;

/* ================= STORAGE UTILS ================= */
function lsGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
}
function loadJSON(k, fallback) {
  try {
    const v = JSON.parse(lsGet(k));
    return v == null ? fallback : v;
  } catch (e) { return fallback; }
}

let dbPromise = null;
function openDB() {
  if (!dbPromise)
    dbPromise = new Promise((res, rej) => {
      try {
        const r = indexedDB.open("scheme_discussions", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("files", { keyPath: "id" });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  return dbPromise;
}
async function putFile(id, blob) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const t = d.transaction("files", "readwrite");
    t.objectStore("files").put({ id, blob });
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function getFile(id) {
  const d = await openDB();
  return new Promise((res, rej) => {
    const q = d.transaction("files", "readonly").objectStore("files").get(id);
    q.onsuccess = () => res(q.result ? q.result.blob : null);
    q.onerror = () => rej(q.error);
  });
}
async function delFile(id) {
  try {
    const d = await openDB();
    const t = d.transaction("files", "readwrite");
    t.objectStore("files").delete(id);
  } catch (e) {}
}

async function prepImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s);
    c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    if (blob && blob.size < file.size)
      return new File([blob], (file.name || "photo").replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch (e) {}
  return file;
}

/* ================= ATTACHMENTS ================= */
function useFileUrl(attachment) {
  const [url, setUrl] = useState(attachment?.url || "");
  useEffect(() => {
    if (attachment?.url) {
      setUrl(attachment.url);
      return;
    }
    let alive = true, made = "";
    if (attachment?.id) {
      getFile(attachment.id)
        .then((b) => {
          if (alive && b) {
            made = URL.createObjectURL(b);
            setUrl(made);
          }
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [attachment]);
  return url;
}

function AttachItem({ a, onOpen }) {
  const url = useFileUrl(a);
  const isImg = (a.type || "").indexOf("image/") === 0;
  if (isImg) {
    return (
      <button
        type="button"
        className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:opacity-90 transition-opacity cursor-pointer shrink-0"
        aria-label={"View " + a.name}
        onClick={() => url && onOpen(url, a.name)}
      >
        {url ? <img src={url} alt={a.name || "Attachment"} className="w-full h-full object-cover" /> : null}
      </button>
    );
  }
  return (
    <a
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors max-w-full truncate"
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      download={a.name}
    >
      <FileText size={14} className="shrink-0 text-slate-400" />
      <span className="truncate">{a.name || "File"}</span>
    </a>
  );
}

function AttachStrip({ atts, onOpen }) {
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {atts.map((a, i) => (
        <AttachItem key={a.id || i} a={a} onOpen={onOpen} />
      ))}
    </div>
  );
}

/* ================= DEAL TICKET BLOCK ================= */
function Ticket({ r }) {
  const targetQ = r.targetQty != null ? r.targetQty : r.target_qty;
  const targetU = r.targetUnit || r.target_unit;
  const amt = r.amount != null ? r.amount : null;
  const qty = r.qty != null ? r.qty : null;
  const freeQ = r.freeQty != null ? r.freeQty : r.free_qty;
  const u = amtUnitOf(r);
  const bt = basisText(r);

  const parts = [];
  if (targetQ != null) {
    parts.push(
      <div key="t" className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target</span>
        <span className="text-xl font-bold font-mono text-slate-900">{targetQ}</span>
        <span className="text-[11px] text-slate-500">{unitOf(targetU, targetQ)}</span>
      </div>,
      <span key="a" className="text-slate-400 flex items-center">
        <ArrowRight size={18} />
      </span>,
      <div key="b" className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Burst Amount</span>
        <span className="text-xl font-bold font-mono text-emerald-600">{rupee(amt == null ? 0 : amt)}</span>
      </div>
    );
  } else if (qty != null && (r.basis === "box" || r.basis === "bottle")) {
    const f = freeQ == null ? 0 : freeQ;
    parts.push(
      <div key="q" className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Buy</span>
        <span className="text-xl font-bold font-mono text-indigo-600">{qty}</span>
        <span className="text-[11px] text-slate-500">{unitOf(r.basis, qty)}</span>
      </div>,
      <span key="a" className="text-slate-400 flex items-center">
        <ArrowRight size={18} />
      </span>,
      <div key="f" className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Get Free</span>
        <span className="text-xl font-bold font-mono text-emerald-600">{f}</span>
        <span className="text-[11px] text-slate-500">{unitOf(r.basis, f)}</span>
      </div>
    );
  } else {
    if (amt != null) {
      parts.push(
        <div key="m" className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Amount</span>
          <span className="text-xl font-bold font-mono text-slate-900">{rupee(amt)}</span>
          {u && <span className="text-[11px] text-slate-500">per {u}</span>}
        </div>
      );
    }
    if (freeQ != null && qty == null && (r.basis === "box" || r.basis === "bottle")) {
      parts.push(
        <div key="f" className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Free Qty</span>
          <span className="text-xl font-bold font-mono text-emerald-600">{freeQ}</span>
          <span className="text-[11px] text-slate-500">{unitOf(r.basis, freeQ)}</span>
        </div>
      );
    }
  }

  if (!parts.length) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap bg-slate-50 border border-dashed border-slate-200 rounded-lg p-2.5">
      {parts}
      {bt && <span className="ml-auto text-[11px] font-medium text-slate-400 self-end">{bt}</span>}
    </div>
  );
}

function dealString(r) {
  const targetQ = r.targetQty != null ? r.targetQty : r.target_qty;
  const targetU = r.targetUnit || r.target_unit;
  const amt = r.amount != null ? r.amount : null;
  const qty = r.qty != null ? r.qty : null;
  const freeQ = r.freeQty != null ? r.freeQty : r.free_qty;

  if (targetQ != null)
    return `Target ${plural(targetQ, unitOf(targetU, 1), unitOf(targetU, 2))}, ${rupee(amt == null ? 0 : amt)}`;
  if (qty != null && (r.basis === "box" || r.basis === "bottle"))
    return `Buy ${plural(qty, unitOf(r.basis, 1), unitOf(r.basis, 2))}, free ${freeQ == null ? 0 : freeQ}`;
  if (amt != null) return `${rupee(amt)}${amtUnitOf(r) ? " per " + amtUnitOf(r) : ""}`;
  return "-";
}

/* ================= CARD VIEW COMPONENT ================= */
function Card({ r, pending, setPending, onDelete, onEdit, onOpen }) {
  const st = statusOf(r), life = lifeOf(r);
  const stype = r.schemeType || r.scheme_type;
  const fromD = r.fromDate || r.from_date;
  const toD = r.toDate || r.to_date;
  const isAll = r.allStores || r.all_stores;
  const storesList = r.stores || [];
  const colorCfg = getTypeColor(stype);

  const statusBadgeClass =
    st === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : st === "Upcoming"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
      <div className="flex justify-between items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colorCfg.bg} ${colorCfg.text} ${colorCfg.border}`}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorCfg.bar }} />
          {stype}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${statusBadgeClass}`}>
          {st}
        </span>
      </div>

      <h3 className={`font-bold text-lg text-slate-900 leading-snug break-words ${r.trader ? "" : "text-slate-400 italic"}`}>
        {r.trader || "Trader not set"}
      </h3>

      {(r.company || r.brand) && (
        <div className="flex flex-col gap-1 text-xs">
          {r.company && (
            <div className="flex gap-2">
              <b className="w-16 text-slate-400 font-medium shrink-0">Company:</b>
              <span className="text-slate-700 font-medium truncate">{r.company}</span>
            </div>
          )}
          {r.brand && (
            <div className="flex gap-2">
              <b className="w-16 text-slate-400 font-medium shrink-0">Brand:</b>
              <span className="text-slate-700 font-medium truncate">{r.brand}</span>
            </div>
          )}
        </div>
      )}

      <Ticket r={r} />

      <div className="space-y-1.5 text-xs text-slate-500">
        <div className="flex items-center justify-between font-mono">
          <span className="flex items-center gap-1.5 text-slate-700">
            <Calendar size={13} className="text-slate-400" />
            {fmt(fromD)} → {fmt(toD)}
          </span>
          <span className="text-slate-400 text-[11px]">
            {plural(spanDays(fromD, toD), "day", "days")}
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${life.pct}%`, backgroundColor: colorCfg.bar }}
          />
        </div>
        <div className={`text-[11px] font-medium ${life.warn ? "text-amber-600 font-bold" : "text-slate-500"}`}>
          {life.text}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-1.5 pt-1">
        <Store size={13} className="text-slate-400 shrink-0" />
        {(isAll ? ["All Store"] : storesList).map((s) => (
          <span key={s} className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {s}
          </span>
        ))}
      </div>

      <p className={`text-xs text-slate-600 whitespace-pre-wrap break-words ${r.discussion ? "" : "italic text-slate-400"}`}>
        {r.discussion || "No discussion notes."}
      </p>

      {(r.attachments || []).length > 0 && <AttachStrip atts={r.attachments} onOpen={onOpen} />}

      <div className="flex justify-between items-center pt-2 mt-auto border-t border-slate-100 text-[11px] text-slate-400">
        <span>Logged {fmt(r.date)}</span>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer text-xs font-semibold"
              onClick={() => onEdit(r)}
            >
              <Edit2 size={13} /> Edit
            </button>
          )}
          {pending === r.id ? (
            <span className="flex items-center gap-2">
              <button
                type="button"
                className="text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                onClick={() => onDelete(r.id)}
              >
                Confirm
              </button>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700 cursor-pointer"
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
              onClick={() => setPending(r.id)}
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ================= TABLE ROW COMPONENT ================= */
function TableRow({ r, pending, setPending, onDelete, onEdit, onOpen }) {
  const st = statusOf(r), bt = basisText(r);
  const stype = r.schemeType || r.scheme_type;
  const fromD = r.fromDate || r.from_date;
  const toD = r.toDate || r.to_date;
  const isAll = r.allStores || r.all_stores;
  const storesList = r.stores || [];
  const colorCfg = getTypeColor(stype);

  const statusBadgeClass =
    st === "Active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : st === "Upcoming"
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <tr className="hover:bg-slate-50/70 transition-colors border-b border-slate-100">
      <td className="px-3.5 py-3 font-mono text-xs text-slate-600 whitespace-nowrap">{fmt(r.date)}</td>
      <td className="px-3.5 py-3 font-semibold text-slate-900">{r.trader || <span className="text-slate-400 italic">Not set</span>}</td>
      <td className="px-3.5 py-3 text-xs">
        <div className="font-medium text-slate-800">{r.company || "-"}</div>
        {r.brand && <div className="text-slate-400 text-[11px]">{r.brand}</div>}
      </td>
      <td className="px-3.5 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${colorCfg.bg} ${colorCfg.text} ${colorCfg.border}`}>
          {stype}
        </span>
        <br />
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border mt-1 ${statusBadgeClass}`}>
          {st}
        </span>
      </td>
      <td className="px-3.5 py-3 text-xs">
        <div className="font-medium text-slate-800">{dealString(r)}</div>
        {bt && <div className="text-[11px] text-slate-400">{bt}</div>}
      </td>
      <td className="px-3.5 py-3 font-mono text-xs whitespace-nowrap">
        <div className="text-slate-800">{fmt(fromD)}</div>
        <div className="text-slate-400 text-[11px]">to {fmt(toD)}</div>
        <div className="text-[10px] text-slate-500">{lifeOf(r).text}</div>
      </td>
      <td className="px-3.5 py-3 text-xs text-slate-600">{isAll ? "All Store" : storesList.join(", ")}</td>
      <td className="px-3.5 py-3 text-xs text-slate-600 max-w-xs break-words">{r.discussion || "-"}</td>
      <td className="px-3.5 py-3 whitespace-nowrap">
        {(r.attachments || []).length > 0 && <AttachStrip atts={r.attachments} onOpen={onOpen} />}
      </td>
      <td className="px-3.5 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {onEdit && (
            <button
              type="button"
              className="text-slate-400 hover:text-indigo-600 p-1 rounded transition-colors cursor-pointer"
              title="Edit"
              onClick={() => onEdit(r)}
            >
              <Edit2 size={15} />
            </button>
          )}
          {pending === r.id ? (
            <span className="flex items-center gap-2 justify-end text-xs">
              <button type="button" className="text-red-600 font-bold hover:underline" onClick={() => onDelete(r.id)}>Confirm</button>
              <button type="button" className="text-slate-500 hover:underline" onClick={() => setPending(null)}>Cancel</button>
            </span>
          ) : (
            <button type="button" className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer" title="Delete" onClick={() => setPending(r.id)}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ================= SEARCHABLE COMBOBOX ================= */
function Combo({ id, items, value, onChange, placeholder, label }) {
  const [text, setText] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  const q = text.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? (items || []).filter((x) => x.toLowerCase().includes(q)) : items || []),
    [items, q]
  );
  const shown = matches.slice(0, 60);

  const pick = (x) => {
    onChange(x);
    setText(x);
    setOpen(false);
  };

  const onBlur = () => {
    let v = value;
    if (!v && items) {
      const ex = items.find((x) => x.toLowerCase() === text.trim().toLowerCase());
      if (ex) {
        v = ex;
        onChange(ex);
      }
    }
    setText(v || "");
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-label={label}
        value={text}
        onFocus={() => {
          setOpen(true);
          setActive(-1);
        }}
        onChange={(e) => {
          setText(e.target.value);
          if (value) onChange("");
          setOpen(true);
          setActive(-1);
        }}
        onBlur={onBlur}
        onKeyDown={onKey}
        className="w-full px-3 py-2 pr-8 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
      />
      {text && (
        <button
          className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 text-sm font-bold"
          type="button"
          aria-label={"Clear " + label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onChange("");
            setText("");
          }}
        >
          ✕
        </button>
      )}
      {open && (
        <ul
          role="listbox"
          className="absolute z-30 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl p-1 text-sm divide-y divide-slate-50"
        >
          {shown.map((x, i) => (
            <li
              key={x}
              role="option"
              className={`px-3 py-2 rounded cursor-pointer transition-colors ${
                i === active ? "bg-indigo-50 text-indigo-700 font-semibold" : "hover:bg-slate-50 text-slate-700"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(x);
              }}
            >
              {x}
            </li>
          ))}
          {!matches.length && <li className="px-3 py-2 text-xs text-slate-400">No match</li>}
          {matches.length > 60 && (
            <li className="px-3 py-1.5 text-[11px] text-slate-400 text-center">
              {matches.length - 60} more, keep typing to narrow
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ================= SEGMENTED BUTTONS ================= */
function Seg({ id, label, options, value, onChange }) {
  return (
    <div className="flex w-full bg-slate-100 p-0.5 rounded-lg border border-slate-200" id={id} role="radiogroup" aria-label={label}>
      {options.map(([v, t]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            value === v ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/* ================= CREATE MODAL ================= */
const emptyForm = () => ({
  trader: "",
  company: "",
  brand: "",
  from: todayISO(),
  to: "",
  type: "",
  basis: "",
  unit: "",
  tunit: "",
  qty: "",
  free: "",
  amount: "",
  target: "",
  disc: "",
  all: false,
  selected: [],
});

function CreateModal({ initialData, stores, setStores, onClose, onSave, tradersList, companiesList, brandsList }) {
  const [f, setF] = useState(() => {
    if (!initialData) return emptyForm();
    return {
      trader: initialData.trader || "",
      company: initialData.company || "",
      brand: initialData.brand || "",
      from: initialData.fromDate || initialData.from_date || todayISO(),
      to: initialData.toDate || initialData.to_date || "",
      type: initialData.schemeType || initialData.scheme_type || "",
      basis: initialData.basis || "",
      unit: initialData.amtUnit || initialData.amt_unit || "",
      tunit: initialData.targetUnit || initialData.target_unit || "",
      qty: initialData.qty != null ? String(initialData.qty) : "",
      free: initialData.freeQty != null ? String(initialData.freeQty) : "",
      amount: initialData.amount != null ? String(initialData.amount) : "",
      target: initialData.targetQty != null ? String(initialData.targetQty) : "",
      disc: initialData.discussion || "",
      all: Boolean(initialData.allStores ?? initialData.all_stores),
      selected: initialData.stores || [],
    };
  });
  const [existingAtts, setExistingAtts] = useState(() => initialData?.attachments || []);
  const [pend, setPend] = useState([]);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState("");
  const [newStore, setNewStore] = useState("");
  const camRef = useRef(null),
    fileRef = useRef(null),
    pendRef = useRef([]);
  pendRef.current = pend;

  useEffect(() => () => pendRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const set = (patch) => {
    setF((p) => ({ ...p, ...patch }));
    setErr(null);
  };
  const needs = BASIS_TYPES.has(f.type);
  const unitBasis = needs && (f.basis === "bottle" || f.basis === "box");
  const needsUnit = (needs && f.basis === "amount") || f.type === "Visibility";
  const burst = f.type === "Burst";
  const perUnit = f.unit === "bottle" || f.unit === "box" ? f.unit : "";
  const tUnitName = f.tunit === "box" ? "boxes" : f.tunit === "bottle" ? "bottles" : "";
  const showAmount = !!f.type && !(needs && f.basis !== "amount");

  const chooseType = (t) => {
    setF((p) => {
      const n = { ...p, type: t };
      if (!BASIS_TYPES.has(t)) n.basis = "";
      if (t === "Visibility") {
        if (p.type !== "Visibility") n.unit = "flat";
      } else if (!BASIS_TYPES.has(p.type) || !BASIS_TYPES.has(t)) n.unit = "";
      if (t !== "Burst") n.tunit = "";
      return n;
    });
    setErr(null);
  };

  const days =
    f.from && f.to
      ? f.to >= f.from
        ? `${plural(spanDays(f.from, f.to), "day", "days")} in this period`
        : "The to date is before the from date."
      : "";
  const preset = (fn) => set({ from: f.from || todayISO(), to: fn(f.from || todayISO()) });

  const summary = useMemo(() => {
    const aOk = showAmount && f.amount !== "" && !isNaN(+f.amount);
    if (burst) {
      if (f.tunit && f.target !== "" && aOk)
        return (
          <>
            Reach <b>{plural(+f.target, unitOf(f.tunit, 1), unitOf(f.tunit, 2))}</b>, earn <b>{rupee(+f.amount)}</b>
          </>
        );
      return null;
    }
    if (unitBasis && f.qty !== "" && f.free !== "")
      return (
        <>
          Buy <b>{plural(+f.qty, unitOf(f.basis, 1), unitOf(f.basis, 2))}</b>, get <b>{plural(+f.free, unitOf(f.basis, 1), unitOf(f.basis, 2))} free</b>
        </>
      );
    if (aOk)
      return (
        <>
          {needs ? "Amount wise: " : `${f.type}: `}
          <b>{rupee(+f.amount) + (needsUnit && perUnit ? " per " + perUnit : "")}</b>
        </>
      );
    return null;
  }, [f, burst, unitBasis, needs, needsUnit, perUnit, showAmount]);

  async function addFiles(list) {
    const next = [];
    for (const file of Array.from(list)) {
      if (pendRef.current.length + next.length >= MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files`);
        break;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is larger than 20 MB`);
        continue;
      }
      const prepared = await prepImage(file);
      const isImg = (prepared.type || "").indexOf("image/") === 0;
      next.push({
        file: prepared,
        name: file.name || "photo.jpg",
        type: prepared.type || "application/octet-stream",
        size: prepared.size,
        preview: isImg ? URL.createObjectURL(prepared) : "",
      });
    }
    setPend((p) => p.concat(next));
  }

  const removePend = (i) =>
    setPend((p) => {
      if (p[i].preview) URL.revokeObjectURL(p[i].preview);
      return p.filter((_, j) => j !== i);
    });

  const addStore = () => {
    const v = newStore.replace(/\s+/g, " ").trim();
    if (!v) return;
    if (stores.some((s) => s.toLowerCase() === v.toLowerCase())) {
      toast.error("That store is already listed");
      return;
    }
    setNewStore("");
    const updated = stores.concat(v);
    setStores(updated);
    lsSet("sd_stores", JSON.stringify(updated));
    set({ selected: f.selected.concat(v) });
  };

  const removeStore = (s) => {
    const updated = stores.filter((x) => x !== s);
    setStores(updated);
    lsSet("sd_stores", JSON.stringify(updated));
    set({ selected: f.selected.filter((x) => x !== s) });
  };

  const toggleStore = (s) =>
    set({
      selected: f.selected.includes(s)
        ? f.selected.filter((x) => x !== s)
        : f.selected.concat(s),
    });

  const fail = (msg, field, elId) => {
    setErr({ msg, field });
    setTimeout(() => {
      const el = document.getElementById(elId || field);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) el.focus({ preventScroll: true });
      }
    }, 30);
  };

  async function submit(e) {
    e.preventDefault();
    if (!f.from) return fail("Enter the from date.", "from", "fFrom");
    if (!f.to) return fail("Enter the to date.", "to", "fTo");
    if (f.to < f.from) return fail("The to date must be on or after the from date.", "to", "fTo");
    if (!f.type) return fail("Choose a scheme type.", "type", "typeGrid");
    if (needs && !f.basis) return fail("Choose Bottle wise, Box wise or Amount wise.", "basis", "basisSeg");
    if (needsUnit && !f.unit) return fail("Choose whether the amount is per bottle or per box.", "unit", "unitSeg");
    if (burst && !f.tunit) return fail("Choose whether the target is in bottles or boxes.", "tunit", "targetSeg");
    const u = f.basis === "box" ? "boxes" : "bottles";
    if (burst && (!isWhole(f.target) || Number(f.target) < 1))
      return fail(`Enter the target qty in ${tUnitName} as a whole number.`, "target", "fTarget");
    if (unitBasis) {
      if (!isWhole(f.qty) || Number(f.qty) < 1)
        return fail(`Enter the qty in ${u} as a whole number.`, "qty", "fQty");
      if (!isWhole(f.free))
        return fail(`Enter the free qty in ${u} as a whole number.`, "free", "fFree");
    } else if (f.amount === "" || isNaN(Number(f.amount)) || Number(f.amount) < 0) {
      return fail(burst ? "Enter the burst amount." : "Enter the amount.", "amount", "fAmount");
    }
    if (!f.all && !f.selected.length) return fail("Choose All Store or tick at least one store.", "stores", "storeGrid");

    setErr(null);
    const atts = [];
    try {
      for (let i = 0; i < pend.length; i++) {
        setSaving(`Saving file ${i + 1} of ${pend.length}...`);
        const id = "f" + uid();
        let publicUrl = "";

        try {
          const fileExt = (pend[i].name || "").split(".").pop() || "jpg";
          const filePath = `${Date.now()}_${id}.${fileExt}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("scheme_attachments")
            .upload(filePath, pend[i].file, { upsert: true });

          if (!uploadErr && uploadData?.path) {
            const { data: urlData } = supabase.storage
              .from("scheme_attachments")
              .getPublicUrl(uploadData.path);
            if (urlData?.publicUrl) publicUrl = urlData.publicUrl;
          }
        } catch (e) {}

        await putFile(id, pend[i].file);
        atts.push({
          id,
          name: pend[i].name,
          type: pend[i].type,
          size: pend[i].size,
          url: publicUrl,
        });
      }
    } catch (x) {
      atts.forEach((a) => delFile(a.id));
      setSaving("");
      return setErr({ msg: "A file could not be saved. Remove it or try again.", field: "files" });
    }

    const rec = {
      id: initialData?.id || uid(),
      date: initialData?.date || todayISO(),
      trader: f.trader,
      company: f.company,
      brand: f.brand,
      fromDate: f.from,
      toDate: f.to,
      schemeType: f.type,
      basis: needs ? f.basis : "",
      amtUnit: needsUnit ? f.unit : "",
      targetQty: burst ? Number(f.target) : null,
      targetUnit: burst ? f.tunit : "",
      qty: unitBasis ? Number(f.qty) : null,
      freeQty: unitBasis ? Number(f.free) : null,
      amount: unitBasis ? null : Number(f.amount),
      allStores: f.all,
      stores: f.all ? [] : stores.filter((s) => f.selected.includes(s)),
      discussion: f.disc.trim(),
      attachments: [...existingAtts, ...atts],
      createdAt: initialData?.createdAt || Date.now(),
    };

    onSave(rec);
  }

  const bad = (k) => (err && err.field === k ? "ring-2 ring-red-500 rounded-lg p-1" : "");

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {initialData ? "Edit scheme discussion" : "New scheme discussion"}
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {initialData ? `Logged ${fmt(initialData.date || todayISO())}` : `Today, ${dayName(todayISO())} ${fmt(todayISO())}`}
            </p>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={submit} noValidate className="overflow-y-auto flex-1 p-6 space-y-6 text-sm">
          {/* Section: Parties */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
              Parties
            </h3>
            <div className="space-y-1">
              <label htmlFor="tIn" className="text-xs font-semibold text-slate-700">Trader</label>
              <Combo id="tIn" items={tradersList} value={f.trader} onChange={(v) => set({ trader: v })} placeholder="Search or select trader" label="trader" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="cIn" className="text-xs font-semibold text-slate-700">Company</label>
                <Combo id="cIn" items={companiesList} value={f.company} onChange={(v) => set({ company: v })} placeholder="Search company" label="company" />
              </div>
              <div className="space-y-1">
                <label htmlFor="bIn" className="text-xs font-semibold text-slate-700">Brand</label>
                <Combo id="bIn" items={brandsList} value={f.brand} onChange={(v) => set({ brand: v })} placeholder="Search brand" label="brand" />
              </div>
            </div>
          </section>

          {/* Section: Period */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
              Period
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`space-y-1 ${bad("from")}`}>
                <label htmlFor="fFrom" className="text-xs font-semibold text-slate-700">From date</label>
                <input
                  id="fFrom"
                  type="date"
                  value={f.from}
                  onChange={(e) => set({ from: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800"
                />
              </div>
              <div className={`space-y-1 ${bad("to")}`}>
                <label htmlFor="fTo" className="text-xs font-semibold text-slate-700">To date</label>
                <input
                  id="fTo"
                  type="date"
                  value={f.to}
                  onChange={(e) => set({ to: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => preset((x) => addDaysISO(x, 6))}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                7 days
              </button>
              <button
                type="button"
                onClick={() => preset((x) => addDaysISO(x, 14))}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                15 days
              </button>
              <button
                type="button"
                onClick={() => preset((x) => addDaysISO(x, 29))}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                30 days
              </button>
              <button
                type="button"
                onClick={() => preset(endOfMonthISO)}
                className="px-2.5 py-1 text-xs font-medium rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
              >
                Till month end
              </button>
            </div>
            {days && <p className="text-xs text-slate-500 italic">{days}</p>}
          </section>

          {/* Section: Scheme */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
              Scheme & Deal
            </h3>
            <div className={`space-y-2 ${bad("type")}`}>
              <span className="text-xs font-semibold text-slate-700">Scheme Type</span>
              <div className="flex flex-wrap gap-2" id="typeGrid">
                {TYPES.map((t) => {
                  const cfg = getTypeColor(t);
                  const isChecked = f.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={isChecked}
                      onClick={() => chooseType(t)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isChecked
                          ? `${cfg.bg} ${cfg.text} ${cfg.border} ring-2 ring-indigo-500/20 shadow-xs`
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.bar }} />
                      {t}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 italic">
                {f.type ? TYPE_HELP[f.type] : "Choose what was discussed with the trader."}
              </p>
            </div>

            {f.type && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                {needs && (
                  <div className={`space-y-1 ${bad("basis")}`}>
                    <span className="text-xs font-semibold text-slate-700">Counted By</span>
                    <Seg
                      id="basisSeg"
                      label="Basis"
                      value={f.basis}
                      onChange={(v) => set({ basis: v })}
                      options={[
                        ["bottle", "Bottle wise"],
                        ["box", "Box wise"],
                        ["amount", "Amount wise"],
                      ]}
                    />
                  </div>
                )}

                {needsUnit && (
                  <div className={`space-y-1 ${bad("unit")}`}>
                    <span className="text-xs font-semibold text-slate-700">
                      {f.type === "Visibility" ? "Visibility amount is" : "Amount is"}
                    </span>
                    <Seg
                      id="unitSeg"
                      label="Amount basis"
                      value={f.unit}
                      onChange={(v) => set({ unit: v })}
                      options={(f.type === "Visibility"
                        ? ["flat", "bottle", "box"]
                        : ["bottle", "box"]
                      ).map((v) => [v, UNIT_LABEL[v]])}
                    />
                  </div>
                )}

                {burst && (
                  <div className="space-y-3">
                    <div className={`space-y-1 ${bad("tunit")}`}>
                      <span className="text-xs font-semibold text-slate-700">Target counted in</span>
                      <Seg
                        id="targetSeg"
                        label="Target counted in"
                        value={f.tunit}
                        onChange={(v) => set({ tunit: v })}
                        options={[
                          ["bottle", "Bottles"],
                          ["box", "Boxes"],
                        ]}
                      />
                    </div>
                    <div className={`space-y-1 ${bad("target")}`}>
                      <label htmlFor="fTarget" className="text-xs font-semibold text-slate-700">
                        Target qty {tUnitName ? `(in ${tUnitName})` : ""}
                      </label>
                      <input
                        id="fTarget"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        value={f.target}
                        onChange={(e) => set({ target: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {unitBasis && (
                    <>
                      <div className={`space-y-1 ${bad("qty")}`}>
                        <label htmlFor="fQty" className="text-xs font-semibold text-slate-700">
                          Qty (in {f.basis === "box" ? "boxes" : "bottles"})
                        </label>
                        <input
                          id="fQty"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="0"
                          value={f.qty}
                          onChange={(e) => set({ qty: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800"
                        />
                      </div>
                      <div className={`space-y-1 ${bad("free")}`}>
                        <label htmlFor="fFree" className="text-xs font-semibold text-slate-700">
                          Free qty (in {f.basis === "box" ? "boxes" : "bottles"})
                        </label>
                        <input
                          id="fFree"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={f.free}
                          onChange={(e) => set({ free: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800"
                        />
                      </div>
                    </>
                  )}

                  {showAmount && (
                    <div className={`space-y-1 ${bad("amount")}`}>
                      <label htmlFor="fAmount" className="text-xs font-semibold text-slate-700">
                        {burst ? "Burst amount (₹)" : "Amount (₹)"}
                      </label>
                      <input
                        id="fAmount"
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={f.amount}
                        onChange={(e) => set({ amount: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {summary && (
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-indigo-700 font-medium">
                    {summary}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section: Stores */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
              Stores Applicable
            </h3>
            <div className={`space-y-2 ${bad("stores")}`}>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.all}
                  onChange={(e) => set({ all: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                All Stores
              </label>

              <div className="flex flex-wrap gap-2 pt-1" id="storeGrid">
                {stores.map((s) => (
                  <label
                    key={s}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      f.all || f.selected.includes(s)
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={f.all || f.selected.includes(s)}
                      disabled={f.all}
                      onChange={() => toggleStore(s)}
                      className="rounded text-indigo-600"
                    />
                    <span>{s}</span>
                    {!f.all && (
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500 font-bold ml-1"
                        onClick={(e) => {
                          e.preventDefault();
                          removeStore(s);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add store name"
                value={newStore}
                onChange={(e) => setNewStore(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStore();
                  }
                }}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
              />
              <button
                type="button"
                onClick={addStore}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Add store
              </button>
            </div>
          </section>

          {/* Section: Notes & Files */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
              Notes & Attachments
            </h3>
            <div className="space-y-1">
              <label htmlFor="fDisc" className="text-xs font-semibold text-slate-700">Discussion Notes</label>
              <textarea
                id="fDisc"
                rows={3}
                placeholder="What was discussed, special conditions, or agreed terms"
                value={f.disc}
                onChange={(e) => set({ disc: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 resize-y"
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700">Photos & Documents</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => camRef.current.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Camera size={15} /> Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Paperclip size={15} /> Attach File
                </button>
              </div>

              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {/* Existing Attachments in Edit Mode */}
              {existingAtts.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Attached Files:</span>
                  <ul className="space-y-1.5">
                    {existingAtts.map((att, idx) => (
                      <li key={att.id || idx} className="flex items-center gap-2.5 p-2 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs">
                        <FileText size={16} className="text-indigo-600 shrink-0" />
                        <span className="flex-1 min-w-0 font-medium text-slate-800 truncate">{att.name || "Attachment"}</span>
                        {att.url && (
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold shrink-0">
                            View
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setExistingAtts((prev) => prev.filter((_, j) => j !== idx))}
                          className="text-slate-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                          title="Remove attached file"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pend.length > 0 && (
                <ul className="space-y-2 pt-1">
                  {pend.map((p, i) => (
                    <li key={p.name + i} className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                      {p.preview ? (
                        <img src={p.preview} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-200 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-400">{bytes(p.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePend(i)}
                        className="text-slate-400 hover:text-red-500 font-bold p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-slate-400">Up to 6 files, 20 MB each.</p>
            </div>
          </section>

          {err && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{err.msg}</span>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!!saving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm"
            >
              {saving || (initialData ? "Save changes" : "Save Discussion")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= CSV EXPORT ================= */
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCSV(rows) {
  const head = [
    "Logged",
    "Trader",
    "Company",
    "Brand",
    "Type",
    "Counted",
    "Deal",
    "From",
    "To",
    "Status",
    "Stores",
    "Discussion",
  ];
  const lines = [head].concat(
    rows.map((r) => [
      r.date,
      r.trader,
      r.company,
      r.brand,
      r.schemeType || r.scheme_type,
      basisText(r),
      dealString(r),
      r.fromDate || r.from_date,
      r.toDate || r.to_date,
      statusOf(r),
      r.allStores || r.all_stores ? "All Store" : (r.stores || []).join("; "),
      r.discussion,
    ])
  );
  const blob = new Blob(["\uFEFF" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `scheme-discussions-${todayISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= MAIN SCHEME DISCUSSIONS PAGE ================= */
export default function SchemeDiscussions() {
  const [records, setRecords] = useState(() => loadJSON("sd_records", []));
  const [stores, setStores] = useState(() => loadJSON("sd_stores", []));
  const [traders, setTraders] = useState(() => {
    try {
      const cached = localStorage.getItem("drinqkart_scheme_traders_v1");
      return cached ? cleanList(JSON.parse(cached).map((x) => (typeof x === "object" ? x.name : x))) : [];
    } catch (_) {
      return [];
    }
  });
  const [companies, setCompanies] = useState(() => {
    try {
      const cached = localStorage.getItem("drinqkart_scheme_companies_v1");
      return cached ? cleanList(JSON.parse(cached).map((x) => (typeof x === "object" ? x.name : x))) : [];
    } catch (_) {
      return [];
    }
  });
  const [brands, setBrands] = useState(() => {
    try {
      const cached = localStorage.getItem("drinqkart_scheme_brands_v1");
      return cached ? cleanList(JSON.parse(cached).map((x) => (typeof x === "object" ? x.name : x))) : [];
    } catch (_) {
      return [];
    }
  });
  const [q, setQ] = useState("");
  const [activeType, setActiveType] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [sortBy, setSortBy] = useState(() =>
    ["new", "ending", "trader"].indexOf(lsGet("sd_sort")) > -1 ? lsGet("sd_sort") : "new"
  );
  const [view, setView] = useState(() => (lsGet("sd_view") === "table" ? "table" : "cards"));
  const [modal, setModal] = useState(false);
  const [lb, setLb] = useState(null);
  const [pending, setPending] = useState(null);

  // Sync to localStorage
  useEffect(() => {
    lsSet("sd_records", JSON.stringify(records));
  }, [records]);
  useEffect(() => {
    lsSet("sd_stores", JSON.stringify(stores));
  }, [stores]);
  useEffect(() => {
    lsSet("sd_sort", sortBy);
  }, [sortBy]);
  useEffect(() => {
    lsSet("sd_view", view);
  }, [view]);

  // Lightbox escape listener
  useEffect(() => {
    if (!lb) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLb(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lb]);

  // Load from Supabase on mount
  useEffect(() => {
    let alive = true;

    async function loadFromDB() {
      // 1. Fetch shops
      try {
        const { data: shopData } = await supabase.from("shop").select("shop_name");
        if (alive && shopData && shopData.length > 0) {
          const shopNames = cleanList(shopData.map((s) => s.shop_name));
          setStores((prev) => cleanList([...shopNames, ...prev]));
        }
      } catch (e) {}

      // 2. Fetch traders from scheme_traders
      try {
        const { data: traderData, error: tErr } = await supabase
          .from("scheme_traders")
          .select("name")
          .order("name", { ascending: true });
        if (alive && !tErr && traderData) {
          const names = cleanList(traderData.map((t) => t.name));
          setTraders(names);
        }
      } catch (e) {}

      // 3. Fetch companies from scheme_companies
      try {
        const { data: companyData, error: cErr } = await supabase
          .from("scheme_companies")
          .select("name")
          .order("name", { ascending: true });
        if (alive && !cErr && companyData) {
          const names = cleanList(companyData.map((c) => c.name));
          setCompanies(names);
        }
      } catch (e) {}

      // 4. Fetch brands from scheme_brands
      try {
        const { data: brandData, error: bErr } = await supabase
          .from("scheme_brands")
          .select("name")
          .order("name", { ascending: true });
        if (alive && !bErr && brandData) {
          const names = cleanList(brandData.map((b) => b.name));
          setBrands(names);
        }
      } catch (e) {}

      // 3. Fetch scheme discussions from Supabase table
      try {
        const { data, error } = await supabase
          .from("scheme_discussions")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && alive) {
          const normalized = data.map((item) => ({
            id: item.id,
            date: item.date,
            trader: item.trader,
            company: item.company,
            brand: item.brand,
            fromDate: item.from_date || item.fromDate,
            toDate: item.to_date || item.toDate,
            schemeType: item.scheme_type || item.schemeType,
            basis: item.basis,
            amtUnit: item.amt_unit || item.amtUnit,
            targetQty: item.target_qty != null ? item.target_qty : item.targetQty,
            targetUnit: item.target_unit || item.targetUnit,
            qty: item.qty,
            freeQty: item.free_qty != null ? item.free_qty : item.freeQty,
            amount: item.amount,
            allStores: item.all_stores != null ? item.all_stores : item.allStores,
            stores: item.stores || [],
            discussion: item.discussion,
            attachments: item.attachments || [],
            createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now(),
          }));
          setRecords(normalized);
        }
      } catch (e) {}
    }

    loadFromDB();
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const c = { Active: 0, Upcoming: 0, Ended: 0 }, byType = {};
    TYPES.forEach((t) => (byType[t] = 0));
    let soon = 0;
    records.forEach((r) => {
      c[statusOf(r)]++;
      if (endingSoon(r)) soon++;
      const st = r.schemeType || r.scheme_type;
      if (byType[st] != null) byType[st]++;
    });
    return { c, byType, soon };
  }, [records]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase(), t = todayISO();
    const a = records.filter((r) => {
      const stype = r.schemeType || r.scheme_type;
      if (activeType && stype !== activeType) return false;
      if (activeStatus && statusOf(r) !== activeStatus) return false;
      if (!ql) return true;
      const hay = [
        r.trader,
        r.company,
        r.brand,
        stype,
        basisText(r),
        r.discussion,
        (r.allStores || r.all_stores) ? "all store" : (r.stores || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return ql.split(/\s+/).every((w) => hay.includes(w));
    });

    if (sortBy === "ending")
      a.sort((x, y) => {
        const xTo = x.toDate || x.to_date;
        const yTo = y.toDate || y.to_date;
        const ex = xTo < t, ey = yTo < t;
        if (ex !== ey) return ex ? 1 : -1;
        return xTo < yTo ? -1 : xTo > yTo ? 1 : 0;
      });
    else if (sortBy === "trader")
      a.sort((x, y) => (x.trader || "\uFFFF").localeCompare(y.trader || "\uFFFF"));
    else
      a.sort((x, y) => (y.createdAt || y.created_at || 0) - (x.createdAt || x.created_at || 0));
    return a;
  }, [records, q, activeType, activeStatus, sortBy]);

  const removeRecord = async (id) => {
    const r = records.find((x) => x.id === id);
    if (r) (r.attachments || []).forEach((a) => delFile(a.id));

    try {
      await supabase.from("scheme_discussions").delete().eq("id", id);
    } catch (e) {}

    setRecords((p) => p.filter((x) => x.id !== id));
    setPending(null);
    toast.success("Discussion deleted");
  };

  const saveRecord = async (rec) => {
    const isEdit = records.some((x) => x.id === rec.id);
    if (isEdit) {
      setRecords((p) => p.map((x) => (x.id === rec.id ? rec : x)));
      toast.success("Discussion updated");
    } else {
      setRecords((p) => [rec].concat(p));
      toast.success("Discussion saved");
    }
    setModal(false);
    setEditingRecord(null);

    try {
      const payload = {
        id: rec.id,
        date: rec.date,
        trader: rec.trader,
        company: rec.company,
        brand: rec.brand,
        from_date: rec.fromDate,
        to_date: rec.toDate,
        scheme_type: rec.schemeType,
        basis: rec.basis || null,
        amt_unit: rec.amtUnit || null,
        target_qty: rec.targetQty,
        target_unit: rec.targetUnit || null,
        qty: rec.qty,
        free_qty: rec.freeQty,
        amount: rec.amount,
        all_stores: Boolean(rec.allStores),
        stores: rec.stores || [],
        discussion: rec.discussion || "",
        attachments: rec.attachments || [],
        created_at: new Date(rec.createdAt || Date.now()).toISOString(),
      };

      await supabase.from("scheme_discussions").upsert([payload], { onConflict: "id" });
    } catch (e) {
      console.error("Failed to upsert scheme discussion:", e);
    }
  };

  const [editingRecord, setEditingRecord] = useState(null);

  const t = todayISO();
  const rowProps = {
    pending,
    setPending,
    onDelete: removeRecord,
    onEdit: (rec) => {
      setEditingRecord(rec);
      setModal(true);
    },
    onOpen: (url, name) => setLb({ url, name }),
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 p-3 sm:p-6 space-y-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Scheme Discussions
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Trader schemes, launches, visibility and payouts across your stores.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
              {dayName(t)}, {fmt(t)}
            </span>
            <button
              type="button"
              disabled={!records.length}
              onClick={() => exportCSV(list)}
              className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-200 font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Download size={15} /> Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setModal(true);
              }}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <Plus size={16} /> Create
            </button>
          </div>
        </header>

        {/* Summary Stats Cards */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-label="Summary">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</span>
            <b className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">{records.length}</b>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active</span>
            <b className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600">{counts.c.Active}</b>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ending in 7 days</span>
            <b className="text-2xl sm:text-3xl font-bold font-mono text-amber-600">{counts.soon}</b>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Upcoming</span>
            <b className="text-2xl sm:text-3xl font-bold font-mono text-blue-600">{counts.c.Upcoming}</b>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ended</span>
            <b className="text-2xl sm:text-3xl font-bold font-mono text-slate-500">{counts.c.Ended}</b>
          </div>
        </section>

        {/* Scheme Mix Bar */}
        <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Scheme Mix</h2>
          <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-100 gap-0.5">
            {TYPES.filter((x) => counts.byType[x]).map((x) => {
              const cfg = getTypeColor(x);
              return (
                <span
                  key={x}
                  style={{
                    flex: `${counts.byType[x]} 1 0`,
                    backgroundColor: cfg.bar,
                  }}
                  title={`${x}: ${counts.byType[x]}`}
                />
              );
            })}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600 pt-1">
            {TYPES.map((x) => {
              const cfg = getTypeColor(x);
              return (
                <li key={x} className="flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: cfg.bar }} />
                  {x} <b className="font-mono text-slate-900 ml-0.5">{counts.byType[x]}</b>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Search, Filter, Sort, View Tools */}
        <section className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="search"
              placeholder="Search trader, company, brand, store or notes"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="inline-flex border border-slate-200 bg-white rounded-lg p-0.5 shadow-2xs text-xs font-semibold">
            {[
              ["", "All"],
              ["Active", "Active"],
              ["Upcoming", "Upcoming"],
              ["Ended", "Ended"],
            ].map(([v, label]) => (
              <button
                key={label}
                type="button"
                onClick={() => setActiveStatus(v)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  activeStatus === v ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs cursor-pointer focus:outline-none"
          >
            <option value="new">Newest first</option>
            <option value="ending">Ending soonest</option>
            <option value="trader">Trader A to Z</option>
          </select>

          <div className="inline-flex border border-slate-200 bg-white rounded-lg p-0.5 shadow-2xs text-xs">
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                view === "cards" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={14} /> Cards
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                view === "table" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <List size={14} /> Table
            </button>
          </div>
        </section>

        {/* Type Filter Chips */}
        <div className="flex flex-wrap gap-2">
          {[""].concat(TYPES).map((x) => {
            const isSelected = activeType === x;
            const cfg = x ? getTypeColor(x) : null;
            return (
              <button
                key={x || "all"}
                type="button"
                onClick={() => setActiveType(x)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cfg && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.bar }} />}
                {x || "All types"}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-medium text-slate-400">
          {records.length ? `Showing ${list.length} of ${records.length} discussions` : ""}
        </div>

        {/* Cards View */}
        {list.length > 0 && view === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((r) => (
              <Card key={r.id} r={r} {...rowProps} />
            ))}
          </div>
        )}

        {/* Table View */}
        {list.length > 0 && view === "table" && (
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="px-3.5 py-3">Logged</th>
                  <th className="px-3.5 py-3">Trader</th>
                  <th className="px-3.5 py-3">Company / Brand</th>
                  <th className="px-3.5 py-3">Type</th>
                  <th className="px-3.5 py-3">Deal</th>
                  <th className="px-3.5 py-3">Period</th>
                  <th className="px-3.5 py-3">Stores</th>
                  <th className="px-3.5 py-3">Notes</th>
                  <th className="px-3.5 py-3">Files</th>
                  <th className="px-3.5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <TableRow key={r.id} r={r} {...rowProps} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty State */}
        {list.length === 0 && (
          <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
              <FileText size={24} />
            </div>
            <strong className="text-base font-bold text-slate-800">
              {records.length ? "No discussions match these filters" : "No discussions recorded yet"}
            </strong>
            <p className="text-xs text-slate-400 max-w-sm">
              {records.length
                ? "Try clearing your search query, or setting status and type filters back to All."
                : "Click Create above to log the first trader scheme or visibility discussion."}
            </p>
          </div>
        )}

        {/* Create / Edit Discussion Modal */}
        {modal && (
          <CreateModal
            initialData={editingRecord}
            stores={stores}
            setStores={setStores}
            onClose={() => {
              setModal(false);
              setEditingRecord(null);
            }}
            onSave={saveRecord}
            tradersList={traders}
            companiesList={companies}
            brandsList={brands}
          />
        )}

        {/* Lightbox Image Preview */}
        {lb && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLb(null)}
          >
            <img src={lb.url} alt={lb.name || ""} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" />
          </div>
        )}
      </div>
    </div>
  );
}
