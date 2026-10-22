export const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// One pass and callback replacement preserve literal $ sequences and placeholder-like content.
export const fillTemplate = (template, values) =>
  template.replace(
    /\{\{(TITLE|DESCRIPTION|URL|BODY|JSONLD)\}\}/g,
    (_, key) => values[key],
  );
