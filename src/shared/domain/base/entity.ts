export abstract class Entity {
  public readonly id?: string;
  public readonly createdAt?: Date;
  public readonly updatedAt?: Date;

  protected constructor(
    id?: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  equals(entity: Entity): boolean {
    if (!(entity instanceof Entity)) {
      return false;
    }
    return this.id === entity.id;
  }

  protected touch(): void {
    (this.updatedAt as any) = new Date();
  }
}