import { Shield } from "lucide-react"
import { PERMISSIONS } from "@/lib/constants"
import type { HelpGuide } from "../../types"

export const rolesPermissionsGuide: HelpGuide = {
  slug: "roles-permissions",
  group: "admin",
  icon: Shield,
  href: "/admin/roles",
  title: { en: "Roles & Permissions", hi: "रोल और परमिशन (Roles & Permissions)" },
  summary: {
    en: "Decide who can see and do what in DNMS: check the roles, change what a role allows, create your own role, and give a role to an employee.",
    hi: "तय करें कि DNMS में कौन क्या देख और कर सकता है: रोल देखें, किसी रोल की परमिशन बदलें, अपना नया रोल बनाएँ, और किसी कर्मचारी को रोल दें।",
  },
  keywords: [
    "role",
    "roles",
    "permission",
    "permissions",
    "access",
    "rights",
    "admin",
    "hr manager",
    "assign role",
    "custom role",
    "रोल",
    "परमिशन",
    "एक्सेस",
    "अधिकार",
    "इजाज़त",
  ],
  sections: [
    {
      id: "how-roles-work",
      title: { en: "How roles work", hi: "रोल कैसे काम करते हैं" },
      intro: {
        en: "A permission is one thing a person is allowed to do, like approve leave or run payroll. A role is a named set of permissions. Every employee holds one role, and it decides which pages show in their sidebar and which buttons they get.",
        hi: "परमिशन का मतलब है किसी एक काम की इजाज़त, जैसे छुट्टी मंज़ूर करना या पेरोल चलाना। रोल कई परमिशन का एक नाम वाला सेट है। हर कर्मचारी के पास एक रोल होता है, और वही तय करता है कि उनके साइडबार में कौन से पेज दिखेंगे और उन्हें कौन से बटन मिलेंगे।",
      },
      steps: [
        {
          text: {
            en: "Click Roles & Permissions in the sidebar. The table lists every role with its Description, how many Permissions it has, how many Employees hold it, and its Type. Create Role (1) adds a new role, and the pencil button (2) on a row changes that role.",
            hi: "साइडबार में Roles & Permissions पर क्लिक करें। टेबल में हर रोल दिखता है - उसका Description, उसमें कितनी Permissions हैं, कितने Employees के पास ये रोल है, और उसका Type। Create Role (1) से नया रोल बनता है, और किसी लाइन का पेंसिल बटन (2) उस रोल को बदलने के लिए है।",
          },
          shot: {
            id: "roles-permissions-list",
            as: "admin",
            path: "/admin/roles",
            highlight: [
              { role: "button", name: "Create Role" },
              { role: "button", name: "Edit HR Manager" },
            ],
          },
        },
        {
          text: {
            en: "DNMS comes with four roles. Admin can do everything, including these admin pages. HR Manager handles all HR work - employees, attendance, leave, payroll, hiring, onboarding and exits - and can also open the Audit Log and Email Templates. HR Employee helps with day-to-day HR, like approving leave and WFH requests and helping with hiring, but can't run payroll. Employee is for everyone else: their own leave, attendance, payslips, performance and projects.",
            hi: "DNMS में चार रोल पहले से बने आते हैं। Admin सब कुछ कर सकता है, ये एडमिन पेज भी। HR Manager पूरा HR काम संभालता है - कर्मचारी, हाज़िरी, छुट्टी, पेरोल, भर्ती, ऑनबोर्डिंग और एग्ज़िट - और Audit Log और Email Templates भी खोल सकता है। HR Employee रोज़ के HR काम में मदद करता है, जैसे छुट्टी और WFH की रिक्वेस्ट मंज़ूर करना और भर्ती में मदद करना, पर पेरोल नहीं चला सकता। Employee बाकी सबके लिए है: अपनी छुट्टी, हाज़िरी, सैलरी स्लिप, परफॉर्मेंस और प्रोजेक्ट्स।",
          },
        },
      ],
      tips: [
        {
          en: "Type System means the role came with DNMS: it can't be deleted and its internal name is fixed, but you can still change its permissions. Type Custom means your company created it.",
          hi: "Type में System का मतलब है कि रोल DNMS के साथ आया है: इसे डिलीट नहीं कर सकते और इसका internal name नहीं बदलता, पर इसकी परमिशन बदल सकते हैं। Custom का मतलब है कि ये रोल आपकी कंपनी ने बनाया है।",
        },
        {
          en: "There is also a hidden system account. It doesn't show in these lists, and its access can't be given or taken away from any DNMS screen.",
          hi: "एक छुपा हुआ सिस्टम अकाउंट भी होता है। ये इन लिस्ट में नहीं दिखता, और DNMS की किसी भी स्क्रीन से इसका एक्सेस न दिया जा सकता है, न हटाया जा सकता है।",
        },
      ],
    },
    {
      id: "edit-role",
      title: {
        en: "See or change what a role can do",
        hi: "देखें या बदलें कि कोई रोल क्या कर सकता है",
      },
      permission: PERMISSIONS.ROLE_WRITE,
      steps: [
        {
          text: {
            en: "Click the pencil button on the role's row. A panel opens on the right with the role's details and the full list of permissions - the ones the role already has are ticked.",
            hi: "रोल की लाइन में पेंसिल बटन पर क्लिक करें। दाईं ओर एक पैनल खुलता है जिसमें रोल की डिटेल्स और सारी परमिशन की लिस्ट होती है - जो परमिशन इस रोल के पास पहले से हैं, उन पर टिक लगा होता है।",
          },
        },
        {
          text: {
            en: "You can change the Display name (1) - the name people see. Under Permissions, they are grouped by module. The box next to a module name, like analytics (2), ticks every permission in that module. Or tick single permissions (3) - each one has a short line saying what it allows.",
            hi: "आप Display name (1) बदल सकते हैं - यही नाम सबको दिखता है। Permissions में परमिशन मॉड्यूल के हिसाब से ग्रुप में हैं। मॉड्यूल के नाम वाला बॉक्स, जैसे analytics (2), उस मॉड्यूल की सारी परमिशन पर एक साथ टिक लगा देता है। या एक-एक परमिशन पर टिक करें (3) - हर परमिशन के साथ एक छोटी लाइन लिखी होती है कि वो किस काम की इजाज़त देती है।",
          },
          shot: {
            id: "roles-permissions-edit",
            as: "admin",
            path: "/admin/roles",
            actions: [
              { click: { role: "button", name: "Edit HR Manager" } },
              { waitFor: { role: "checkbox", name: "Select all analytics permissions" } },
            ],
            highlight: [
              { placeholder: "e.g. HR Manager" },
              { role: "checkbox", name: "Select all analytics permissions" },
              { role: "checkbox", name: "analytics:read" },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Scroll down and click Save changes. Everyone who holds this role gets the new permissions within about 15 minutes, without signing out.",
            hi: "नीचे स्क्रॉल करें और Save changes पर क्लिक करें। जिन लोगों के पास ये रोल है, उन्हें लगभग 15 मिनट में नई परमिशन मिल जाती हैं - साइन आउट करने की ज़रूरत नहीं।",
          },
        },
      ],
      tips: [
        {
          en: "Select All at the top of the list ticks every permission at once. Click it again to clear them all.",
          hi: "लिस्ट के ऊपर Select All एक बार में सारी परमिशन पर टिक लगा देता है। दोबारा क्लिक करने पर सारे टिक हट जाते हैं।",
        },
        {
          en: "For a System role the Internal name (slug) box is greyed out. That is normal - only the display name, description and permissions can change.",
          hi: "System रोल में Internal name (slug) वाला बॉक्स ग्रे रहता है। ये नॉर्मल है - इसमें सिर्फ़ display name, description और परमिशन बदल सकते हैं।",
        },
        {
          en: "Be careful with the Admin role. It is meant to have every permission. If you take role:write away from it, you could lock yourself out of this page.",
          hi: "Admin रोल के साथ ध्यान रखें। इसके पास सारी परमिशन होनी चाहिए। अगर आपने इससे role:write हटा दी, तो आप खुद इस पेज से बाहर हो सकते हैं।",
        },
      ],
    },
    {
      id: "create-role",
      title: { en: "Create your own role", hi: "अपना नया रोल बनाएँ" },
      permission: PERMISSIONS.ROLE_WRITE,
      intro: {
        en: "Make a custom role when none of the built-in ones fits a job - for example, someone who only looks after projects.",
        hi: "जब पहले से बने रोल में से कोई भी किसी काम पर ठीक न बैठे, तब अपना रोल बनाएँ - जैसे कोई जो सिर्फ़ प्रोजेक्ट्स संभालता है।",
      },
      steps: [
        {
          text: {
            en: "Click Create Role at the top right of the page.",
            hi: "पेज पर ऊपर दाईं ओर Create Role पर क्लिक करें।",
          },
        },
        {
          text: {
            en: "Type the Internal name (slug) (1) - a short code like project_coordinator. Only small letters, numbers and underscores are allowed, and DNMS turns spaces into underscores for you. Then type the Display name (2) people will see, like Project Coordinator, and a Description if you want one.",
            hi: "Internal name (slug) (1) टाइप करें - एक छोटा कोड, जैसे project_coordinator। इसमें सिर्फ़ छोटे अक्षर, नंबर और underscore (_) चलते हैं, और स्पेस को DNMS अपने आप underscore बना देता है। फिर Display name (2) टाइप करें जो सबको दिखेगा, जैसे Project Coordinator, और चाहें तो Description भी लिखें।",
          },
          shot: {
            id: "roles-permissions-create",
            as: "admin",
            path: "/admin/roles",
            actions: [
              { click: { role: "button", name: "Create Role" } },
              { fill: { placeholder: "e.g. hr_manager" }, value: "project_coordinator" },
              { fill: { placeholder: "e.g. HR Manager" }, value: "Project Coordinator" },
            ],
            highlight: [{ placeholder: "e.g. hr_manager" }, { placeholder: "e.g. HR Manager" }],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "Tick the permissions this role needs, then scroll down and click Create role. The new role shows up in the table with the Type Custom.",
            hi: "इस रोल को जो परमिशन चाहिए उन पर टिक करें, फिर नीचे स्क्रॉल करके Create role पर क्लिक करें। नया रोल टेबल में Custom Type के साथ दिखने लगता है।",
          },
        },
      ],
      tips: [
        {
          en: "A person holds only one role, so a custom role should also include the everyday permissions the Employee role has - for example payroll:read to see their own payslips and document:read to open company documents. Open the Employee role first to see which ones it has.",
          hi: "एक व्यक्ति के पास एक ही रोल होता है, इसलिए कस्टम रोल में वो रोज़ वाली परमिशन भी होनी चाहिए जो Employee रोल में हैं - जैसे अपनी सैलरी स्लिप देखने के लिए payroll:read और कंपनी के डॉक्युमेंट्स खोलने के लिए document:read। पहले Employee रोल खोलकर देख लें कि उसमें कौन सी परमिशन हैं।",
        },
        {
          en: "To delete a custom role, click the bin button on its row. You can only delete a role that no employee holds, so move those people to another role first.",
          hi: "कस्टम रोल डिलीट करने के लिए उसकी लाइन में बिन (कूड़ेदान) बटन पर क्लिक करें। रोल तभी डिलीट होता है जब किसी कर्मचारी के पास वो रोल न हो, इसलिए पहले उन लोगों को दूसरा रोल दे दें।",
        },
      ],
    },
    {
      id: "assign-role",
      title: { en: "Give a role to an employee", hi: "किसी कर्मचारी को रोल दें" },
      permission: PERMISSIONS.ROLE_WRITE,
      intro: {
        en: "Each employee holds exactly one role. New employees get the Employee role on their own, so you only need this when someone needs more (or less) access.",
        hi: "हर कर्मचारी के पास सिर्फ़ एक रोल होता है। नए कर्मचारियों को Employee रोल अपने आप मिल जाता है, इसलिए ये तभी करना है जब किसी को ज़्यादा (या कम) एक्सेस देना हो।",
      },
      steps: [
        {
          text: {
            en: "In the sidebar, open Employees and then Employee Directory. Click the person's name to open their profile.",
            hi: "साइडबार में Employees और फिर Employee Directory खोलें। जिस व्यक्ति का रोल बदलना है, उसके नाम पर क्लिक करके उसकी प्रोफाइल खोलें।",
          },
        },
        {
          text: {
            en: "Click the Roles tab (1). It shows the role the person holds now. Click Manage Roles (2).",
            hi: "Roles टैब (1) पर क्लिक करें। इसमें दिखता है कि अभी उस व्यक्ति के पास कौन सा रोल है। Manage Roles (2) पर क्लिक करें।",
          },
          shot: {
            id: "roles-permissions-profile-roles",
            as: "admin",
            path: "/employees/DM004-priya-sharma",
            actions: [{ click: { role: "tab", name: "Roles", exact: true } }],
            highlight: [
              { role: "tab", name: "Roles", exact: true },
              { role: "button", name: "Manage Roles" },
            ],
          },
        },
        {
          text: {
            en: "Pick the new role (1) - you can choose only one - and click Save (2).",
            hi: "नया रोल चुनें (1) - एक ही रोल चुना जा सकता है - और Save (2) पर क्लिक करें।",
          },
          shot: {
            id: "roles-permissions-manage-dialog",
            as: "admin",
            path: "/employees/DM004-priya-sharma",
            actions: [
              { click: { role: "tab", name: "Roles", exact: true } },
              { click: { role: "button", name: "Manage Roles" } },
              { waitFor: { text: "HR Manager", exact: true } },
            ],
            highlight: [
              { text: "HR Manager", exact: true },
              { role: "button", name: "Save", exact: true },
            ],
            crop: { role: "dialog" },
          },
        },
        {
          text: {
            en: "The person gets a notification that their access was updated, and every other admin gets one about the change too. The change is also written to the Audit Log.",
            hi: "उस व्यक्ति को नोटिफिकेशन मिलता है कि उसका एक्सेस बदल गया है, और बाकी सभी एडमिन को भी इस बदलाव का नोटिफिकेशन जाता है। ये बदलाव Audit Log में भी दर्ज हो जाता है।",
          },
        },
      ],
      tips: [
        {
          en: "The new access reaches the person within about 15 minutes - they don't have to sign out. If they sign out and back in, it applies straight away.",
          hi: "नया एक्सेस लगभग 15 मिनट में उस व्यक्ति तक पहुँच जाता है - साइन आउट करने की ज़रूरत नहीं। अगर वो साइन आउट करके दोबारा साइन इन करें, तो तुरंत लागू हो जाता है।",
        },
        {
          en: "Changing your own role applies at once. Don't take the Admin role away from yourself unless another admin can give it back.",
          hi: "अपना खुद का रोल बदलने पर बदलाव तुरंत लागू होता है। जब तक कोई दूसरा एडमिन उसे वापस न दे सके, खुद से Admin रोल न हटाएँ।",
        },
      ],
    },
    {
      id: "questions",
      title: { en: "Common questions", hi: "आम सवाल" },
      faq: [
        {
          q: {
            en: "Who can open Roles & Permissions?",
            hi: "Roles & Permissions कौन खोल सकता है?",
          },
          a: {
            en: "Anyone whose role has the role:read permission - by default, only Admin. Changing roles and giving them to people needs role:write, which also only Admin has by default.",
            hi: "जिसके रोल में role:read परमिशन हो - शुरुआत में सिर्फ़ Admin के पास होती है। रोल बदलने और लोगों को रोल देने के लिए role:write चाहिए, जो भी शुरुआत में सिर्फ़ Admin के पास होती है।",
          },
        },
        {
          q: {
            en: "I changed someone's role, but they still see the old menu. Why?",
            hi: "मैंने किसी का रोल बदला, पर उन्हें अभी भी पुराना मेन्यू दिख रहा है। क्यों?",
          },
          a: {
            en: "Access updates within about 15 minutes. If they need it now, ask them to sign out and sign back in.",
            hi: "एक्सेस लगभग 15 मिनट में अपडेट होता है। अगर अभी चाहिए, तो उनसे कहें कि साइन आउट करके दोबारा साइन इन करें।",
          },
        },
        {
          q: {
            en: "Why can't I delete a role?",
            hi: "मैं कोई रोल डिलीट क्यों नहीं कर पा रहा?",
          },
          a: {
            en: "System roles can never be deleted, so they have no bin button. A custom role can be deleted only when no employee holds it - give those people another role first.",
            hi: "System रोल कभी डिलीट नहीं होते, इसलिए उनमें बिन बटन नहीं होता। कस्टम रोल तभी डिलीट होता है जब किसी कर्मचारी के पास वो रोल न हो - पहले उन लोगों को दूसरा रोल दे दें।",
          },
        },
      ],
    },
  ],
}
