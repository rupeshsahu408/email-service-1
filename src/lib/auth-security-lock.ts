export function isSecurityLocked(user: {
  securityLockedUntil: Date | null;
}): boolean {
  return (
    user.securityLockedUntil != null &&
    user.securityLockedUntil.getTime() > Date.now()
  );
}
