import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGroup } from "./group-create.service";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/utils/supabase", () => ({ supabase: { from, rpc } }));

const userId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: groupId, error: null });
});

function insertQuery(result: unknown) {
  const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  from.mockReturnValue(query);
  return query;
}

describe("createGroup", () => {
  it("creates a group using the authenticated user and returns the selected row", async () => {
    const row = { id: groupId, name: "Trip", created_by: userId };
    const query = insertQuery({ data: row, error: null });
    await expect(createGroup({ name: " Trip ", description: " Costs ", type: "Trip" })).resolves.toEqual({ group: row, groupType: "Trip" });
    expect(rpc).toHaveBeenCalledWith("create_group", {
      p_name: "Trip",
      p_description: "Costs",
    });
  });

  it("rejects unauthenticated creation before writing", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "28000", message: "Authentication required" } });
    await expect(createGroup({ name: "Trip", type: "Trip" })).rejects.toThrow(/session has expired/);
  });

  it("surfaces backend failures", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST500", message: "database unavailable" } });
    await expect(createGroup({ name: "Trip", type: "Trip" })).rejects.toThrow("database unavailable");
  });

  it("maps Supabase permission errors to an actionable message", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "new row violates row-level security policy for table groups" } });
    await expect(createGroup({ name: "Trip", type: "Trip" })).rejects.toThrow(/does not match the group creator/);
  });
});
