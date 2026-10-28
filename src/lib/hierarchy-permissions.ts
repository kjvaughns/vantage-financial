export function canManageHierarchy(roles: string[]) {
  return roles.some((role) => ["super_admin", "admin", "leader", "manager"].includes(role));
}

export function canMoveWithinHierarchy(roles: string[], actorId: string, targetId: string, uplineId: string | null, descendants: string[]) {
  if (!canManageHierarchy(roles)) return false;
  if (roles.includes("super_admin") || roles.includes("admin")) return true;
  return targetId !== actorId && descendants.includes(targetId) &&
    (uplineId === null || uplineId === actorId || descendants.includes(uplineId));
}