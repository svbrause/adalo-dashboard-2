import React from "react";

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
      const label = match[1]
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
