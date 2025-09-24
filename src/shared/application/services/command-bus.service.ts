import { Injectable } from '@nestjs/common';
import { Command, CommandBus, CommandHandler, CommandResult } from '../interfaces/command-handler.interface';

@Injectable()
export class InMemoryCommandBus implements CommandBus {
  private handlers = new Map<string, CommandHandler<any, any>>();

  async execute<TCommand extends Command, TResult = any>(
    command: TCommand
  ): Promise<CommandResult<TResult>> {
    const commandType = command.constructor.name;
    const handler = this.handlers.get(commandType);

    if (!handler) {
      return {
        success: false,
        error: `No handler registered for command: ${commandType}`
      };
    }

    try {
      const startTime = Date.now();
      const result = await handler.execute(command);
      const executionTime = Date.now() - startTime;

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          commandType
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Command execution failed',
        metadata: {
          commandType,
          timestamp: new Date()
        }
      };
    }
  }

  register<TCommand extends Command, TResult = any>(
    commandType: string,
    handler: CommandHandler<TCommand, TResult>
  ): void {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler for command ${commandType} is already registered`);
    }
    this.handlers.set(commandType, handler);
  }
}