import type { WizardField, WizardFlow, WizardState } from "./types";

export const STEPPERS: Record<WizardFlow | "default", string[]> = {
  voice: ["Choose path", "Describe", "Owner info", "Configure", "Review & publish"],
  copy: ["Choose path", "Read site", "Configure", "Review & publish"],
  default: ["Choose path", "Describe", "Configure", "Review & publish"],
};

export const STATE_INDEX: Record<WizardFlow | "default", Partial<Record<WizardState, number>>> = {
  voice: { path: 0, "describe-voice": 1, details: 2, configure: 3, review: 4 },
  copy: { path: 0, "describe-copy": 1, configure: 2, review: 3 },
  default: { path: 0, "describe-voice": 1, "describe-copy": 1, details: 1, configure: 2, review: 3 },
};

export const FIELD_LABELS: Partial<Record<WizardField, string>> = {
  email: "Email",
  companyName: "Company",
  industry: "Industry",
  services: "Services",
  aboutUs: "About",
  address: "Address",
  phone: "Phone",
  team: "Team",
  advantages: "USPs",
};

export type ChipMode = "single" | "multi";

export type ChipVariant = "pill" | "phrase";

export interface ChipConfig {
  mode: ChipMode;
  options: string[];
}

export const INDUSTRY_OPTIONS: string[] = [
  "Technology", "Healthcare", "Finance", "Real Estate", "Restaurant", "Retail",
  "Education", "Consulting", "Marketing", "Legal", "Fitness", "Beauty",
  "Construction", "Nonprofit",
];

export const DEFAULT_SERVICE_OPTIONS: string[] = [
  "Web Design", "SEO", "Branding", "Social Media", "Content Marketing",
  "App Development", "E-commerce", "Photography", "Video Production",
  "Graphic Design", "Copywriting", "PPC Advertising",
];

export const DEFAULT_ABOUT_OPTIONS: string[] = [
  "We help small businesses grow", "Expert team with 10+ years",
  "Serving clients nationwide", "Award-winning service",
  "Customer-first approach", "Innovative solutions",
  "Affordable pricing", "Free consultations",
];

export const SERVICES_BY_INDUSTRY: Record<string, string[]> = {
  Technology: ["Web Design", "App Development", "Cloud Services", "IT Support", "Cybersecurity", "Software Development", "Data Analytics", "AI Solutions", "DevOps", "QA Testing"],
  Healthcare: ["Telemedicine", "Patient Portal", "Medical Billing", "Health Coaching", "Lab Services", "Mental Health", "Physical Therapy", "Home Care", "Pharmacy", "Wellness Programs"],
  Finance: ["Financial Planning", "Tax Preparation", "Bookkeeping", "Investment Advisory", "Insurance", "Payroll Services", "Auditing", "Wealth Management", "Lending", "Risk Management"],
  "Real Estate": ["Property Listings", "Virtual Tours", "Property Management", "Home Staging", "Mortgage Assistance", "Commercial Leasing", "Appraisals", "Relocation Services", "Investment Properties", "Rental Management"],
  Restaurant: ["Menu Design", "Catering", "Online Ordering", "Event Hosting", "Delivery Service", "Meal Prep", "Private Dining", "Food Truck", "Bakery", "Bar Service"],
  Retail: ["E-commerce", "In-store Pickup", "Custom Orders", "Gift Cards", "Loyalty Programs", "Personal Shopping", "Product Customization", "Wholesale", "Subscription Boxes", "Returns & Exchanges"],
  Education: ["Online Courses", "Tutoring", "Test Prep", "Curriculum Design", "Corporate Training", "Workshops", "Certification Programs", "Mentoring", "Study Materials", "Language Classes"],
  Consulting: ["Strategy Consulting", "Management Consulting", "IT Consulting", "HR Consulting", "Marketing Consulting", "Financial Consulting", "Operations", "Change Management", "Risk Assessment", "Process Improvement"],
  Marketing: ["SEO", "Social Media", "Content Marketing", "PPC Advertising", "Email Marketing", "Branding", "Video Production", "Influencer Marketing", "PR", "Market Research"],
  Legal: ["Business Law", "Contract Review", "Intellectual Property", "Estate Planning", "Immigration", "Family Law", "Litigation", "Compliance", "Mediation", "Tax Law"],
  Fitness: ["Personal Training", "Group Classes", "Nutrition Coaching", "Online Programs", "Yoga", "Pilates", "Sports Training", "Rehab Programs", "Weight Loss", "Corporate Wellness"],
  Beauty: ["Hair Styling", "Skincare", "Makeup", "Nail Services", "Spa Treatments", "Lash Extensions", "Waxing", "Microblading", "Facials", "Bridal Packages"],
  Construction: ["Residential Building", "Commercial Building", "Renovations", "Roofing", "Plumbing", "Electrical", "Landscaping", "Interior Design", "Project Management", "Demolition"],
  Nonprofit: ["Fundraising", "Volunteer Programs", "Community Outreach", "Grant Writing", "Event Planning", "Advocacy", "Education Programs", "Youth Services", "Food Distribution", "Housing Assistance"],
};

export const DEPLOY_FEATURES: string[] = ["contact-form", "ai-blog-posts", "seo", "analytics"];

export const MAX_DEPLOY_RETRIES = 3;

export const PLAN_ORDER: string[] = ["free", "starter", "pro", "business"];

export const RESUME_TTL_MS = 30 * 60 * 1000;
export const RESUME_POLL_INTERVAL_MS = 3000;
export const RESUME_POLL_MAX_ATTEMPTS = 30;
export const RESUME_STORAGE_KEY = "wts.wizardResume";
