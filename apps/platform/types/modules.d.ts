declare module 'opossum' {
  class CircuitBreaker {
    constructor(fn: (...args: any[]) => any, options?: Record<string, any>);
    fire(...args: any[]): Promise<any>;
    fallback(fn: (...args: any[]) => any): this;
    on(event: string, fn: (...args: any[]) => void): this;
    isOpen(): boolean;
    isClosed(): boolean;
  }
  export default CircuitBreaker;
}
declare module 'tailwindcss-animate';
