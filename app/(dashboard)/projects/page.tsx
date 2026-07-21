import { redirect } from "next/navigation"

// The projects board now lives at /projects/my-projects.
export default function ProjectsPage() {
  redirect("/projects/my-projects")
}
