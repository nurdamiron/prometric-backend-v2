import { AggregateRoot } from '../../../../../shared/domain/base/aggregate-root';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { UserLoggedInEvent } from '../events/user-logged-in.event';
import { PasswordChangedEvent } from '../events/password-changed.event';
import { AccountLockedEvent } from '../events/account-locked.event';
import { Email } from '../value-objects/email.vo';
import { StrongPassword } from '../value-objects/strong-password.vo';
import { UserRole } from '../value-objects/user-role.vo';

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

export class UserAggregate extends AggregateRoot {
  private constructor(
    private readonly _id: string,
    private _email: Email,
    private _firstName: string,
    private _lastName: string,
    private _password: StrongPassword,
    private _role?: UserRole,
    private _status: UserStatus = UserStatus.PENDING,
    private _organizationId?: string,
    private _onboardingStep: OnboardingStep = OnboardingStep.EMAIL_VERIFICATION,
    private _phone?: string,
    private _verificationCode?: string,
    private _verificationExpiresAt?: Date,
    private _registrationData?: any,
    private _aiConfig?: any,
    private _failedLoginAttempts: number = 0,
    private _lockedUntil?: Date,
    private _lastLoginAt?: Date,
    private _lastLoginIp?: string,
    private _passwordChangedAt?: Date,
    private _knownDevices?: any[],
    private _securityEvents?: any[],
    private readonly _createdAt: Date = new Date(),
    private _updatedAt: Date = new Date()
  ) {
    super();
  }

  // 🏭 FACTORY METHODS
  static async register(
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    verificationCode: string
  ): Promise<UserAggregate> {
    const emailVo = Email.create(email);
    const passwordVo = await StrongPassword.create(password);
    const userId = this.generateId();

    const user = new UserAggregate(
      userId,
      emailVo,
      firstName,
      lastName,
      passwordVo,
      undefined, // role assigned during onboarding
      UserStatus.PENDING,
      undefined, // organizationId assigned later
      OnboardingStep.EMAIL_VERIFICATION,
      undefined, // phone
      verificationCode,
      new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    );

    // 📢 Domain Event
    user.addDomainEvent(new UserRegisteredEvent(
      userId,
      email,
      firstName,
      lastName,
      verificationCode
    ));

    return user;
  }

  static reconstitute(data: any): UserAggregate {
    return new UserAggregate(
      data.id,
      Email.create(data.email),
      data.firstName,
      data.lastName,
      StrongPassword.reconstitute(data.password),
      data.role ? UserRole.create(data.role) : undefined,
      data.status,
      data.organizationId,
      data.onboardingStep,
      data.phone,
      data.verificationCode,
      data.verificationExpiresAt,
      data.registrationData,
      data.aiConfig,
      data.failedLoginAttempts,
      data.lockedUntil,
      data.lastLoginAt,
      data.lastLoginIp,
      data.passwordChangedAt,
      data.knownDevices,
      data.securityEvents,
      data.createdAt,
      data.updatedAt
    );
  }

  // 🔐 AUTHENTICATION METHODS
  verifyEmail(code: string): void {
    if (this._verificationCode !== code) {
      throw new Error('Invalid verification code');
    }

    if (this._verificationExpiresAt && this._verificationExpiresAt < new Date()) {
      throw new Error('Verification code has expired');
    }

    this._status = UserStatus.ACTIVE;
    this._onboardingStep = OnboardingStep.THEME;
    this._verificationCode = undefined;
    this._verificationExpiresAt = undefined;
    this.markModified();
  }

  login(requestMetadata: { ipAddress?: string; userAgent?: string }): void {
    if (this.isAccountLocked()) {
      throw new Error(`Account locked until ${this._lockedUntil?.toISOString()}`);
    }

    // Reset failed attempts on successful login
    this._failedLoginAttempts = 0;
    this._lockedUntil = undefined;
    this._lastLoginAt = new Date();
    this._lastLoginIp = requestMetadata.ipAddress || 'unknown';

    this.markModified();

    // 📢 Domain Event
    this.addDomainEvent(new UserLoggedInEvent(
      this._id,
      this._email.value,
      requestMetadata.ipAddress,
      requestMetadata.userAgent
    ));
  }

  incrementFailedAttempts(): void {
    this._failedLoginAttempts += 1;

    // Auto-lock after 5 failed attempts
    if (this._failedLoginAttempts >= 5) {
      this._lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      // 📢 Domain Event
      this.addDomainEvent(new AccountLockedEvent(
        this._id,
        this._email.value,
        this._failedLoginAttempts,
        this._lockedUntil
      ));
    }

    this.markModified();
  }

  async changePassword(newPassword: string): Promise<void> {
    this._password = await StrongPassword.create(newPassword);
    this._passwordChangedAt = new Date();
    this.markModified();

    // 📢 Domain Event
    this.addDomainEvent(new PasswordChangedEvent(
      this._id,
      this._email.value
    ));
  }

  completeOnboarding(onboardingData: any): void {
    // Validate onboarding data based on user type
    if (onboardingData.userType === 'owner') {
      this._role = UserRole.create('owner');
      this._status = UserStatus.ACTIVE;
    } else if (onboardingData.userType === 'employee') {
      this._role = UserRole.create('employee');
      this._status = UserStatus.PENDING; // Requires approval
    }

    this._onboardingStep = OnboardingStep.COMPLETED;
    this._registrationData = onboardingData;
    this.markModified();
  }

  configureAI(aiConfig: any): void {
    this._aiConfig = aiConfig;
    this.markModified();
  }

  // 🔍 BUSINESS RULES
  isAccountLocked(): boolean {
    return this._lockedUntil ? new Date() < this._lockedUntil : false;
  }

  shouldRequirePasswordChange(): boolean {
    if (!this._passwordChangedAt) return true;
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    return this._passwordChangedAt < sixMonthsAgo;
  }

  canAccessOrganization(organizationId: string): boolean {
    return this._organizationId === organizationId;
  }

  isOnboardingComplete(): boolean {
    return this._onboardingStep === OnboardingStep.COMPLETED;
  }

  // 📊 GETTERS
  getUserId(): string { return this._id; }
  get email(): string { return this._email.value; }
  get firstName(): string { return this._firstName; }
  get lastName(): string { return this._lastName; }
  get password(): string { return this._password.value; }
  get role(): string | undefined { return this._role?.value; }
  get status(): UserStatus { return this._status; }
  get organizationId(): string | undefined { return this._organizationId; }
  get onboardingStep(): OnboardingStep { return this._onboardingStep; }
  get phone(): string | undefined { return this._phone; }
  get verificationCode(): string | undefined { return this._verificationCode; }
  get verificationExpiresAt(): Date | undefined { return this._verificationExpiresAt; }
  get registrationData(): any { return this._registrationData; }
  get aiConfig(): any { return this._aiConfig; }
  get failedLoginAttempts(): number { return this._failedLoginAttempts; }
  get lockedUntil(): Date | undefined { return this._lockedUntil; }
  get lastLoginAt(): Date | undefined { return this._lastLoginAt; }
  get lastLoginIp(): string | undefined { return this._lastLoginIp; }
  get passwordChangedAt(): Date | undefined { return this._passwordChangedAt; }
  get knownDevices(): any[] | undefined { return this._knownDevices; }
  get securityEvents(): any[] | undefined { return this._securityEvents; }
  getUserCreatedAt(): Date { return this._createdAt; }
  getUserUpdatedAt(): Date { return this._updatedAt; }

  private markModified(): void {
    this._updatedAt = new Date();
  }

  private static generateId(): string {
    return require('crypto').randomUUID();
  }
}