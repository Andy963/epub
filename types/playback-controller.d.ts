export type PlaybackState = "stopped" | "playing" | "paused" | "ended" | "error";

export interface PlaybackControllerEvents {
  onSegmentStart?: (index: number) => void;
  onSegmentEnd?: (index: number) => void;
  onError?: (index: number, error: unknown) => void;
  onStateChange?: (state: PlaybackState) => void;
}

export interface PlaybackControllerDriver<Segment = any> {
  playSegment(segments: Segment[], index: number, options?: { signal?: AbortSignal }): Promise<void>;
  pause(): void;
  resume(): void | Promise<void>;
  stop(): void;
}

export interface PlaybackControllerOptions<Segment = any> extends PlaybackControllerEvents {
  segments: Segment[];
  driver: PlaybackControllerDriver<Segment>;
  startIndex?: number;

  maxRetries?: number;
  retryDelayMs?: number | ((attempt: number, error: unknown) => number);
  skipOnError?: boolean;
}

export class PlaybackController<Segment = any> {
  constructor(options: PlaybackControllerOptions<Segment>);

  get state(): PlaybackState;
  get currentIndex(): number;
  get segments(): Segment[];

  play(): void;
  pause(): void;
  resume(): void;
  stop(): void;
  seekToSegment(index: number): void;
  next(): void;
  prev(): void;
}

