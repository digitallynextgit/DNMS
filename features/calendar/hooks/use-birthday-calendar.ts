"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"

/** One birthday on the calendar. Month and day only - the API never sends a birth year. */
export interface CalendarBirthday {
  id: string
  name: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation: string | null
  /** "YYYY-MM-DD" in the requested year. */
  date: string
}

/** Every birthday falling in `year`, for the Birthday Calendar. */
export function useBirthdayCalendar(year: number) {
  return useQuery({
    queryKey: ["birthdays", "year", year],
    queryFn: async () =>
      (await apiFetch<{ data: { data: CalendarBirthday[] } }>(`/api/birthdays?year=${year}`)).data
        .data,
    staleTime: 5 * 60_000,
  })
}
