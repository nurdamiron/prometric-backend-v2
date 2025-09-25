import { ValueObject } from '../../../../../shared/domain/base/value-object';

interface EmailProps {
  value: string;
}

export class Email extends ValueObject<EmailProps> {
  private constructor(props: EmailProps) {
    super(props);
  }

  static create(email: string): Email {
    if (!email || typeof email !== 'string') {
      throw new Error('Email is required');
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      throw new Error('Invalid email format');
    }

    // Business rules for email
    if (trimmedEmail.length > 254) {
      throw new Error('Email too long');
    }

    // Kazakhstan business email validation
    const suspiciousPatterns = [
      /temp.*mail/i,
      /disposable/i,
      /10.*minute.*mail/i,
      /mailinator/i,
      /guerrillamail/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(trimmedEmail)) {
        throw new Error('Temporary email addresses are not allowed');
      }
    }

    return new Email({ value: trimmedEmail });
  }

  get value(): string {
    return this.props.value;
  }

  get domain(): string {
    const parts = this.props.value.split('@');
    return parts[1] || '';
  }

  isBusinessEmail(): boolean {
    const businessDomains = ['gmail.com', 'mail.ru', 'yandex.ru', 'yandex.kz'];
    return !businessDomains.includes(this.domain);
  }

  equals(other: Email): boolean {
    return this.props.value === other.props.value;
  }
}