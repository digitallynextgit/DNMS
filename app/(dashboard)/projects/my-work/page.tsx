// Direct import, not the projects barrel, which would pull every project component into this bundle.
import { MyWorkView } from "@/features/projects/components/my-work-view"

export default function MyWorkPage() {
  return <MyWorkView />
}
