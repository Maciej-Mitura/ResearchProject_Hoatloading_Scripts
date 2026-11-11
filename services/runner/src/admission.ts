export class CapacityError extends Error {}
export class Admission {
  private active = new Set<string>();
  rejected = 0;
  blocked = false;
  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 8) throw new Error("SANDBOX_MAX_ACTIVE must be 1..8");
  }
  snapshot() { return { active: this.active.size, capacity: this.capacity, rejected: this.rejected, blocked: this.blocked }; }
  async run<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (this.blocked || this.active.size >= this.capacity || this.active.has(id)) {
      this.rejected++;
      throw new CapacityError("Sandbox capacity unavailable");
    }
    this.active.add(id);
    try { return await operation(); } finally { this.active.delete(id); }
  }
}
export const admission = new Admission(Number(Deno.env.get("SANDBOX_MAX_ACTIVE") ?? "2"));
