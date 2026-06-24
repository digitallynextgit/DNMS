import { GuideSection } from "@/features/docs/components/guide-section"
import { StepList } from "@/features/docs/components/step-list"
import { TipBox } from "@/features/docs/components/tip-box"
import { InfoTable } from "@/features/docs/components/info-table"

export function PayrollGuide() {
  return (
    <div className="space-y-8">
      <GuideSection title="Viewing Your Payslip">
        <p>
          Go to <strong>Sidebar → Payroll → My Payslips</strong>.
        </p>
        <p>
          You will see a list of payslips, one for each month. The most recent one is at the top.
          Click <strong>View</strong> on any row to open the full payslip for that month.
        </p>
        <p>You can also download the payslip as a PDF to save or print it.</p>
      </GuideSection>

      <GuideSection title="Reading Your Payslip">
        <p>Your payslip is divided into three sections. Here is what each one means:</p>

        <div className="mt-2 space-y-4">
          <div>
            <p className="text-foreground mb-2 font-medium">Earnings</p>
            <p className="text-muted-foreground mb-2">
              These are the amounts you are paid. They all add up to your Gross Salary.
            </p>
            <InfoTable
              rows={[
                {
                  term: "Basic Salary",
                  description: "The fixed base amount of your salary before any additions.",
                },
                {
                  term: "HRA",
                  description: "House Rent Allowance - a contribution towards your rent.",
                },
                {
                  term: "Conveyance",
                  description: "A fixed amount to help cover your travel to work.",
                },
                {
                  term: "Medical Allowance",
                  description: "A fixed amount towards medical expenses.",
                },
              ]}
            />
          </div>

          <div>
            <p className="text-foreground mb-2 font-medium">Deductions</p>
            <p className="text-muted-foreground mb-2">
              These amounts are subtracted from your Gross Salary.
            </p>
            <InfoTable
              rows={[
                {
                  term: "PF",
                  description:
                    "Provident Fund - a portion goes to your retirement savings. Your company also adds a matching amount.",
                },
                {
                  term: "ESI",
                  description: "Employee State Insurance - covers health and medical benefits.",
                },
                {
                  term: "TDS",
                  description:
                    "Tax Deducted at Source - income tax deducted by the company on your behalf.",
                },
                {
                  term: "LOP",
                  description:
                    "Loss of Pay - deducted for days you were absent without an approved leave.",
                },
              ]}
            />
          </div>

          <div className="bg-muted/40 border-border rounded border p-4">
            <p className="text-foreground font-medium">
              Net Salary = Gross Salary − Total Deductions
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              This is the amount that gets credited to your bank account.
            </p>
          </div>
        </div>

        <p className="mt-3">
          Your payslip also shows an attendance summary for that month - how many days you were
          present, how many leaves you took, and your LOP days if any.
        </p>
      </GuideSection>

      <GuideSection title="What is LOP?">
        <p>
          LOP stands for <strong>Loss of Pay</strong>. If you were absent on a working day and did
          not have an approved leave for that day, it counts as a loss-of-pay day.
        </p>
        <p>
          For each LOP day, the equivalent one day&apos;s salary is deducted from your pay. The LOP
          Days field on your payslip shows how many days were deducted this way.
        </p>
        <p>
          If you think your LOP days are incorrect, check your attendance and leave records first.
          If there is still a discrepancy, contact HR.
        </p>
      </GuideSection>

      <GuideSection title="Common Deductions Explained">
        <InfoTable
          rows={[
            {
              term: "PF",
              description:
                "Provident Fund. A portion of your salary goes into a retirement savings account. Your employer also adds a matching contribution. You can withdraw this when you leave the company or retire.",
            },
            {
              term: "ESI",
              description:
                "Employee State Insurance. This provides health insurance and medical benefits to you and your family. It only applies if your salary is below a certain threshold.",
            },
            {
              term: "TDS",
              description:
                "Tax Deducted at Source. The company deducts income tax from your salary every month and pays it to the government on your behalf. The amount depends on your total annual income.",
            },
          ]}
        />
      </GuideSection>

      <GuideSection title="For HR: Generating Payroll">
        <StepList
          steps={[
            "Go to Payroll → Overview.",
            "Select the month and year you want to generate payroll for.",
            "Click Generate Payroll.",
            "The system calculates each employee's salary based on their attendance, salary structure, and any LOP days.",
            "Review the generated records. Check for any employees with missing salary structures.",
            "Once everything looks correct, change the status: first to Approved, then to Paid when salaries have been disbursed.",
          ]}
        />
        <p>
          Only move payroll to Paid status after you have actually transferred the salaries to
          employees&apos; bank accounts.
        </p>
      </GuideSection>

      <GuideSection title="For HR: Salary Structures">
        <p>
          Go to <strong>Payroll → Salary Structures</strong>.
        </p>
        <p>
          Every employee needs a salary structure set up before their payroll can be generated. A
          salary structure defines all their pay components - Basic, HRA, Conveyance, and so on.
        </p>
        <p>
          Click <strong>Add</strong> to assign a salary structure to an employee. Fill in each
          component and the amounts. Once saved, this structure is used every month when payroll is
          generated.
        </p>
        <p>
          If an employee gets a raise, update their salary structure before generating that
          month&apos;s payroll.
        </p>
      </GuideSection>

      <TipBox variant="tip">
        Payslips are finalised once payroll is marked as Paid. If you spot a mistake in your
        payslip, contact HR before that point - corrections are much easier to make before the
        payroll is locked.
      </TipBox>
    </div>
  )
}
