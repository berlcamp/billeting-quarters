import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Calendar,
  ClipboardCheck,
  Crown,
  FileText,
  Flag,
  HeartPulse,
  HelpCircle,
  Hospital,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Package,
  Pill,
  Settings,
  Stethoscope,
  Thermometer,
  Trash2,
  Truck,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/permissions";

// One step in a numbered "how to" list. Optional `note` shows below the step
// in a softer tone — use it for keyboard shortcuts, validation hints, or
// "what happens next" callouts.
export interface GuideStep {
  text: string;
  note?: string;
}

export interface GuideSection {
  heading: string;
  body?: string | string[];
  steps?: GuideStep[];
  tips?: string[];
  warnings?: string[];
}

export interface ModuleGuide {
  slug: string;
  title: string;
  // One-line summary shown on the index card and at the top of the guide.
  summary: string;
  icon: LucideIcon;
  // Roles that touch this module day-to-day. Omit / empty means "all signed-in
  // users". Used to filter the index for relevance.
  audience?: UserRole[];
  // Sidebar grouping on the help index — mirrors the main nav grouping.
  category:
    | "Getting started"
    | "Operations"
    | "Medical"
    | "Logistics"
    | "Personnel"
    | "Reports"
    | "Admin";
  sections: GuideSection[];
}

const BERL_EMAIL = "berlcamp@gmail.com";

export const MODULE_GUIDES: ModuleGuide[] = [
  // ===========================================================================
  // GETTING STARTED
  // ===========================================================================
  {
    slug: "getting-started",
    title: "Getting started",
    summary:
      "How to sign in, what to expect on first run, and how the app is organized.",
    icon: HelpCircle,
    category: "Getting started",
    sections: [
      {
        heading: "What is PPDMS?",
        body: [
          "Palaro Command (PPDMS) is the operations platform for the Palarong Pambansa. It coordinates incidents, medical referrals, VIP movements, venues, transportation, personnel, supplies, and food across every Billeting Quarter (BQ) and Playing Venue (PV).",
          "Everything you do in the app is timestamped and audited for compliance with the Data Privacy Act (RA 10173).",
        ],
      },
      {
        heading: "Sign in for the first time",
        steps: [
          {
            text: "Open the sign-in page and click \"Sign in with Google\".",
            note: "Google is the only accepted login method — there is no email/password fallback.",
          },
          {
            text: "Choose the Google account that matches the email your administrator invited.",
          },
          {
            text: "If your email is on the access list, you go straight to the dashboard with the role you were assigned.",
          },
        ],
        tips: [
          "Can't get past the Google screen? You probably haven't been invited yet — contact your command center lead.",
          "Already invited but seeing \"not authorized\"? Make sure you signed in with the same email that was invited (Gmail aliases like name+palaro@ count as different addresses).",
        ],
      },
      {
        heading: "How the dashboard is organized",
        body: [
          "The left sidebar is your map of the system, grouped by purpose: Operations, Medical, Logistics, Personnel, Reports, and Admin. You only see entries your role can use — if you don't see Heat Index or Venues, your role isn't authorised for them.",
          "The top bar shows your current location (breadcrumbs), notifications, theme toggle, and your account menu. The Help icon (?) brings you back to this guide at any time.",
        ],
      },
      {
        heading: "Common patterns",
        tips: [
          "Times are entered in PHT (Asia/Manila) and stored in UTC. The app converts on display.",
          "Lists usually have a search box (top-left) and filters (top-right).",
          "Click a row to open detail; click an action button to fire a state change. Destructive actions ask for confirmation.",
          "Critical events trigger toast notifications and update other tabs in realtime.",
        ],
      },
    ],
  },

  {
    slug: "command-center",
    title: "Command Center",
    summary:
      "The home dashboard — at-a-glance situational awareness for ops leads.",
    icon: LayoutDashboard,
    category: "Getting started",
    audience: ["super_admin", "command_center"],
    sections: [
      {
        heading: "What you see",
        body: [
          "Open incidents, critical incidents, active referrals, and hospitalizations today live at the top. The pipeline below shows how incidents flow Open → In Progress → Referred → Resolved.",
          "The live incident feed (left) and active referrals (right) update in realtime — no refresh needed. The bottom section shows audit activity and a sites map.",
        ],
      },
      {
        heading: "Workflows from the dashboard",
        steps: [
          {
            text: "Watch for the pulse animation on the Critical card — it appears the moment a critical incident is filed.",
          },
          {
            text: "Click any feed entry to jump straight to its detail page.",
          },
          {
            text: "Use the sites map to spot clusters — multiple incidents at the same BQ or PV usually warrant a coordinated response.",
          },
        ],
        tips: [
          "Keep this page open on a separate monitor at the command center. It's designed for passive monitoring.",
        ],
      },
    ],
  },

  // ===========================================================================
  // OPERATIONS
  // ===========================================================================
  {
    slug: "incidents",
    title: "Incidents",
    summary:
      "Universal entry point for any operational event — medical, utility, security, facility, VIP, or other.",
    icon: AlertTriangle,
    category: "Operations",
    sections: [
      {
        heading: "When to file an incident",
        body: [
          "Anything operationally relevant: an athlete twisted an ankle, a power outage at a BQ, a security concern, a facility issue, a VIP status change. If you'd want command center to know, file it.",
          "Filing is intentionally fast: a field officer should be able to submit on a phone in under 30 seconds.",
        ],
      },
      {
        heading: "File a new incident",
        steps: [
          {
            text: "From the sidebar, open Operations → Incidents, then click \"New Incident\".",
          },
          {
            text: "Pick a category and severity. Severity drives notification reach — Critical pages command center immediately.",
          },
          {
            text: "Add a title and short description. Keep the title scannable — \"Power out, BQ-A wing 3\" beats \"Issue at BQ\".",
          },
          {
            text: "Pick the site and (optional) delegation. Use \"Use current location\" on a phone to capture GPS.",
          },
          {
            text: "Snap up to 5 photos. They're compressed in the browser and stored privately.",
          },
          {
            text: "Submit. You're redirected to the detail page; the incident also appears live on Command Center.",
            note: "If submission fails, the toast tells you why — your draft stays in the form.",
          },
        ],
        tips: [
          "Severity guide: Low = no action needed; Medium = follow-up by end of shift; High = needs attention now; Critical = page command center.",
          "If the incident is medical and needs care escalated past field level, create a Field referral from the incident detail page (don't refile).",
        ],
      },
      {
        heading: "Working an existing incident",
        steps: [
          {
            text: "Open the detail page from the list or the dashboard feed.",
          },
          {
            text: "The right sidebar shows the stage tracker (Reported → In Progress → Resolved). The left has summary cards, photos, and stage-specific actions.",
          },
          {
            text: "Update the status as the situation evolves. Use Resolution notes when you close it.",
          },
          {
            text: "If you need a medical referral, the action card on the right gives you a one-click path.",
          },
        ],
        warnings: [
          "Once an incident is closed, edits become an addendum — the original record is never overwritten. This is on purpose for audit and medical retention.",
        ],
      },
    ],
  },

  {
    slug: "vip",
    title: "VIP Tracking",
    summary:
      "Estimated and actual arrival/departure times for VIPs being escorted by Protocol Officers.",
    icon: Crown,
    category: "Operations",
    audience: ["protocol_officer", "command_center"],
    sections: [
      {
        heading: "Concept",
        body: [
          "Each VIP has a record (name, title, organization, optional delegation). Movements track the journey through ETA → Arrived → ETD → Departed for any destination site.",
          "Status changes notify command center automatically.",
        ],
      },
      {
        heading: "Add a VIP",
        steps: [
          { text: "Open Operations → VIP Tracking." },
          {
            text: "Click \"Add VIP\" and fill in the details. Title (Senator, Secretary, etc.) helps protocol officers identify quickly.",
          },
          {
            text: "Save. The VIP shows up in the active list.",
          },
        ],
      },
      {
        heading: "Log a movement",
        steps: [
          {
            text: "From the VIP detail or the main list, click \"Log Movement\".",
          },
          {
            text: "Pick the destination site and an initial status (usually ETA logged).",
          },
          {
            text: "Enter the estimated arrival time. As the journey progresses, update the same movement to Arrived (with actual arrival), ETD logged, then Departed.",
          },
        ],
        tips: [
          "One movement per leg — don't reuse a movement for the next destination. New leg, new movement.",
          "Cancel a movement if the VIP changes plans — don't delete it. The cancelled record is still useful for auditing escort hours.",
        ],
      },
    ],
  },

  {
    slug: "heat-index",
    title: "Heat Index",
    summary:
      "Record temperature + humidity at venues; the system computes heat index and recommends suspension when it gets dangerous.",
    icon: Thermometer,
    category: "Operations",
    audience: ["medical_field", "venue_manager", "command_center"],
    sections: [
      {
        heading: "Why this matters",
        body: [
          "Heat-related illness is the most common medical risk at outdoor venues. Once heat index crosses the danger threshold, games should be paused.",
          "The app uses the NWS heat-index formula. You enter temp + humidity; the server computes the index, classifies the danger level, and sets the suspension flag — you don't need to do the math.",
        ],
      },
      {
        heading: "Record a reading",
        steps: [
          {
            text: "Open Operations → Heat Index.",
          },
          {
            text: "Click \"Record Reading\" and pick the site.",
          },
          {
            text: "Enter the current temperature (°C) and relative humidity (%).",
          },
          {
            text: "Add an optional note (e.g. \"reading from court 3 sensor at 14:00\") and submit.",
            note: "If the result is Danger or Extreme Danger, command center and venue managers get a notification automatically.",
          },
        ],
        tips: [
          "Take readings every 60 minutes during peak hours (10:00–16:00 PHT) at outdoor playing venues.",
        ],
      },
      {
        heading: "Override the suspension flag",
        body: [
          "If on-the-ground judgment differs from the computed flag (e.g. shaded venue, indoor activity), command center can override the recommendation.",
        ],
        steps: [
          {
            text: "Open the reading from the heat-index list.",
          },
          {
            text: "Click \"Override\" and provide a reason (required).",
          },
          {
            text: "The override is appended to the reading's notes with your name and timestamp — the original recommendation is preserved for audit.",
          },
        ],
        warnings: [
          "Overrides at extreme-danger levels need a clear, defensible reason — they're scrutinized in incident reviews.",
        ],
      },
    ],
  },

  // ===========================================================================
  // MEDICAL
  // ===========================================================================
  {
    slug: "medical-field",
    title: "Medical — Field",
    summary:
      "First responders triage at the venue and refer up to UCF when needed.",
    icon: HeartPulse,
    category: "Medical",
    audience: ["medical_field"],
    sections: [
      {
        heading: "Your job",
        body: [
          "You're the first medical contact. Stabilize what you can on-site; for anything beyond field care, create a referral to the nearest Urgent Care Facility (UCF).",
        ],
      },
      {
        heading: "Create a Field referral",
        steps: [
          {
            text: "Open Medical → Field, then click \"Create Referral\". You can also open this flow from a medical incident's detail page.",
          },
          {
            text: "Fill in patient details: name, age, gender, delegation.",
          },
          {
            text: "Capture vitals if you have them: BP, HR, temp, RR, SpO2. Leave blank if not measured — don't guess.",
          },
          {
            text: "Document chief complaint and any treatment you've already given.",
          },
          {
            text: "Pick the destination UCF. Submit.",
            note: "UCF staff get a notification within 1 second.",
          },
        ],
        warnings: [
          "Never skip a level of the chain. Even in critical cases, route through UCF or Hospital — the chain is what gives the receiving facility patient context. Don't drive a patient straight to a hospital without a referral.",
        ],
      },
      {
        heading: "Track your referrals",
        body: [
          "The \"My Active Referrals\" tab shows what you've sent up. Each card surfaces patient name, time waiting, and current stage. The History tab is your case log.",
        ],
      },
    ],
  },

  {
    slug: "medical-ucf",
    title: "Medical — UCF",
    summary:
      "Urgent Care Facility staff: receive Field referrals, assess, treat, and either discharge or escalate to Hospital.",
    icon: Stethoscope,
    category: "Medical",
    audience: ["medical_ucf"],
    sections: [
      {
        heading: "Inbox",
        body: [
          "Open Medical → UCF. Pending referrals are sorted oldest-first (by referral time) — the longest waits sit at the top. Each card shows patient, age, delegation, chief complaint, and how long they've been waiting.",
        ],
      },
      {
        heading: "Process a referral",
        steps: [
          {
            text: "Open a pending card. Review the field assessment (vitals, treatment given, chief complaint).",
          },
          {
            text: "Click \"Accept\" — this sets received_at and signals the field medic that you have the patient.",
          },
          {
            text: "Fill in the Initial Assessment: vitals on arrival, initial diagnosis, treatment plan, notes.",
          },
          {
            text: "Decide: \"Discharge\" (case closes here) or \"Refer to Hospital\" (escalates to the hospital chain).",
          },
        ],
        tips: [
          "If the patient arrived without a referral (walk-up), still create a referral record so the chain has context. Use medical-clinic if it's a non-acute visit instead.",
          "Print the referral slip via the Print button on the assessment page when handing off — useful for paper trail.",
        ],
      },
    ],
  },

  {
    slug: "medical-hospital",
    title: "Medical — Hospital",
    summary:
      "Hospital reception: receive UCF referrals or log direct admittances; manage admit/discharge.",
    icon: Hospital,
    category: "Medical",
    audience: ["medical_hospital"],
    sections: [
      {
        heading: "Inbox",
        body: [
          "Medical → Hospital shows incoming referrals routed to your facility. Patient PII is shown to medical staff in full; non-medical viewers see initials only.",
        ],
      },
      {
        heading: "Accept and admit",
        steps: [
          { text: "Open the referral and click \"Accept\"." },
          {
            text: "Add hospital intake notes (vitals on arrival, working diagnosis, plan).",
          },
          {
            text: "Choose Admit (status → admitted) or Discharge (status → discharged) once disposition is decided.",
          },
        ],
      },
      {
        heading: "Direct admittance",
        body: [
          "If a Palaro-related case arrives without a referral (walk-in or transfer from another facility), file it as a direct admittance.",
        ],
        steps: [
          {
            text: "Use the standard incident form, set category to Medical, and check the Hospital Direct flag.",
          },
          {
            text: "From the incident detail, you can immediately convert it into a hospital-tier referral so the patient timeline reflects reality.",
          },
        ],
      },
    ],
  },

  {
    slug: "medical-clinic",
    title: "Medical — Clinic",
    summary:
      "Open clinic for walk-in patients (athletes, staff, spectators with non-acute needs).",
    icon: Pill,
    category: "Medical",
    audience: ["medical_clinic"],
    sections: [
      {
        heading: "Patient registration",
        steps: [
          {
            text: "Medical → Clinic → \"Register Patient\".",
          },
          {
            text: "Capture full name, age, gender, delegation, contact, allergies, and any relevant medical history.",
          },
          {
            text: "Save. The system auto-generates a patient number (PT-YYYY-#####).",
          },
        ],
      },
      {
        heading: "Log a visit",
        steps: [
          {
            text: "From a patient's profile, click \"New Visit\".",
          },
          {
            text: "Pick the clinic site, record vitals, chief complaint, diagnosis, prescription, and notes.",
          },
          {
            text: "Save. The visit shows up on the patient's history and counts toward clinic-volume reports.",
          },
        ],
        tips: [
          "Recurring patients: search by patient number or name first — don't create duplicate records.",
        ],
      },
    ],
  },

  {
    slug: "medical-supplies",
    title: "Medical Supplies",
    summary:
      "Inventory tracking with low-stock and expiry warnings for clinics, UCFs, and hospitals.",
    icon: Package,
    category: "Medical",
    audience: [
      "medical_field",
      "medical_ucf",
      "medical_hospital",
      "medical_clinic",
    ],
    sections: [
      {
        heading: "Add a supply item",
        steps: [
          {
            text: "Medical → Supplies → \"Add supply\".",
          },
          {
            text: "Name (e.g. \"Paracetamol 500mg\"), category, unit (pcs/box/bottle/...), starting stock, reorder threshold, expiry date, and storage site.",
          },
          {
            text: "Save. The starting stock is logged as an initial stock_in movement so the history is complete from day one.",
          },
        ],
      },
      {
        heading: "Record a movement",
        body: [
          "Movements adjust stock and write to history. Pick the type carefully — it determines whether stock goes up or down.",
        ],
        steps: [
          {
            text: "Click \"Record movement\" or use the per-row arrow icons on the inventory table.",
          },
          {
            text: "Pick supply, type (Stock in / Stock out / Adjustment / Expired), quantity (always positive — the system applies the sign), and an optional reason.",
          },
          {
            text: "Save. New stock is shown in the toast.",
          },
        ],
        tips: [
          "Use Adjustment after a physical re-count — it sets stock to the new value via a positive delta.",
          "Use Expired (not Stock out) when discarding past-date items so the report distinguishes waste from consumption.",
        ],
        warnings: [
          "Stock out is rejected if there isn't enough on hand. The error tells you what's currently tracked — re-count if reality differs.",
        ],
      },
      {
        heading: "Watching the flags",
        body: [
          "The inventory table flags items that are Low (stock ≤ reorder), Out of stock, Expiring soon (≤ 30 days), and Expired. Watch the stat cards at the top of the page for daily standup.",
        ],
      },
    ],
  },

  // ===========================================================================
  // LOGISTICS
  // ===========================================================================
  {
    slug: "transportation",
    title: "Transportation",
    summary:
      "Vehicle catalogue, QR-based in/out scanning, and route management for shuttles, ambulances, and service vehicles.",
    icon: Truck,
    category: "Logistics",
    audience: ["logistics_officer", "transportation_dispatcher"],
    sections: [
      {
        heading: "Register a vehicle",
        steps: [
          {
            text: "Transportation → \"Add vehicle\".",
          },
          {
            text: "Fill in vehicle code (short, unique — used for the QR), plate, type, capacity, driver name and contact, current assignment.",
          },
          {
            text: "Save. The vehicle gets a generated QR (open the QR icon on its row to print a sticker).",
          },
        ],
        tips: [
          "Codes like BUS-01 / VAN-NCR-3 / AMB-1 are easier than serial numbers — they show up across the app.",
        ],
      },
      {
        heading: "Scan in/out at a checkpoint",
        steps: [
          {
            text: "Click \"Scan vehicle\". Pick the site you're scanning at first.",
          },
          {
            text: "Allow camera access. Point at the QR sticker on the dashboard.",
          },
          {
            text: "Direction (in or out) is decided automatically from the last scan: if the last log was \"in\", the next is \"out\".",
            note: "Same QR re-scanned within 2.5s is debounced — you won't accidentally insert duplicates.",
          },
        ],
      },
      {
        heading: "Manual entry",
        body: [
          "If a QR is unreadable or the camera is unavailable, use Manual entry. Pick vehicle, site, direction, optional passenger count, and notes.",
        ],
      },
      {
        heading: "Routes",
        body: [
          "Routes are pre-defined recurring trips (e.g. BQ-A → PV-Stadium at 09:00). They're informational — they don't auto-fill scan logs — but they help dispatchers plan and operators know where to be.",
        ],
      },
    ],
  },

  {
    slug: "venues",
    title: "Venues",
    summary:
      "Practice slot booking on a day-grid view, with conflict detection and special-request approval.",
    icon: MapPin,
    category: "Logistics",
    audience: ["venue_manager", "logistics_officer"],
    sections: [
      {
        heading: "Book a practice slot",
        steps: [
          {
            text: "Venues → Day grid. Use the date picker to pick the day.",
          },
          {
            text: "Click an empty cell at the venue/hour you want — the booking dialog pre-fills the venue and start time.",
          },
          {
            text: "Pick the delegation, sport, end time, and any notes. Save.",
          },
        ],
        tips: [
          "Click an existing slot to edit it. Cancelled slots show with a strikethrough and reduced opacity.",
          "Drag a stylus or finger across the day grid on a tablet to scan all venues at a glance.",
        ],
      },
      {
        heading: "Special requests (overriding a conflict)",
        body: [
          "By default, double-booking the same venue is blocked. If a delegation genuinely needs that slot anyway:",
        ],
        steps: [
          {
            text: "In the booking dialog, check \"Special request\".",
          },
          {
            text: "Enter a reason — required.",
          },
          {
            text: "Save. The slot is created with status special_request — it does not become a confirmed booking until command center approves.",
          },
          {
            text: "Command center then opens the All Bookings tab, finds the row, and clicks \"Approve\".",
          },
        ],
      },
      {
        heading: "Status lifecycle",
        body: [
          "Bookings move through: special_request (pending approval, optional) → booked → completed (after the slot is over). Any active booking can be cancelled at any time.",
        ],
      },
    ],
  },

  {
    slug: "garbage",
    title: "Garbage Collection",
    summary:
      "Schedule pickups across sites and log whether they were collected or missed.",
    icon: Trash2,
    category: "Logistics",
    audience: ["logistics_officer", "garbage_logger", "command_center"],
    sections: [
      {
        heading: "Schedule a pickup",
        steps: [
          {
            text: "Logistics → Garbage → \"Schedule pickup\".",
          },
          {
            text: "Pick the site, scheduled time (PHT), optional collector name, and any notes.",
          },
          {
            text: "Tick \"Special request\" if this is outside the regular route — the row is flagged for visibility.",
          },
          {
            text: "Save.",
          },
        ],
      },
      {
        heading: "Mark collected or missed",
        body: [
          "When the crew arrives (or doesn't), update the row from the table.",
        ],
        steps: [
          {
            text: "Find the row (it'll be in the Scheduled status by default).",
          },
          {
            text: "Click the green check to mark Collected — collected_at is stamped automatically.",
          },
          {
            text: "Click the red X to mark Missed — provide a reason if you have one. Missed pickups stay in the system so you can re-schedule.",
          },
        ],
        tips: [
          "Overdue (>30 min late) pickups are highlighted in the stat cards at the top — work that list first during your morning pass.",
        ],
      },
    ],
  },

  {
    slug: "food",
    title: "Food Supply",
    summary:
      "Caterer roster and meal requests from BQs through to delivery confirmation.",
    icon: UtensilsCrossed,
    category: "Logistics",
    audience: [
      "logistics_officer",
      "food_supplier_admin",
      "venue_manager",
      "delegation_head",
      "command_center",
    ],
    sections: [
      {
        heading: "Suppliers (admin only)",
        body: [
          "Food → Suppliers tab. Command center adds caterers with contact info and daily capacity. Suppliers stay in the catalogue (soft delete) so historical requests retain their attribution.",
        ],
      },
      {
        heading: "Request meals (BQ side)",
        steps: [
          { text: "Food → Meal requests → \"Request meals\"." },
          {
            text: "Pick the BQ that needs meals — the system rejects non-BQ sites.",
          },
          {
            text: "Choose meal type (breakfast/lunch/dinner/snack) and the meal count.",
          },
          {
            text: "Pick required-by time. Leave supplier as \"Any available\" if you're not picky.",
          },
          {
            text: "Add notes for dietary restrictions or drop-off instructions. Submit.",
          },
        ],
      },
      {
        heading: "Confirm and deliver (command center side)",
        steps: [
          {
            text: "Open the Meal requests tab. Pending rows have a Confirm button.",
          },
          {
            text: "Click Confirm to assign a supplier and lock the request.",
          },
          {
            text: "When the supplier delivers, click \"Mark delivered\". The status badge updates and the action stamps your name + time into notes.",
          },
        ],
        tips: [
          "The \"Meals due (24h)\" stat at the top sums all meals required in the next 24 hours — useful for daily standup with caterers.",
        ],
      },
    ],
  },

  // ===========================================================================
  // PERSONNEL
  // ===========================================================================
  {
    slug: "personnel-duty",
    title: "Duty Schedule",
    summary:
      "Plan personnel shifts across sites — who is where, when.",
    icon: Calendar,
    category: "Personnel",
    audience: ["personnel_admin"],
    sections: [
      {
        heading: "Schedule a shift",
        steps: [
          {
            text: "Personnel → Duty Schedule → \"Schedule shift\".",
          },
          {
            text: "Pick the personnel record, optional site, start and end time (PHT), and a label like \"morning\" or \"graveyard\".",
          },
          {
            text: "Save. The shift shows up on the duty table and on the assigned person's roster.",
          },
        ],
        tips: [
          "End time must be after start time — overnight shifts that cross midnight should still use the actual end timestamp on the next day.",
        ],
      },
      {
        heading: "Edit / delete",
        body: [
          "Click the pencil icon on a row to edit. Click the trash icon to delete (with confirmation). Deletes are hard — don't delete if you might need to audit who was scheduled.",
        ],
      },
    ],
  },

  {
    slug: "personnel-attendance",
    title: "Attendance",
    summary:
      "Time-in / time-out tracking via QR scanning of personnel ID cards.",
    icon: ClipboardCheck,
    category: "Personnel",
    audience: ["personnel_admin"],
    sections: [
      {
        heading: "Scan an ID",
        steps: [
          {
            text: "Personnel → Attendance → \"Scan QR\".",
          },
          {
            text: "Pick the site (optional but recommended).",
          },
          {
            text: "Allow camera access; scan the personnel ID card.",
          },
          {
            text: "Direction (time_in or time_out) is decided automatically from today's history — first scan = time_in, next scan = time_out, alternating.",
            note: "Same QR re-scanned within 2.5s is debounced.",
          },
        ],
      },
      {
        heading: "Manual entry",
        body: [
          "Use \"Manual entry\" when QR isn't available. Pick personnel, type (time_in/time_out), site, and notes.",
        ],
      },
      {
        heading: "What's logged",
        body: [
          "Every attendance row records who was scanned, who scanned them, the site, and the timestamp. The data feeds reports and audit logs.",
        ],
      },
    ],
  },

  {
    slug: "personnel-ids",
    title: "ID Generator",
    summary:
      "Print Palaro Command ID cards with embedded QR for attendance scanning.",
    icon: BadgeCheck,
    category: "Personnel",
    audience: ["personnel_admin"],
    sections: [
      {
        heading: "Print IDs",
        steps: [
          {
            text: "Personnel → ID Generator. The roster shows every active personnel with a role.",
          },
          {
            text: "Use the print button to send to printer. The card has a front (name, role) and back (QR) layout.",
          },
        ],
        tips: [
          "Card artwork is loaded from /public/id-assets/id-template.png. If a hint banner shows, drop the template image at that path.",
          "Cards are sized 1305 × 1850 (CR80 ratio). Print to a PVC card printer or A4 with 4-up sheet.",
        ],
      },
    ],
  },

  // ===========================================================================
  // REPORTS
  // ===========================================================================
  {
    slug: "reports",
    title: "Reports & Analytics",
    summary:
      "Daily summaries and multi-day analytics across incidents, medical, heat, vehicles, and delegations.",
    icon: FileText,
    category: "Reports",
    audience: ["delegation_head", "command_center"],
    sections: [
      {
        heading: "What's available",
        body: [
          "Daily Incident Summary — counts by category, severity, and status for any single day.",
          "Medical Chain Throughput — Field → UCF → Hospital metrics: time-to-accept, time-to-discharge (median + p90), hospitalization rate, busiest receiving facilities.",
          "Operations Snapshot — multi-day stacked bar chart across incidents, referrals, and clinic visits.",
          "Heat-Index Trends — daily peak heat indexes per playing venue, suspension events list.",
          "Vehicle Utilization — per-vehicle scan volume, p90-overcommitted vehicles flagged, idle vehicles surfaced.",
          "Per-Delegation Summary — incidents/referrals/VIP movements/bookings/clinic visits by region (NCR, CAR, …).",
        ],
      },
      {
        heading: "Generate a report",
        steps: [
          {
            text: "Open Reports. Each report card has a date or date-range picker.",
          },
          {
            text: "Pick the window and click \"Generate report\".",
          },
          {
            text: "On the report page, use the Print / Save as PDF button to export.",
            note: "Print is browser-driven — \"Save as PDF\" is one of the destinations in the print dialog.",
          },
        ],
        tips: [
          "URLs are share-friendly: /dashboard/reports/operations/2026-05-01/2026-05-07 always re-renders the same report.",
          "Reports use Asia/Manila day boundaries — a row dated 2026-05-04 covers PHT midnight to PHT midnight.",
        ],
      },
      {
        heading: "Audit log",
        body: [
          "The bottom of the Reports index shows the last 20 audited actions. Every state-changing action across the system is logged with actor, timestamp, entity, and changes diff.",
        ],
      },
    ],
  },

  // ===========================================================================
  // ADMIN
  // ===========================================================================
  {
    slug: "admin-users",
    title: "User Management",
    summary:
      "Invite users, assign roles, and manage account status.",
    icon: Users,
    category: "Admin",
    audience: ["super_admin", "command_center"],
    sections: [
      {
        heading: "How invites work",
        body: [
          "PPDMS is invite-only. An email that hasn't been pre-invited cannot sign in — the database trigger rejects unauthorized Google sign-ins before any auth.users row is created.",
          `The seeded super admin is ${BERL_EMAIL}.`,
        ],
      },
      {
        heading: "Invite a user",
        steps: [
          { text: "Admin → Users → \"Invite user\"." },
          {
            text: "Enter the user's exact Google email and pick a role.",
          },
          {
            text: "Save. The invitee can now sign in with Google and is auto-linked to this profile.",
          },
        ],
        warnings: [
          "Use the exact Google login email. Aliases (name+palaro@gmail.com vs name@gmail.com) are different to Google.",
        ],
      },
      {
        heading: "Manage existing users",
        body: [
          "Click a row to open the edit dialog. You can change role and agency, suspend/activate the account.",
        ],
        tips: [
          "You cannot demote yourself from super_admin or suspend yourself — guards against accidental lockouts.",
          "Suspended users land on /auth/suspended on next request; their session is invalidated server-side.",
        ],
      },
    ],
  },

  {
    slug: "admin-sites",
    title: "Sites",
    summary:
      "Manage Billeting Quarters, Playing Venues, UCFs, hospitals, clinics, and command centers.",
    icon: Building2,
    category: "Admin",
    audience: ["super_admin", "command_center"],
    sections: [
      {
        heading: "Add a site",
        steps: [
          { text: "Admin → Sites → \"Add Site\"." },
          {
            text: "Name, type (BQ / PV / UCF / hospital / clinic / command center), address, contact, capacity, GPS coordinates.",
          },
          { text: "Save. The new site is immediately pickable across all forms (incidents, referrals, venues, transportation, …)." },
        ],
        tips: [
          "Site type isn't cosmetic — it gates which sites appear in which pickers. UCF referrals only list UCF sites; venue bookings only list playing venues.",
        ],
      },
      {
        heading: "Edit / decommission",
        body: [
          "Click a row to edit. Decommission (soft delete) flips is_active=false — historical references are preserved, but the site stops appearing in new pickers.",
        ],
      },
    ],
  },

  {
    slug: "admin-delegations",
    title: "Delegations",
    summary:
      "The 17 Philippine regions competing as teams.",
    icon: Flag,
    category: "Admin",
    audience: ["super_admin", "command_center"],
    sections: [
      {
        heading: "What's pre-loaded",
        body: [
          "All 17 regions are seeded by the database (NCR, CAR, R-I through R-XIII, BARMM). You only need to fill in head-of-delegation, contact, athlete counts, and assigned BQ.",
        ],
      },
      {
        heading: "Edit a delegation",
        steps: [
          {
            text: "Admin → Delegations. Click any row to open the edit dialog.",
          },
          {
            text: "Update head, contact, athlete/coach/official counts, color (used for badges in some views), and the BQ they're assigned to.",
          },
          { text: "Save." },
        ],
      },
    ],
  },

  {
    slug: "admin-settings",
    title: "Settings (super admin)",
    summary:
      "System-wide settings — restricted to the super admin.",
    icon: Settings,
    category: "Admin",
    audience: ["super_admin"],
    sections: [
      {
        heading: "Access",
        body: [
          "Admin → Settings is visible only to super_admin. It's the right place for things that affect every user (audit retention windows, system-wide feature flags) and shouldn't be touched by command center leads.",
        ],
      },
    ],
  },

  // ===========================================================================
  // SECURITY / META
  // ===========================================================================
  {
    slug: "auth",
    title: "Sign in & access",
    summary:
      "Why Google sign-in is required, what happens behind the scenes, and how to recover when something goes wrong.",
    icon: KeyRound,
    category: "Getting started",
    sections: [
      {
        heading: "Google OAuth — the only way in",
        body: [
          "PPDMS does not support email/password login or magic links. Sign-in flows through Google so you can use your existing 2FA, password manager, and account recovery — and the system never holds a password for you.",
        ],
      },
      {
        heading: "What happens during sign-in",
        body: [
          "When you click \"Sign in with Google\", Supabase tries to create an auth user for your Google email. A database trigger looks up your email in the invited-profiles table. If you're invited and active, your profile is linked to your Google account and you proceed to the dashboard. If not, the trigger rejects the sign-in — no auth user is ever created.",
        ],
      },
      {
        heading: "Common error states",
        tips: [
          "\"Not authorized\" — your email isn't on the access list. Contact your command center lead to be invited.",
          "\"Suspended\" — your account was active and is now suspended. Contact a super admin.",
          "Bounced back to /auth — your session expired or was signed out. Sign in again.",
        ],
      },
      {
        heading: "Privacy & retention",
        body: [
          "All PII (patient names, contact numbers, medical history) is governed by the Data Privacy Act (RA 10173). Photos uploaded to incident reports go to private storage with signed URLs that expire in 1 hour. No medical record is ever hard-deleted — discontinuation flips an is_active flag instead.",
        ],
      },
    ],
  },
];

export function findGuide(slug: string): ModuleGuide | undefined {
  return MODULE_GUIDES.find((g) => g.slug === slug);
}

// Categories in display order — driving the help index grouping.
export const HELP_CATEGORIES: ModuleGuide["category"][] = [
  "Getting started",
  "Operations",
  "Medical",
  "Logistics",
  "Personnel",
  "Reports",
  "Admin",
];
