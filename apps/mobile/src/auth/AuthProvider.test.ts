import { beforeEach, describe, expect, it, vi } from "vitest";
import { exchangeOAuthCallback } from "./oauth";

const { exchangeCodeForSession } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("expo-linking", () => ({
  parse: (url: string) => {
    const parsed = new URL(url);
    return {
      queryParams: Object.fromEntries(parsed.searchParams.entries()),
    };
  },
}));

vi.mock("../utils/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession,
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

describe("exchangeOAuthCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exchanges the same authorization code only once", async () => {
    const session = { access_token: "access-token" };
    exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    const callbackUrl = "chillar://auth/callback?code=one-time-code";
    const [first, second] = await Promise.all([
      exchangeOAuthCallback(callbackUrl),
      exchangeOAuthCallback(callbackUrl),
    ]);

    expect(first).toBe(session);
    expect(second).toBe(session);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");
  });

  it("rejects callback errors and missing codes without exchanging", async () => {
    await expect(exchangeOAuthCallback("chillar://auth/callback?error=access_denied")).rejects.toThrow("access_denied");
    await expect(exchangeOAuthCallback("chillar://auth/callback")).rejects.toThrow("no authorization code");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
