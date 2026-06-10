"use client";
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ConfirmOpts { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
interface PromptOpts { title: string; message?: ReactNode; label?: string; placeholder?: string; type?: string; confirmLabel?: string; defaultValue?: string; validate?: (v: string) => string | null }
interface AlertOpts { title: string; message?: ReactNode; confirmLabel?: string }

interface DialogApi {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: AlertOpts) => Promise<void>;
}

const Ctx = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDialog must be used within <DialogProvider>");
  return c;
}

type State =
  | { kind: "confirm"; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: "prompt"; opts: PromptOpts; resolve: (v: string | null) => void }
  | { kind: "alert"; opts: AlertOpts; resolve: () => void }
  | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const [value, setValue] = useState("");
  const [err, setErr] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => { setErr(""); setState({ kind: "confirm", opts, resolve }); }), []);
  const prompt = useCallback((opts: PromptOpts) => new Promise<string | null>((resolve) => { setErr(""); setValue(opts.defaultValue ?? ""); setState({ kind: "prompt", opts, resolve }); }), []);
  const alert = useCallback((opts: AlertOpts) => new Promise<void>((resolve) => { setErr(""); setState({ kind: "alert", opts, resolve }); }), []);

  useEffect(() => { if (state) panelRef.current?.focus(); }, [state]);

  function finish(result: boolean | string | null | void) {
    if (!state) return;
    (state.resolve as (v: unknown) => void)(result);
    setState(null); setValue(""); setErr("");
  }
  function onConfirm() {
    if (!state) return;
    if (state.kind === "prompt") {
      const e = state.opts.validate?.(value);
      if (e) { setErr(e); return; }
      finish(value);
    } else if (state.kind === "confirm") finish(true);
    else finish(undefined);
  }
  function onCancel() {
    if (!state) return;
    if (state.kind === "confirm") finish(false);
    else if (state.kind === "prompt") finish(null);
    else finish(undefined);
  }

  const o = state?.opts as (ConfirmOpts & PromptOpts & AlertOpts) | undefined;
  const destructive = state?.kind === "confirm" && (state.opts as ConfirmOpts).destructive;

  return (
    <Ctx.Provider value={{ confirm, prompt, alert }}>
      {children}
      {state && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          onKeyDown={(e) => { if (e.key === "Escape") onCancel(); else if (e.key === "Enter" && state.kind !== "prompt") onConfirm(); }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
          <div className="card-elev animate-rise relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <button type="button" onClick={onCancel} aria-label="Close"
              className="absolute right-3.5 top-3.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
            <h2 className="pr-6 font-display text-lg font-semibold">{o?.title}</h2>
            {o?.message && <div className="mt-2 text-sm text-muted-foreground">{o.message}</div>}
            {state.kind === "prompt" && (
              <div className="mt-4">
                {state.opts.label && <label className="mb-1 block text-sm font-medium">{state.opts.label}</label>}
                <input
                  autoFocus
                  type={state.opts.type ?? "text"}
                  value={value}
                  placeholder={state.opts.placeholder}
                  onChange={(e) => { setValue(e.target.value); setErr(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
                />
              </div>
            )}
            {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
            <div className="mt-6 flex justify-end gap-2">
              {state.kind !== "alert" && (
                <button type="button" onClick={onCancel} className="rounded-lg border px-3.5 py-2 text-sm">{o?.cancelLabel ?? "Cancel"}</button>
              )}
              <button type="button" onClick={onConfirm}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium ${destructive ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
                {o?.confirmLabel ?? (state.kind === "alert" ? "OK" : state.kind === "confirm" ? "Confirm" : "Save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
