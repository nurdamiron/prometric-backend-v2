// System Health Entity - DDD Domain Entity
import { HealthStatus } from '../value-objects/health-status.vo';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  message?: string;
  lastChecked: Date;
}

export interface SystemHealthProps {
  id: string;
  overallStatus: HealthStatus;
  components: ComponentHealth[];
  timestamp: Date;
  uptime: number;
  version: string;
}

export class SystemHealth {
  private constructor(private props: SystemHealthProps) {}

  public static create(
    components: ComponentHealth[],
    uptime: number,
    version: string
  ): SystemHealth {
    // Validation
    if (uptime < 0) {
      throw new Error('Uptime cannot be negative');
    }
    if (!version || version.trim() === '') {
      throw new Error('Version is required');
    }

    const overallStatus = this.calculateOverallStatus(components);

    return new SystemHealth({
      id: crypto.randomUUID(),
      overallStatus,
      components,
      timestamp: new Date(),
      uptime,
      version,
    });
  }

  public static reconstitute(props: SystemHealthProps): SystemHealth {
    return new SystemHealth(props);
  }

  // Getters
  public getId(): string {
    return this.props.id;
  }

  public getOverallStatus(): HealthStatus {
    return this.props.overallStatus;
  }

  public getComponents(): ComponentHealth[] {
    return this.props.components;
  }

  public getTimestamp(): Date {
    return this.props.timestamp;
  }

  public getUptime(): number {
    return this.props.uptime;
  }

  public getVersion(): string {
    return this.props.version;
  }

  // Business Logic
  public isHealthy(): boolean {
    return this.props.overallStatus.isHealthy();
  }

  public isDegraded(): boolean {
    return this.props.overallStatus.isDegraded();
  }

  public isUnhealthy(): boolean {
    return this.props.overallStatus.isUnhealthy();
  }

  public getUnhealthyComponents(): ComponentHealth[] {
    return this.props.components.filter(comp => comp.status.isUnhealthy());
  }

  public getDegradedComponents(): ComponentHealth[] {
    return this.props.components.filter(comp => comp.status.isDegraded());
  }

  public getComponentByName(name: string): ComponentHealth | undefined {
    return this.props.components.find(comp => comp.name === name);
  }

  public hasComponent(name: string): boolean {
    return this.props.components.some(comp => comp.name === name);
  }

  // Component Management Methods
  public getComponent(name: string): ComponentHealth | undefined {
    return this.props.components.find(comp => comp.name === name);
  }

  public getHealthyComponents(): ComponentHealth[] {
    return this.props.components.filter(comp => comp.status.isHealthy());
  }

  public getHealthyCount(): number {
    return this.getHealthyComponents().length;
  }

  public getDegradedCount(): number {
    return this.getDegradedComponents().length;
  }

  public getUnhealthyCount(): number {
    return this.getUnhealthyComponents().length;
  }

  public getTotalComponents(): number {
    return this.props.components.length;
  }

  // Performance Metrics
  public getAverageResponseTime(): number {
    const componentsWithResponseTime = this.props.components.filter(comp => comp.responseTime !== undefined);
    if (componentsWithResponseTime.length === 0) {
      return 0;
    }
    const total = componentsWithResponseTime.reduce((sum, comp) => sum + (comp.responseTime || 0), 0);
    return total / componentsWithResponseTime.length;
  }

  public getMaxResponseTime(): number {
    const responseTimes = this.props.components
      .filter(comp => comp.responseTime !== undefined)
      .map(comp => comp.responseTime!);
    return responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
  }

  public getMinResponseTime(): number {
    const responseTimes = this.props.components
      .filter(comp => comp.responseTime !== undefined)
      .map(comp => comp.responseTime!);
    return responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
  }

  // Formatted Output
  public getFormattedUptime(): string {
    const hours = Math.floor(this.props.uptime / 3600);
    const minutes = Math.floor((this.props.uptime % 3600) / 60);
    const seconds = this.props.uptime % 60;

    const parts = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
    } else if (minutes > 0) {
      parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
    } else {
      parts.push(`${seconds}s`);
    }

    return parts.join(' ');
  }

  // Summary Information
  public getSummary(): any {
    return {
      overallStatus: this.props.overallStatus.getValue(),
      version: this.props.version,
      uptime: this.props.uptime,
      totalComponents: this.getTotalComponents(),
      healthyComponents: this.getHealthyCount(),
      degradedComponents: this.getDegradedCount(),
      unhealthyComponents: this.getUnhealthyCount(),
      averageResponseTime: this.getAverageResponseTime(),
      timestamp: this.props.timestamp
    };
  }

  public getComponentStatusBreakdown(): any {
    return {
      healthy: this.getHealthyComponents().map(comp => comp.name),
      degraded: this.getDegradedComponents().map(comp => comp.name),
      unhealthy: this.getUnhealthyComponents().map(comp => comp.name)
    };
  }

  public getDetailedReport(): any {
    return {
      summary: this.getSummary(),
      components: this.props.components,
      breakdown: this.getComponentStatusBreakdown(),
      performance: {
        averageResponseTime: this.getAverageResponseTime(),
        maxResponseTime: this.getMaxResponseTime(),
        minResponseTime: this.getMinResponseTime()
      }
    };
  }

  // Serialization
  public toPlainObject(): any {
    return {
      overallStatus: this.props.overallStatus.getValue(),
      components: this.props.components.map(comp => ({
        name: comp.name,
        status: comp.status.getValue(),
        responseTime: comp.responseTime,
        message: comp.message,
        lastChecked: comp.lastChecked
      })),
      timestamp: this.props.timestamp,
      uptime: this.props.uptime,
      version: this.props.version,
      summary: this.getSummary()
    };
  }

  // Static helper methods
  private static calculateOverallStatus(components: ComponentHealth[]): HealthStatus {
    if (components.length === 0) {
      return HealthStatus.healthy(); // Empty components = healthy system
    }

    const hasUnhealthy = components.some(comp => comp.status.isUnhealthy());
    if (hasUnhealthy) {
      return HealthStatus.unhealthy();
    }

    const hasDegraded = components.some(comp => comp.status.isDegraded());
    if (hasDegraded) {
      return HealthStatus.degraded();
    }

    return HealthStatus.healthy();
  }

  // Serialization
  public toJSON(): string {
    return JSON.stringify(this.toPlainObject());
  }

  public toApiResponse(): any {
    return {
      status: this.props.overallStatus.getValue(),
      timestamp: this.props.timestamp.toISOString(),
      uptime: this.props.uptime,
      version: this.props.version,
      components: this.props.components.reduce((acc, comp) => {
        acc[comp.name] = {
          status: comp.status.getValue(),
          responseTime: comp.responseTime,
          message: comp.message,
          lastChecked: comp.lastChecked.toISOString()
        };
        return acc;
      }, {} as Record<string, any>)
    };
  }
}