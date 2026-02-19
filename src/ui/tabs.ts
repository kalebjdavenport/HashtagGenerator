import type { GenerationMethod, MethodId } from "../types.ts";

export interface TabComponent {
  element: HTMLElement;
  getPanel(id: MethodId): HTMLElement | null;
  selectTab(id: MethodId): void;
  onTabChange(cb: (id: MethodId) => void): void;
}

export function createTabs(methods: GenerationMethod[]): TabComponent {
  const listeners: Array<(id: MethodId) => void> = [];

  const wrapper = document.createElement("div");
  wrapper.className = "tabs-component";

  // Tab list
  const tablist = document.createElement("div");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Generation method");
  tablist.className = "tab-list flex border-b border-buffer-border mb-4";
  wrapper.appendChild(tablist);

  // Panels container
  const panelsContainer = document.createElement("div");
  wrapper.appendChild(panelsContainer);

  const tabs: HTMLButtonElement[] = [];
  const panels: HTMLElement[] = [];

  for (const method of methods) {
    // Tab button
    const tab = document.createElement("button");
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", `panel-${method.id}`);
    tab.setAttribute("tabindex", "-1");
    tab.id = `tab-${method.id}`;
    tab.dataset.methodId = method.id;
    tab.className = "tab-button px-4 py-2.5 text-sm font-semibold text-buffer-muted border-b-2 border-transparent -mb-px transition-colors hover:text-buffer-dark";
    tab.textContent = method.label;
    tablist.appendChild(tab);
    tabs.push(tab);

    // Panel
    const panel = document.createElement("div");
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `tab-${method.id}`);
    panel.id = `panel-${method.id}`;
    panel.className = "tab-panel hidden";
    panel.setAttribute("tabindex", "0");
    panel.innerHTML = method.renderPanel();
    panelsContainer.appendChild(panel);
    panels.push(panel);
  }

  function activate(index: number): void {
    for (let i = 0; i < tabs.length; i++) {
      const isActive = i === index;
      tabs[i].setAttribute("aria-selected", String(isActive));
      tabs[i].setAttribute("tabindex", isActive ? "0" : "-1");
      tabs[i].classList.toggle("tab-active", isActive);

      if (isActive) {
        panels[i].classList.remove("hidden");
      } else {
        panels[i].classList.add("hidden");
      }
    }

    const methodId = methods[index].id;
    methods[index].onActivate?.();
    for (const cb of listeners) cb(methodId);
  }

  // Click handler
  tablist.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest("[role='tab']") as HTMLButtonElement | null;
    if (!target) return;
    const idx = tabs.indexOf(target);
    if (idx >= 0) {
      activate(idx);
      target.focus();
    }
  });

  // Keyboard navigation
  tablist.addEventListener("keydown", (e) => {
    const currentIdx = tabs.findIndex(
      (t) => t.getAttribute("aria-selected") === "true",
    );
    let nextIdx = currentIdx;

    switch (e.key) {
      case "ArrowRight":
        nextIdx = (currentIdx + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    activate(nextIdx);
    tabs[nextIdx].focus();
  });

  // Activate first tab by default
  if (tabs.length > 0) {
    activate(0);
  }

  return {
    element: wrapper,
    getPanel(id: MethodId): HTMLElement | null {
      return panelsContainer.querySelector(`#panel-${id}`) ?? null;
    },
    selectTab(id: MethodId): void {
      const idx = methods.findIndex((m) => m.id === id);
      if (idx >= 0) activate(idx);
    },
    onTabChange(cb: (id: MethodId) => void): void {
      listeners.push(cb);
    },
  };
}
