export type MethodId = "keybert" | "nano" | "webllm";

export interface GenerationInput {
  title: string;
  text: string;
}

export interface GenerationResult {
  hashtags: string[];
  durationMs: number;
  method: MethodId;
}

export interface GenerationMethod {
  readonly id: MethodId;
  readonly label: string;
  readonly description: string;

  /** Check whether this method can currently generate. */
  isAvailable(): boolean;

  /** Run generation and return results. */
  generate(input: GenerationInput): Promise<GenerationResult>;

  /** Return the HTML content for this method's tab panel. */
  renderPanel(): string;

  /** Called when the tab is activated (e.g. to lazy-init resources). */
  onActivate?(): void;

  /** Called when the tab is deactivated. */
  onDeactivate?(): void;

  /** Cleanup resources (e.g. terminate worker). */
  destroy?(): void;

  /** Optional callback for status messages during generation. */
  onStatus?: (html: string) => void;
}
