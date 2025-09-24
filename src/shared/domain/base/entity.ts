export abstract class Entity {
  protected constructor(
    public readonly id: string,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date
  ) {
    this.createdAt = createdAt ?? new Date();
    this.updatedAt = updatedAt ?? new Date();
  }

  public equals(entity: Entity): boolean {
    if (!(entity instanceof Entity)) {
      return false;
    }

    return this.id === entity.id;
  }

  protected touch(): void {
    (this as any).updatedAt = new Date();
  }
}