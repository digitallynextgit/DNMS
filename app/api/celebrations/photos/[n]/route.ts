import { withSession } from "@/server/api-handler"
import { readBirthdayPhoto } from "@/features/celebrations"

export const GET = withSession(async (_req, { params }, session) => {
  const photo = await readBirthdayPhoto(session.user, Number(params.n))
  return new Response(new Uint8Array(photo), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" },
  })
})
