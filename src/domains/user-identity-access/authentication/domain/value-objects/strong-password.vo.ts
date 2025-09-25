import { ValueObject } from '../../../../../shared/domain/base/value-object';
import * as bcrypt from 'bcrypt';

interface StrongPasswordProps {
  hashedValue: string;
}

export class StrongPassword extends ValueObject<StrongPasswordProps> {
  private constructor(props: StrongPasswordProps) {
    super(props);
  }

  static async create(plainPassword: string): Promise<StrongPassword> {
    if (!plainPassword || typeof plainPassword !== 'string') {
      throw new Error('Password is required');
    }

    // Kazakhstan business password policy
    if (plainPassword.length < 10) {
      throw new Error('Password must be at least 10 characters long');
    }

    if (plainPassword.length > 128) {
      throw new Error('Password too long (max 128 characters)');
    }

    // Business rules for strong password
    const hasUpperCase = /[A-Z]/.test(plainPassword);
    const hasLowerCase = /[a-z]/.test(plainPassword);
    const hasNumbers = /\d/.test(plainPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(plainPassword);

    if (!hasUpperCase) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (!hasLowerCase) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    if (!hasNumbers) {
      throw new Error('Password must contain at least one number');
    }

    if (!hasSpecialChar) {
      throw new Error('Password must contain at least one special character');
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^password/i,
      /^qwerty/i,
      /^123456/,
      /^admin/i,
      /^user/i,
      /(.)\1{3,}/, // Repeated characters
    ];

    for (const pattern of weakPatterns) {
      if (pattern.test(plainPassword)) {
        throw new Error('Password contains weak patterns');
      }
    }

    // Hash with bcrypt cost 12 (production security requirement)
    const saltRounds = process.env.NODE_ENV === 'production' ? 12 : 8;
    const hashedValue = await bcrypt.hash(plainPassword, saltRounds);

    return new StrongPassword({ hashedValue });
  }

  static reconstitute(hashedPassword: string): StrongPassword {
    return new StrongPassword({ hashedValue: hashedPassword });
  }

  async verify(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this.props.hashedValue);
  }

  get value(): string {
    return this.props.hashedValue;
  }

  needsUpdate(): boolean {
    // Check if password hash needs updating (bcrypt version, cost, etc.)
    const currentCost = this.extractBcryptCost();
    const targetCost = process.env.NODE_ENV === 'production' ? 12 : 8;
    return currentCost < targetCost;
  }

  private extractBcryptCost(): number {
    const costMatch = this.props.hashedValue.match(/^\$2[aby]?\$(\d+)\$/);
    return costMatch && costMatch[1] ? parseInt(costMatch[1], 10) : 0;
  }

  equals(other: StrongPassword): boolean {
    return this.props.hashedValue === other.props.hashedValue;
  }
}