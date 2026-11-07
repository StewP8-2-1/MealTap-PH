import {
  BookOpenIcon,
  CalendarDaysIcon,
  HouseIcon,
  MessageCircleIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  /** Label in the desktop header. */
  label: string;
  /** Short Taglish label in the mobile bottom tab bar. */
  shortLabel: string;
  icon: LucideIcon;
};

/** Primary destinations. Pages beyond Home are built in Stages 8–12. */
export const primaryNav: NavItem[] = [
  { href: "/", label: "Home", shortLabel: "Home", icon: HouseIcon },
  {
    href: "/recipes",
    label: "Recipes",
    shortLabel: "Hanap",
    icon: BookOpenIcon,
  },
  {
    href: "/planner",
    label: "Meal Planner",
    shortLabel: "Plano",
    icon: CalendarDaysIcon,
  },
  {
    href: "/chat",
    label: "Ask MealTap",
    shortLabel: "Chat",
    icon: MessageCircleIcon,
  },
  {
    href: "/profile",
    label: "Profile",
    shortLabel: "Ako",
    icon: UserRoundIcon,
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}
