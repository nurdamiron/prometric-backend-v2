// Unit tests for SystemHealth Domain Entity - DDD Pattern
import { SystemHealth, ComponentHealth } from '../entities/system-health.entity';
import { HealthStatus } from '../value-objects/health-status.vo';

describe('SystemHealth Domain Entity', () => {
  const mockHealthyComponent: ComponentHealth = {
    name: 'database',
    status: HealthStatus.healthy(),
    responseTime: 50,
    message: 'Database connection is healthy',
    lastChecked: new Date('2024-01-15T10:00:00Z')
  };

  const mockDegradedComponent: ComponentHealth = {
    name: 'cache',
    status: HealthStatus.degraded(),
    responseTime: 500,
    message: 'Cache is responding slowly',
    lastChecked: new Date('2024-01-15T10:00:01Z')
  };

  const mockUnhealthyComponent: ComponentHealth = {
    name: 'external-api',
    status: HealthStatus.unhealthy(),
    responseTime: 5000,
    message: 'External API is not responding',
    lastChecked: new Date('2024-01-15T10:00:02Z')
  };

  describe('Creation', () => {
    test('should create system health with healthy components', () => {
      const components = [mockHealthyComponent];
      const uptime = 3600; // 1 hour
      const version = '1.0.0';

      const systemHealth = SystemHealth.create(components, uptime, version);

      expect(systemHealth.getOverallStatus().getValue()).toBe('healthy');
      expect(systemHealth.getComponents()).toEqual(components);
      expect(systemHealth.getUptime()).toBe(3600);
      expect(systemHealth.getVersion()).toBe('1.0.0');
      expect(systemHealth.getTimestamp()).toBeInstanceOf(Date);
    });

    test('should create system health with mixed component statuses', () => {
      const components = [mockHealthyComponent, mockDegradedComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      expect(systemHealth.getOverallStatus().getValue()).toBe('degraded');
      expect(systemHealth.getComponents()).toHaveLength(2);
    });

    test('should create system health with unhealthy components', () => {
      const components = [mockHealthyComponent, mockUnhealthyComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      expect(systemHealth.getOverallStatus().getValue()).toBe('unhealthy');
    });

    test('should create system health with no components', () => {
      const systemHealth = SystemHealth.create([], 1800, '1.0.0');

      expect(systemHealth.getOverallStatus().getValue()).toBe('healthy');
      expect(systemHealth.getComponents()).toHaveLength(0);
    });

    test('should throw error for invalid uptime', () => {
      expect(() => SystemHealth.create([mockHealthyComponent], -1, '1.0.0'))
        .toThrow('Uptime cannot be negative');
    });

    test('should throw error for invalid version', () => {
      expect(() => SystemHealth.create([mockHealthyComponent], 1800, ''))
        .toThrow('Version is required');

      expect(() => SystemHealth.create([mockHealthyComponent], 1800, null as any))
        .toThrow('Version is required');
    });
  });

  describe('Overall Status Calculation', () => {
    test('should return healthy when all components are healthy', () => {
      const healthyComponents = [
        { ...mockHealthyComponent, name: 'database' },
        { ...mockHealthyComponent, name: 'cache' },
        { ...mockHealthyComponent, name: 'storage' }
      ];

      const systemHealth = SystemHealth.create(healthyComponents, 1800, '1.0.0');
      expect(systemHealth.getOverallStatus().getValue()).toBe('healthy');
    });

    test('should return degraded when any component is degraded but none unhealthy', () => {
      const mixedComponents = [
        mockHealthyComponent,
        mockDegradedComponent
      ];

      const systemHealth = SystemHealth.create(mixedComponents, 1800, '1.0.0');
      expect(systemHealth.getOverallStatus().getValue()).toBe('degraded');
    });

    test('should return unhealthy when any component is unhealthy', () => {
      const mixedComponents = [
        mockHealthyComponent,
        mockDegradedComponent,
        mockUnhealthyComponent
      ];

      const systemHealth = SystemHealth.create(mixedComponents, 1800, '1.0.0');
      expect(systemHealth.getOverallStatus().getValue()).toBe('unhealthy');
    });

    test('should return healthy for empty components array', () => {
      const systemHealth = SystemHealth.create([], 1800, '1.0.0');
      expect(systemHealth.getOverallStatus().getValue()).toBe('healthy');
    });
  });

  describe('Component Management', () => {
    test('should return component by name', () => {
      const components = [mockHealthyComponent, mockDegradedComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      const databaseComponent = systemHealth.getComponent('database');
      expect(databaseComponent).toEqual(mockHealthyComponent);

      const cacheComponent = systemHealth.getComponent('cache');
      expect(cacheComponent).toEqual(mockDegradedComponent);
    });

    test('should return undefined for non-existent component', () => {
      const systemHealth = SystemHealth.create([mockHealthyComponent], 1800, '1.0.0');

      const nonExistentComponent = systemHealth.getComponent('non-existent');
      expect(nonExistentComponent).toBeUndefined();
    });

    test('should return healthy components', () => {
      const components = [mockHealthyComponent, mockDegradedComponent, mockUnhealthyComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      const healthyComponents = systemHealth.getHealthyComponents();
      expect(healthyComponents).toHaveLength(1);
      expect(healthyComponents[0]).toEqual(mockHealthyComponent);
    });

    test('should return degraded components', () => {
      const components = [mockHealthyComponent, mockDegradedComponent, mockUnhealthyComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      const degradedComponents = systemHealth.getDegradedComponents();
      expect(degradedComponents).toHaveLength(1);
      expect(degradedComponents[0]).toEqual(mockDegradedComponent);
    });

    test('should return unhealthy components', () => {
      const components = [mockHealthyComponent, mockDegradedComponent, mockUnhealthyComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      const unhealthyComponents = systemHealth.getUnhealthyComponents();
      expect(unhealthyComponents).toHaveLength(1);
      expect(unhealthyComponents[0]).toEqual(mockUnhealthyComponent);
    });

    test('should count components by status', () => {
      const components = [
        mockHealthyComponent,
        mockDegradedComponent,
        mockUnhealthyComponent,
        { ...mockHealthyComponent, name: 'storage' }
      ];

      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      expect(systemHealth.getHealthyCount()).toBe(2);
      expect(systemHealth.getDegradedCount()).toBe(1);
      expect(systemHealth.getUnhealthyCount()).toBe(1);
      expect(systemHealth.getTotalComponents()).toBe(4);
    });
  });

  describe('Performance Metrics', () => {
    test('should calculate average response time', () => {
      const components = [
        { ...mockHealthyComponent, responseTime: 100 },
        { ...mockDegradedComponent, responseTime: 300 },
        { ...mockUnhealthyComponent, responseTime: 500 }
      ];

      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');
      expect(systemHealth.getAverageResponseTime()).toBe(300);
    });

    test('should handle components without response time', () => {
      const componentsWithoutResponseTime = [
        { ...mockHealthyComponent, responseTime: undefined },
        { ...mockDegradedComponent, responseTime: 300 }
      ];

      const systemHealth = SystemHealth.create(componentsWithoutResponseTime, 1800, '1.0.0');
      expect(systemHealth.getAverageResponseTime()).toBe(300);
    });

    test('should return 0 for average response time when no components have response time', () => {
      const componentsWithoutResponseTime = [
        { ...mockHealthyComponent, responseTime: undefined },
        { ...mockDegradedComponent, responseTime: undefined }
      ];

      const systemHealth = SystemHealth.create(componentsWithoutResponseTime, 1800, '1.0.0');
      expect(systemHealth.getAverageResponseTime()).toBe(0);
    });

    test('should return 0 for average response time when no components', () => {
      const systemHealth = SystemHealth.create([], 1800, '1.0.0');
      expect(systemHealth.getAverageResponseTime()).toBe(0);
    });

    test('should calculate max response time', () => {
      const components = [
        { ...mockHealthyComponent, responseTime: 100 },
        { ...mockDegradedComponent, responseTime: 300 },
        { ...mockUnhealthyComponent, responseTime: 500 }
      ];

      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');
      expect(systemHealth.getMaxResponseTime()).toBe(500);
    });

    test('should calculate min response time', () => {
      const components = [
        { ...mockHealthyComponent, responseTime: 100 },
        { ...mockDegradedComponent, responseTime: 300 },
        { ...mockUnhealthyComponent, responseTime: 500 }
      ];

      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');
      expect(systemHealth.getMinResponseTime()).toBe(100);
    });
  });

  describe('Status Checks', () => {
    test('should correctly identify if system is healthy', () => {
      const healthySystem = SystemHealth.create([mockHealthyComponent], 1800, '1.0.0');
      const degradedSystem = SystemHealth.create([mockDegradedComponent], 1800, '1.0.0');
      const unhealthySystem = SystemHealth.create([mockUnhealthyComponent], 1800, '1.0.0');

      expect(healthySystem.isHealthy()).toBe(true);
      expect(degradedSystem.isHealthy()).toBe(false);
      expect(unhealthySystem.isHealthy()).toBe(false);
    });

    test('should correctly identify if system is degraded', () => {
      const healthySystem = SystemHealth.create([mockHealthyComponent], 1800, '1.0.0');
      const degradedSystem = SystemHealth.create([mockDegradedComponent], 1800, '1.0.0');
      const unhealthySystem = SystemHealth.create([mockUnhealthyComponent], 1800, '1.0.0');

      expect(healthySystem.isDegraded()).toBe(false);
      expect(degradedSystem.isDegraded()).toBe(true);
      expect(unhealthySystem.isDegraded()).toBe(false);
    });

    test('should correctly identify if system is unhealthy', () => {
      const healthySystem = SystemHealth.create([mockHealthyComponent], 1800, '1.0.0');
      const degradedSystem = SystemHealth.create([mockDegradedComponent], 1800, '1.0.0');
      const unhealthySystem = SystemHealth.create([mockUnhealthyComponent], 1800, '1.0.0');

      expect(healthySystem.isUnhealthy()).toBe(false);
      expect(degradedSystem.isUnhealthy()).toBe(false);
      expect(unhealthySystem.isUnhealthy()).toBe(true);
    });

    test('should check if component exists', () => {
      const systemHealth = SystemHealth.create([mockHealthyComponent], 1800, '1.0.0');

      expect(systemHealth.hasComponent('database')).toBe(true);
      expect(systemHealth.hasComponent('non-existent')).toBe(false);
    });
  });

  describe('Formatted Output', () => {
    test('should return formatted uptime', () => {
      const systemHealth = SystemHealth.create([mockHealthyComponent], 3661, '1.0.0'); // 1 hour, 1 minute, 1 second

      const formattedUptime = systemHealth.getFormattedUptime();
      expect(formattedUptime).toBe('1h 1m 1s');
    });

    test('should handle zero uptime', () => {
      const systemHealth = SystemHealth.create([mockHealthyComponent], 0, '1.0.0');

      const formattedUptime = systemHealth.getFormattedUptime();
      expect(formattedUptime).toBe('0s');
    });

    test('should handle large uptime values', () => {
      const systemHealth = SystemHealth.create([mockHealthyComponent], 90061, '1.0.0'); // 25h 1m 1s

      const formattedUptime = systemHealth.getFormattedUptime();
      expect(formattedUptime).toBe('25h 1m 1s');
    });

    test('should handle partial time values', () => {
      const systemHealth1 = SystemHealth.create([mockHealthyComponent], 60, '1.0.0'); // 1 minute
      const systemHealth2 = SystemHealth.create([mockHealthyComponent], 3600, '1.0.0'); // 1 hour

      expect(systemHealth1.getFormattedUptime()).toBe('1m 0s');
      expect(systemHealth2.getFormattedUptime()).toBe('1h 0m 0s');
    });
  });

  describe('Summary Information', () => {
    test('should generate health summary', () => {
      const components = [mockHealthyComponent, mockDegradedComponent, mockUnhealthyComponent];
      const systemHealth = SystemHealth.create(components, 3600, '1.2.3');

      const summary = systemHealth.getSummary();

      expect(summary.overallStatus).toBe('unhealthy');
      expect(summary.version).toBe('1.2.3');
      expect(summary.uptime).toBe(3600);
      expect(summary.totalComponents).toBe(3);
      expect(summary.healthyComponents).toBe(1);
      expect(summary.degradedComponents).toBe(1);
      expect(summary.unhealthyComponents).toBe(1);
      expect(summary.averageResponseTime).toBeDefined();
      expect(summary.timestamp).toBeInstanceOf(Date);
    });

    test('should generate component status breakdown', () => {
      const components = [
        mockHealthyComponent,
        mockDegradedComponent,
        mockUnhealthyComponent
      ];

      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');
      const breakdown = systemHealth.getComponentStatusBreakdown();

      expect(breakdown).toEqual({
        healthy: ['database'],
        degraded: ['cache'],
        unhealthy: ['external-api']
      });
    });

    test('should generate detailed status report', () => {
      const components = [mockHealthyComponent, mockDegradedComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      const report = systemHealth.getDetailedReport();

      expect(report.summary).toBeDefined();
      expect(report.components).toHaveLength(2);
      expect(report.performance).toBeDefined();
      expect(report.performance.averageResponseTime).toBeDefined();
      expect(report.performance.maxResponseTime).toBeDefined();
      expect(report.performance.minResponseTime).toBeDefined();
    });
  });

  describe('Serialization', () => {
    test('should serialize to plain object', () => {
      const components = [mockHealthyComponent, mockDegradedComponent];
      const systemHealth = SystemHealth.create(components, 1800, '1.0.0');

      const serialized = systemHealth.toPlainObject();

      expect(serialized.overallStatus).toBe('degraded');
      expect(serialized.components).toHaveLength(2);
      expect(serialized.uptime).toBe(1800);
      expect(serialized.version).toBe('1.0.0');
      expect(serialized.timestamp).toBeInstanceOf(Date);
      expect(serialized.summary).toBeDefined();
    });

    test('should serialize to JSON string', () => {
      const systemHealth = SystemHealth.create([mockHealthyComponent], 1800, '1.0.0');

      const jsonString = systemHealth.toJSON();
      const parsed = JSON.parse(jsonString);

      expect(parsed.overallStatus).toBe('healthy');
      expect(parsed.components).toBeDefined();
      expect(parsed.version).toBe('1.0.0');
    });
  });

  describe('Edge Cases', () => {
    test('should handle components with same name', () => {
      const duplicateComponents = [
        mockHealthyComponent,
        { ...mockHealthyComponent, message: 'Second database instance' }
      ];

      const systemHealth = SystemHealth.create(duplicateComponents, 1800, '1.0.0');

      // Should handle gracefully - typically would use first occurrence
      expect(systemHealth.getComponent('database')).toEqual(mockHealthyComponent);
      expect(systemHealth.getTotalComponents()).toBe(2);
    });

    test('should handle very large response times', () => {
      const slowComponent = {
        ...mockHealthyComponent,
        responseTime: Number.MAX_SAFE_INTEGER
      };

      const systemHealth = SystemHealth.create([slowComponent], 1800, '1.0.0');
      expect(systemHealth.getMaxResponseTime()).toBe(Number.MAX_SAFE_INTEGER);
    });

    test('should handle components with special characters in names', () => {
      const specialComponent = {
        ...mockHealthyComponent,
        name: 'database-primary_01'
      };

      const systemHealth = SystemHealth.create([specialComponent], 1800, '1.0.0');
      expect(systemHealth.hasComponent('database-primary_01')).toBe(true);
    });

    test('should handle very long version strings', () => {
      const longVersion = 'v1.0.0-beta.1+build.12345.abcdef';
      const systemHealth = SystemHealth.create([mockHealthyComponent], 1800, longVersion);

      expect(systemHealth.getVersion()).toBe(longVersion);
    });
  });
});