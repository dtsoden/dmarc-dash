import { describe, it, expect, vi } from "vitest";
import { processMailbox } from "@/lib/graph/mailbox";

function fakeClient(over: Partial<any> = {}) {
  return {
    listInbox: vi.fn().mockResolvedValue([{ id: "m1", hasAttachments: true }]),
    getFileAttachments: vi.fn().mockResolvedValue([{ id: "a1", name: "r.xml.gz", contentBytes: Buffer.from("X").toString("base64") }]),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    ensureFolder: vi.fn().mockResolvedValue("err-folder"),
    moveMessage: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("processMailbox", () => {
  it("deletes the email when all attachments ingest (safe mode)", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "ingested", recordsIngested: 1 });
    await processMailbox(c as any, { deleteMode: "safe" }, ingest);
    expect(c.deleteMessage).toHaveBeenCalledWith("m1");
    expect(c.moveMessage).not.toHaveBeenCalled();
  });

  it("deletes the email on duplicate too", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "duplicate", recordsIngested: 0 });
    await processMailbox(c as any, { deleteMode: "safe" }, ingest);
    expect(c.deleteMessage).toHaveBeenCalledWith("m1");
  });

  it("moves to errors folder on failure in safe mode, does not delete", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "failed", recordsIngested: 0 });
    await processMailbox(c as any, { deleteMode: "safe" }, ingest);
    expect(c.deleteMessage).not.toHaveBeenCalled();
    expect(c.moveMessage).toHaveBeenCalledWith("m1", "err-folder");
  });

  it("hard mode deletes even on failure", async () => {
    const c = fakeClient();
    const ingest = vi.fn().mockReturnValue({ status: "failed", recordsIngested: 0 });
    await processMailbox(c as any, { deleteMode: "hard" }, ingest);
    expect(c.deleteMessage).toHaveBeenCalledWith("m1");
  });
});
