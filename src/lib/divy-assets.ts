import groupSki from "@/assets/group-ski.jpg";
import groupVegas from "@/assets/group-vegas.jpg";
import groupNyc from "@/assets/group-nyc.jpg";
import groupLunch from "@/assets/group-lunch.jpg";
import groupClub from "@/assets/group-club.jpg";
import avatarMaya from "@/assets/avatar-maya.png";
import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";
import avatar3 from "@/assets/avatar-3.png";

const covers: Record<string, string> = {
  ski: groupSki,
  vegas: groupVegas,
  nyc: groupNyc,
  lunch: groupLunch,
  club: groupClub,
};

const avatars: Record<string, string> = {
  maya: avatarMaya,
  a1: avatar1,
  a2: avatar2,
  a3: avatar3,
};

/** Base cover used until someone adds a photo: soft purple gradient + group glyph. */
export const defaultCover =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b21b6"/></linearGradient></defs><rect width="96" height="96" fill="url(#g)"/><g fill="#ffffff" fill-opacity="0.92"><circle cx="48" cy="38" r="13"/><path d="M24 78c0-13.3 10.7-22 24-22s24 8.7 24 22z"/></g><g fill="#ffffff" fill-opacity="0.45"><circle cx="22" cy="42" r="9"/><path d="M6 70c0-9 7.2-15 16-15 2.5 0 4.8.5 6.9 1.4C24.4 60 22 64.7 22 70z"/><circle cx="74" cy="42" r="9"/><path d="M90 70c0-9-7.2-15-16-15-2.5 0-4.8.5-6.9 1.4C71.6 60 74 64.7 74 70z"/></g></svg>`,
  );

export const coverOptions = [
  { key: "club", label: "Club" },
  { key: "nyc", label: "Home" },
  { key: "vegas", label: "Trip" },
  { key: "ski", label: "Outdoors" },
  { key: "lunch", label: "Food" },
] as const;

export const avatarOptions = [
  { key: "maya", label: "Violet" },
  { key: "a1", label: "Amber" },
  { key: "a2", label: "Teal" },
  { key: "a3", label: "Rose" },
] as const;

export function coverSrc(key: string | null | undefined) {
  if (!key) return defaultCover;
  if (key.startsWith("data:") || key.startsWith("http")) return key;
  return covers[key] ?? defaultCover;
}

export function avatarSrc(key: string | null | undefined) {
  if (key && (key.startsWith("data:") || key.startsWith("http"))) return key;
  return avatars[key ?? "a1"] ?? avatar1;
}
