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
