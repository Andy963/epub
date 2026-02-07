declare module "marks-pane" {
  export class Pane {
    constructor(...args: any[]);
    element: HTMLElement;
    destroy(...args: any[]): void;
    clear(...args: any[]): void;
  }

  export class Highlight {
    constructor(...args: any[]);
    range: Range;
    element: HTMLElement;
    attach(...args: any[]): void;
    detach(...args: any[]): void;
  }

  export class Underline {
    constructor(...args: any[]);
    range: Range;
    element: HTMLElement;
    attach(...args: any[]): void;
    detach(...args: any[]): void;
  }
}
