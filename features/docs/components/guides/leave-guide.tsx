import { GuideSection } from "@/features/docs/components/guide-section"
import { StepList } from "@/features/docs/components/step-list"
import { TipBox } from "@/features/docs/components/tip-box"

export function LeaveGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="Understanding Leave Balances">
        <p>
          Go to <strong>Sidebar → Leave → My Leaves</strong>.
        </p>
        <p>
          At the top of the page you will see a card for each type of leave (like Casual Leave, Sick
          Leave, etc.). Each card shows four numbers:
        </p>
        <ul className="mt-2 space-y-2">
          <li className="flex gap-2">
            <span className="text-foreground w-24 shrink-0 font-medium">Allocated</span>
            <span>The total number of days HR has given you for this leave type.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-24 shrink-0 font-medium">Used</span>
            <span>Days you have already taken.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-24 shrink-0 font-medium">Pending</span>
            <span>Days from requests that are still waiting for approval.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-foreground w-24 shrink-0 font-medium">Available</span>
            <span>
              How many days you can still take. This is Allocated minus Used minus Pending.
            </span>
          </li>
        </ul>
      </GuideSection>

      <GuideSection title="How to Apply for Leave">
        <StepList
          steps={[
            "Go to Sidebar → Leave → Apply Leave.",
            "Choose the type of leave you want to take (for example, Casual Leave or Sick Leave).",
            "Pick your start date and end date. The app will automatically skip weekends - you only count working days.",
            "The number of days is calculated for you automatically. You do not need to count yourself.",
            "Write a short reason for your leave in the text box.",
            "Click Submit. Your request is sent to your manager or HR for approval.",
          ]}
        />
      </GuideSection>

      <GuideSection title="What Happens After You Apply">
        <p>
          Right after you apply, your request shows as <strong>Pending</strong>. Your leave balance
          will show those days as pending too, so you know they are accounted for.
        </p>
        <p>
          Your manager or HR will review the request and either approve or reject it. You will get a
          notification as soon as a decision is made.
        </p>
        <p>
          If your leave is approved, your balance updates automatically - the days move from Pending
          to Used.
        </p>
      </GuideSection>

      <GuideSection title="Cancelling a Leave">
        <p>Changed your mind? You can cancel a leave request that is still Pending.</p>
        <StepList
          steps={[
            "Go to Leave → My Leaves.",
            "Find the request you want to cancel.",
            "Click the Cancel button next to it.",
          ]}
        />
        <p>
          You cannot cancel a leave that has already been approved. If you need to undo an approved
          leave, contact HR and they can reverse it for you.
        </p>
      </GuideSection>

      <GuideSection title="For Managers: Approving Leave">
        <p>
          Go to <strong>Sidebar → Leave → Team Leaves</strong>.
        </p>
        <p>
          This page shows all pending leave requests from people who report to you. For each
          request, you can see the employee name, leave type, dates, number of days, and their
          reason.
        </p>
        <p>
          Click <strong>Approve</strong> to allow the leave, or <strong>Reject</strong> to decline
          it. If you reject, please write a short reason - the employee will see your message in
          their notification.
        </p>
      </GuideSection>

      <GuideSection title="For HR: Leave Types">
        <p>
          Go to <strong>Sidebar → Leave → Leave Types</strong>.
        </p>
        <p>This is where you manage the types of leave available in the company. You can:</p>
        <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
          <li>Add a new leave type (for example, Maternity Leave or Paternity Leave)</li>
          <li>Set the maximum number of days for each type</li>
          <li>Choose whether it is a paid or unpaid leave</li>
          <li>Decide whether unused days carry forward to the next year</li>
        </ul>
        <p>
          Changes to leave types apply to new allocations. Existing balances are not changed
          automatically.
        </p>
      </GuideSection>

      <TipBox variant="tip">
        Try to apply for leave at least 2 days in advance whenever possible. This gives your manager
        enough time to plan around your absence.
      </TipBox>
    </div>
  )
}
