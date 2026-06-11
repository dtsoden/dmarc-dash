"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X, Pencil } from "lucide-react";

// Friendly schedule control for the digest jobs. The backend still stores a 5-field
// cron string, but the user never sees it: they pick a day and time, and toggle the
// digest on or off. An empty/invalid cron means "off" (the scheduler skips it), so
// turning a digest off simply clears the stored value.

export type ScheduleMode = "weekly" | "monthly";

const WEEKDAYS = [
  { v: 1, label: "Monday" },
  { v: 2, label: "Tuesday" },
  { v: 3, label: "Wednesday" },
  { v: 4, label: "Thursday" },
  { v: 5, label: "Friday" },
  { v: 6, label: "Saturday" },
  { v: 0, label: "Sunday" },
];
const WEEKDAY_NAME: Record<number, string> = Object.fromEntries(WEEKDAYS.map((d) => [d.v, d.label]));

interface Parsed { enabled: boolean; minute: number; hour: number; dow: number; dom: number }

const DEFAULTS: Parsed = { enabled: false, minute: 0, hour: 8, dow: 1, dom: 1 };

// Parse a stored cron into the fields we expose. Anything we don't recognise (empty,
// wrong shape, ranges/lists) reads as "off" with sensible defaults ready for when the
// user turns it on.
function parseCron(cron: string, mode: ScheduleMode): Parsed {
  if (!cron || !cron.trim()) return { ...DEFAULTS };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { ...DEFAULTS };
  const [mi, ho, dm, , dw] = parts;
  const minute = Number(mi), hour = Number(ho);
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return { ...DEFAULTS };
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ...DEFAULTS };
  if (mode === "weekly") {
    if (dm !== "*") return { ...DEFAULTS, minute, hour };
    const dow = Number(dw);
    if (!Number.isInteger(dow) || dow < 0 || dow > 7) return { ...DEFAULTS, minute, hour };
    return { enabled: true, minute, hour, dow: dow === 7 ? 0 : dow, dom: 1 };
  }
  const dom = Number(dm);
  if (!Number.isInteger(dom) || dom < 1 || dom > 28) return { ...DEFAULTS, minute, hour };
  return { enabled: true, minute, hour, dom, dow: 1 };
}

function toCron(p: Parsed, mode: ScheduleMode): string {
  return mode === "weekly"
    ? `${p.minute} ${p.hour} * * ${p.dow}`
    : `${p.minute} ${p.hour} ${p.dom} * *`;
}

function fmtTime(hour: number, minute: number): string {
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function summarize(p: Parsed, mode: ScheduleMode): string {
  const t = fmtTime(p.hour, p.minute);
  return mode === "weekly"
    ? `Every ${WEEKDAY_NAME[p.dow]} at ${t}`
    : `On the ${ordinal(p.dom)} of each month at ${t}`;
}

const sel = "rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function ScheduleField({ mode, label, description, cron, onChange }: {
  mode: ScheduleMode;
  label: string;
  description?: string;
  cron: string;
  onChange: (cron: string) => void;
}) {
  const parsed = parseCron(cron, mode);
  const [editing, setEditing] = useState(false);

  function toggle(on: boolean) {
    if (on) onChange(toCron(parsed.enabled ? parsed : { ...DEFAULTS, enabled: true }, mode));
    else onChange(""); // empty => off
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <Switch checked={parsed.enabled} onChange={toggle} label={`Turn ${label} ${parsed.enabled ? "off" : "on"}`} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {parsed.enabled ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
              <Clock className="size-4 text-primary" /> {summarize(parsed, mode)}
            </span>
            <button type="button" onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
              <Pencil className="size-3.5" /> Edit schedule
            </button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">Off, this digest will not be sent.</span>
        )}
      </div>

      {editing && (
        <ScheduleModal
          mode={mode} label={label} initial={parsed}
          onCancel={() => setEditing(false)}
          onSave={(p) => { onChange(toCron({ ...p, enabled: true }, mode)); setEditing(false); }}
        />
      )}
    </div>
  );
}

function ScheduleModal({ mode, label, initial, onCancel, onSave }: {
  mode: ScheduleMode; label: string; initial: Parsed;
  onCancel: () => void; onSave: (p: Parsed) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [p, setP] = useState<Parsed>(initial);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const timeValue = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  function setTime(v: string) {
    const [h, m] = v.split(":").map(Number);
    if (Number.isInteger(h) && Number.isInteger(m)) setP((s) => ({ ...s, hour: h, minute: m }));
  }

  const modal = (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onKeyDown={(e) => { if (e.key === "Enter") onSave(p); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="card-elev animate-rise relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <button type="button" onClick={onCancel} aria-label="Close"
          className="absolute right-3.5 top-3.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
        <h2 className="pr-6 font-display text-lg font-semibold">{label} schedule</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose when this digest is sent.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Repeat</label>
            <div className={`${sel} inline-flex w-full items-center bg-muted/50 capitalize text-muted-foreground`}>{mode}</div>
          </div>

          {mode === "weekly" ? (
            <div>
              <label className="mb-1 block text-sm font-medium">Day of week</label>
              <select className={`${sel} w-full`} value={p.dow} onChange={(e) => setP((s) => ({ ...s, dow: Number(e.target.value) }))}>
                {WEEKDAYS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium">Day of month</label>
              <select className={`${sel} w-full`} value={p.dom} onChange={(e) => setP((s) => ({ ...s, dom: Number(e.target.value) }))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{ordinal(d)}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Capped at the 28th so it lands every month.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Time</label>
            <input type="time" className={`${sel} w-full`} value={timeValue} onChange={(e) => setTime(e.target.value)} />
          </div>

          <div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Summary: </span>
            <span className="font-medium text-foreground">{summarize(p, mode)}</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border px-3.5 py-2 text-sm">Cancel</button>
          <button type="button" onClick={() => onSave(p)} className="rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">Save schedule</button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modal, document.body) : null;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
    </button>
  );
}
