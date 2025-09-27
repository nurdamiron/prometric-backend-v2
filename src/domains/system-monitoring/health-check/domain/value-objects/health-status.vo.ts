// Health Status Value Object - DDD Pattern
export type HealthStatusValue = 'healthy' | 'degraded' | 'unhealthy';

export class HealthStatus {
  private constructor(private readonly value: HealthStatusValue) {}

  public static healthy(): HealthStatus {
    return new HealthStatus('healthy');
  }

  public static degraded(): HealthStatus {
    return new HealthStatus('degraded');
  }

  public static unhealthy(): HealthStatus {
    return new HealthStatus('unhealthy');
  }

  public static create(value: string): HealthStatus {
    if (!this.isValid(value)) {
      throw new Error(`Invalid health status: ${value}. Must be one of: healthy, degraded, unhealthy`);
    }
    return new HealthStatus(value as HealthStatusValue);
  }

  public getValue(): HealthStatusValue {
    return this.value;
  }

  public isHealthy(): boolean {
    return this.value === 'healthy';
  }

  public isDegraded(): boolean {
    return this.value === 'degraded';
  }

  public isUnhealthy(): boolean {
    return this.value === 'unhealthy';
  }

  public equals(other: HealthStatus): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }

  private static isValid(value: string): boolean {
    const validStatuses: HealthStatusValue[] = ['healthy', 'degraded', 'unhealthy'];
    return validStatuses.includes(value as HealthStatusValue);
  }
}