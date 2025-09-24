export interface Command {
  readonly commandId?: string;
  readonly timestamp?: Date;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    commandType?: string;
    timestamp?: Date;
    [key: string]: any;
  };
}

export interface CommandHandler<TCommand extends Command, TResult = any> {
  execute(command: TCommand): Promise<CommandResult<TResult>>;
}

export interface CommandBus {
  execute<TCommand extends Command, TResult = any>(
    command: TCommand
  ): Promise<CommandResult<TResult>>;

  register<TCommand extends Command, TResult = any>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): void;
}