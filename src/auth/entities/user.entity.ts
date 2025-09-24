import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  EMPLOYEE = 'employee'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

export enum OnboardingStep {
  EMAIL_VERIFICATION = 'email_verification',
  THEME = 'theme',
  PERSONAL = 'personal',
  USERTYPE = 'usertype',
  COMPANY = 'company',
  FEATURES = 'features',
  AI = 'ai',
  COMPLETED = 'completed'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, nullable: true })
  role?: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ nullable: true })
  phone?: string;

  // Organization relationship
  @Column({ name: 'organization_id', nullable: true })
  organizationId?: string;

  // @ManyToOne(() => Organization, organization => organization.id, { nullable: true })
  // @JoinColumn({ name: 'organization_id' })
  // organization?: Organization;

  // Onboarding tracking
  @Column({ type: 'enum', enum: OnboardingStep, default: OnboardingStep.EMAIL_VERIFICATION })
  onboardingStep: OnboardingStep;

  @Column({ nullable: true, length: 6 })
  verificationCode?: string;

  @Column({ nullable: true })
  verificationExpiresAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  registrationData?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    companyBin?: string;
    companyName?: string;
    industry?: string;
    theme?: 'light' | 'dark';
    plan?: string;
    userType?: 'owner' | 'employee';
    rejectionReason?: string;
  };

  // AI Assistant configuration
  @Column({ type: 'jsonb', nullable: true })
  aiConfig?: {
    assistantName: string;
    personality: string;
    expertise: string[];
    voicePreference: string;
  };

  // 🔐 SESSION MANAGEMENT (Enhanced security)
  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', nullable: true })
  lastLoginIp?: string;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', nullable: true })
  lockedUntil?: Date;

  @Column({ name: 'password_changed_at', nullable: true })
  passwordChangedAt?: Date;

  // 📱 DEVICE TRACKING
  @Column({ name: 'known_devices', type: 'jsonb', nullable: true })
  knownDevices?: Array<{
    fingerprint: string;
    name: string;
    lastUsed: Date;
    trusted: boolean;
  }>;

  // 📊 SECURITY METADATA
  @Column({ name: 'security_events', type: 'jsonb', nullable: true })
  securityEvents?: Array<{
    type: string;
    timestamp: Date;
    details: any;
    riskLevel: 'low' | 'medium' | 'high';
  }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 🔧 HELPER METHODS
  isAccountLocked(): boolean {
    return this.lockedUntil ? new Date() < this.lockedUntil : false;
  }

  shouldRequirePasswordChange(): boolean {
    if (!this.passwordChangedAt) return true;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return this.passwordChangedAt < sixMonthsAgo;
  }

  incrementFailedAttempts(): void {
    this.failedLoginAttempts += 1;

    // Auto-lock after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    }
  }

  resetFailedAttempts(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = undefined;
  }

  updateLoginMetadata(ip: string): void {
    this.lastLoginAt = new Date();
    this.lastLoginIp = ip;
    this.resetFailedAttempts();
  }
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true, length: 12 })
  bin: string;  // Kazakhstan BIN

  @Column()
  industry: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, user => user.id)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  // AI Brain configuration
  @Column({ type: 'jsonb', nullable: true })
  aiBrain?: {
    personality: string;
    businessGoals: string[];
    activeModules: string[];
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// 🔄 REFRESH TOKEN ENTITY (Session Management)
@Entity('refresh_tokens')
@Index(['userId', 'revokedAt'])
@Index(['tokenHash'])
@Index(['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token_hash', unique: true })
  tokenHash: string; // SHA256 hash of the refresh token

  @Column({ name: 'jti', unique: true })
  jti: string; // JWT ID for tracking

  // 📱 DEVICE INFORMATION
  @Column({ name: 'device_fingerprint', nullable: true })
  deviceFingerprint?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ type: 'jsonb', nullable: true })
  deviceInfo?: {
    platform?: string;
    browser?: string;
    os?: string;
    isMobile?: boolean;
  };

  // 🕰️ TOKEN LIFECYCLE
  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'revocation_reason', nullable: true })
  revocationReason?: string;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // 🔧 HELPER METHODS
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  revoke(reason: string): void {
    this.revokedAt = new Date();
    this.revocationReason = reason;
  }

  updateUsage(): void {
    this.lastUsedAt = new Date();
    this.usageCount += 1;
  }
}