/**
 * Converts each persisted pack-asset payload to the draft a founder can read,
 * compare, and steer. It is shared by the server use case and client UI so a
 * generic-versus-voice comparison never compares different source text.
 */
export const assetContentAsText = (content: unknown | null): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item, index) => {
        if (item && typeof item === "object") {
          const slide = item as { title?: unknown; body?: unknown };
          if (
            typeof slide.title === "string" ||
            typeof slide.body === "string"
          ) {
            return `${index + 1}. ${slide.title ?? ""}\n${slide.body ?? ""}`.trim();
          }
        }
        return typeof item === "string" ? item : JSON.stringify(item);
      })
      .join("\n\n");
  }
  if (content && typeof content === "object") {
    const value = content as {
      variants?: unknown;
      subject?: unknown;
      body?: unknown;
      script?: unknown;
      title?: unknown;
      bullets?: unknown;
    };
    if (Array.isArray(value.variants)) {
      return value.variants
        .filter((variant): variant is string => typeof variant === "string")
        .join("\n\n---\n\n");
    }
    if (typeof value.subject === "string" || typeof value.body === "string") {
      return `${value.subject ?? ""}\n\n${value.body ?? ""}`.trim();
    }
    if (typeof value.script === "string") return value.script;
    if (typeof value.title === "string" || Array.isArray(value.bullets)) {
      const bullets = Array.isArray(value.bullets)
        ? value.bullets.filter(
            (bullet): bullet is string => typeof bullet === "string",
          )
        : [];
      return [value.title ?? "", ...bullets].filter(Boolean).join("\n");
    }
  }
  return content === null ? "" : JSON.stringify(content, null, 2);
};
