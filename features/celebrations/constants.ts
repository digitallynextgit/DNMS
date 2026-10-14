export const BIRTHDAY = {
  employeeId: "8794020a-92b7-47ae-883c-610b07070c78",
  email: "manpreet@digitallynext.com",
  name: "Manpreet",
  // 13 Oct 2026, midnight to midnight IST (UTC+5:30).
  startsAt: Date.parse("2026-10-12T18:30:00Z"),
  endsAt: Date.parse("2026-10-13T18:30:00Z"),
  // Accounts that see every show a day early, to check it. Empty: only the birthday person sees theirs.
  previewEmails: [] as string[],
  // features/celebrations/photos/{n}.webp, in story order: a caption on the polaroid and the
  // line read out while that photo has the spotlight.
  chapters: [
    { caption: "Pure joy", line: "Your laugh fills every room." },
    { caption: "Inspiration", line: "You show us what's possible." },
    { caption: "Mentor", line: "Every lesson, carried with us." },
    { caption: "Style icon", line: "Grace in everything." },
    { caption: "Boss mode", line: "Calm. Decisive. Unstoppable." },
    { caption: "Leader", line: "You lead with heart." },
  ],
} as const
