import React from "react";

const TEMPLATE_VAR_DISPLAY_LABELS: Partial<Record<string, string>> = {
  blueprint_link: "Plan link",
};

/**
 * Replaces {{variable_name}} tokens in a string with styled pill spans
 * so template syntax looks friendly rather than technical in read-only views.
 *
 * e.g. "Hi {{first_name}}!" → "Hi " + <span class="template-var">First name</span> + "!"
 */
export function renderTemplateVars(text: string): React.ReactNode {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) => {
    const match = part.match(/^\{\{([^}]+)\}\}$/);
    if (match) {
      const key = match[1].trim();
      const label =
        TEMPLATE_VAR_DISPLAY_LABELS[key] ??
        key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      return (
        <span key={i} className="template-var">
          {label}
        </span>
      );
    }
    return part || null;
  });
}
