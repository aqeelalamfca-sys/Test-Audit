export const PAKISTAN_CITIES = [
  "Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan",
  "Peshawar", "Quetta", "Sialkot", "Gujranwala", "Hyderabad", "Abbottabad",
  "Bahawalpur", "Sargodha", "Sukkur", "Larkana", "Sheikhupura", "Jhang",
  "Rahim Yar Khan", "Gujrat", "Mardan", "Kasur", "Dera Ghazi Khan",
  "Sahiwal", "Nawabshah", "Mirpur Khas", "Chiniot", "Kamoke", "Other",
] as const;

export const COUNTRIES = [
  { value: "Pakistan", label: "Pakistan" },
  { value: "UAE", label: "UAE" },
  { value: "Saudi Arabia", label: "Saudi Arabia" },
  { value: "Other", label: "Other" },
] as const;

export const ENTITY_TYPES = [
  { value: "private_limited", label: "Private Limited Company" },
  { value: "smc_pvt", label: "Single Member Company (SMC – Pvt.)" },
  { value: "public_unlisted", label: "Public Limited Company (Unlisted)" },
  { value: "listed", label: "Listed Company" },
  { value: "limited_guarantee", label: "Company Limited by Guarantee" },
  { value: "unlimited", label: "Unlimited Company" },
  { value: "foreign_branch", label: "Foreign Company (Branch / Liaison Office)" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietor", label: "Sole Proprietorship" },
  { value: "ngo", label: "NGO / Non-Profit" },
  { value: "trust", label: "Trust" },
  { value: "association", label: "Association of Persons" },
  { value: "government", label: "Government Entity" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const INDUSTRY_SECTORS = [
  { value: "manufacturing", label: "Manufacturing" },
  { value: "trading_wholesale", label: "Trading / Wholesale" },
  { value: "retail", label: "Retail" },
  { value: "construction", label: "Construction" },
  { value: "real_estate", label: "Real Estate & Developers" },
  { value: "textile", label: "Textile & Apparel" },
  { value: "pharmaceuticals", label: "Pharmaceuticals" },
  { value: "cement", label: "Cement" },
  { value: "steel", label: "Steel" },
  { value: "fmcg", label: "FMCG" },
  { value: "it_software", label: "IT / Software / SaaS" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "media_entertainment", label: "Media & Entertainment" },
  { value: "logistics", label: "Logistics & Transportation" },
  { value: "education", label: "Education Institution" },
  { value: "healthcare", label: "Healthcare / Hospital" },
  { value: "power_generation", label: "Power Generation" },
  { value: "renewable_energy", label: "Renewable Energy (Solar / Wind)" },
  { value: "oil_gas", label: "Oil & Gas" },
  { value: "utilities", label: "Utilities" },
  { value: "banking", label: "Banking & Finance" },
  { value: "insurance", label: "Insurance" },
  { value: "services", label: "Services" },
  { value: "agriculture", label: "Agriculture" },
  { value: "hospitality", label: "Hospitality" },
  { value: "transport", label: "Transport & Logistics" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const SIZE_CLASSIFICATIONS = [
  { value: "large", label: "Large Company" },
  { value: "medium", label: "Medium-Sized Company" },
  { value: "small", label: "Small Company" },
  { value: "sme", label: "SME (SECP / ICAP)" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const OWNERSHIP_TYPES = [
  { value: "family_owned", label: "Family-Owned Company" },
  { value: "group_holding", label: "Group / Holding Company" },
  { value: "subsidiary", label: "Subsidiary Company" },
  { value: "associate_jv", label: "Associate / Joint Venture" },
  { value: "soe", label: "State-Owned Enterprise (SOE)" },
  { value: "foreign_multinational", label: "Foreign-Owned / Multinational Subsidiary" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const REGULATORY_CATEGORIES = [
  { value: "not_regulated", label: "Not Regulated (General Corporate)" },
  { value: "banking_sbp", label: "Banking Company (SBP)" },
  { value: "dfi", label: "Development Finance Institution (DFI)" },
  { value: "microfinance", label: "Microfinance Bank" },
  { value: "nbfc", label: "NBFC (Leasing / Modaraba / AMC / REIT / PE / VC)" },
  { value: "insurance", label: "Insurance Company" },
  { value: "takaful", label: "Takaful Operator" },
  { value: "stock_broker", label: "Stock Broker / Securities Company" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "pension_fund", label: "Pension Fund" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const SPECIAL_ENTITY_TYPES = [
  { value: "not_applicable", label: "Not Applicable" },
  { value: "section_42", label: "Section-42 (Not-for-Profit)" },
  { value: "ngo_npo", label: "NGO / NPO" },
  { value: "trust", label: "Trust" },
  { value: "project_spv", label: "Project-Specific SPV" },
  { value: "sez_company", label: "SEZ Company" },
  { value: "ppp", label: "Public-Private Partnership (PPP)" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const TAX_PROFILES = [
  { value: "fbr_registered", label: "FBR Registered" },
  { value: "sales_tax", label: "Sales Tax Registered" },
  { value: "export_oriented", label: "Export-Oriented Unit" },
  { value: "withholding_agent", label: "Withholding Agent" },
  { value: "tax_exempt", label: "Tax-Exempt / Reduced Rate" },
  { value: "sez_holiday", label: "SEZ / Tax Holiday" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const LIFECYCLE_STATUSES = [
  { value: "newly_incorporated", label: "Newly Incorporated" },
  { value: "ongoing_operations", label: "Ongoing Operations" },
  { value: "dormant", label: "Dormant Company" },
  { value: "under_liquidation", label: "Under Liquidation" },
  { value: "winding_up", label: "Under Winding-Up / Easy Exit" },
  { value: "merger_amalgamation", label: "Under Merger / Amalgamation" },
  { value: "other", label: "Other (Specify)" },
] as const;

export const REPORTING_FRAMEWORKS = [
  { value: "IFRS", label: "IFRS (International Financial Reporting Standards)" },
  { value: "AFRS", label: "AFRS for SSE (ICAP Small & Medium)" },
  { value: "IPSAS", label: "IPSAS (International Public Sector)" },
  { value: "GAAP_PK", label: "Pakistan GAAP (Companies Act 2017)" },
  { value: "ISLAMIC", label: "Islamic Accounting (AAOIFI)" },
  { value: "OTHER", label: "Other Framework" },
] as const;

export const ENGAGEMENT_TYPES = [
  { value: "statutory_audit", label: "Statutory Audit" },
  { value: "internal_audit", label: "Internal Audit" },
  { value: "tax_audit", label: "Tax Audit" },
  { value: "forensic_audit", label: "Forensic Audit" },
  { value: "compliance_audit", label: "Compliance Audit" },
  { value: "special_purpose", label: "Special Purpose Audit" },
  { value: "review_engagement", label: "Review Engagement" },
  { value: "agreed_upon_procedures", label: "Agreed-Upon Procedures" },
] as const;

export const RISK_RATINGS = [
  { value: "LOW", label: "Low Risk" },
  { value: "MEDIUM", label: "Medium Risk" },
  { value: "HIGH", label: "High Risk" },
] as const;
