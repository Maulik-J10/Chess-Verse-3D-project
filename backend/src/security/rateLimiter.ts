export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  public isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const windowStart = now - this.windowMs;

    // Filter out old timestamps
    const recent = timestamps.filter(t => t > windowStart);
    if (recent.length >= this.maxRequests) {
      return false;
    }

    recent.push(now);
    this.requests.set(key, recent);
    return true;
  }

  public cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    for (const [key, timestamps] of this.requests.entries()) {
      const recent = timestamps.filter(t => t > windowStart);
      if (recent.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, recent);
      }
    }
  }
}

