import { ClientDetail } from "@/features/clients"

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ClientDetail clientRef={id} />
}
