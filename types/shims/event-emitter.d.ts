declare module "event-emitter" {
  export type Listener = (...args: any[]) => void;

  export interface Emitter {
    on(event: string, listener: Listener): this;
    once(event: string, listener: Listener): this;
    off(event: string, listener?: Listener): this;
    emit(event: string, ...args: any[]): boolean;
  }

  function eventEmitter<T extends object>(target?: T): T & Emitter;
  export default eventEmitter;
}
