import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

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
  PERSONAL_INFO = 'personal_info',
  COMPANY_INFO = 'company_info',
  THEME_SELECTION = 'theme_selection',
  PRICING = 'pricing',
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

  @Column({ type: 'enum', enum: UserRole, default: UserRole.EMPLOYEE })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.PENDING })
  status: UserStatus;

  @Column({ nullable: true })
  phone?: string;

  // Organization relationship
  @Column({ name: 'organization_id', nullable: true })
  organizationId?: string;

  @ManyToOne(() => Organization, organization => organization.id, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

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
  };

  // AI Assistant configuration
  @Column({ type: 'jsonb', nullable: true })
  aiConfig?: {
    assistantName: string;
    personality: string;
    expertise: string[];
    voicePreference: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
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