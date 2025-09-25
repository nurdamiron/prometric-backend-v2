export abstract class ValueObject<T> {
  protected readonly props: T;

  constructor(props: T) {
    this.props = Object.freeze(props);
  }

  public equals(other: ValueObject<T>): boolean {
    if (!other || !other.props) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}