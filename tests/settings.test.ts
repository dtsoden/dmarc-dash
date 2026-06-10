import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import { migrate } from "@/lib/db/migrate";
import { closeDb, getDb } from "@/lib/db/connection";
import { setSetting, getSetting, getSettings, SETTING_DEFS } from "@/lib/settings";

const TMP = "data/test-settings.db";
const KEY = "data/test-settings.key";
afterEach(() => { closeDb(); for (const s of ["","-wal","-shm"]) fs.rmSync(TMP+s,{force:true}); fs.rmSync(KEY,{force:true}); });

describe("settings", () => {
  it("returns typed defaults when unset", () => {
    migrate(TMP);
    expect(getSetting("poll_interval_minutes", TMP, KEY)).toBe(15);
    expect(getSetting("delete_mode", TMP, KEY)).toBe("safe");
    expect(getSetting("setup_complete", TMP, KEY)).toBe(false);
  });
  it("persists and coerces int/bool", () => {
    migrate(TMP);
    setSetting("poll_interval_minutes", 30, TMP, KEY);
    setSetting("setup_complete", true, TMP, KEY);
    expect(getSetting("poll_interval_minutes", TMP, KEY)).toBe(30);
    expect(getSetting("setup_complete", TMP, KEY)).toBe(true);
  });
  it("encrypts secret-typed settings at rest", () => {
    migrate(TMP);
    setSetting("graph_client_secret", "topsecret", TMP, KEY);
    const raw = (getDb(TMP).prepare("SELECT value FROM setting WHERE key='graph_client_secret'").get() as any).value;
    expect(raw).not.toContain("topsecret");
    expect(getSetting("graph_client_secret", TMP, KEY)).toBe("topsecret");
  });
  it("getSettings returns a typed bag", () => {
    migrate(TMP);
    const all = getSettings(TMP, KEY);
    expect(all.poll_interval_minutes).toBe(15);
    expect(Object.keys(all)).toEqual(expect.arrayContaining(Object.keys(SETTING_DEFS)));
  });
});
