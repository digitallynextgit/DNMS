import { Users } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

// Priya Sharma (DM004) - the demo employee whose profile the screenshots open.
const PRIYA_PROFILE = "/employees/DM004-priya-sharma"

export const employeeDirectoryGuide: HelpGuide = {
  slug: "employee-directory",
  group: "hr",
  icon: Users,
  href: "/employees/employee-directory",
  title: { en: "Employee Directory", hi: "कर्मचारियों की लिस्ट (Employee Directory)" },
  summary: {
    en: "Find anyone in the company, add new employees, update their details, change their role, and deactivate people who have left.",
    hi: "कंपनी में किसी को भी ढूँढें, नए employee जोड़ें, उनकी जानकारी अपडेट करें, उनका role बदलें, और जो लोग जा चुके हैं उन्हें deactivate करें।",
  },
  keywords: [
    "employee",
    "staff",
    "directory",
    "add employee",
    "new joinee",
    "profile",
    "edit",
    "deactivate",
    "terminate",
    "role",
    "export",
    "कर्मचारी",
    "स्टाफ",
    "प्रोफाइल",
    "नया कर्मचारी",
  ],
  sections: [
    {
      id: "find",
      title: { en: "Find an employee", hi: "किसी employee को ढूँढें" },
      intro: {
        en: "The directory lists everyone in the company, one row per person. It opens showing only Active employees.",
        hi: "डायरेक्टरी में कंपनी के सभी लोग होते हैं, हर व्यक्ति की एक लाइन। खुलते ही इसमें सिर्फ Active employees दिखते हैं।",
      },
      steps: [
        {
          text: {
            en: "In the sidebar, open Employees and click Employee Directory. Each row shows the person's Department, Designation, Status and the date they Joined. A Probation tag means they are still on probation.",
            hi: "साइडबार में Employees खोलें और Employee Directory पर क्लिक करें। हर लाइन में उस व्यक्ति का Department, Designation, Status और जॉइन करने की तारीख (Joined) दिखती है। Probation टैग का मतलब है कि वो अभी प्रोबेशन पर हैं।",
          },
        },
        {
          text: {
            en: "Type a name, email or employee code in the search box (1). To narrow the list, pick a department (2) or a status (3). Click Clear to go back to the full Active list.",
            hi: "सर्च बॉक्स (1) में नाम, ईमेल या employee code टाइप करें। लिस्ट छोटी करनी हो तो department (2) या status (3) चुनें। पूरी Active लिस्ट पर वापस जाने के लिए Clear पर क्लिक करें।",
          },
          shot: {
            id: "employee-directory-list",
            as: "hr",
            path: "/employees/employee-directory",
            highlight: [
              { placeholder: "Search by name, email, or ID..." },
              { text: "All Departments", exact: true },
              { text: "Active", exact: true },
              { role: "tab", name: "Card view" },
              { role: "link", name: "Add Employee" },
            ],
          },
        },
        {
          text: {
            en: "Prefer cards with photos? Click the card view button (4). Click any name to open that person's profile. If you are allowed to add people, the Add Employee button (5) is at the top right.",
            hi: "फोटो वाले कार्ड देखने हैं? कार्ड व्यू बटन (4) पर क्लिक करें। किसी भी नाम पर क्लिक करके उस व्यक्ति की प्रोफाइल खोलें। अगर आपको लोग जोड़ने की इजाज़त है, तो Add Employee बटन (5) ऊपर दाईं ओर है।",
          },
        },
      ],
      tips: [
        {
          en: "The status filter has more than Active and Inactive: On Leave, Suspended, Resigned and Terminated too. Pick All Statuses to see everyone.",
          hi: "Status फिल्टर में Active और Inactive के अलावा On Leave, Suspended, Resigned और Terminated भी हैं। सबको देखने के लिए All Statuses चुनें।",
        },
        {
          en: "Your search, filters and page number are kept in the web address, so you can bookmark a filtered list or share it with a colleague.",
          hi: "आपका सर्च, फिल्टर और पेज नंबर वेब एड्रेस (URL) में रहते हैं, इसलिए फिल्टर की हुई लिस्ट को बुकमार्क कर सकते हैं या किसी साथी को भेज सकते हैं।",
        },
      ],
      faq: [
        {
          q: {
            en: "Why can't I see the Add Employee button?",
            hi: "मुझे Add Employee बटन क्यों नहीं दिख रहा?",
          },
          a: {
            en: "You need permission to create and edit employees. Ask an admin if you should have it.",
            hi: "इसके लिए employees बनाने और edit करने की permission चाहिए। अगर आपको ये मिलनी चाहिए तो admin से बात करें।",
          },
        },
      ],
    },
    {
      id: "add",
      title: { en: "Add a new employee", hi: "नया employee जोड़ें" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      intro: {
        en: "Adding someone is a form in five steps: Personal Info, Employment, Documents, Address & Emergency, and Review & Submit. Fields with a red star are required.",
        hi: "किसी को जोड़ना पाँच स्टेप का फॉर्म है: Personal Info, Employment, Documents, Address & Emergency, और Review & Submit। लाल स्टार वाली फील्ड भरना ज़रूरी है।",
      },
      steps: [
        {
          text: {
            en: "Click Add Employee at the top right of the directory. The five steps are shown across the top (1).",
            hi: "डायरेक्टरी में ऊपर दाईं ओर Add Employee पर क्लिक करें। पाँचों स्टेप ऊपर (1) दिखते हैं।",
          },
          shot: {
            id: "employee-directory-add-form",
            as: "hr",
            path: "/employees/new",
            highlight: [
              { text: "Personal Info", exact: true },
              { placeholder: "Diwakar" },
              { placeholder: "Diwakar.doe@company.com" },
              { role: "button", name: "Next", exact: true },
            ],
          },
        },
        {
          text: {
            en: "Personal Info: fill in First Name (2), Last Name, Work Email (3), Personal Email, Work Phone, Personal Phone, Date of Birth, Gender and Nationality. If the work email already belongs to someone else, the form tells you straight away. Click Next (4).",
            hi: "Personal Info: First Name (2), Last Name, Work Email (3), Personal Email, Work Phone, Personal Phone, Date of Birth, Gender और Nationality भरें। अगर वर्क ईमेल पहले से किसी और का है, तो फॉर्म तुरंत बता देता है। Next (4) पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Employment: the Employee Code is filled in with the next free number - click View codes to see the codes already used. Pick the Department, Designation, Employment Type, Date of Joining and Work Location. Job Role and Manager are optional, and Job Role only lists the roles of the department you picked.",
            hi: "Employment: Employee Code में अगला खाली नंबर अपने आप भर जाता है - पहले से इस्तेमाल हुए codes देखने के लिए View codes पर क्लिक करें। Department, Designation, Employment Type, Date of Joining और Work Location चुनें। Job Role और Manager भरना ज़रूरी नहीं है, और Job Role में सिर्फ चुने हुए department के roles आते हैं।",
          },
        },
        {
          text: {
            en: "On the same step, Login Password already has a strong password in it - click Generate for a new one. It is emailed to the employee. Leave Require password change on first login turned on, so they set their own. If the office has an attendance machine, type their code from the machine in Biometric Device ID.",
            hi: "इसी स्टेप पर Login Password में पहले से एक मज़बूत पासवर्ड भरा होता है - नया चाहिए तो Generate पर क्लिक करें। ये पासवर्ड employee को ईमेल हो जाता है। Require password change on first login को ऑन रहने दें, ताकि वो अपना पासवर्ड खुद सेट करें। अगर ऑफिस में अटेंडेंस मशीन है, तो मशीन वाला उनका code Biometric Device ID में डालें।",
          },
        },
        {
          text: {
            en: "Documents (optional): click to add files such as ID proof or the offer letter, give each one a Document Title, and pick a Category. Address & Emergency: fill in the current address, and tick Same as current if the permanent address is the same. The emergency contact is optional.",
            hi: "Documents (ज़रूरी नहीं): ID proof या offer letter जैसी फाइलें जोड़ें, हर फाइल का Document Title लिखें और Category चुनें। Address & Emergency: अभी का पता भरें, और अगर स्थायी पता भी वही है तो Same as current पर टिक करें। Emergency contact भरना ज़रूरी नहीं है।",
          },
        },
        {
          text: {
            en: "Review & Submit: check everything once, then click Create Employee. Their profile opens straight away.",
            hi: "Review & Submit: सब कुछ एक बार चेक करें, फिर Create Employee पर क्लिक करें। उनकी प्रोफाइल तुरंत खुल जाती है।",
          },
        },
      ],
      tips: [
        {
          en: "When you create an employee, DNMS emails them a welcome message with their login, sets up their leave balances, and starts their onboarding checklist and 15-day scorecard.",
          hi: "Employee बनाते ही DNMS उन्हें लॉगिन डिटेल्स के साथ वेलकम ईमेल भेजता है, उनका leave balance सेट करता है, और उनकी onboarding checklist और 15-day scorecard शुरू कर देता है।",
        },
        {
          en: "HR managers and admins also see On Probation at the top of the Employment step. New hires start on a 6-month probation - change the Probation Period, or turn it off to confirm someone straight away.",
          hi: "HR managers और admins को Employment स्टेप में सबसे ऊपर On Probation भी दिखता है। नए लोग 6 महीने के प्रोबेशन पर शुरू होते हैं - Probation Period बदलें, या इसे बंद करके किसी को सीधे confirm करें।",
        },
        {
          en: "Gmail App Password is optional. Turn it on only if this person should send emails from DNMS through their own Gmail.",
          hi: "Gmail App Password ज़रूरी नहीं है। इसे तभी ऑन करें जब ये व्यक्ति DNMS से अपने Gmail के ज़रिए ईमेल भेजेगा।",
        },
      ],
    },
    {
      id: "profile",
      title: { en: "Open a profile", hi: "प्रोफाइल खोलें" },
      steps: [
        {
          text: {
            en: "Click a name in the directory. The top card shows their photo, designation, department, employee code, status and contact details.",
            hi: "डायरेक्टरी में किसी नाम पर क्लिक करें। ऊपर वाले कार्ड में उनकी फोटो, designation, department, employee code, status और contact details दिखते हैं।",
          },
        },
        {
          text: {
            en: "Use the tabs (1) to move around. Info has personal and job details, address and emergency contact. Documents holds their files. Leave shows their leave for the year, and Salary shows their salary structure and payslips.",
            hi: "आगे देखने के लिए टैब्स (1) इस्तेमाल करें। Info में पर्सनल और नौकरी की जानकारी, पता और emergency contact है। Documents में उनकी फाइलें हैं। Leave में साल भर की छुट्टियाँ, और Salary में सैलरी स्ट्रक्चर और payslips दिखती हैं।",
          },
          shot: {
            id: "employee-directory-profile",
            as: "hr",
            path: PRIYA_PROFILE,
            highlight: [
              { css: "[role=tablist]" },
              { role: "link", name: "Edit full profile" },
              { role: "button", name: "Photo" },
            ],
          },
        },
        {
          text: {
            en: "Roles shows what they can do in DNMS. Task Access lets you allow them to fix their own old tasks. 15-Day Scorecard is their new-joinee review - see the Onboarding guide.",
            hi: "Roles में दिखता है कि वो DNMS में क्या-क्या कर सकते हैं। Task Access से आप उन्हें अपने पुराने tasks ठीक करने की इजाज़त दे सकते हैं। 15-Day Scorecard उनका नए joinee वाला review है - इसके लिए Onboarding गाइड देखें।",
          },
        },
        {
          text: {
            en: "If you can edit employees, use Edit full profile (2) or the Edit buttons on the Info tab to change their details. To change their picture, click Photo (3) and pick Upload photo or Choose an avatar.",
            hi: "अगर आप employees को edit कर सकते हैं, तो जानकारी बदलने के लिए Edit full profile (2) या Info टैब के Edit बटन इस्तेमाल करें। फोटो बदलने के लिए Photo (3) पर क्लिक करें और Upload photo या Choose an avatar चुनें।",
          },
        },
        {
          text: {
            en: "On the Documents tab, click Upload to add a file. Pick the File, give it a Title and Category, then click Upload.",
            hi: "Documents टैब पर फाइल जोड़ने के लिए Upload पर क्लिक करें। File चुनें, उसका Title और Category दें, फिर Upload पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "You only see the tabs and buttons your access allows. For example, Task Access appears only for people who can edit employees.",
          hi: "आपको वही टैब और बटन दिखते हैं जिनका आपके पास एक्सेस है। जैसे, Task Access सिर्फ उन्हें दिखता है जो employees को edit कर सकते हैं।",
        },
      ],
    },
    {
      id: "edit",
      title: { en: "Edit someone's details", hi: "किसी की जानकारी बदलें" },
      permission: PERMISSIONS.EMPLOYEE_WRITE,
      steps: [
        {
          text: {
            en: "On the Info tab, each box has its own Edit button: Personal Information, Employment Details, Address and Emergency Contact. Click it, change the fields, and click Save changes.",
            hi: "Info टैब पर हर बॉक्स का अपना Edit बटन है: Personal Information, Employment Details, Address और Emergency Contact। उस पर क्लिक करें, फील्ड बदलें, और Save changes पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Employment Details is where you change the department, designation, job role, manager (1), employment type, status or work location. Untick On probation (2) to confirm someone before their probation ends. Click Save changes (3).",
            hi: "Employment Details में आप department, designation, job role, manager (1), employment type, status या work location बदल सकते हैं। प्रोबेशन खत्म होने से पहले किसी को confirm करना हो तो On probation (2) से टिक हटा दें। Save changes (3) पर क्लिक करें।",
          },
          shot: {
            id: "employee-directory-edit-employment",
            as: "hr",
            path: PRIYA_PROFILE,
            actions: [{ click: { role: "button", name: "Edit", exact: true, nth: 1 } }],
            highlight: [
              { placeholder: "Search and select a manager" },
              { role: "checkbox", name: "On probation" },
              { role: "button", name: "Save changes" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Need to change a lot at once? Click Edit full profile at the top. It opens the same five-step form used for adding someone, and you finish with Save Changes.",
            hi: "एक साथ बहुत कुछ बदलना है? ऊपर Edit full profile पर क्लिक करें। ये वही पाँच स्टेप वाला फॉर्म खोलता है जो किसी को जोड़ते समय आता है, और आखिर में Save Changes पर क्लिक करें।",
          },
        },
      ],
      tips: [
        {
          en: "Changing the Status here does not stop someone signing in. To close their access, deactivate them (see the next section).",
          hi: "यहाँ Status बदलने से किसी का लॉगिन बंद नहीं होता। उनका एक्सेस बंद करना हो तो उन्हें deactivate करें (अगला सेक्शन देखें)।",
        },
        {
          en: "The manager you set here is the person who approves their leave and sees them as part of their team.",
          hi: "यहाँ जो manager आप सेट करते हैं, वही उनकी छुट्टी approve करता है और उन्हें अपनी टीम में देखता है।",
        },
      ],
    },
    {
      id: "deactivate",
      title: {
        en: "Deactivate, reactivate or remove someone",
        hi: "किसी को deactivate, reactivate या हटाएँ",
      },
      permission: PERMISSIONS.EMPLOYEE_DELETE,
      intro: {
        en: "Deactivating closes a person's access but keeps all their records. For someone who resigned, complete their exit clearance instead - it closes the account for you.",
        hi: "Deactivate करने से व्यक्ति का एक्सेस बंद हो जाता है, लेकिन उनके सारे रिकॉर्ड रहते हैं। जिसने resign किया है, उसका exit clearance पूरा करें - वो अपने आप अकाउंट बंद कर देता है।",
      },
      steps: [
        {
          text: {
            en: "In the table, each row has an eye icon (1) that opens the profile, and a Deactivate icon (2). Deactivate works straight away: the person can no longer sign in and is taken off their project teams.",
            hi: "टेबल में हर लाइन पर एक आँख वाला आइकन (1) है जो प्रोफाइल खोलता है, और एक Deactivate आइकन (2)। Deactivate तुरंत काम करता है: वो व्यक्ति अब साइन इन नहीं कर पाएगा और अपनी प्रोजेक्ट टीमों से हट जाएगा।",
          },
          shot: {
            id: "employee-directory-row-actions",
            as: "hr",
            path: "/employees/employee-directory",
            highlight: [
              { role: "link", name: "View" },
              { role: "button", name: "Deactivate" },
            ],
            crop: { role: "table" },
          },
        },
        {
          text: {
            en: "To find someone you deactivated, set the status filter to Inactive. Their row now has Reactivate, which gives their access back, and Delete permanently, which removes the record for good after you confirm.",
            hi: "Deactivate किए गए व्यक्ति को ढूँढने के लिए status फिल्टर में Inactive चुनें। अब उनकी लाइन पर Reactivate होता है, जिससे एक्सेस वापस मिल जाता है, और Delete permanently, जो कन्फर्म करने के बाद रिकॉर्ड हमेशा के लिए हटा देता है।",
          },
        },
        {
          text: {
            en: "To act on many people at once, tick the boxes on the left, or the box in the header for the whole page. A bar appears with Export CSV (1), which downloads the selected rows, and Terminate (2), which marks them all as terminated and deactivates them.",
            hi: "कई लोगों पर एक साथ काम करना है तो बाईं ओर के बॉक्स टिक करें, या पूरे पेज के लिए हेडर वाला बॉक्स। एक बार दिखेगी जिसमें Export CSV (1) है, जो चुनी हुई लाइनें डाउनलोड करता है, और Terminate (2), जो सबको terminated मार्क करके deactivate कर देता है।",
          },
          shot: {
            id: "employee-directory-bulk",
            as: "hr",
            path: "/employees/employee-directory",
            actions: [{ click: { role: "checkbox", name: "Select all" } }],
            highlight: [
              { role: "button", name: "Export CSV" },
              { role: "button", name: "Terminate" },
            ],
          },
        },
      ],
      tips: [
        {
          en: "Delete permanently cannot be undone, and it removes or detaches their attendance, leave, payroll and document history. Deactivating is almost always the better choice.",
          hi: "Delete permanently को वापस नहीं किया जा सकता, और इससे उनकी attendance, leave, payroll और documents की हिस्ट्री हट जाती है या अलग हो जाती है। ज़्यादातर मामलों में deactivate करना ही बेहतर है।",
        },
        {
          en: "You can't deactivate your own account.",
          hi: "आप अपना खुद का अकाउंट deactivate नहीं कर सकते।",
        },
      ],
    },
    {
      id: "roles",
      title: { en: "Change someone's role", hi: "किसी का role बदलें" },
      permission: PERMISSIONS.ROLE_WRITE,
      intro: {
        en: "A role decides what a person can see and do in DNMS, such as approving leave or running payroll. Each person has exactly one role.",
        hi: "Role तय करता है कि कोई व्यक्ति DNMS में क्या देख और कर सकता है, जैसे छुट्टी approve करना या payroll चलाना। हर व्यक्ति का सिर्फ एक role होता है।",
      },
      steps: [
        {
          text: {
            en: "Open the person's profile and click the Roles tab. Their current role is shown under Assigned Roles. Click Manage Roles (1).",
            hi: "उस व्यक्ति की प्रोफाइल खोलें और Roles टैब पर क्लिक करें। उनका अभी का role Assigned Roles में दिखता है। Manage Roles (1) पर क्लिक करें।",
          },
          shot: {
            id: "employee-directory-roles",
            as: "admin",
            path: PRIYA_PROFILE,
            actions: [{ click: { role: "tab", name: "Roles" } }],
            highlight: [{ role: "button", name: "Manage Roles" }],
          },
        },
        {
          text: {
            en: "Pick the new role, for example HR Manager (1), and click Save (2).",
            hi: "नया role चुनें, जैसे HR Manager (1), और Save (2) पर क्लिक करें।",
          },
          shot: {
            id: "employee-directory-roles-dialog",
            as: "admin",
            path: PRIYA_PROFILE,
            actions: [
              { click: { role: "tab", name: "Roles" } },
              { click: { role: "button", name: "Manage Roles" } },
            ],
            highlight: [
              { text: "HR Manager", exact: true },
              { role: "button", name: "Save", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
      ],
      tips: [
        {
          en: "Only people who can manage roles - usually admins - see Manage Roles. To change what a role itself allows, use Roles & Permissions.",
          hi: "Manage Roles सिर्फ उन्हें दिखता है जो roles मैनेज कर सकते हैं - आमतौर पर admins। किसी role में क्या-क्या allowed है, ये बदलने के लिए Roles & Permissions इस्तेमाल करें।",
        },
      ],
    },
  ],
}
