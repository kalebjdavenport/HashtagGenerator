export interface FormElements {
  form: HTMLFormElement;
  titleInput: HTMLInputElement;
  textInput: HTMLTextAreaElement;
  fileInput: HTMLInputElement;
  generateBtn: HTMLButtonElement;
  statusDiv: HTMLElement;
  resultsDiv: HTMLElement;
  hashtagContainer: HTMLElement;
  copyAllBtn: HTMLElement;
  clearBtn: HTMLElement;
  resetBtn: HTMLElement;
  copyFeedback: HTMLElement;
  timingDiv: HTMLElement;
  tabsContainer: HTMLElement;
}

export function formTemplate(): string {
  return `
  <form id="hashtag-form" aria-label="Hashtag generator input" class="space-y-5">
    <div>
      <label for="title-input" class="block text-sm font-semibold text-buffer-dark mb-1.5">
        Title or topic <span class="text-buffer-muted font-normal">(optional)</span>
      </label>
      <input
        id="title-input"
        name="title"
        type="text"
        class="w-full rounded-xl border border-buffer-border bg-white p-3.5 text-buffer-dark placeholder-buffer-muted/50 focus:border-buffer-blue transition-colors"
        placeholder="e.g. How to Build an AI-Powered Log Parser"
        aria-describedby="title-input-help"
      />
      <p id="title-input-help" class="text-xs text-buffer-muted mt-1.5">
        Helps generate hashtags that match your content's theme.
      </p>
    </div>

    <div>
      <label for="text-input" class="block text-sm font-semibold text-buffer-dark mb-1.5">
        Paste your text
      </label>
      <textarea
        id="text-input"
        name="text"
        rows="6"
        class="w-full rounded-xl border border-buffer-border bg-white p-4 text-buffer-dark placeholder-buffer-muted/50 focus:border-buffer-blue resize-y transition-colors"
        placeholder="Paste an article, blog post, or any text here..."
        aria-describedby="text-input-help"
        required
        minlength="20"
      ></textarea>
      <p id="text-input-help" class="text-xs text-buffer-muted mt-1.5">
        Minimum 20 characters. The more text you provide, the better the results.
      </p>
    </div>

    <div>
      <label for="file-input" class="block text-sm font-semibold text-buffer-dark mb-1.5">
        Or upload a .txt file
      </label>
      <input
        id="file-input"
        type="file"
        accept=".txt,text/plain"
        aria-describedby="file-input-help"
        class="block w-full text-sm text-buffer-muted file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-buffer-border file:text-sm file:font-semibold file:bg-buffer-light file:text-buffer-dark hover:file:bg-white file:cursor-pointer file:transition-colors"
      />
      <p id="file-input-help" class="text-xs text-buffer-muted mt-1.5">Plain text files only (.txt)</p>
    </div>

    <div id="tabs-container"></div>

    <button
      type="submit"
      id="generate-btn"
      class="w-full bg-buffer-blue text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-buffer-blue-hover active:bg-buffer-blue-active disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      disabled
      aria-disabled="true"
    >
      Loading...
    </button>
  </form>

  <div id="status" role="status" aria-live="polite" class="mt-5"></div>

  <div id="results" role="region" aria-live="polite" aria-label="Generated hashtags" class="mt-8 hidden">
    <h2 class="text-lg font-bold text-buffer-dark mb-3">Your Hashtags</h2>
    <div id="timing" class="text-sm text-buffer-muted mb-3 hidden"></div>
    <div id="hashtag-container" class="flex flex-wrap gap-2 mb-5"></div>
    <div class="flex gap-3">
      <button
        id="copy-all-btn"
        type="button"
        class="flex-1 bg-buffer-dark text-white font-semibold py-2.5 px-5 rounded-xl hover:opacity-90 transition-opacity"
      >
        Copy All
      </button>
      <button
        id="clear-btn"
        type="button"
        class="px-5 py-2.5 text-buffer-muted font-semibold border border-buffer-border rounded-xl hover:bg-buffer-light transition-colors"
      >
        Clear
      </button>
      <button
        id="reset-btn"
        type="button"
        class="px-5 py-2.5 text-red-500 font-semibold border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
      >
        Reset
      </button>
    </div>
    <p id="copy-feedback" class="text-sm text-buffer-green mt-2 hidden" role="status" aria-live="polite"></p>
  </div>
`;
}

export function getFormElements(): FormElements {
  return {
    form: document.getElementById("hashtag-form") as HTMLFormElement,
    titleInput: document.getElementById("title-input") as HTMLInputElement,
    textInput: document.getElementById("text-input") as HTMLTextAreaElement,
    fileInput: document.getElementById("file-input") as HTMLInputElement,
    generateBtn: document.getElementById("generate-btn") as HTMLButtonElement,
    statusDiv: document.getElementById("status")!,
    resultsDiv: document.getElementById("results")!,
    hashtagContainer: document.getElementById("hashtag-container")!,
    copyAllBtn: document.getElementById("copy-all-btn")!,
    clearBtn: document.getElementById("clear-btn")!,
    resetBtn: document.getElementById("reset-btn")!,
    copyFeedback: document.getElementById("copy-feedback")!,
    timingDiv: document.getElementById("timing")!,
    tabsContainer: document.getElementById("tabs-container")!,
  };
}

export function setupFileUpload(
  fileInput: HTMLInputElement,
  textInput: HTMLTextAreaElement,
  onChange?: () => void,
): void {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        textInput.value = reader.result;
        onChange?.();
      }
    };
    reader.readAsText(file);
  });
}
