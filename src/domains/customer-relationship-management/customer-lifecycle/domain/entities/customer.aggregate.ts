import { AggregateRoot } from '../../../../../shared/domain/base/aggregate-root';
import { CustomerId } from '../value-objects/customer-id.vo';
import { CustomerInfo } from '../value-objects/customer-info.vo';
import { CustomerStatus } from '../value-objects/customer-status.vo';
import { CustomerCreatedEvent } from '../events/customer-created.event';

export interface CustomerProps {
  organizationId: string;
  customerInfo: CustomerInfo;
  status: CustomerStatus;
  leadScore: number;
  source?: string;
  assignedTo?: string;
  createdBy: string;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  notes?: string;
  tags?: string[];
  totalValue: number;
  potentialValue: number;
}

export class Customer extends AggregateRoot {
  private constructor(
    private customerId: CustomerId,
    private props: CustomerProps,
    private _createdAt?: Date,
    private _updatedAt?: Date
  ) {
    super();
  }

  public static create(
    organizationId: string,
    customerInfo: CustomerInfo,
    createdBy: string
  ): Customer {
    const customerId = CustomerId.generate();
    const initialStatus = CustomerStatus.lead();

    const customer = new Customer(customerId, {
      organizationId,
      customerInfo,
      status: initialStatus,
      leadScore: 0,
      createdBy,
      totalValue: 0,
      potentialValue: 0
    });

    // Domain event for Customer creation
    customer.addDomainEvent(
      new CustomerCreatedEvent(
        customerId,
        organizationId,
        customerInfo,
        initialStatus,
        createdBy
      )
    );

    return customer;
  }

  public static restore(
    customerId: CustomerId,
    props: CustomerProps,
    createdAt: Date,
    updatedAt: Date
  ): Customer {
    return new Customer(customerId, props, createdAt, updatedAt);
  }

  // Getters
  public getCustomerId(): CustomerId {
    return this.customerId;
  }

  public getCustomerInfo(): CustomerInfo {
    return this.props.customerInfo;
  }

  public getStatus(): CustomerStatus {
    return this.props.status;
  }

  public getLeadScore(): number {
    return this.props.leadScore;
  }

  public getTotalValue(): number {
    return this.props.totalValue;
  }

  public getPotentialValue(): number {
    return this.props.potentialValue;
  }

  // Business logic methods
  public changeStatus(newStatus: CustomerStatus, reason: string, changedBy: string): void {
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new Error(`Cannot transition from ${this.props.status.value} to ${newStatus.value}`);
    }

    this.props.status = newStatus;
    this.addNotes(`Status changed to ${newStatus.value}: ${reason} (by ${changedBy})`);
    this._customerTouch();
  }

  public updateLeadScore(newScore: number): void {
    if (newScore < 0 || newScore > 100) {
      throw new Error('Lead score must be between 0 and 100');
    }

    this.props.leadScore = newScore;
    this._customerTouch();
  }

  public assignTo(userId: string): void {
    this.props.assignedTo = userId;
    this._customerTouch();
  }

  public addNotes(notes: string): void {
    if (!notes || notes.trim().length === 0) {
      return;
    }

    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${notes.trim()}`;

    if (this.props.notes) {
      this.props.notes += '\n' + newNote;
    } else {
      this.props.notes = newNote;
    }

    this._customerTouch();
  }

  public addTag(tag: string): void {
    if (!tag || tag.trim().length === 0) {
      return;
    }

    if (!this.props.tags) {
      this.props.tags = [];
    }

    const trimmedTag = tag.trim().toLowerCase();
    if (!this.props.tags.includes(trimmedTag)) {
      this.props.tags.push(trimmedTag);
      this._customerTouch();
    }
  }

  public removeTag(tag: string): void {
    if (!this.props.tags) {
      return;
    }

    const trimmedTag = tag.trim().toLowerCase();
    this.props.tags = this.props.tags.filter(t => t !== trimmedTag);
    this._customerTouch();
  }

  public updatePotentialValue(value: number): void {
    if (value < 0) {
      throw new Error('Potential value cannot be negative');
    }

    this.props.potentialValue = value;
    this._customerTouch();
  }

  public addToTotalValue(amount: number): void {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    this.props.totalValue += amount;
    this._customerTouch();
  }

  public scheduleFollowUp(date: Date): void {
    if (date <= new Date()) {
      throw new Error('Follow-up date must be in the future');
    }

    this.props.nextFollowUpDate = date;
    this._customerTouch();
  }

  public recordContact(): void {
    this.props.lastContactDate = new Date();
    this._customerTouch();
  }

  private _customerTouch(): void {
    this._updatedAt = new Date();
  }

  // Query methods
  public isHighValue(): boolean {
    return this.props.potentialValue > 100000 || this.props.totalValue > 50000;
  }

  public isOverdue(): boolean {
    if (!this.props.nextFollowUpDate) {
      return false;
    }
    return this.props.nextFollowUpDate < new Date();
  }

  public getDaysSinceLastContact(): number {
    if (!this.props.lastContactDate) {
      return Infinity;
    }

    const diffTime = Date.now() - this.props.lastContactDate.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  // Convert to snapshot for persistence
  public toSnapshot(): CustomerProps {
    return {
      ...this.props,
      tags: this.props.tags ? [...this.props.tags] : undefined
    };
  }
}