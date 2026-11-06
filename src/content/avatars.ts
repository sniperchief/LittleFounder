// Preset child avatars (no photos). Keys are stored in child_profiles.avatar_key.

export const avatarKeys = ["founder-1", "founder-2", "founder-3", "founder-4", "founder-5", "founder-6"] as const;

export type AvatarKey = (typeof avatarKeys)[number];

export const avatarLabels: Record<AvatarKey, string> = {
  "founder-1": "Sprout",
  "founder-2": "Beats",
  "founder-3": "Bolt",
  "founder-4": "Specs",
  "founder-5": "Star",
  "founder-6": "Bow",
};

export function isAvatarKey(value: string): value is AvatarKey {
  return (avatarKeys as readonly string[]).includes(value);
}
