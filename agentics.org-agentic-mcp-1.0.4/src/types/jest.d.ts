import 'jest';

declare global {
  namespace jest {
    interface Mock<T = any, Y extends any[] = any> {
      (...args: Y): T;
      mockImplementation(fn: (...args: Y) => T): this;
      mockReturnValue(value: T): this;
    }

    interface Matchers<R> {
      toContain(expected: string): R;
      toBeDefined(): R;
      toBe(expected: any): R;
      toThrow(expected?: string | Error): R;
      rejects: {
        toThrow(expected?: string | Error): Promise<R>;
      };
      toHaveLength(length: number): R;
    }
  }

  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function beforeEach(fn: () => void | Promise<void>): void;
  function expect<T>(actual: T): jest.Matchers<T>;
  const jest: {
    fn(): jest.Mock;
    mock(moduleName: string, factory?: any): void;
  };
}
