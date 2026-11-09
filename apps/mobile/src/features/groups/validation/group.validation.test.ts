import { describe, expect, it } from "vitest";
import { validateGroupInput } from "./group.validation";

const valid = { name: "Weekend trip", description: "Shared costs", type: "Trip" as const };

describe("validateGroupInput", () => {
  it("rejects empty and whitespace-only names", () => {
    expect(validateGroupInput({ ...valid, name: "" }).name).toBeTruthy();
    expect(validateGroupInput({ ...valid, name: "   " }).name).toBeTruthy();
  });

  it("rejects names over 60 characters and descriptions over 200", () => {
    expect(validateGroupInput({ ...valid, name: "a".repeat(61) }).name).toBeTruthy();
    expect(validateGroupInput({ ...valid, description: "a".repeat(201) }).description).toBeTruthy();
  });

  it("accepts a valid group", () => {
    expect(validateGroupInput(valid)).toEqual({});
  });
});
