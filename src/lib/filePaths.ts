export const FOLDER_PLACEHOLDER = ".keep";

export const normalizePath = (input: string) => {
  const trimmed = input.trim().replace(/\\/g, "/");
  const segments = trimmed.split("/").filter((segment) => segment.length > 0);
  return segments.join("/");
};

export const isPlaceholderFile = (path: string) => {
  const normalized = normalizePath(path);
  return (
    normalized === FOLDER_PLACEHOLDER ||
    normalized.endsWith(`/${FOLDER_PLACEHOLDER}`)
  );
};
