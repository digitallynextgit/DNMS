import { GuideSection } from "@/features/docs/components/guide-section"
import { StepList } from "@/features/docs/components/step-list"
import { TipBox } from "@/features/docs/components/tip-box"

export function DocumentsGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="Types of Documents">
        <p>There are two kinds of documents in DNMS:</p>
        <div className="mt-2 space-y-3">
          <div className="border-border rounded-lg border p-4">
            <p className="text-foreground font-medium">Company Documents</p>
            <p className="text-muted-foreground mt-1">
              These are files shared with everyone in the company - things like HR policies, leave
              forms, onboarding checklists, and document templates. Any employee can view and
              download these.
            </p>
          </div>
          <div className="border-border rounded-lg border p-4">
            <p className="text-foreground font-medium">Employee Documents</p>
            <p className="text-muted-foreground mt-1">
              These are your personal files - your offer letter, ID proof, certificates, and other
              documents HR has uploaded for you. Only you and HR can see your documents.
            </p>
          </div>
        </div>
      </GuideSection>

      <GuideSection title="Viewing Company Documents">
        <p>
          Go to <strong>Sidebar → Documents</strong>.
        </p>
        <p>
          You will see tabs at the top to filter documents by category - Policies, Templates,
          Employment, and others. Click a tab to see documents in that category.
        </p>
        <p>
          Click the <strong>Download</strong> button next to any document to save it to your device.
        </p>
      </GuideSection>

      <GuideSection title="Viewing Your Documents">
        <p>
          To see your personal files, go to <strong>Employees → your name</strong>, then click on
          the <strong>Documents</strong> tab on your profile page.
        </p>
        <p>
          This shows all the files HR has uploaded specifically for you. You can download any of
          them from here.
        </p>
        <p>
          If a document is missing - for example, you never received a copy of your offer letter -
          contact HR and they can upload it for you.
        </p>
      </GuideSection>

      <GuideSection title="For HR: Uploading a Document">
        <StepList
          steps={[
            "Click the Upload button on the Documents page.",
            "Select the file from your computer. The file can be a PDF, Word document, or image. Maximum size is 20 MB.",
            "Fill in a clear title so employees can find it easily.",
            "Choose a category (for example, Policy, Template, or Employment).",
            "If the document has an expiry date - like a certification or annual policy - enter that date so you get reminded when it is due for renewal.",
            "Click Upload. The document is now available immediately.",
          ]}
        />
      </GuideSection>

      <GuideSection title="Document Expiry">
        <p>
          Some documents - like certifications, licences, or annual policies - have an expiry date.
          DNMS helps you keep track of these.
        </p>
        <ul className="mt-2 space-y-2">
          <li className="flex gap-2">
            <span className="w-36 shrink-0 font-medium text-amber-700">Yellow warning badge</span>
            <span>
              The document is expiring within the next 30 days. Time to renew or replace it.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="w-36 shrink-0 font-medium text-red-700">Red badge</span>
            <span>
              The document has already expired. HR should upload an updated version as soon as
              possible.
            </span>
          </li>
        </ul>
        <p className="mt-3">
          To renew a document, upload the new file and either replace the old one or upload it as a
          new version.
        </p>
      </GuideSection>

      <TipBox variant="tip">
        Keep your personal documents up to date. If your ID proof, professional certifications, or
        any other credentials have changed, let HR know so they can upload the latest versions to
        your profile.
      </TipBox>
    </div>
  )
}
