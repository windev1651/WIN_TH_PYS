const activeOperations = new Set<string>();
const busyUsers = new Set<string>();

export function tryAcquireOperationLock(key: string, userId: string): boolean {
  if (activeOperations.has(key) || busyUsers.has(userId)) {
    return false;
  }

  activeOperations.add(key);
  busyUsers.add(userId);

  return true;
}

export function releaseOperationLock(key: string, userId: string): void {
  activeOperations.delete(key);
  busyUsers.delete(userId);
}

export function isUserBusy(userId: string): boolean {
  return busyUsers.has(userId);
}
