import { GuideSection } from "@/features/docs/components/guide-section"
import { StepList } from "@/features/docs/components/step-list"
import { TipBox } from "@/features/docs/components/tip-box"

export function EmployeesGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="Employee Directory">
        <p>
          Go to <strong>Sidebar → Employees → Employee List</strong>.
        </p>
        <p>
          This shows all employees in the company. Use the search bar at the top to find someone by
          name. You can also filter the list by department or by status (Active, Resigned, etc.).
        </p>
        <p>
          Click on any employee&apos;s name to open their full profile, where you can see their
          contact details, employment info, documents, and attendance summary.
        </p>
      </GuideSection>

      <GuideSection title="Adding a New Employee">
        <StepList
          steps={[
            "Click the Add Employee button in the top-right corner of the Employee List page.",
            "Fill in the personal details: full name, email address, phone number, and date of birth.",
            "Fill in the employment details: department, designation (job title), who they report to (manager), their joining date, and salary type.",
            "Fill in their home address and an emergency contact person.",
            "Review all the details, then click Submit.",
          ]}
        />
        <p>
          Once you save the new employee, the system automatically sends them a welcome email with
          their login details. They can log into DNMS right away.
        </p>
      </GuideSection>

      <GuideSection title="Editing an Employee">
        <p>
          Click on the employee&apos;s name to open their profile. Then click the{" "}
          <strong>Edit</strong> button at the top right.
        </p>
        <p>
          You can update any of their details - personal info, employment details, contact
          information, and more. Click Save when you are done.
        </p>
        <p>
          Every change you make is recorded in the system&apos;s audit log, so there is always a
          record of what was changed and when.
        </p>
      </GuideSection>

      <GuideSection title="Deactivating an Employee">
        <p>
          When someone leaves the company - whether they resign or are terminated - you need to
          deactivate their account so they can no longer access DNMS.
        </p>
        <StepList
          steps={[
            "Open the employee's profile.",
            "Click Edit.",
            "Find the Status field and change it to Resigned or Terminated.",
            "Save the changes.",
          ]}
        />
        <p>
          Their access is removed immediately. Their historical data - payslips, attendance records,
          and leave history - is preserved for your records.
        </p>
      </GuideSection>

      <GuideSection title="Org Chart">
        <p>
          Go to <strong>Sidebar → Employees → Org Chart</strong>.
        </p>
        <p>
          The org chart shows the full reporting hierarchy of the company in a visual tree. You can
          see who reports to whom at every level.
        </p>
        <p>
          Click on any person&apos;s card to go directly to their employee profile. Use the arrow
          buttons on a card to expand or collapse the branches below that person.
        </p>
      </GuideSection>

      <TipBox variant="tip">
        Always assign a Manager when creating a new employee. The manager assignment is required for
        leave approvals to work - without it, leave requests will not be routed to anyone.
      </TipBox>
    </div>
  )
}
