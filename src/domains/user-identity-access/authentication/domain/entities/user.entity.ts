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

  // Onboarding tracking
  @Column({ type: 'enum', enum: OnboardingStep, default: OnboardingStep.EMAIL_VERIFICATION })
  onboardingStep: OnboardingStep;

  @Column({ nullable: true, length: 6 })
  verificationCode?: string;

  @Column({ nullable: true })
  verificationExpiresAt?: Date;

  @Column({ default: false })
  emailVerified: boolean;

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
    configuredAt: Date;
  };

  // Security fields
  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt?: Date;

  @Column({ name: 'last_login_ip', nullable: true })
  lastLoginIp?: string;

  @Column({ name: 'failed_login_attempts', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', nullable: true })
  lockedUntil?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Helper methods
  isAccountLocked(): boolean {
    return this.lockedUntil ? new Date() < this.lockedUntil : false;
  }
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  bin?: string;

  @Column()
  name: string;

  @Column()
  industry: string;

  @Column({ name: 'owner_id', nullable: true })
  ownerId?: string;

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

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'jti' })
  jti: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column({ name: 'device_fingerprint', nullable: true })
  deviceFingerprint?: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo?: any;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'last_used_at', nullable: true })
  lastUsedAt?: Date;

  @Column({ name: 'revoked_at', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'revocation_reason', nullable: true })
  revocationReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}