import { Command } from '../../../../../../shared/application/interfaces/command-handler.interface';

export class CreateCustomerCommand implements Command {
  public readonly commandId?: string;
  public readonly timestamp?: Date;

  constructor(
    public readonly organizationId: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly createdBy: string,
    public readonly phone?: string,
    public readonly companyName?: string,
    public readonly source?: string,
    public readonly assignedTo?: string,
    public readonly notes?: string,
    public readonly tags?: string[],
    public readonly potentialValue?: number
  ) {
    this.timestamp = new Date();
  }
}