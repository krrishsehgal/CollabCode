import type { User } from "@supabase/supabase-js";

export const getDisplayName = (user?: User | null) => {
  if (!user) return "";

  const identityDisplayName = user.identities?.find((identity) => {
    const displayName = identity.identity_data?.display_name;
    return typeof displayName === "string" && displayName.trim().length > 0;
  })?.identity_data?.display_name;

  const normalizedIdentity =
    typeof identityDisplayName === "string" ? identityDisplayName.trim() : "";
  const metadataName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";
  const metadataDisplayName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const email = typeof user.email === "string" ? user.email : "";

  return (
    normalizedIdentity ||
    metadataName ||
    metadataDisplayName ||
    email ||
    (user.id ? user.id.slice(0, 6) : "")
  );
};
