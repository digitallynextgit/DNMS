import { GuideSection } from "@/components/docs/guide-section"
import { StepList } from "@/components/docs/step-list"
import { TipBox } from "@/components/docs/tip-box"

export function GettingStartedGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="Logging In">
        <StepList
          steps={[
            "Open your web browser and go to the DNMS app URL shared by your HR team.",
            "Enter the email address and password that HR gave you when you joined.",
            "Click Sign In. You will land on the Dashboard - your home page in DNMS.",
          ]}
        />
      </GuideSection>

      <GuideSection title="Understanding the Sidebar">
        <p>
          The sidebar on the left is how you move around the app. Here is what each section does:
        </p>
        <ul className="mt-3 space-y-2">
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Dashboard</span>
            <span>A quick overview - headcount, recent joiners, and handy shortcuts.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Employees</span>
            <span>Browse the employee directory and org chart.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Attendance</span>
            <span>Check your check-in and check-out history for any day.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Leave</span>
            <span>Apply for leave, check how many days you have left, and track requests.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Payroll</span>
            <span>View and download your monthly payslips.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Documents</span>
            <span>Access company policies, templates, and your personal files.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-32 shrink-0 font-medium">Notifications</span>
            <span>See all system messages - leave approvals, payslip releases, and more.</span>
          </li>
        </ul>
        <p className="text-muted-foreground mt-3 text-xs">
          You only see the sections your role gives you access to. If something is missing, check
          with your HR team.
        </p>
      </GuideSection>

      <GuideSection title="Your Profile">
        <p>
          To see your own details, click your name or avatar in the top-right corner of the screen,
          then choose <strong>View Profile</strong>.
        </p>
        <p>
          Your profile shows your employment information - department, designation, manager, joining
          date, and contact details. If anything looks wrong, ask HR to update it for you.
        </p>
      </GuideSection>

      <GuideSection title="Notifications">
        <p>
          The bell icon at the top of the screen shows a number when you have unread messages. Click
          it to see a preview, or go to <strong>Notifications</strong> in the sidebar to read
          everything in full.
        </p>
        <p>
          You will get notifications when your leave is approved or rejected, when your payslip is
          ready, or when HR sends you a message.
        </p>
      </GuideSection>

      <TipBox variant="tip">
        If you cannot see a menu item, your role may not have access to that section. Contact your
        HR team and they can check your permissions.
      </TipBox>
    </div>
  )
}
