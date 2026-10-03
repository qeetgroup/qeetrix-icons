type Category = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
};

/**
 * Internal taxonomy for source organization, discovery, and future metadata.
 * Array order is the canonical display order; IDs never prefix component names.
 */
export const categories = [
  {
    id: "actions",
    label: "Actions",
    description: "Common interface actions and commands.",
  },
  {
    id: "navigation",
    label: "Navigation",
    description: "Movement through views, menus, and interface panels.",
  },
  {
    id: "status",
    label: "Status",
    description: "Feedback, availability, progress, and outcome indicators.",
  },
  {
    id: "identity",
    label: "Identity",
    description: "Users, accounts, profiles, and identity lifecycle concepts.",
  },
  {
    id: "security",
    label: "Security",
    description: "Authentication, authorization, access control, and protection.",
  },
  {
    id: "files",
    label: "Files",
    description: "Documents, folders, attachments, and file operations.",
  },
  {
    id: "communication",
    label: "Communication",
    description: "Messages, conversations, notifications, and delivery channels.",
  },
  {
    id: "data",
    label: "Data",
    description: "Records, tables, databases, and data relationships.",
  },
  {
    id: "time",
    label: "Time",
    description: "Dates, schedules, durations, and temporal events.",
  },
  {
    id: "devices",
    label: "Devices",
    description: "Physical endpoints, hardware, and connected peripherals.",
  },
  {
    id: "development",
    label: "Development",
    description: "Code, APIs, terminals, and software development workflows.",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    description: "Compute, networks, cloud resources, and deployed services.",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Money, payments, balances, transfers, and financial records.",
  },
  {
    id: "commerce",
    label: "Commerce",
    description: "Products, orders, purchases, and commercial transactions.",
  },
  {
    id: "location",
    label: "Location",
    description: "Places, addresses, maps, and physical positioning.",
  },
  {
    id: "media",
    label: "Media",
    description: "Images, audio, video, playback, and media controls.",
  },
  {
    id: "ai",
    label: "AI",
    description: "Models, inference, assistants, and AI product interactions.",
  },
  {
    id: "observability",
    label: "Observability",
    description: "Logs, metrics, traces, monitoring, and operational diagnostics.",
  },
  {
    id: "organization",
    label: "Organization",
    description: "Organizations, teams, membership, and workplace structure.",
  },
  {
    id: "qeet",
    label: "Qeet",
    description: "Concepts specific to Qeet products and the shared Qeet ecosystem.",
  },
] as const satisfies readonly Category[];
