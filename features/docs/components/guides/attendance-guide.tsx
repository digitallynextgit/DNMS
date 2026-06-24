import { GuideSection } from "@/features/docs/components/guide-section"
import { StepList } from "@/features/docs/components/step-list"
import { TipBox } from "@/features/docs/components/tip-box"
import { InfoTable } from "@/features/docs/components/info-table"

export function AttendanceGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="How Attendance is Recorded">
        <p>
          Your company uses <strong>Hikvision biometric devices</strong> placed at the office
          entrance. When you arrive, the device scans your ID card and automatically records your
          check-in time. When you leave, it records your check-out time.
        </p>
        <p>
          You do not need to do anything manually - it all happens automatically as you walk in and
          out.
        </p>
        <p>
          If you forget to scan or the device misses you, HR can add a manual attendance record on
          your behalf.
        </p>
      </GuideSection>

      <GuideSection title="Viewing Your Attendance">
        <p>
          Go to <strong>Sidebar → Attendance → My Attendance</strong>.
        </p>
        <p>You will see your attendance for the last 30 days. Each row in the list shows:</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
          <li>Date</li>
          <li>Check-in time</li>
          <li>Check-out time</li>
          <li>Total hours worked</li>
          <li>Status (Present, Late, Half Day, etc.)</li>
        </ul>
      </GuideSection>

      <GuideSection title="Understanding Status Types">
        <p>Here is what each attendance status means:</p>
        <InfoTable
          rows={[
            { term: "Present", description: "You were at the office for a full working day." },
            {
              term: "Late",
              description:
                "You arrived after the grace period. Your check-in was recorded but marked as late.",
            },
            { term: "Half Day", description: "You were present for less than 4 hours." },
            { term: "Absent", description: "No attendance record was found for that day." },
            { term: "On Leave", description: "You had an approved leave request for that day." },
            { term: "Holiday", description: "It was a public holiday - no attendance required." },
            { term: "Weekend", description: "It was a Saturday or Sunday - office is closed." },
          ]}
        />
      </GuideSection>

      <GuideSection title="For HR: Overview">
        <p>
          Go to <strong>Sidebar → Attendance → Overview</strong>.
        </p>
        <p>
          This shows attendance for all employees. You can use the filters at the top to narrow down
          by employee name, department, or date range.
        </p>
        <p>
          If an employee was present but their record is missing, use the{" "}
          <strong>Add Manual Record</strong> button to create an entry for them.
        </p>
      </GuideSection>

      <GuideSection title="For HR: Managing Devices">
        <p>
          Go to <strong>Sidebar → Attendance → Devices</strong>.
        </p>
        <p>To add a new Hikvision device to the system:</p>
        <StepList
          steps={[
            "Click Add Device.",
            "Enter the device's IP address and serial number.",
            "Save the device.",
            "Click the Sync button to pull the latest attendance data from that device.",
          ]}
        />
        <p>
          You can sync any device at any time by clicking its Sync button. This is useful after a
          device was offline or when you want to catch up on the latest records.
        </p>
      </GuideSection>

      <GuideSection title="Holidays">
        <p>
          Go to <strong>Sidebar → Attendance → Holidays</strong>.
        </p>
        <p>
          This page lists all public holidays for the current year. On these days, all employees are
          automatically marked as Holiday - no attendance is needed.
        </p>
        <p>
          HR can add new holidays or remove existing ones from this page. Any changes apply
          immediately to the attendance records.
        </p>
      </GuideSection>

      <TipBox variant="tip">
        If your attendance shows Absent for a day when you were actually at the office, contact HR.
        They can add a manual record to fix it.
      </TipBox>
    </div>
  )
}
