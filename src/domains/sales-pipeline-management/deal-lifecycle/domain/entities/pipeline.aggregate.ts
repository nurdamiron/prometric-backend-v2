import { AggregateRoot } from '../../../../../shared/domain/base/aggregate-root';
import { v4 as uuidv4 } from 'uuid';

export interface PipelineProps {
  organizationId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  orderIndex: number;
  stages: StageProps[];
  config?: PipelineConfig;
}

export interface StageProps {
  id: string;
  name: string;
  slug: string;
  colorHex: string;
  probability: number;
  type: StageType;
  orderIndex: number;
  wipLimit?: number;
  isActive: boolean;
  config?: StageConfig;
}

export interface PipelineConfig {
  allowReorder?: boolean;
  strictWipLimits?: boolean;
  autoCalculateProbabilities?: boolean;
}

export interface StageConfig {
  autoAdvance?: boolean;
  requiredFields?: string[];
  notifications?: boolean;
}

export enum StageType {
  NORMAL = 'normal',
  WON = 'won',
  LOST = 'lost'
}

export class Pipeline extends AggregateRoot {
  private constructor(
    private pipelineId: string,
    private props: PipelineProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super();
  }

  public static create(
    organizationId: string,
    name: string,
    isDefault: boolean = false
  ): Pipeline {
    const pipelineId = uuidv4();

    // Create default stages for new pipeline
    const defaultStages: StageProps[] = [
      {
        id: uuidv4(),
        name: 'Лиды',
        slug: 'leads',
        colorHex: '#64748B',
        probability: 10,
        type: StageType.NORMAL,
        orderIndex: 0,
        isActive: true
      },
      {
        id: uuidv4(),
        name: 'Квалификация',
        slug: 'qualification',
        colorHex: '#3B82F6',
        probability: 25,
        type: StageType.NORMAL,
        orderIndex: 1,
        isActive: true
      },
      {
        id: uuidv4(),
        name: 'Предложение',
        slug: 'proposal',
        colorHex: '#8B5CF6',
        probability: 50,
        type: StageType.NORMAL,
        orderIndex: 2,
        isActive: true
      },
      {
        id: uuidv4(),
        name: 'Переговоры',
        slug: 'negotiation',
        colorHex: '#F59E0B',
        probability: 75,
        type: StageType.NORMAL,
        orderIndex: 3,
        isActive: true
      },
      {
        id: uuidv4(),
        name: 'Выиграли',
        slug: 'won',
        colorHex: '#10B981',
        probability: 100,
        type: StageType.WON,
        orderIndex: 4,
        isActive: true
      },
      {
        id: uuidv4(),
        name: 'Проиграли',
        slug: 'lost',
        colorHex: '#EF4444',
        probability: 0,
        type: StageType.LOST,
        orderIndex: 5,
        isActive: true
      }
    ];

    return new Pipeline(pipelineId, {
      organizationId,
      name,
      isDefault,
      orderIndex: 0,
      stages: defaultStages,
      config: {
        allowReorder: true,
        strictWipLimits: false,
        autoCalculateProbabilities: false
      }
    });
  }

  public static restore(
    pipelineId: string,
    props: PipelineProps,
    createdAt: Date,
    updatedAt: Date
  ): Pipeline {
    return new Pipeline(pipelineId, props, createdAt, updatedAt);
  }

  // Getters
  public getPipelineId(): string {
    return this.pipelineId;
  }

  public getName(): string {
    return this.props.name;
  }

  public getStages(): StageProps[] {
    return [...this.props.stages].sort((a, b) => a.orderIndex - b.orderIndex);
  }

  public getStageById(stageId: string): StageProps | undefined {
    return this.props.stages.find(stage => stage.id === stageId);
  }

  // Business logic
  public addStage(name: string, colorHex: string, probability: number, type: StageType): string {
    const stageId = uuidv4();
    const maxOrder = Math.max(...this.props.stages.map(s => s.orderIndex), -1);

    const newStage: StageProps = {
      id: stageId,
      name,
      slug: this.generateSlug(name),
      colorHex,
      probability,
      type,
      orderIndex: maxOrder + 1,
      isActive: true
    };

    // Terminal stages (won/lost) always at the end
    if (type === StageType.WON || type === StageType.LOST) {
      const nonTerminalStages = this.props.stages.filter(s => s.type === StageType.NORMAL);
      newStage.orderIndex = nonTerminalStages.length;
    }

    this.props.stages.push(newStage);
    this.touch();

    return stageId;
  }

  public reorderStages(stageOrders: Array<{ stageId: string; orderIndex: number }>): void {
    stageOrders.forEach(order => {
      const stage = this.props.stages.find(s => s.id === order.stageId);
      if (stage) {
        stage.orderIndex = order.orderIndex;
      }
    });

    this.touch();
  }

  public updateStageName(stageId: string, newName: string): void {
    const stage = this.getStageById(stageId);
    if (!stage) {
      throw new Error('Stage not found');
    }

    // Check uniqueness
    const nameExists = this.props.stages.some(s =>
      s.id !== stageId && s.name.toLowerCase() === newName.toLowerCase()
    );

    if (nameExists) {
      throw new Error('Stage name already exists in this pipeline');
    }

    stage.name = newName;
    stage.slug = this.generateSlug(newName);
    this.touch();
  }

  public removeStage(stageId: string, dealsCount: number): void {
    if (dealsCount > 0) {
      throw new Error(`Cannot delete stage with ${dealsCount} deals. Move deals first.`);
    }

    this.props.stages = this.props.stages.filter(s => s.id !== stageId);
    this.reindexStages();
    this.touch();
  }

  public mergeStages(sourceStageId: string, targetStageId: string): void {
    const sourceStage = this.getStageById(sourceStageId);
    const targetStage = this.getStageById(targetStageId);

    if (!sourceStage || !targetStage) {
      throw new Error('Source or target stage not found');
    }

    // Remove source stage after merge
    this.props.stages = this.props.stages.filter(s => s.id !== sourceStageId);
    this.reindexStages();
    this.touch();
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }

  private reindexStages(): void {
    const normalStages = this.props.stages
      .filter(s => s.type === StageType.NORMAL)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const terminalStages = this.props.stages
      .filter(s => s.type === StageType.WON || s.type === StageType.LOST)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    // Reindex normal stages
    normalStages.forEach((stage, index) => {
      stage.orderIndex = index;
    });

    // Reindex terminal stages after normal ones
    terminalStages.forEach((stage, index) => {
      stage.orderIndex = normalStages.length + index;
    });
  }

  public toSnapshot(): PipelineProps {
    return {
      ...this.props,
      stages: this.props.stages.map(stage => ({ ...stage }))
    };
  }

  private _touch(): void {
    // Update timestamp for aggregate changes
    // In full DDD implementation, this would update updatedAt timestamp
  }
}