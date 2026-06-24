import { GuideSection } from "@/features/docs/components/guide-section"
import { StepList } from "@/features/docs/components/step-list"
import { TipBox } from "@/features/docs/components/tip-box"
import { InfoTable } from "@/features/docs/components/info-table"

export function AdminGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="Roles & Permissions">
        <p>
          Go to <strong>Admin → Roles & Permissions</strong>.
        </p>
        <p>
          A role is a set of rules that controls what a user can see and do in DNMS. Every employee
          is assigned a role, and that role decides their access.
        </p>
        <p>The system comes with these default roles:</p>
        <InfoTable
          rows={[
            {
              term: "Super Admin",
              description: "Full access to everything in the system. Can manage other admins.",
            },
            {
              term: "HR Admin",
              description:
                "Full access to all HR functions - employees, payroll, attendance, leave, documents, and settings.",
            },
            {
              term: "HR Manager",
              description:
                "Access to most HR functions but with some restrictions, such as no access to system settings.",
            },
            {
              term: "Employee",
              description:
                "Access only to their own data - their attendance, leave, payslips, and profile.",
            },
            {
              term: "Viewer",
              description:
                "Read-only access to some areas. Cannot create, edit, or delete anything.",
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="Creating a Custom Role">
        <p>
          If the default roles do not fit your needs, you can create a custom role with exactly the
          permissions you want.
        </p>
        <StepList
          steps={[
            "Click Add Role on the Roles & Permissions page.",
            'Enter a name for the role (for example, "Finance Manager" or "Department Head").',
            "Go through the permissions list and tick the ones this role should have. Use Select All to grant every permission at once.",
            "Click Save.",
            "To give this role to an employee, open their profile, go to Edit, and change their role to the new one.",
          ]}
        />
      </GuideSection>

      <GuideSection title="Audit Log">
        <p>
          Go to <strong>Admin → Audit Log</strong>.
        </p>
        <p>
          The audit log is a complete record of every action taken in DNMS. Every time someone
          creates, edits, or deletes something - whether it is an employee profile, a payroll
          record, or a document - it gets logged here automatically.
        </p>
        <p>Each log entry shows:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
          <li>Who did it (the employee&apos;s name)</li>
          <li>What they did (the action and what changed)</li>
          <li>When they did it (date and time)</li>
          <li>Which module it happened in</li>
        </ul>
        <p className="mt-3">
          Use the filters at the top to search by employee, module (like Payroll or Leave), or date
          range. This is useful for investigating any unexpected changes.
        </p>
      </GuideSection>

      <GuideSection title="Email Templates">
        <p>
          Go to <strong>Admin → Email Templates</strong>.
        </p>
        <p>
          DNMS sends emails automatically when certain things happen - for example, when a new
          employee is added, when a leave request is approved, or when a payslip is generated. Email
          templates control what those emails say.
        </p>
        <p>
          Click <strong>Edit</strong> on any template to change the subject line or body text. You
          can personalise the emails using placeholders - special tags that get replaced with real
          data when the email is sent:
        </p>
        <InfoTable
          rows={[
            { term: "{{first_name}}", description: "The recipient's first name." },
            { term: "{{last_name}}", description: "The recipient's last name." },
            { term: "{{company_name}}", description: "Your company's name." },
            { term: "{{login_url}}", description: "The link to the DNMS login page." },
          ]}
        />
        <p className="mt-3">
          Be careful not to delete or mistype placeholders - if you do, the real value will not
          appear in the email.
        </p>
      </GuideSection>

      <GuideSection title="Toggling a Template On/Off">
        <p>
          On the Email Templates page, each template has an <strong>Active</strong> toggle switch.
          When the toggle is on, the system sends that email automatically. When it is off, that
          email is disabled and will not be sent.
        </p>
        <p>
          For example, if you want to stop sending welcome emails to new employees temporarily, just
          turn off that template&apos;s toggle.
        </p>
      </GuideSection>

      <TipBox variant="warning">
        Only Super Admins should manage roles and permissions. Giving the wrong permissions to a
        user can accidentally lock them out of the system or give them access to sensitive data they
        should not see.
      </TipBox>
    </div>
  )
}
