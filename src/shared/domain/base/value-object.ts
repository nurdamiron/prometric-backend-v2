export abstract class ValueObject<T> {
  public constructor(public readonly value: T) {
    this.validate();
  }

  protected abstract validate(): void;

  public equals(other: ValueObject<T>): boolean {
    if (!(other instanceof this.constructor)) {
      return false;
    }

    return JSON.stringify(this.value) === JSON.stringify(other.value);
  }

  public toString(): string {
    return JSON.stringify(this.value);
  }
}