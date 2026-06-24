import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import {
  type CareersApiResponse,
  type CareersDepartment,
  type CareersRole,
  type CareersTone,
  DEFAULT_CAREERS_JOBS_LABEL,
  DEFAULT_CAREERS_TONE,
  DEFAULT_INTERNSHIP_JOBS_LABEL,
  slugifyCareer,
} from "@/features/recruitment/careers-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
  "Access-Control-Max-Age": "86400",
}

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401, headers: CORS_HEADERS },
  )
}

function normalizeTone(value: string | null | undefined): CareersTone {
  return value === "red" || value === "teal" ? value : DEFAULT_CAREERS_TONE
}

function modeForType(type: string): "full-time" | "internship" {
  return type === "INTERNSHIP" ? "internship" : "full-time"
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: NextRequest) {
  const expected = process.env.CAREERS_API_KEY
  if (!expected) {
    return NextResponse.json(
      { error: "CAREERS_API_KEY is not configured on the server" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
  const provided = req.headers.get("x-api-key")
  if (!provided || provided !== expected) {
    return unauthorized()
  }

  const postings = await db.jobPosting.findMany({
    where: { publishToCareers: true, status: "OPEN" },
    orderBy: [{ createdAt: "asc" }],
    include: {
      department: {
        select: {
          id: true,
          name: true,
          careersTone: true,
          careersJobsLabel: true,
        },
      },
    },
  })

  type Bucket = Map<string, { department: CareersDepartment; mode: "full-time" | "internship" }>
  const buckets: Bucket = new Map()

  for (const posting of postings) {
    const mode = modeForType(posting.type)
    const dept = posting.department
    const deptKey = `${mode}::${dept?.id ?? "no-department"}`

    const deptTitle = dept?.name ?? "Other Roles"
    const deptId = dept ? slugifyCareer(dept.name) : "other-roles"
    const tone = normalizeTone(dept?.careersTone)
    const jobsLabel =
      dept?.careersJobsLabel ??
      (mode === "internship" ? DEFAULT_INTERNSHIP_JOBS_LABEL : DEFAULT_CAREERS_JOBS_LABEL)

    let bucket = buckets.get(deptKey)
    if (!bucket) {
      bucket = {
        mode,
        department: {
          id: deptId,
          title: deptTitle,
          jobsLabel,
          tone,
          roles: [],
        },
      }
      buckets.set(deptKey, bucket)
    }

    const role: CareersRole = {
      id: posting.slug?.trim() || slugifyCareer(posting.title) || posting.id,
      title: posting.title,
      ...(posting.meta ? { meta: posting.meta } : {}),
      ...(posting.summary ? { summary: posting.summary } : {}),
    }

    const intro = posting.intro?.trim()
    if (intro) {
      role.description = {
        intro,
        ...(posting.jobEssence?.trim() ? { jobEssence: posting.jobEssence.trim() } : {}),
        ...(posting.keyRequirements.length ? { keyRequirements: posting.keyRequirements } : {}),
        ...(posting.currentOpenings.length ? { currentOpenings: posting.currentOpenings } : {}),
      }
    }

    bucket.department.roles.push(role)
  }

  const fullTime: CareersDepartment[] = []
  const internship: CareersDepartment[] = []
  for (const { mode, department } of buckets.values()) {
    if (mode === "internship") internship.push(department)
    else fullTime.push(department)
  }

  const payload: CareersApiResponse = {
    generatedAt: new Date().toISOString(),
    fullTime,
    internship,
  }

  return NextResponse.json(payload, {
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
