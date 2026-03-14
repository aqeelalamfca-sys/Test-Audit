import { useCallback } from "react";

export interface FormFieldData {
  name: string;
  label: string;
  type: string;
  value: string;
  isEmpty: boolean;
  isNarrative: boolean;
}

export interface PageFormSnapshot {
  totalFields: number;
  filledFields: number;
  emptyFields: number;
  completionPercent: number;
  fields: FormFieldData[];
  narrativeFields: FormFieldData[];
  hasConclusion: boolean;
  selectedOptions: string[];
  visibleTabs: string[];
  activeTab: string;
}

const NARRATIVE_PATTERNS = /conclusion|summary|narrative|remarks|memo|rationale|observation|comment|note|description|explanation|finding|recommendation|opinion/i;

function getFieldLabel(el: HTMLElement): string {
  const id = el.getAttribute("id") || el.getAttribute("name") || "";
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  if (id) {
    const labelEl = document.querySelector(`label[for="${id}"]`);
    if (labelEl) return labelEl.textContent?.trim() || id;
  }

  const parent = el.closest("[data-field-label]");
  if (parent) return parent.getAttribute("data-field-label") || "";

  const wrapper = el.closest(".space-y-1, .space-y-2, .space-y-3, .form-group, [class*='field']");
  if (wrapper) {
    const label = wrapper.querySelector("label, .label, [class*='Label']");
    if (label && label.textContent) return label.textContent.trim();
  }

  const prev = el.previousElementSibling;
  if (prev && (prev.tagName === "LABEL" || prev.classList.contains("label"))) {
    return prev.textContent?.trim() || "";
  }

  return id.replace(/([A-Z])/g, " $1").replace(/[-_]/g, " ").trim() || "Unlabeled";
}

function getFieldName(el: HTMLElement): string {
  return el.getAttribute("name")
    || el.getAttribute("id")
    || el.getAttribute("data-testid")
    || el.getAttribute("aria-label")?.replace(/\s+/g, "-").toLowerCase()
    || "";
}

export function usePageFormData() {
  const extractFormData = useCallback((): PageFormSnapshot => {
    const fields: FormFieldData[] = [];
    const narrativeFields: FormFieldData[] = [];
    const selectedOptions: string[] = [];
    const container = document.querySelector(".page-container, [data-testid='page-content'], main, [role='main'], .flex-1.overflow-auto");
    if (!container) {
      return {
        totalFields: 0, filledFields: 0, emptyFields: 0, completionPercent: 0,
        fields: [], narrativeFields: [], hasConclusion: false,
        selectedOptions: [], visibleTabs: [], activeTab: "",
      };
    }

    const inputs = container.querySelectorAll<HTMLInputElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([aria-hidden="true"])'
    );
    inputs.forEach(input => {
      if (input.closest("[data-radix-popper-content-wrapper]")) return;
      const type = input.type || "text";
      let value = "";

      if (type === "checkbox" || type === "radio") {
        if (input.checked) {
          value = input.value || "checked";
          const label = getFieldLabel(input);
          if (label) selectedOptions.push(label);
        }
      } else {
        value = input.value;
      }

      const name = getFieldName(input);
      const label = getFieldLabel(input);
      const isNarrative = NARRATIVE_PATTERNS.test(name) || NARRATIVE_PATTERNS.test(label);
      const field: FormFieldData = { name, label, type, value, isEmpty: !value, isNarrative };
      fields.push(field);
      if (isNarrative) narrativeFields.push(field);
    });

    const textareas = container.querySelectorAll<HTMLTextAreaElement>("textarea");
    textareas.forEach(ta => {
      if (ta.closest("[data-radix-popper-content-wrapper]")) return;
      const name = getFieldName(ta);
      const label = getFieldLabel(ta);
      const value = ta.value;
      const isNarrative = true;
      const field: FormFieldData = { name, label, type: "textarea", value, isEmpty: !value.trim(), isNarrative };
      fields.push(field);
      narrativeFields.push(field);
    });

    const selects = container.querySelectorAll<HTMLSelectElement>("select");
    selects.forEach(sel => {
      if (sel.closest("[data-radix-popper-content-wrapper]")) return;
      const name = getFieldName(sel);
      const label = getFieldLabel(sel);
      const value = sel.value;
      const isNarrative = NARRATIVE_PATTERNS.test(name) || NARRATIVE_PATTERNS.test(label);
      const field: FormFieldData = { name, label, type: "select", value, isEmpty: !value, isNarrative };
      fields.push(field);
      if (isNarrative) narrativeFields.push(field);
      if (value && label) selectedOptions.push(`${label}: ${value}`);
    });

    const radixSelects = container.querySelectorAll<HTMLElement>("[role='combobox']");
    radixSelects.forEach(btn => {
      if (btn.closest("[data-radix-popper-content-wrapper]")) return;
      if (btn.tagName === "SELECT" || btn.tagName === "INPUT") return;
      const name = getFieldName(btn);
      const label = getFieldLabel(btn);
      const valueEl = btn.querySelector("[data-value], span");
      const value = btn.getAttribute("data-value") || valueEl?.textContent?.trim() || "";
      if (value && !value.startsWith("Select")) {
        selectedOptions.push(`${label || name}: ${value}`);
      }
    });

    const visibleTabs: string[] = [];
    let activeTab = "";
    const tabButtons = container.querySelectorAll<HTMLElement>('[role="tab"]');
    tabButtons.forEach(tab => {
      const text = tab.textContent?.trim();
      if (text) {
        visibleTabs.push(text);
        if (tab.getAttribute("data-state") === "active" || tab.getAttribute("aria-selected") === "true") {
          activeTab = text;
        }
      }
    });

    const hasConclusion = !!container.querySelector('[data-testid="page-conclusion-panel"], [data-testid="conclusion-text"]');

    const filledFields = fields.filter(f => !f.isEmpty).length;
    const totalFields = fields.length;
    const completionPercent = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

    return {
      totalFields,
      filledFields,
      emptyFields: totalFields - filledFields,
      completionPercent,
      fields,
      narrativeFields,
      hasConclusion,
      selectedOptions,
      visibleTabs,
      activeTab,
    };
  }, []);

  return { extractFormData };
}
