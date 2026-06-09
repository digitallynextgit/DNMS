# Careers API - Integration Guide

The DNMS exposes a single public endpoint that returns the live list of open
roles in the exact shape your marketing site already uses. Whenever a recruiter
creates a posting in the DNMS and ticks **Publish to Careers Site**, it
appears here on the next fetch.

## Endpoint

```
GET https://dnms.example.com/api/public/careers
```

### Headers

| Header      | Value              | Required |
| ----------- | ------------------ | -------- |
| `X-API-Key` | shared secret      | **yes**  |
| `Accept`    | `application/json` | no       |

The API key is set as `CAREERS_API_KEY` in the DNMS environment. Treat it as a
server secret - **do not embed it in client-side JavaScript**. Fetch from a
Next.js Server Component / Route Handler / `getStaticProps` and surface the
result to the browser, not the key.

### Caching

Response includes `Cache-Control: public, max-age=60, s-maxage=300,
stale-while-revalidate=600` - safe to cache aggressively on a CDN. The DNMS
side is the source of truth, so revalidating every 60–300 s keeps the careers
page fresh without hammering the API.

### CORS

Open (`Access-Control-Allow-Origin: *`), but the key requirement above means
browser-direct calls aren't useful in practice. Use server-to-server.

## Response shape

```ts
type CareersTone = "red" | "teal"
type CareersMode = "full-time" | "internship"

type CareersRoleDescription = {
  intro: string
  jobEssence?: string
  keyRequirements?: string[]
  currentOpenings?: string[]
}

type CareersRole = {
  id: string // slug derived from title
  title: string
  meta?: string
  summary?: string
  description?: CareersRoleDescription
}

type CareersDepartment = {
  id: string // slug derived from department name
  title: string
  jobsLabel: string // CTA text, defaults to "Explore Open Roles"
  tone: CareersTone // visual accent, defaults to "teal"
  roles: CareersRole[]
}

type CareersApiResponse = {
  generatedAt: string // ISO timestamp
  fullTime: CareersDepartment[]
  internship: CareersDepartment[]
}
```

A shared TS file lives at `lib/careers-types.ts` in the DNMS repo - copy it
into the marketing site to keep both ends in sync.

## Mapping from DNMS → API

| DNMS field (`JobPosting`)                | API field                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `title`                                  | `role.title`                                                                         |
| `slug` (auto from title if blank)        | `role.id`                                                                            |
| `meta`                                   | `role.meta`                                                                          |
| `summary`                                | `role.summary`                                                                       |
| `intro`                                  | `role.description.intro`                                                             |
| `jobEssence`                             | `role.description.jobEssence`                                                        |
| `keyRequirements: string[]`              | `role.description.keyRequirements`                                                   |
| `currentOpenings: string[]`              | `role.description.currentOpenings`                                                   |
| `type === "INTERNSHIP"`                  | bucketed into `internship`, else `fullTime`                                          |
| `status === "OPEN"` + `publishToCareers` | included only if both true                                                           |
| `department.name`                        | `department.title`                                                                   |
| `department.careersTone`                 | `department.tone` (defaults to `teal`)                                               |
| `department.careersJobsLabel`            | `department.jobsLabel` (defaults to `Explore Open Roles` / `Explore Open Positions`) |

A posting is only published if **both** `publishToCareers=true` and
`status='OPEN'`. Drafts, on-hold, and closed postings never leak.

## Example client (Next.js, server-side)

```ts
// app/careers/data.ts
import "server-only"
import type { CareersApiResponse } from "@/lib/careers-types"

const DNMS_URL = process.env.DNMS_BASE_URL! // e.g. https://dnms.example.com
const DNMS_KEY = process.env.DNMS_CAREERS_API_KEY!

export async function fetchCareers(): Promise<CareersApiResponse> {
  const res = await fetch(`${DNMS_URL}/api/public/careers`, {
    headers: { "X-API-Key": DNMS_KEY },
    next: { revalidate: 300 }, // ISR - re-fetch every 5 min
  })
  if (!res.ok) {
    throw new Error(`Careers API responded ${res.status}`)
  }
  return res.json()
}
```

```ts
// app/careers/page.tsx
import { fetchCareers } from "./data"

export default async function CareersPage() {
  const { fullTime, internship } = await fetchCareers()
  // Render fullTime[] and internship[] exactly like the static CAREERS_DEPARTMENTS array.
}
```

If you previously imported `CAREERS_DEPARTMENTS` and
`CAREERS_INTERNSHIP_DEPARTMENTS` from a static file, replace those imports
with the `fullTime` and `internship` arrays returned here. No other render
code needs to change - the shape is identical.

## Errors

| Status | Body                                                             | Cause                           |
| ------ | ---------------------------------------------------------------- | ------------------------------- |
| 401    | `{ "error": "Unauthorized" }`                                    | Missing or wrong `X-API-Key`    |
| 500    | `{ "error": "CAREERS_API_KEY is not configured on the server" }` | The DNMS hasn't set the env var |

## Local testing

```bash
curl -H "X-API-Key: $CAREERS_API_KEY" http://localhost:3000/api/public/careers | jq
```

## Where the data is edited

Recruiters create job postings at `/recruitment` in the DNMS dashboard. The
job-creation dialog has a **"Publish to Careers Site"** section with:

- toggle to publish/unpublish
- meta + summary
- intro paragraph
- job essence
- key requirements (one per line)
- current openings (one per line - for roles with multiple seniority levels)

Department-level tone (`red` / `teal`) and the "Explore Open Roles" CTA label
are set in the same dialog under **"Careers settings for {department}"** when
a department is selected.
