import { describe, expect, it } from "vitest";
import { canMoveWithinHierarchy } from "./hierarchy-permissions";

describe("manual hierarchy permissions", () => {
  it("super admin can move any recruit to any leader", () => {
    expect(canMoveWithinHierarchy(["super_admin"], "kj", "recruit", "pranav", [])).toBe(true);
  });
  it("a leader can place their recruit under their downline leader", () => {
    expect(canMoveWithinHierarchy(["leader"], "pranav", "recruit", "leader", ["recruit", "leader"])).toBe(true);
  });
  it("a leader cannot move someone outside their hierarchy", () => {
    expect(canMoveWithinHierarchy(["leader"], "pranav", "outside", "leader", ["leader"])).toBe(false);
  });
  it("a leader cannot move their recruit to an outside leader", () => {
    expect(canMoveWithinHierarchy(["leader"], "pranav", "recruit", "outside", ["recruit"])).toBe(false);
  });
  it("an agent cannot change hierarchy", () => {
    expect(canMoveWithinHierarchy(["agent"], "jaden", "recruit", "pranav", ["recruit", "pranav"])).toBe(false);
  });
  it("a manager cannot move themselves", () => {
    expect(canMoveWithinHierarchy(["manager"], "manager", "manager", "leader", ["leader"])).toBe(false);
  });
});