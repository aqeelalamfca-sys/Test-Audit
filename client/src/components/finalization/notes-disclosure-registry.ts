import type { DraftFSData, CoAAccountData } from '../planning/fs-types';

export type ReportingFramework = 'full_ifrs' | 'ifrs_sme' | 'companies_act_2017';

export type CompanyType =
  | 'small'
  | 'medium'
  | 'large'
  | 'public_unlisted'
  | 'listed'
  | 'section_42_npo'
  | 'regulated_bank'
  | 'regulated_nbfc'
  | 'regulated_insurance';

export type ListingStatus = 'listed' | 'public_unlisted' | 'private' | 'npo';

export interface EntityProfile {
  companyType: CompanyType;
  reportingFramework: ReportingFramework;
  listingStatus: ListingStatus;
  industry: string;
  isRegulated: boolean;
  regulatoryType?: string;
  isNPO: boolean;
  hasSubsidiaries: boolean;
  hasAssociates: boolean;
  hasLeases: boolean;
  hasEmployeeBenefits: boolean;
  hasBorrowings: boolean;
  hasRelatedPartyTransactions: boolean;
  hasTaxation: boolean;
  hasContingencies: boolean;
  hasCommitments: boolean;
  hasGovernmentGrants: boolean;
  hasForeignCurrency: boolean;
}

export type NoteCategory =
  | 'general_info'
  | 'accounting_policies'
  | 'critical_estimates'
  | 'balance_sheet'
  | 'profit_loss'
  | 'cash_flow'
  | 'equity'
  | 'related_parties'
  | 'contingencies'
  | 'commitments'
  | 'events_after'
  | 'going_concern'
  | 'other_mandatory';

export type TableType =
  | 'movement_schedule'
  | 'ageing_analysis'
  | 'maturity_analysis'
  | 'related_party_matrix'
  | 'tax_reconciliation'
  | 'segment_analysis'
  | 'sensitivity_analysis'
  | 'fair_value_hierarchy'
  | 'lease_maturity'
  | 'borrowing_schedule'
  | 'provision_movement'
  | 'inventory_breakdown'
  | 'revenue_disaggregation'
  | 'basic_breakdown';

export interface DisclosureSubItem {
  key: string;
  label: string;
  dataKey?: string;
  format?: 'currency' | 'text' | 'percentage' | 'date';
  placeholder?: string;
}

export interface DisclosureTable {
  type: TableType;
  title: string;
  columns: { key: string; label: string; format?: string }[];
  dataSource: string;
  description: string;
}

export interface DisclosureNote {
  noteNumber: string;
  key: string;
  title: string;
  category: NoteCategory;
  isaReference?: string;
  ifrsReference: string;
  smeReference?: string;
  companiesActReference?: string;
  secpRequirement?: string;
  applicability: {
    frameworks: ReportingFramework[];
    companyTypes: CompanyType[];
    conditions?: string[];
  };
  requiredDataKeys: string[];
  narrativeTemplate: string;
  subItems: DisclosureSubItem[];
  tables: DisclosureTable[];
  isAlwaysRequired: boolean;
  notApplicableRationale?: string;
}

const ALL_FRAMEWORKS: ReportingFramework[] = ['full_ifrs', 'ifrs_sme', 'companies_act_2017'];
const ALL_COMPANY_TYPES: CompanyType[] = [
  'small', 'medium', 'large', 'public_unlisted', 'listed',
  'section_42_npo', 'regulated_bank', 'regulated_nbfc', 'regulated_insurance',
];

export function determineFramework(
  entityType: string | undefined,
  industry: string | undefined,
  secpNo: string | undefined,
): Partial<EntityProfile> {
  const profile: Partial<EntityProfile> = {};
  const et = (entityType || '').toLowerCase();
  const ind = (industry || '').toLowerCase();

  if (et.includes('bank') || et.includes('banking')) {
    profile.companyType = 'regulated_bank';
    profile.listingStatus = et.includes('listed') ? 'listed' : 'private';
    profile.reportingFramework = 'full_ifrs';
    profile.isRegulated = true;
    profile.regulatoryType = 'SBP';
  } else if (et.includes('nbfc') || et.includes('leasing') || et.includes('modaraba')) {
    profile.companyType = 'regulated_nbfc';
    profile.listingStatus = et.includes('listed') ? 'listed' : 'private';
    profile.reportingFramework = 'full_ifrs';
    profile.isRegulated = true;
    profile.regulatoryType = 'SECP_NBFC';
  } else if (et.includes('insurance') || et.includes('takaful')) {
    profile.companyType = 'regulated_insurance';
    profile.listingStatus = et.includes('listed') ? 'listed' : 'private';
    profile.reportingFramework = 'full_ifrs';
    profile.isRegulated = true;
    profile.regulatoryType = 'SECP_Insurance';
  } else if (et.includes('public listed') || (et.includes('listed') && !et.includes('unlisted'))) {
    profile.companyType = 'listed';
    profile.listingStatus = 'listed';
    profile.reportingFramework = 'full_ifrs';
    profile.isRegulated = false;
  } else if (et.includes('public') && !et.includes('listed')) {
    profile.companyType = 'public_unlisted';
    profile.listingStatus = 'public_unlisted';
    profile.reportingFramework = 'full_ifrs';
    profile.isRegulated = false;
  } else if (et.includes('section 42') || et.includes('npo') || et.includes('not-for-profit') || et.includes('non-profit')) {
    profile.companyType = 'section_42_npo';
    profile.listingStatus = 'npo';
    profile.reportingFramework = 'ifrs_sme';
    profile.isNPO = true;
    profile.isRegulated = false;
  } else if (et.includes('large') || et.includes('private large')) {
    profile.companyType = 'large';
    profile.listingStatus = 'private';
    profile.reportingFramework = 'full_ifrs';
    profile.isRegulated = false;
  } else if (et.includes('medium') || et.includes('private medium')) {
    profile.companyType = 'medium';
    profile.listingStatus = 'private';
    profile.reportingFramework = 'ifrs_sme';
    profile.isRegulated = false;
  } else if (et.includes('small') || et.includes('private small')) {
    profile.companyType = 'small';
    profile.listingStatus = 'private';
    profile.reportingFramework = 'companies_act_2017';
    profile.isRegulated = false;
  } else {
    profile.companyType = 'medium';
    profile.listingStatus = 'private';
    profile.reportingFramework = 'ifrs_sme';
    profile.isRegulated = false;
  }

  if (!profile.isRegulated) {
    if (ind.includes('bank') || ind.includes('banking')) {
      profile.companyType = 'regulated_bank';
      profile.reportingFramework = 'full_ifrs';
      profile.isRegulated = true;
      profile.regulatoryType = 'SBP';
    } else if (ind.includes('nbfc') || ind.includes('leasing') || ind.includes('modaraba') || ind.includes('investment finance')) {
      profile.companyType = 'regulated_nbfc';
      profile.reportingFramework = 'full_ifrs';
      profile.isRegulated = true;
      profile.regulatoryType = 'SECP_NBFC';
    } else if (ind.includes('insurance') || ind.includes('takaful')) {
      profile.companyType = 'regulated_insurance';
      profile.reportingFramework = 'full_ifrs';
      profile.isRegulated = true;
      profile.regulatoryType = 'SECP_Insurance';
    }
  }

  return profile;
}

export const DISCLOSURE_NOTES_REGISTRY: DisclosureNote[] = [
  {
    noteNumber: '1',
    key: 'company_info',
    title: 'The Company and Its Operations',
    category: 'general_info',
    isaReference: 'ISA 570',
    ifrsReference: 'IAS 1.51',
    smeReference: 'Section 3.24',
    companiesActReference: 'Companies Act 2017, S.225',
    secpRequirement: 'Fourth Schedule, Part I',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      '{{companyName}} ("the Company") was incorporated in Pakistan on {{incorporationDate}} as a {{companyType}} under the {{incorporationLaw}}. ' +
      'The Company is registered with the Securities and Exchange Commission of Pakistan (SECP) under registration number {{secpNo}}. ' +
      'The registered office of the Company is situated at {{registeredOffice}}. ' +
      'The Company is principally engaged in {{principalActivity}}. ' +
      'The Company has {{numberOfEmployees}} employees as at the reporting date ({{priorYear}}: {{priorYearEmployees}}).',
    subItems: [
      { key: 'company_name', label: 'Company Name', format: 'text', placeholder: 'Legal name of the entity' },
      { key: 'incorporation_date', label: 'Date of Incorporation', format: 'date', placeholder: 'DD/MM/YYYY' },
      { key: 'company_type', label: 'Company Type', format: 'text', placeholder: 'e.g., private limited company' },
      { key: 'incorporation_law', label: 'Incorporation Law', format: 'text', placeholder: 'e.g., Companies Act 2017' },
      { key: 'secp_no', label: 'SECP Registration No.', format: 'text', placeholder: 'Registration number' },
      { key: 'registered_office', label: 'Registered Office Address', format: 'text', placeholder: 'Full address' },
      { key: 'principal_activity', label: 'Principal Activity', format: 'text', placeholder: 'Nature of business' },
      { key: 'number_of_employees', label: 'Number of Employees', format: 'text', placeholder: 'Current year headcount' },
      { key: 'ntn', label: 'National Tax Number (NTN)', format: 'text', placeholder: 'NTN' },
      { key: 'strn', label: 'Sales Tax Registration No.', format: 'text', placeholder: 'STRN' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '2',
    key: 'basis_of_preparation',
    title: 'Basis of Preparation',
    category: 'general_info',
    isaReference: 'ISA 700',
    ifrsReference: 'IAS 1.15-24',
    smeReference: 'Section 3.3',
    companiesActReference: 'Companies Act 2017, S.225, Fourth Schedule',
    secpRequirement: 'Fourth Schedule, Part I, Para 1',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      '2.1 Statement of Compliance\n' +
      'These financial statements have been prepared in accordance with the accounting and reporting standards as applicable in Pakistan. ' +
      'The accounting and reporting standards applicable in Pakistan comprise of {{frameworkDescription}}. ' +
      'Where provisions of and directives issued under the Companies Act, 2017 differ from the {{framework}}, the provisions of and directives issued under the Companies Act, 2017 have been followed.\n\n' +
      '2.2 Basis of Measurement\n' +
      'These financial statements have been prepared under the historical cost convention except as otherwise disclosed in the respective accounting policies.\n\n' +
      '2.3 Functional and Presentation Currency\n' +
      'These financial statements are presented in Pakistani Rupees (PKR), which is the Company\'s functional and presentation currency. ' +
      'Figures have been rounded off to the nearest {{roundingUnit}} unless otherwise stated.\n\n' +
      '2.4 Use of Estimates and Judgements\n' +
      'The preparation of financial statements in conformity with {{framework}} requires management to make judgements, estimates and assumptions that affect the application of accounting policies and the reported amounts of assets, liabilities, income and expenses. Actual results may differ from these estimates.',
    subItems: [
      { key: 'framework', label: 'Reporting Framework', format: 'text', placeholder: 'IFRS / IFRS for SMEs / Companies Act 2017' },
      { key: 'framework_description', label: 'Framework Description', format: 'text', placeholder: 'Detailed framework description' },
      { key: 'measurement_basis', label: 'Measurement Basis', format: 'text', placeholder: 'Historical cost / Fair value' },
      { key: 'functional_currency', label: 'Functional Currency', format: 'text', placeholder: 'Pakistani Rupees (PKR)' },
      { key: 'rounding_unit', label: 'Rounding Unit', format: 'text', placeholder: 'e.g., Rupee, thousand Rupees' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '3',
    key: 'significant_accounting_policies',
    title: 'Significant Accounting Policies',
    category: 'accounting_policies',
    isaReference: 'ISA 700',
    ifrsReference: 'IAS 1.117-124, IAS 8',
    smeReference: 'Section 10',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I',
    secpRequirement: 'S.R.O. 1002(I)/2017',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'The significant accounting policies applied in the preparation of these financial statements are set out below. ' +
      'These policies have been consistently applied to all the years presented, unless otherwise stated.\n\n' +
      '{{policyTexts}}',
    subItems: [
      { key: 'new_standards_adopted', label: 'New Standards Adopted', format: 'text', placeholder: 'Standards/amendments effective this year' },
      { key: 'standards_not_yet_effective', label: 'Standards Not Yet Effective', format: 'text', placeholder: 'Standards issued but not yet effective' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '4',
    key: 'critical_estimates',
    title: 'Critical Accounting Estimates and Judgements',
    category: 'critical_estimates',
    isaReference: 'ISA 540',
    ifrsReference: 'IAS 1.122-133',
    smeReference: 'Section 8',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'The Company makes estimates and assumptions concerning the future. The resulting accounting estimates will, by definition, seldom equal the related actual results. ' +
      'The estimates and assumptions that have a significant risk of causing a material adjustment to the carrying amounts of assets and liabilities within the next financial year are discussed below:\n\n' +
      '{{estimatesList}}',
    subItems: [
      { key: 'useful_life_estimate', label: 'Useful Life of PPE', format: 'text', placeholder: 'Description of estimate methodology' },
      { key: 'impairment_estimate', label: 'Impairment of Assets', format: 'text', placeholder: 'Description of impairment assessment' },
      { key: 'provision_estimate', label: 'Provision Estimates', format: 'text', placeholder: 'Description of provision methodology' },
      { key: 'ecl_estimate', label: 'Expected Credit Losses', format: 'text', placeholder: 'ECL methodology for IFRS 9' },
      { key: 'deferred_tax_estimate', label: 'Deferred Tax Recoverability', format: 'text', placeholder: 'Assessment of deferred tax assets' },
      { key: 'fair_value_estimate', label: 'Fair Value Measurements', format: 'text', placeholder: 'Fair value estimation methodology' },
      { key: 'lease_estimate', label: 'Lease Term & Discount Rate', format: 'text', placeholder: 'Key assumptions for IFRS 16' },
      { key: 'employee_benefit_estimate', label: 'Employee Benefit Obligations', format: 'text', placeholder: 'Actuarial assumptions' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '5',
    key: 'ppe',
    title: 'Property, Plant and Equipment',
    category: 'balance_sheet',
    isaReference: 'ISA 501',
    ifrsReference: 'IAS 16',
    smeReference: 'Section 17',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 7',
    secpRequirement: 'Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['PPE', 'PROPERTY_PLANT_EQUIPMENT', 'FIXED_ASSETS'],
    narrativeTemplate:
      '5.1 Cost\n' +
      'The gross carrying amount of property, plant and equipment as at {{periodEnd}} is Rs. {{ppeGross}} ({{priorYear}}: Rs. {{priorPpeGross}}).\n\n' +
      '5.2 Depreciation\n' +
      'Accumulated depreciation as at {{periodEnd}} amounts to Rs. {{ppeAccDep}} ({{priorYear}}: Rs. {{priorPpeAccDep}}).\n\n' +
      '5.3 Net Book Value\n' +
      'The net book value as at {{periodEnd}} is Rs. {{ppeNet}} ({{priorYear}}: Rs. {{priorPpeNet}}).\n\n' +
      '{{ppeAdditionalDisclosures}}',
    subItems: [
      { key: 'ppe_gross', label: 'Gross Carrying Amount', dataKey: 'PPE.gross', format: 'currency' },
      { key: 'ppe_acc_dep', label: 'Accumulated Depreciation', dataKey: 'PPE.accDep', format: 'currency' },
      { key: 'ppe_net', label: 'Net Book Value', dataKey: 'PPE.net', format: 'currency' },
      { key: 'depreciation_method', label: 'Depreciation Method', format: 'text', placeholder: 'Straight line / WDV' },
      { key: 'fully_depreciated_assets', label: 'Fully Depreciated Assets Still in Use', format: 'currency' },
      { key: 'capital_wip', label: 'Capital Work-in-Progress', dataKey: 'CWIP', format: 'currency' },
    ],
    tables: [
      {
        type: 'movement_schedule',
        title: 'Movement Schedule of Property, Plant and Equipment',
        columns: [
          { key: 'asset_class', label: 'Asset Class', format: 'text' },
          { key: 'opening_cost', label: 'Opening Cost', format: 'currency' },
          { key: 'additions', label: 'Additions', format: 'currency' },
          { key: 'disposals', label: 'Disposals', format: 'currency' },
          { key: 'transfers', label: 'Transfers', format: 'currency' },
          { key: 'closing_cost', label: 'Closing Cost', format: 'currency' },
          { key: 'opening_dep', label: 'Opening Depreciation', format: 'currency' },
          { key: 'charge_year', label: 'Charge for Year', format: 'currency' },
          { key: 'dep_on_disposals', label: 'On Disposals', format: 'currency' },
          { key: 'closing_dep', label: 'Closing Depreciation', format: 'currency' },
          { key: 'nbv', label: 'Net Book Value', format: 'currency' },
          { key: 'rate', label: 'Rate %', format: 'percentage' },
        ],
        dataSource: 'coaAccounts.PPE',
        description: 'Movement schedule showing cost and depreciation for each class of PPE per IAS 16.73',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '6',
    key: 'intangible_assets',
    title: 'Intangible Assets',
    category: 'balance_sheet',
    ifrsReference: 'IAS 38',
    smeReference: 'Section 18',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 7',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['INTANGIBLE', 'INTANGIBLE_ASSETS', 'GOODWILL', 'SOFTWARE', 'PATENTS'],
    narrativeTemplate:
      'Intangible assets with finite useful lives are amortised over their estimated useful lives and assessed for impairment whenever there is an indication of impairment. ' +
      'The net book value as at {{periodEnd}} is Rs. {{intangibleNet}} ({{priorYear}}: Rs. {{priorIntangibleNet}}).\n\n' +
      '{{intangibleAdditionalDisclosures}}',
    subItems: [
      { key: 'intangible_gross', label: 'Gross Carrying Amount', format: 'currency' },
      { key: 'intangible_amortisation', label: 'Accumulated Amortisation', format: 'currency' },
      { key: 'intangible_net', label: 'Net Book Value', format: 'currency' },
      { key: 'amortisation_method', label: 'Amortisation Method', format: 'text', placeholder: 'Straight line' },
    ],
    tables: [
      {
        type: 'movement_schedule',
        title: 'Movement Schedule of Intangible Assets',
        columns: [
          { key: 'asset_class', label: 'Asset Class', format: 'text' },
          { key: 'opening_cost', label: 'Opening Cost', format: 'currency' },
          { key: 'additions', label: 'Additions', format: 'currency' },
          { key: 'disposals', label: 'Disposals', format: 'currency' },
          { key: 'closing_cost', label: 'Closing Cost', format: 'currency' },
          { key: 'opening_amort', label: 'Opening Amortisation', format: 'currency' },
          { key: 'charge_year', label: 'Charge for Year', format: 'currency' },
          { key: 'closing_amort', label: 'Closing Amortisation', format: 'currency' },
          { key: 'nbv', label: 'Net Book Value', format: 'currency' },
          { key: 'rate', label: 'Rate %', format: 'percentage' },
        ],
        dataSource: 'coaAccounts.INTANGIBLE',
        description: 'Movement schedule for each class of intangible assets per IAS 38.118',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not hold any intangible assets as at the reporting date.',
  },

  {
    noteNumber: '7',
    key: 'right_of_use_assets',
    title: 'Right-of-Use Assets and Lease Liabilities',
    category: 'balance_sheet',
    ifrsReference: 'IFRS 16',
    smeReference: 'Section 20',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ['full_ifrs'],
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasLeases'],
    },
    requiredDataKeys: ['RIGHT_OF_USE', 'ROU_ASSETS', 'LEASE_LIABILITY', 'LEASE'],
    narrativeTemplate:
      'The Company has lease contracts for {{leaseTypes}}. ' +
      'The Company recognises right-of-use assets and lease liabilities for these leases.\n\n' +
      '7.1 Right-of-Use Assets\n' +
      'Net carrying amount as at {{periodEnd}} is Rs. {{rouNet}} ({{priorYear}}: Rs. {{priorRouNet}}).\n\n' +
      '7.2 Lease Liabilities\n' +
      'Total lease liabilities as at {{periodEnd}} amount to Rs. {{leaseTotal}} ({{priorYear}}: Rs. {{priorLeaseTotal}}).\n\n' +
      '7.3 Amounts recognised in profit or loss:\n' +
      '- Depreciation charge: Rs. {{rouDepreciation}}\n' +
      '- Interest on lease liabilities: Rs. {{leaseInterest}}\n' +
      '- Short-term lease expense: Rs. {{shortTermLeaseExpense}}',
    subItems: [
      { key: 'rou_net', label: 'ROU Assets Net Book Value', format: 'currency' },
      { key: 'lease_total', label: 'Total Lease Liabilities', format: 'currency' },
      { key: 'lease_current', label: 'Current Portion', format: 'currency' },
      { key: 'lease_non_current', label: 'Non-Current Portion', format: 'currency' },
      { key: 'rou_depreciation', label: 'ROU Depreciation', format: 'currency' },
      { key: 'lease_interest', label: 'Lease Interest', format: 'currency' },
    ],
    tables: [
      {
        type: 'lease_maturity',
        title: 'Maturity Analysis of Lease Liabilities',
        columns: [
          { key: 'period', label: 'Period', format: 'text' },
          { key: 'undiscounted_amount', label: 'Undiscounted Amounts', format: 'currency' },
          { key: 'discount', label: 'Discount Effect', format: 'currency' },
          { key: 'present_value', label: 'Present Value', format: 'currency' },
        ],
        dataSource: 'coaAccounts.LEASE',
        description: 'Maturity analysis of lease liabilities showing undiscounted amounts per IFRS 16.58',
      },
      {
        type: 'movement_schedule',
        title: 'Movement Schedule of Right-of-Use Assets',
        columns: [
          { key: 'asset_class', label: 'Asset Class', format: 'text' },
          { key: 'opening', label: 'Opening Balance', format: 'currency' },
          { key: 'additions', label: 'Additions', format: 'currency' },
          { key: 'depreciation', label: 'Depreciation', format: 'currency' },
          { key: 'derecognition', label: 'Derecognition', format: 'currency' },
          { key: 'closing', label: 'Closing Balance', format: 'currency' },
        ],
        dataSource: 'coaAccounts.ROU_ASSETS',
        description: 'Movement of right-of-use assets by class per IFRS 16.53',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not have any material lease arrangements requiring recognition under IFRS 16.',
  },

  {
    noteNumber: '8',
    key: 'investment_property',
    title: 'Investment Property',
    category: 'balance_sheet',
    ifrsReference: 'IAS 40',
    smeReference: 'Section 16',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['INVESTMENT_PROPERTY', 'INV_PROPERTY'],
    narrativeTemplate:
      'Investment property is property held to earn rentals or for capital appreciation or both. ' +
      'The Company measures investment property at {{measurementModel}} after initial recognition.\n\n' +
      'Fair value of investment property as at {{periodEnd}} is Rs. {{investmentPropertyFV}} ({{priorYear}}: Rs. {{priorInvestmentPropertyFV}}).',
    subItems: [
      { key: 'investment_property_cost', label: 'Cost', format: 'currency' },
      { key: 'investment_property_fv', label: 'Fair Value', format: 'currency' },
      { key: 'measurement_model', label: 'Measurement Model', format: 'text', placeholder: 'Cost model / Fair value model' },
      { key: 'rental_income', label: 'Rental Income from Investment Property', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not hold any investment property as at the reporting date.',
  },

  {
    noteNumber: '9',
    key: 'long_term_investments',
    title: 'Long-term Investments',
    category: 'balance_sheet',
    ifrsReference: 'IAS 28, IFRS 9, IFRS 10, IFRS 11',
    smeReference: 'Sections 14, 15',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 8',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['INVESTMENT', 'INVESTMENTS', 'ASSOCIATE', 'SUBSIDIARY', 'JOINT_VENTURE'],
    narrativeTemplate:
      '9.1 Investment in Subsidiaries\n{{subsidiaryDisclosure}}\n\n' +
      '9.2 Investment in Associates\n{{associateDisclosure}}\n\n' +
      '9.3 Other Long-term Investments\n' +
      'Total long-term investments as at {{periodEnd}} amount to Rs. {{longTermInvestments}} ({{priorYear}}: Rs. {{priorLongTermInvestments}}).',
    subItems: [
      { key: 'subsidiaries', label: 'Investment in Subsidiaries', format: 'currency' },
      { key: 'associates', label: 'Investment in Associates', format: 'currency' },
      { key: 'joint_ventures', label: 'Investment in Joint Ventures', format: 'currency' },
      { key: 'other_investments', label: 'Other Long-term Investments', format: 'currency' },
      { key: 'equity_method_income', label: 'Share of Profit from Associates', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Details of Long-term Investments',
        columns: [
          { key: 'entity_name', label: 'Name of Entity', format: 'text' },
          { key: 'country', label: 'Country', format: 'text' },
          { key: 'holding_pct', label: 'Holding %', format: 'percentage' },
          { key: 'cost', label: 'Cost', format: 'currency' },
          { key: 'carrying_value', label: 'Carrying Value', format: 'currency' },
        ],
        dataSource: 'coaAccounts.INVESTMENT',
        description: 'Details of subsidiaries, associates and other investments per IAS 28/IFRS 12',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not hold any long-term investments as at the reporting date.',
  },

  {
    noteNumber: '10',
    key: 'deferred_tax',
    title: 'Deferred Tax Asset / Liability',
    category: 'balance_sheet',
    isaReference: 'ISA 540',
    ifrsReference: 'IAS 12',
    smeReference: 'Section 29',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasTaxation'],
    },
    requiredDataKeys: ['DEFERRED_TAX', 'DTL', 'DTA', 'DEFERRED_TAX_ASSET', 'DEFERRED_TAX_LIABILITY'],
    narrativeTemplate:
      'Deferred tax is recognised on all temporary differences between the carrying amounts of assets and liabilities in the financial statements and the corresponding tax bases used in the computation of taxable profit.\n\n' +
      'Net deferred tax {{deferredTaxPosition}} as at {{periodEnd}} amounts to Rs. {{deferredTaxBalance}} ({{priorYear}}: Rs. {{priorDeferredTaxBalance}}).\n\n' +
      'The deferred tax {{deferredTaxPosition}} is attributable to the following items:\n{{deferredTaxBreakdown}}',
    subItems: [
      { key: 'deferred_tax_balance', label: 'Deferred Tax Balance', format: 'currency' },
      { key: 'deferred_tax_position', label: 'Position (Asset/Liability)', format: 'text', placeholder: 'asset / liability' },
      { key: 'accelerated_depreciation', label: 'Accelerated Depreciation', format: 'currency' },
      { key: 'provision_differences', label: 'Provisions & Allowances', format: 'currency' },
      { key: 'unused_tax_losses', label: 'Unused Tax Losses', format: 'currency' },
    ],
    tables: [
      {
        type: 'tax_reconciliation',
        title: 'Deferred Tax Reconciliation',
        columns: [
          { key: 'description', label: 'Temporary Difference', format: 'text' },
          { key: 'opening', label: 'Opening Balance', format: 'currency' },
          { key: 'charge_pl', label: 'Charged to P&L', format: 'currency' },
          { key: 'charge_oci', label: 'Charged to OCI', format: 'currency' },
          { key: 'closing', label: 'Closing Balance', format: 'currency' },
        ],
        dataSource: 'coaAccounts.DEFERRED_TAX',
        description: 'Reconciliation of deferred tax balances by temporary difference per IAS 12.81',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'No significant temporary differences exist requiring recognition of deferred tax.',
  },

  {
    noteNumber: '11',
    key: 'inventories',
    title: 'Inventories',
    category: 'balance_sheet',
    isaReference: 'ISA 501',
    ifrsReference: 'IAS 2',
    smeReference: 'Section 13',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 9',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['INVENTORIES', 'INVENTORY', 'STOCK', 'RAW_MATERIALS', 'WIP', 'FINISHED_GOODS'],
    narrativeTemplate:
      'Inventories as at {{periodEnd}} amount to Rs. {{inventoryTotal}} ({{priorYear}}: Rs. {{priorInventoryTotal}}).\n\n' +
      'Inventories are valued at the lower of cost and net realisable value. Cost is determined using the {{costFormula}} method.\n\n' +
      '{{inventoryWriteDown}}',
    subItems: [
      { key: 'raw_materials', label: 'Raw Materials', dataKey: 'RAW_MATERIALS', format: 'currency' },
      { key: 'wip', label: 'Work-in-Progress', dataKey: 'WIP', format: 'currency' },
      { key: 'finished_goods', label: 'Finished Goods', dataKey: 'FINISHED_GOODS', format: 'currency' },
      { key: 'stores_spares', label: 'Stores and Spares', format: 'currency' },
      { key: 'packing_material', label: 'Packing Material', format: 'currency' },
      { key: 'inventory_total', label: 'Total Inventories', format: 'currency' },
      { key: 'write_down', label: 'Write-down to NRV', format: 'currency' },
      { key: 'cost_formula', label: 'Cost Formula', format: 'text', placeholder: 'Weighted average / FIFO' },
    ],
    tables: [
      {
        type: 'inventory_breakdown',
        title: 'Breakdown of Inventories',
        columns: [
          { key: 'category', label: 'Category', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.INVENTORIES',
        description: 'Breakdown of inventories by category per IAS 2.36',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not hold inventories as at the reporting date.',
  },

  {
    noteNumber: '12',
    key: 'trade_receivables',
    title: 'Trade and Other Receivables',
    category: 'balance_sheet',
    isaReference: 'ISA 505',
    ifrsReference: 'IFRS 9, IFRS 7',
    smeReference: 'Section 11',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 10',
    secpRequirement: 'S.R.O. 985(I)/2019 - ECL requirements',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['TRADE_RECEIVABLES', 'RECEIVABLES', 'ACCOUNTS_RECEIVABLE', 'OTHER_RECEIVABLES'],
    narrativeTemplate:
      'Trade and other receivables as at {{periodEnd}} amount to Rs. {{receivablesTotal}} ({{priorYear}}: Rs. {{priorReceivablesTotal}}).\n\n' +
      'Trade debts - considered good: Rs. {{tradeDebtorsGood}}\n' +
      'Trade debts - considered doubtful: Rs. {{tradeDebtorsDoubtful}}\n' +
      'Less: Expected credit loss allowance: Rs. ({{eclAllowance}})\n\n' +
      '{{eclDisclosure}}',
    subItems: [
      { key: 'trade_debtors', label: 'Trade Debtors', dataKey: 'TRADE_RECEIVABLES', format: 'currency' },
      { key: 'other_receivables', label: 'Other Receivables', format: 'currency' },
      { key: 'ecl_allowance', label: 'ECL Allowance', format: 'currency' },
      { key: 'receivables_total', label: 'Net Receivables', format: 'currency' },
      { key: 'receivables_secured', label: 'Secured Receivables', format: 'currency' },
      { key: 'receivables_unsecured', label: 'Unsecured Receivables', format: 'currency' },
    ],
    tables: [
      {
        type: 'ageing_analysis',
        title: 'Ageing Analysis of Trade Receivables',
        columns: [
          { key: 'category', label: 'Category', format: 'text' },
          { key: 'not_due', label: 'Not Yet Due', format: 'currency' },
          { key: 'days_1_30', label: '1-30 Days', format: 'currency' },
          { key: 'days_31_60', label: '31-60 Days', format: 'currency' },
          { key: 'days_61_90', label: '61-90 Days', format: 'currency' },
          { key: 'days_91_180', label: '91-180 Days', format: 'currency' },
          { key: 'days_181_365', label: '181-365 Days', format: 'currency' },
          { key: 'over_365', label: 'Over 365 Days', format: 'currency' },
          { key: 'total', label: 'Total', format: 'currency' },
        ],
        dataSource: 'coaAccounts.TRADE_RECEIVABLES',
        description: 'Ageing analysis of trade receivables for ECL assessment per IFRS 9.5.5.15',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '13',
    key: 'advances_deposits_prepayments',
    title: 'Advances, Deposits and Prepayments',
    category: 'balance_sheet',
    ifrsReference: 'IAS 1.54',
    smeReference: 'Section 11',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['ADVANCES', 'DEPOSITS', 'PREPAYMENTS', 'PREPAYMENT'],
    narrativeTemplate:
      'Advances, deposits and prepayments as at {{periodEnd}} amount to Rs. {{adpTotal}} ({{priorYear}}: Rs. {{priorAdpTotal}}).\n\n' +
      '{{adpBreakdown}}',
    subItems: [
      { key: 'advance_to_suppliers', label: 'Advances to Suppliers', format: 'currency' },
      { key: 'advance_to_employees', label: 'Advances to Employees', format: 'currency' },
      { key: 'advance_tax', label: 'Advance Income Tax', format: 'currency' },
      { key: 'security_deposits', label: 'Security Deposits', format: 'currency' },
      { key: 'prepaid_expenses', label: 'Prepaid Expenses', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Advances, Deposits and Prepayments',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.ADVANCES',
        description: 'Detailed breakdown of advances, deposits and prepayments',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'No material advances, deposits or prepayments exist as at the reporting date.',
  },

  {
    noteNumber: '14',
    key: 'cash_bank_balances',
    title: 'Cash and Bank Balances',
    category: 'balance_sheet',
    ifrsReference: 'IAS 7',
    smeReference: 'Section 7',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['CASH', 'BANK', 'CASH_EQUIVALENTS', 'CASH_AND_BANK'],
    narrativeTemplate:
      'Cash and bank balances as at {{periodEnd}} amount to Rs. {{cashTotal}} ({{priorYear}}: Rs. {{priorCashTotal}}).\n\n' +
      'Cash in hand: Rs. {{cashInHand}}\n' +
      'Cash at banks - current accounts: Rs. {{bankCurrent}}\n' +
      'Cash at banks - deposit accounts: Rs. {{bankDeposit}}\n' +
      'Short-term deposits (maturity < 3 months): Rs. {{shortTermDeposits}}\n' +
      'Total: Rs. {{cashTotal}}',
    subItems: [
      { key: 'cash_in_hand', label: 'Cash in Hand', format: 'currency' },
      { key: 'bank_current', label: 'Bank - Current Accounts', format: 'currency' },
      { key: 'bank_deposit', label: 'Bank - Deposit Accounts', format: 'currency' },
      { key: 'short_term_deposits', label: 'Short-term Deposits', format: 'currency' },
      { key: 'cash_total', label: 'Total Cash and Bank Balances', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Details of Cash and Bank Balances',
        columns: [
          { key: 'bank_name', label: 'Bank Name', format: 'text' },
          { key: 'account_type', label: 'Account Type', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.CASH',
        description: 'Details of cash and bank balances by bank and account type',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '15',
    key: 'share_capital_reserves',
    title: 'Share Capital and Reserves',
    category: 'equity',
    ifrsReference: 'IAS 1.79, IAS 32',
    smeReference: 'Section 22',
    companiesActReference: 'Companies Act 2017, S.83-95, Fourth Schedule',
    secpRequirement: 'Companies (General Provisions and Forms) Rules, 2018',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['SHARE_CAPITAL', 'RESERVES', 'RETAINED_EARNINGS', 'EQUITY'],
    narrativeTemplate:
      '15.1 Authorised Share Capital\n' +
      '{{authorisedShares}} ordinary shares of Rs. {{parValue}} each: Rs. {{authorisedCapital}}\n\n' +
      '15.2 Issued, Subscribed and Paid-up Share Capital\n' +
      '{{issuedShares}} ordinary shares of Rs. {{parValue}} each fully paid in cash: Rs. {{paidUpCapital}}\n\n' +
      '15.3 Reserves\n{{reservesBreakdown}}\n\n' +
      '15.4 Retained Earnings / (Accumulated Losses)\n' +
      'Balance as at {{periodEnd}}: Rs. {{retainedEarnings}} ({{priorYear}}: Rs. {{priorRetainedEarnings}})',
    subItems: [
      { key: 'authorised_capital', label: 'Authorised Capital', format: 'currency' },
      { key: 'paid_up_capital', label: 'Paid-up Capital', dataKey: 'SHARE_CAPITAL', format: 'currency' },
      { key: 'par_value', label: 'Par Value per Share', format: 'currency' },
      { key: 'authorised_shares', label: 'Authorised Shares (Number)', format: 'text' },
      { key: 'issued_shares', label: 'Issued Shares (Number)', format: 'text' },
      { key: 'retained_earnings', label: 'Retained Earnings', dataKey: 'RETAINED_EARNINGS', format: 'currency' },
      { key: 'share_premium', label: 'Share Premium', format: 'currency' },
      { key: 'revaluation_surplus', label: 'Revaluation Surplus', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '16',
    key: 'long_term_borrowings',
    title: 'Long-term Borrowings',
    category: 'balance_sheet',
    ifrsReference: 'IFRS 9, IAS 32',
    smeReference: 'Section 11, 22',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 4',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasBorrowings'],
    },
    requiredDataKeys: ['LONG_TERM_BORROWING', 'BORROWINGS', 'LOAN', 'TERM_FINANCE'],
    narrativeTemplate:
      'Long-term borrowings as at {{periodEnd}} amount to Rs. {{longTermBorrowings}} ({{priorYear}}: Rs. {{priorLongTermBorrowings}}).\n\n' +
      'Current maturity shown under current liabilities: Rs. {{currentMaturity}}\n\n' +
      '{{borrowingDetails}}',
    subItems: [
      { key: 'long_term_borrowings', label: 'Total Long-term Borrowings', format: 'currency' },
      { key: 'current_maturity', label: 'Current Maturity', format: 'currency' },
      { key: 'secured_borrowings', label: 'Secured Borrowings', format: 'currency' },
      { key: 'unsecured_borrowings', label: 'Unsecured Borrowings', format: 'currency' },
      { key: 'interest_rate_range', label: 'Interest Rate Range', format: 'text', placeholder: 'e.g., KIBOR + 2%' },
    ],
    tables: [
      {
        type: 'borrowing_schedule',
        title: 'Long-term Borrowings Details',
        columns: [
          { key: 'lender', label: 'Lender', format: 'text' },
          { key: 'facility_type', label: 'Facility Type', format: 'text' },
          { key: 'interest_rate', label: 'Interest Rate', format: 'text' },
          { key: 'maturity_date', label: 'Maturity Date', format: 'text' },
          { key: 'security', label: 'Security', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.BORROWINGS',
        description: 'Details of each long-term borrowing facility per IFRS 7.7',
      },
      {
        type: 'maturity_analysis',
        title: 'Maturity Analysis of Long-term Borrowings',
        columns: [
          { key: 'period', label: 'Period', format: 'text' },
          { key: 'principal', label: 'Principal', format: 'currency' },
          { key: 'interest', label: 'Interest', format: 'currency' },
          { key: 'total', label: 'Total', format: 'currency' },
        ],
        dataSource: 'coaAccounts.BORROWINGS',
        description: 'Maturity analysis showing repayment schedule per IFRS 7.39',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not have any long-term borrowings as at the reporting date.',
  },

  {
    noteNumber: '17',
    key: 'employee_benefits',
    title: 'Deferred Liabilities / Employee Benefits',
    category: 'balance_sheet',
    isaReference: 'ISA 540',
    ifrsReference: 'IAS 19',
    smeReference: 'Section 28',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasEmployeeBenefits'],
    },
    requiredDataKeys: ['EMPLOYEE_BENEFITS', 'GRATUITY', 'PENSION', 'PROVIDENT_FUND', 'COMPENSATED_ABSENCES'],
    narrativeTemplate:
      '17.1 Staff Gratuity\n' +
      'The Company operates an {{gratuityType}} gratuity scheme for its eligible employees. ' +
      'The liability recognised in the balance sheet as at {{periodEnd}} is Rs. {{gratuityLiability}} ({{priorYear}}: Rs. {{priorGratuityLiability}}).\n\n' +
      '17.2 Provident Fund\n' +
      'The Company operates a recognised provident fund for its permanent employees. {{providentFundDisclosure}}\n\n' +
      '17.3 Compensated Absences\n' +
      'Provision for compensated absences as at {{periodEnd}} is Rs. {{compensatedAbsences}} ({{priorYear}}: Rs. {{priorCompensatedAbsences}}).',
    subItems: [
      { key: 'gratuity_liability', label: 'Gratuity Liability', format: 'currency' },
      { key: 'gratuity_type', label: 'Gratuity Type', format: 'text', placeholder: 'funded / unfunded' },
      { key: 'provident_fund_contribution', label: 'Provident Fund Contribution', format: 'currency' },
      { key: 'compensated_absences', label: 'Compensated Absences', format: 'currency' },
      { key: 'actuarial_gain_loss', label: 'Actuarial Gain / (Loss)', format: 'currency' },
      { key: 'discount_rate', label: 'Discount Rate', format: 'percentage' },
      { key: 'salary_increase_rate', label: 'Expected Salary Increase Rate', format: 'percentage' },
    ],
    tables: [
      {
        type: 'movement_schedule',
        title: 'Movement in Staff Gratuity',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.GRATUITY',
        description: 'Reconciliation of defined benefit obligation per IAS 19.140',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not have any defined benefit obligations or material employee benefit liabilities.',
  },

  {
    noteNumber: '18',
    key: 'trade_payables',
    title: 'Trade and Other Payables',
    category: 'balance_sheet',
    ifrsReference: 'IAS 1.54, IFRS 9',
    smeReference: 'Section 11',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 5',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['TRADE_PAYABLES', 'PAYABLES', 'ACCOUNTS_PAYABLE', 'OTHER_PAYABLES', 'ACCRUALS'],
    narrativeTemplate:
      'Trade and other payables as at {{periodEnd}} amount to Rs. {{payablesTotal}} ({{priorYear}}: Rs. {{priorPayablesTotal}}).\n\n' +
      '{{payablesBreakdown}}',
    subItems: [
      { key: 'trade_creditors', label: 'Trade Creditors', dataKey: 'TRADE_PAYABLES', format: 'currency' },
      { key: 'accrued_expenses', label: 'Accrued Expenses', format: 'currency' },
      { key: 'withholding_tax', label: 'Withholding Tax Payable', format: 'currency' },
      { key: 'sales_tax_payable', label: 'Sales Tax Payable', format: 'currency' },
      { key: 'provident_fund_payable', label: 'Provident Fund Payable', format: 'currency' },
      { key: 'other_payables', label: 'Other Payables', format: 'currency' },
      { key: 'payables_total', label: 'Total Trade and Other Payables', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Trade and Other Payables',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.TRADE_PAYABLES',
        description: 'Detailed breakdown of trade and other payables',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '19',
    key: 'short_term_borrowings',
    title: 'Short-term Borrowings',
    category: 'balance_sheet',
    ifrsReference: 'IFRS 9, IFRS 7',
    smeReference: 'Section 11',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasBorrowings'],
    },
    requiredDataKeys: ['SHORT_TERM_BORROWING', 'RUNNING_FINANCE', 'OVERDRAFT', 'MURABAHA', 'SHORT_TERM_LOAN'],
    narrativeTemplate:
      'Short-term borrowings as at {{periodEnd}} amount to Rs. {{shortTermBorrowings}} ({{priorYear}}: Rs. {{priorShortTermBorrowings}}).\n\n' +
      '{{shortTermBorrowingDetails}}',
    subItems: [
      { key: 'running_finance', label: 'Running Finance / Overdraft', format: 'currency' },
      { key: 'short_term_loans', label: 'Short-term Loans', format: 'currency' },
      { key: 'murabaha', label: 'Murabaha Finance', format: 'currency' },
      { key: 'commercial_paper', label: 'Commercial Paper', format: 'currency' },
      { key: 'total_st_borrowings', label: 'Total Short-term Borrowings', format: 'currency' },
      { key: 'sanctioned_limit', label: 'Sanctioned Limit', format: 'currency' },
    ],
    tables: [
      {
        type: 'borrowing_schedule',
        title: 'Short-term Borrowings Details',
        columns: [
          { key: 'lender', label: 'Lender', format: 'text' },
          { key: 'facility_type', label: 'Facility Type', format: 'text' },
          { key: 'interest_rate', label: 'Rate', format: 'text' },
          { key: 'sanctioned_limit', label: 'Limit', format: 'currency' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.SHORT_TERM_BORROWING',
        description: 'Details of short-term borrowing facilities per IFRS 7.7',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not have any short-term borrowings as at the reporting date.',
  },

  {
    noteNumber: '20',
    key: 'provisions',
    title: 'Provisions',
    category: 'balance_sheet',
    isaReference: 'ISA 540',
    ifrsReference: 'IAS 37',
    smeReference: 'Section 21',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['PROVISIONS', 'PROVISION', 'WARRANTY_PROVISION', 'LEGAL_PROVISION'],
    narrativeTemplate:
      'Provisions as at {{periodEnd}} amount to Rs. {{provisionsTotal}} ({{priorYear}}: Rs. {{priorProvisionsTotal}}).\n\n' +
      'A provision is recognised when the Company has a present legal or constructive obligation as a result of past events, it is probable that an outflow of resources will be required to settle the obligation and a reliable estimate of the amount can be made.\n\n' +
      '{{provisionsDetails}}',
    subItems: [
      { key: 'warranty_provision', label: 'Warranty Provision', format: 'currency' },
      { key: 'legal_provision', label: 'Legal Claims Provision', format: 'currency' },
      { key: 'restructuring_provision', label: 'Restructuring Provision', format: 'currency' },
      { key: 'other_provisions', label: 'Other Provisions', format: 'currency' },
      { key: 'provisions_total', label: 'Total Provisions', format: 'currency' },
    ],
    tables: [
      {
        type: 'provision_movement',
        title: 'Movement in Provisions',
        columns: [
          { key: 'provision_type', label: 'Provision Type', format: 'text' },
          { key: 'opening', label: 'Opening Balance', format: 'currency' },
          { key: 'charged', label: 'Charged During Year', format: 'currency' },
          { key: 'utilised', label: 'Utilised', format: 'currency' },
          { key: 'reversed', label: 'Reversed', format: 'currency' },
          { key: 'unwinding', label: 'Unwinding of Discount', format: 'currency' },
          { key: 'closing', label: 'Closing Balance', format: 'currency' },
        ],
        dataSource: 'coaAccounts.PROVISIONS',
        description: 'Movement in each class of provision per IAS 37.84',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'No provisions are required to be recognised as at the reporting date.',
  },

  {
    noteNumber: '21',
    key: 'revenue',
    title: 'Revenue',
    category: 'profit_loss',
    ifrsReference: 'IFRS 15',
    smeReference: 'Section 23',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['REVENUE', 'SALES', 'TURNOVER', 'SERVICE_REVENUE'],
    narrativeTemplate:
      'Revenue for the period ended {{periodEnd}} amounts to Rs. {{revenueTotal}} ({{priorYear}}: Rs. {{priorRevenueTotal}}).\n\n' +
      'Revenue is recognised at an amount that reflects the consideration to which the Company expects to be entitled in exchange for transferring goods or services to a customer.\n\n' +
      'Gross revenue: Rs. {{grossRevenue}}\n' +
      'Less: Sales tax: Rs. ({{salesTax}})\n' +
      'Less: Trade discounts and allowances: Rs. ({{tradeDiscounts}})\n' +
      'Net revenue: Rs. {{netRevenue}}',
    subItems: [
      { key: 'gross_revenue', label: 'Gross Revenue', format: 'currency' },
      { key: 'sales_tax', label: 'Sales Tax', format: 'currency' },
      { key: 'trade_discounts', label: 'Trade Discounts / Returns', format: 'currency' },
      { key: 'net_revenue', label: 'Net Revenue', dataKey: 'REVENUE', format: 'currency' },
    ],
    tables: [
      {
        type: 'revenue_disaggregation',
        title: 'Disaggregation of Revenue',
        columns: [
          { key: 'revenue_stream', label: 'Revenue Stream', format: 'text' },
          { key: 'timing', label: 'Timing of Recognition', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.REVENUE',
        description: 'Disaggregation of revenue into categories per IFRS 15.114',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '22',
    key: 'cost_of_sales',
    title: 'Cost of Sales / Cost of Revenue',
    category: 'profit_loss',
    ifrsReference: 'IAS 1.99, IAS 2.36',
    smeReference: 'Section 5',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['COST_OF_SALES', 'COST_OF_REVENUE', 'DIRECT_COSTS'],
    narrativeTemplate:
      'Cost of sales for the period ended {{periodEnd}} amounts to Rs. {{costOfSalesTotal}} ({{priorYear}}: Rs. {{priorCostOfSalesTotal}}).\n\n' +
      '{{costOfSalesBreakdown}}',
    subItems: [
      { key: 'opening_stock', label: 'Opening Stock', format: 'currency' },
      { key: 'purchases', label: 'Purchases', format: 'currency' },
      { key: 'direct_labour', label: 'Direct Labour', format: 'currency' },
      { key: 'manufacturing_overhead', label: 'Manufacturing Overhead', format: 'currency' },
      { key: 'closing_stock', label: 'Less: Closing Stock', format: 'currency' },
      { key: 'cost_of_sales_total', label: 'Cost of Sales', dataKey: 'COST_OF_SALES', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Cost of Sales',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.COST_OF_SALES',
        description: 'Detailed breakdown of cost of sales by component',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '23',
    key: 'distribution_costs',
    title: 'Distribution Costs',
    category: 'profit_loss',
    ifrsReference: 'IAS 1.99',
    smeReference: 'Section 5',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['DISTRIBUTION', 'DISTRIBUTION_COSTS', 'SELLING_EXPENSES'],
    narrativeTemplate:
      'Distribution costs for the period ended {{periodEnd}} amount to Rs. {{distributionTotal}} ({{priorYear}}: Rs. {{priorDistributionTotal}}).\n\n' +
      '{{distributionBreakdown}}',
    subItems: [
      { key: 'salaries_distribution', label: 'Salaries and Benefits', format: 'currency' },
      { key: 'freight_outward', label: 'Freight Outward', format: 'currency' },
      { key: 'advertising', label: 'Advertising and Marketing', format: 'currency' },
      { key: 'commission', label: 'Sales Commission', format: 'currency' },
      { key: 'depreciation_distribution', label: 'Depreciation', format: 'currency' },
      { key: 'other_distribution', label: 'Other Distribution Costs', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Distribution Costs',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.DISTRIBUTION',
        description: 'Detailed breakdown of distribution and selling expenses',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company has not incurred any distribution costs during the period.',
  },

  {
    noteNumber: '24',
    key: 'admin_expenses',
    title: 'Administrative Expenses',
    category: 'profit_loss',
    ifrsReference: 'IAS 1.99',
    smeReference: 'Section 5',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['ADMIN', 'ADMIN_EXPENSES', 'ADMINISTRATIVE_EXPENSES'],
    narrativeTemplate:
      'Administrative expenses for the period ended {{periodEnd}} amount to Rs. {{adminTotal}} ({{priorYear}}: Rs. {{priorAdminTotal}}).\n\n' +
      '{{adminBreakdown}}',
    subItems: [
      { key: 'salaries_admin', label: 'Salaries, Wages and Benefits', format: 'currency' },
      { key: 'rent_rates', label: 'Rent, Rates and Taxes', format: 'currency' },
      { key: 'utilities', label: 'Utilities', format: 'currency' },
      { key: 'depreciation_admin', label: 'Depreciation', format: 'currency' },
      { key: 'amortisation_admin', label: 'Amortisation', format: 'currency' },
      { key: 'professional_fees', label: 'Professional and Legal Fees', format: 'currency' },
      { key: 'audit_fee', label: 'Auditors\' Remuneration', format: 'currency' },
      { key: 'insurance', label: 'Insurance', format: 'currency' },
      { key: 'repair_maintenance', label: 'Repair and Maintenance', format: 'currency' },
      { key: 'other_admin', label: 'Other Administrative Expenses', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Administrative Expenses',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.ADMIN',
        description: 'Detailed breakdown of administrative expenses',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '25',
    key: 'other_operating_income',
    title: 'Other Operating Income',
    category: 'profit_loss',
    ifrsReference: 'IAS 1.98',
    smeReference: 'Section 5',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['OTHER_INCOME', 'OTHER_OPERATING_INCOME'],
    narrativeTemplate:
      'Other operating income for the period ended {{periodEnd}} amounts to Rs. {{otherIncomeTotal}} ({{priorYear}}: Rs. {{priorOtherIncomeTotal}}).\n\n' +
      '{{otherIncomeBreakdown}}',
    subItems: [
      { key: 'gain_on_disposal', label: 'Gain on Disposal of Assets', format: 'currency' },
      { key: 'rental_income', label: 'Rental Income', format: 'currency' },
      { key: 'scrap_sales', label: 'Scrap Sales', format: 'currency' },
      { key: 'liabilities_written_back', label: 'Liabilities Written Back', format: 'currency' },
      { key: 'exchange_gain', label: 'Exchange Gain', format: 'currency' },
      { key: 'government_grant_income', label: 'Government Grant Income', format: 'currency' },
      { key: 'other_misc_income', label: 'Miscellaneous Income', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Other Operating Income',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.OTHER_INCOME',
        description: 'Detailed breakdown of other operating income',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'No other operating income was earned during the period.',
  },

  {
    noteNumber: '26',
    key: 'other_operating_expenses',
    title: 'Other Operating Expenses',
    category: 'profit_loss',
    ifrsReference: 'IAS 1.98',
    smeReference: 'Section 5',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['OTHER_EXPENSE', 'OTHER_OPERATING_EXPENSES', 'OTHER_CHARGES'],
    narrativeTemplate:
      'Other operating expenses for the period ended {{periodEnd}} amount to Rs. {{otherExpenseTotal}} ({{priorYear}}: Rs. {{priorOtherExpenseTotal}}).\n\n' +
      '{{otherExpenseBreakdown}}',
    subItems: [
      { key: 'loss_on_disposal', label: 'Loss on Disposal of Assets', format: 'currency' },
      { key: 'impairment_loss', label: 'Impairment Loss', format: 'currency' },
      { key: 'exchange_loss', label: 'Exchange Loss', format: 'currency' },
      { key: 'penalties_fines', label: 'Penalties and Fines', format: 'currency' },
      { key: 'donations', label: 'Donations', format: 'currency' },
      { key: 'workers_welfare_fund', label: 'Workers\' Welfare Fund', format: 'currency' },
      { key: 'workers_profit_participation', label: 'Workers\' Profit Participation Fund', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Other Operating Expenses',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.OTHER_EXPENSE',
        description: 'Detailed breakdown of other operating expenses',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'No other operating expenses were incurred during the period.',
  },

  {
    noteNumber: '27',
    key: 'finance_costs',
    title: 'Finance Costs',
    category: 'profit_loss',
    ifrsReference: 'IFRS 9, IAS 23',
    smeReference: 'Section 25',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasBorrowings'],
    },
    requiredDataKeys: ['FINANCE_COSTS', 'INTEREST_EXPENSE', 'MARKUP'],
    narrativeTemplate:
      'Finance costs for the period ended {{periodEnd}} amount to Rs. {{financeCostsTotal}} ({{priorYear}}: Rs. {{priorFinanceCostsTotal}}).\n\n' +
      '{{financeCostsBreakdown}}',
    subItems: [
      { key: 'interest_long_term', label: 'Interest on Long-term Borrowings', format: 'currency' },
      { key: 'interest_short_term', label: 'Interest on Short-term Borrowings', format: 'currency' },
      { key: 'interest_lease', label: 'Interest on Lease Liabilities', format: 'currency' },
      { key: 'bank_charges', label: 'Bank Charges', format: 'currency' },
      { key: 'unwinding_discount', label: 'Unwinding of Discount on Provisions', format: 'currency' },
      { key: 'less_capitalised', label: 'Less: Capitalised to Qualifying Assets', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Breakdown of Finance Costs',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'current_year', label: 'Current Year', format: 'currency' },
          { key: 'prior_year', label: 'Prior Year', format: 'currency' },
        ],
        dataSource: 'coaAccounts.FINANCE_COSTS',
        description: 'Detailed breakdown of finance costs',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company has not incurred any finance costs during the period.',
  },

  {
    noteNumber: '28',
    key: 'taxation',
    title: 'Taxation',
    category: 'profit_loss',
    isaReference: 'ISA 540',
    ifrsReference: 'IAS 12',
    smeReference: 'Section 29',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part II',
    secpRequirement: 'Income Tax Ordinance, 2001',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasTaxation'],
    },
    requiredDataKeys: ['TAX', 'INCOME_TAX', 'TAX_EXPENSE', 'TAXATION'],
    narrativeTemplate:
      '28.1 Tax Charge for the Year\n' +
      'Current tax: Rs. {{currentTax}}\n' +
      'Deferred tax: Rs. {{deferredTaxCharge}}\n' +
      'Total tax charge: Rs. {{totalTaxCharge}} ({{priorYear}}: Rs. {{priorTotalTaxCharge}})\n\n' +
      '28.2 Tax Reconciliation\n' +
      'The tax on profit before taxation differs from the theoretical amount as follows:\n' +
      '{{taxReconciliation}}\n\n' +
      '28.3 Tax Assessments\n' +
      '{{taxAssessmentStatus}}',
    subItems: [
      { key: 'current_tax', label: 'Current Tax', format: 'currency' },
      { key: 'deferred_tax_charge', label: 'Deferred Tax Charge / (Credit)', format: 'currency' },
      { key: 'total_tax_charge', label: 'Total Tax Charge', format: 'currency' },
      { key: 'applicable_tax_rate', label: 'Applicable Tax Rate', format: 'percentage' },
      { key: 'effective_tax_rate', label: 'Effective Tax Rate', format: 'percentage' },
    ],
    tables: [
      {
        type: 'tax_reconciliation',
        title: 'Tax Charge Reconciliation',
        columns: [
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'amount', label: 'Amount', format: 'currency' },
          { key: 'rate', label: 'Rate %', format: 'percentage' },
        ],
        dataSource: 'coaAccounts.TAX',
        description: 'Reconciliation between accounting profit and tax charge per IAS 12.81(c)',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '29',
    key: 'related_party_transactions',
    title: 'Related Party Transactions',
    category: 'related_parties',
    isaReference: 'ISA 550',
    ifrsReference: 'IAS 24',
    smeReference: 'Section 33',
    companiesActReference: 'Companies Act 2017, S.207-208, Fourth Schedule, Part I, Para 18',
    secpRequirement: 'Listed Companies (Code of Corporate Governance) Regulations, 2019',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasRelatedPartyTransactions'],
    },
    requiredDataKeys: ['RELATED_PARTY'],
    narrativeTemplate:
      'The Company has entered into transactions with the following related parties during the period:\n\n' +
      '{{relatedPartyList}}\n\n' +
      'Key management personnel compensation:\n' +
      '- Short-term employee benefits: Rs. {{kmpShortTerm}}\n' +
      '- Post-employment benefits: Rs. {{kmpPostEmployment}}\n' +
      '- Total: Rs. {{kmpTotal}}\n\n' +
      'The Company\'s related parties comprise associated companies, key management personnel, directors and their close family members. ' +
      'Transactions with related parties are carried out on mutually agreed terms and conditions.',
    subItems: [
      { key: 'kmp_short_term', label: 'KMP Short-term Benefits', format: 'currency' },
      { key: 'kmp_post_employment', label: 'KMP Post-employment Benefits', format: 'currency' },
      { key: 'kmp_total', label: 'KMP Total Compensation', format: 'currency' },
      { key: 'directors_remuneration', label: 'Directors\' Remuneration', format: 'currency' },
      { key: 'chief_executive_remuneration', label: 'Chief Executive Remuneration', format: 'currency' },
    ],
    tables: [
      {
        type: 'related_party_matrix',
        title: 'Related Party Transactions Matrix',
        columns: [
          { key: 'party_name', label: 'Name of Related Party', format: 'text' },
          { key: 'relationship', label: 'Relationship', format: 'text' },
          { key: 'nature', label: 'Nature of Transaction', format: 'text' },
          { key: 'amount', label: 'Transaction Amount', format: 'currency' },
          { key: 'balance', label: 'Outstanding Balance', format: 'currency' },
        ],
        dataSource: 'coaAccounts.RELATED_PARTY',
        description: 'Matrix of all related party transactions and balances per IAS 24.18',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '30',
    key: 'contingencies_commitments',
    title: 'Contingencies and Commitments',
    category: 'contingencies',
    isaReference: 'ISA 501, ISA 540',
    ifrsReference: 'IAS 37.86-92',
    smeReference: 'Section 21',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 14-15',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['CONTINGENCIES', 'COMMITMENTS'],
    narrativeTemplate:
      '30.1 Contingencies\n' +
      '{{contingenciesList}}\n\n' +
      '30.2 Commitments\n' +
      'Capital commitments outstanding as at {{periodEnd}}:\n' +
      '- Contracted but not provided for: Rs. {{capitalCommitmentsContracted}}\n' +
      '- Authorised but not contracted: Rs. {{capitalCommitmentsAuthorised}}\n\n' +
      'Other commitments:\n{{otherCommitments}}\n\n' +
      '30.3 Guarantees\n' +
      'Guarantees issued by banks on behalf of the Company: Rs. {{bankGuarantees}} ({{priorYear}}: Rs. {{priorBankGuarantees}})',
    subItems: [
      { key: 'tax_contingency', label: 'Tax Contingencies', format: 'currency' },
      { key: 'legal_contingency', label: 'Legal Contingencies', format: 'currency' },
      { key: 'capital_commitments_contracted', label: 'Capital Commitments (Contracted)', format: 'currency' },
      { key: 'capital_commitments_authorised', label: 'Capital Commitments (Authorised)', format: 'currency' },
      { key: 'bank_guarantees', label: 'Bank Guarantees', format: 'currency' },
      { key: 'letters_of_credit', label: 'Letters of Credit', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '31',
    key: 'cash_flow_notes',
    title: 'Cash Flow Statement Notes',
    category: 'cash_flow',
    ifrsReference: 'IAS 7',
    smeReference: 'Section 7',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part III',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: ['CASH', 'NON_CASH_ITEMS'],
    narrativeTemplate:
      '31.1 Cash and Cash Equivalents\n' +
      'For the purposes of the statement of cash flows, cash and cash equivalents comprise:\n' +
      'Cash in hand: Rs. {{cashInHand}}\n' +
      'Balances with banks: Rs. {{bankBalances}}\n' +
      'Short-term deposits (maturity < 3 months): Rs. {{shortTermDeposits}}\n' +
      'Less: Bank overdrafts: Rs. ({{bankOverdrafts}})\n' +
      'Total: Rs. {{cashEquivalentsTotal}}\n\n' +
      '31.2 Non-cash Investing and Financing Activities\n' +
      '{{nonCashActivities}}',
    subItems: [
      { key: 'cash_in_hand_cf', label: 'Cash in Hand', format: 'currency' },
      { key: 'bank_balances_cf', label: 'Balances with Banks', format: 'currency' },
      { key: 'short_term_deposits_cf', label: 'Short-term Deposits', format: 'currency' },
      { key: 'bank_overdrafts_cf', label: 'Bank Overdrafts', format: 'currency' },
      { key: 'non_cash_ppe', label: 'Non-cash PPE Additions', format: 'currency' },
      { key: 'non_cash_rou', label: 'Non-cash ROU Asset Recognition', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '32',
    key: 'financial_risk_management',
    title: 'Financial Risk Management',
    category: 'other_mandatory',
    ifrsReference: 'IFRS 7',
    smeReference: 'Section 11',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    secpRequirement: 'Listed Companies (Code of Corporate Governance) Regulations, 2019',
    applicability: {
      frameworks: ['full_ifrs'],
      companyTypes: ['large', 'public_unlisted', 'listed', 'regulated_bank', 'regulated_nbfc', 'regulated_insurance'],
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'The Company\'s activities expose it to a variety of financial risks: credit risk, liquidity risk and market risk. ' +
      'The Company\'s overall risk management programme focuses on the unpredictability of financial markets and seeks to minimise potential adverse effects on the Company\'s financial performance.\n\n' +
      '32.1 Credit Risk\n{{creditRiskDisclosure}}\n\n' +
      '32.2 Liquidity Risk\n{{liquidityRiskDisclosure}}\n\n' +
      '32.3 Market Risk\n' +
      '(a) Interest Rate Risk\n{{interestRateRiskDisclosure}}\n' +
      '(b) Currency Risk\n{{currencyRiskDisclosure}}\n' +
      '(c) Other Price Risk\n{{otherPriceRiskDisclosure}}',
    subItems: [
      { key: 'max_credit_exposure', label: 'Maximum Credit Exposure', format: 'currency' },
      { key: 'credit_quality', label: 'Credit Quality Assessment', format: 'text' },
    ],
    tables: [
      {
        type: 'sensitivity_analysis',
        title: 'Interest Rate Sensitivity Analysis',
        columns: [
          { key: 'scenario', label: 'Scenario', format: 'text' },
          { key: 'impact_pl', label: 'Impact on Profit', format: 'currency' },
          { key: 'impact_equity', label: 'Impact on Equity', format: 'currency' },
        ],
        dataSource: 'financialRiskData',
        description: 'Sensitivity analysis for interest rate risk per IFRS 7.40',
      },
      {
        type: 'maturity_analysis',
        title: 'Contractual Maturity Analysis of Financial Liabilities',
        columns: [
          { key: 'liability', label: 'Financial Liability', format: 'text' },
          { key: 'on_demand', label: 'On Demand', format: 'currency' },
          { key: 'within_1_year', label: 'Within 1 Year', format: 'currency' },
          { key: 'years_1_5', label: '1-5 Years', format: 'currency' },
          { key: 'over_5_years', label: 'Over 5 Years', format: 'currency' },
          { key: 'total', label: 'Total', format: 'currency' },
        ],
        dataSource: 'financialRiskData',
        description: 'Contractual maturity analysis of financial liabilities per IFRS 7.39',
      },
      {
        type: 'fair_value_hierarchy',
        title: 'Fair Value Hierarchy',
        columns: [
          { key: 'instrument', label: 'Financial Instrument', format: 'text' },
          { key: 'level_1', label: 'Level 1', format: 'currency' },
          { key: 'level_2', label: 'Level 2', format: 'currency' },
          { key: 'level_3', label: 'Level 3', format: 'currency' },
          { key: 'total', label: 'Total', format: 'currency' },
        ],
        dataSource: 'financialRiskData',
        description: 'Fair value hierarchy for financial instruments per IFRS 13.93',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'Not applicable for companies preparing under IFRS for SMEs or Companies Act 2017.',
  },

  {
    noteNumber: '33',
    key: 'events_after_reporting',
    title: 'Events After the Reporting Period',
    category: 'events_after',
    isaReference: 'ISA 560',
    ifrsReference: 'IAS 10',
    smeReference: 'Section 32',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'The Board of Directors authorised these financial statements for issue on {{authorisationDate}}.\n\n' +
      '{{eventsDisclosure}}\n\n' +
      'No material events have occurred after the reporting date that require adjustment to or disclosure in these financial statements, except as disclosed above.',
    subItems: [
      { key: 'authorisation_date', label: 'Date of Authorisation', format: 'date' },
      { key: 'proposed_dividend', label: 'Proposed Dividend', format: 'currency' },
      { key: 'subsequent_events_description', label: 'Subsequent Events Description', format: 'text', placeholder: 'Description of any subsequent events' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '34',
    key: 'going_concern',
    title: 'Going Concern',
    category: 'going_concern',
    isaReference: 'ISA 570',
    ifrsReference: 'IAS 1.25-26',
    smeReference: 'Section 3.8-3.9',
    companiesActReference: 'Companies Act 2017, S.225(2)',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'These financial statements have been prepared on a going concern basis. ' +
      'The directors have reviewed the Company\'s financial position as at {{periodEnd}} and are satisfied that the Company has adequate resources to continue in operational existence for the foreseeable future.\n\n' +
      '{{goingConcernAssessment}}',
    subItems: [
      { key: 'going_concern_assessment', label: 'Going Concern Assessment', format: 'text', placeholder: 'Management assessment details' },
      { key: 'material_uncertainty', label: 'Material Uncertainty Exists', format: 'text', placeholder: 'Yes / No' },
      { key: 'mitigating_factors', label: 'Mitigating Factors', format: 'text', placeholder: 'Actions taken by management' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '35',
    key: 'general_disclosures',
    title: 'General Disclosures',
    category: 'other_mandatory',
    ifrsReference: 'IAS 1',
    companiesActReference: 'Companies Act 2017, Fourth Schedule, Part I, Para 16-20',
    secpRequirement: 'Fourth Schedule, Companies Act 2017',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      '35.1 Number of Employees\n' +
      'Total number of employees as at {{periodEnd}}: {{totalEmployees}} ({{priorYear}}: {{priorTotalEmployees}})\n' +
      'Average number of employees during the year: {{avgEmployees}} ({{priorYear}}: {{priorAvgEmployees}})\n\n' +
      '35.2 Production Capacity and Actual Output (if applicable)\n' +
      'Designed capacity: {{designedCapacity}}\n' +
      'Actual output: {{actualOutput}}\n' +
      'Capacity utilisation: {{capacityUtilisation}}\n\n' +
      '35.3 Remuneration of Chief Executive, Directors and Executives\n' +
      '{{remunerationDisclosure}}\n\n' +
      '35.4 Auditors\' Remuneration\n' +
      'Audit fee: Rs. {{auditFee}} ({{priorYear}}: Rs. {{priorAuditFee}})\n' +
      'Other services: Rs. {{otherAuditServices}} ({{priorYear}}: Rs. {{priorOtherAuditServices}})\n\n' +
      '35.5 Donations\n' +
      'Total donations made during the year: Rs. {{donationsTotal}} ({{priorYear}}: Rs. {{priorDonationsTotal}})\n' +
      'Names of donees to whom donations exceeding Rs. 500,000 were made:\n{{doneesList}}\n\n' +
      '35.6 Transactions with the Provident Fund Trust\n' +
      '{{providentFundDisclosure}}\n\n' +
      '35.7 Date of Authorisation for Issue\n' +
      'These financial statements were authorised for issue on {{authorisationDate}} by the Board of Directors.',
    subItems: [
      { key: 'total_employees', label: 'Total Employees', format: 'text' },
      { key: 'avg_employees', label: 'Average Employees', format: 'text' },
      { key: 'designed_capacity', label: 'Designed Capacity', format: 'text', placeholder: 'If manufacturing entity' },
      { key: 'actual_output', label: 'Actual Output', format: 'text' },
      { key: 'capacity_utilisation', label: 'Capacity Utilisation %', format: 'percentage' },
      { key: 'audit_fee', label: 'Audit Fee', format: 'currency' },
      { key: 'other_audit_services', label: 'Other Audit Services Fee', format: 'currency' },
      { key: 'donations_total', label: 'Total Donations', format: 'currency' },
      { key: 'ce_remuneration', label: 'Chief Executive Remuneration', format: 'currency' },
      { key: 'directors_fees', label: 'Directors\' Meeting Fees', format: 'currency' },
      { key: 'executives_remuneration', label: 'Executives\' Remuneration', format: 'currency' },
    ],
    tables: [
      {
        type: 'basic_breakdown',
        title: 'Remuneration of Chief Executive, Directors and Executives',
        columns: [
          { key: 'component', label: 'Component', format: 'text' },
          { key: 'chief_executive', label: 'Chief Executive', format: 'currency' },
          { key: 'directors', label: 'Directors', format: 'currency' },
          { key: 'executives', label: 'Executives', format: 'currency' },
        ],
        dataSource: 'remunerationData',
        description: 'Remuneration details per Companies Act 2017, Fourth Schedule, Part I, Para 16',
      },
    ],
    isAlwaysRequired: true,
  },

  {
    noteNumber: '36',
    key: 'segment_reporting',
    title: 'Segment Reporting',
    category: 'other_mandatory',
    ifrsReference: 'IFRS 8',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ['full_ifrs'],
      companyTypes: ['listed', 'public_unlisted'],
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'The Company has identified the following reportable segments based on the internal reporting provided to the chief operating decision-maker:\n\n' +
      '{{segmentDisclosure}}\n\n' +
      'Segment revenue, profit, assets and liabilities are presented in the table below.',
    subItems: [
      { key: 'segment_1_name', label: 'Segment 1 Name', format: 'text' },
      { key: 'segment_2_name', label: 'Segment 2 Name', format: 'text' },
    ],
    tables: [
      {
        type: 'segment_analysis',
        title: 'Segment Information',
        columns: [
          { key: 'segment', label: 'Segment', format: 'text' },
          { key: 'revenue', label: 'Revenue', format: 'currency' },
          { key: 'profit', label: 'Profit/(Loss)', format: 'currency' },
          { key: 'assets', label: 'Total Assets', format: 'currency' },
          { key: 'liabilities', label: 'Total Liabilities', format: 'currency' },
        ],
        dataSource: 'segmentData',
        description: 'Segment information per IFRS 8.23',
      },
    ],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company operates in a single reportable segment.',
  },

  {
    noteNumber: '37',
    key: 'government_grants',
    title: 'Government Grants',
    category: 'other_mandatory',
    ifrsReference: 'IAS 20',
    smeReference: 'Section 24',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasGovernmentGrants'],
    },
    requiredDataKeys: ['GOVERNMENT_GRANTS', 'DEFERRED_INCOME'],
    narrativeTemplate:
      'Government grants are recognised at their fair value where there is a reasonable assurance that the grant will be received and all attached conditions will be complied with.\n\n' +
      '{{governmentGrantDetails}}',
    subItems: [
      { key: 'grants_received', label: 'Grants Received During Year', format: 'currency' },
      { key: 'deferred_grant_income', label: 'Deferred Grant Income', format: 'currency' },
      { key: 'grant_income_recognised', label: 'Grant Income Recognised in P&L', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company has not received any government grants during the period.',
  },

  {
    noteNumber: '38',
    key: 'foreign_currency',
    title: 'Foreign Currency Transactions',
    category: 'other_mandatory',
    ifrsReference: 'IAS 21',
    smeReference: 'Section 30',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
      conditions: ['hasForeignCurrency'],
    },
    requiredDataKeys: ['EXCHANGE_GAIN_LOSS'],
    narrativeTemplate:
      'Transactions in foreign currencies are translated into the functional currency using the exchange rates prevailing at the dates of the transactions. ' +
      'Monetary assets and liabilities denominated in foreign currencies are retranslated at the rate prevailing on the reporting date.\n\n' +
      'Net exchange gain/(loss) recognised during the year: Rs. {{netExchangeGainLoss}} ({{priorYear}}: Rs. {{priorNetExchangeGainLoss}}).',
    subItems: [
      { key: 'net_exchange_gain_loss', label: 'Net Exchange Gain / (Loss)', format: 'currency' },
      { key: 'foreign_currency_exposure', label: 'Foreign Currency Exposure (USD)', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: false,
    notApplicableRationale: 'The Company does not have material foreign currency transactions.',
  },

  {
    noteNumber: '39',
    key: 'earnings_per_share',
    title: 'Earnings Per Share',
    category: 'other_mandatory',
    ifrsReference: 'IAS 33',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ['full_ifrs'],
      companyTypes: ['listed', 'public_unlisted'],
    },
    requiredDataKeys: ['EPS'],
    narrativeTemplate:
      'Basic earnings per share:\n' +
      'Profit attributable to ordinary shareholders: Rs. {{profitForEPS}}\n' +
      'Weighted average number of ordinary shares: {{weightedAvgShares}}\n' +
      'Basic earnings per share (Rupees): {{basicEPS}} ({{priorYear}}: {{priorBasicEPS}})\n\n' +
      'Diluted earnings per share:\n' +
      '{{dilutedEPSDisclosure}}',
    subItems: [
      { key: 'profit_for_eps', label: 'Profit for EPS Calculation', format: 'currency' },
      { key: 'weighted_avg_shares', label: 'Weighted Average Shares', format: 'text' },
      { key: 'basic_eps', label: 'Basic EPS', format: 'currency' },
      { key: 'diluted_eps', label: 'Diluted EPS', format: 'currency' },
    ],
    tables: [],
    isAlwaysRequired: false,
    notApplicableRationale: 'Not applicable for private companies under IFRS for SMEs.',
  },

  {
    noteNumber: '40',
    key: 'corresponding_figures',
    title: 'Corresponding Figures',
    category: 'other_mandatory',
    ifrsReference: 'IAS 1.38-44, IAS 8',
    smeReference: 'Section 3.14',
    companiesActReference: 'Companies Act 2017, Fourth Schedule',
    applicability: {
      frameworks: ALL_FRAMEWORKS,
      companyTypes: ALL_COMPANY_TYPES,
    },
    requiredDataKeys: [],
    narrativeTemplate:
      'Corresponding figures have been rearranged and reclassified, wherever necessary, for the purposes of comparison and better presentation. ' +
      '{{reclassificationDetails}}',
    subItems: [
      { key: 'reclassification_details', label: 'Reclassification Details', format: 'text', placeholder: 'Details of any reclassifications made' },
    ],
    tables: [],
    isAlwaysRequired: true,
  },
];

export function getApplicableNotes(profile: EntityProfile): DisclosureNote[] {
  return DISCLOSURE_NOTES_REGISTRY.filter((note) => {
    const frameworkMatch =
      note.applicability.frameworks.length === 0 ||
      note.applicability.frameworks.includes(profile.reportingFramework);

    const companyTypeMatch =
      note.applicability.companyTypes.length === 0 ||
      note.applicability.companyTypes.includes(profile.companyType);

    if (!frameworkMatch || !companyTypeMatch) return false;

    if (note.applicability.conditions && note.applicability.conditions.length > 0) {
      const allConditionsMet = note.applicability.conditions.every((condition) => {
        const value = (profile as unknown as Record<string, unknown>)[condition];
        return value === true;
      });
      if (!allConditionsMet && !note.isAlwaysRequired) return false;
    }

    return true;
  });
}

export function getNoteIndex(
  notes: DisclosureNote[],
): { noteNumber: string; title: string; page?: number }[] {
  return notes.map((note) => ({
    noteNumber: note.noteNumber,
    title: note.title,
  }));
}

export function getRequiredTables(notes: DisclosureNote[]): DisclosureTable[] {
  const tables: DisclosureTable[] = [];
  for (const note of notes) {
    for (const table of note.tables) {
      tables.push(table);
    }
  }
  return tables;
}

export const ACCOUNTING_POLICY_TEMPLATES: Record<
  string,
  {
    standard: string;
    title: string;
    fullIFRS: string;
    smeText: string;
    conditions?: string[];
  }
> = {
  revenue_recognition: {
    standard: 'IFRS 15 / IAS 18',
    title: 'Revenue Recognition',
    fullIFRS:
      'Revenue is recognised when control of goods or services is transferred to the customer at an amount that reflects the consideration to which the Company expects to be entitled. ' +
      'Revenue from sale of goods is recognised at the point in time when the customer obtains control of the goods, which is generally upon delivery. ' +
      'Revenue from rendering of services is recognised over time as the services are provided, based on the stage of completion method. ' +
      'Revenue is measured at the fair value of the consideration received or receivable, net of trade discounts, volume rebates and sales taxes.',
    smeText:
      'Revenue from the sale of goods is recognised when the significant risks and rewards of ownership have been transferred to the buyer, ' +
      'the Company retains neither continuing managerial involvement nor effective control over the goods sold, ' +
      'the amount of revenue can be measured reliably, it is probable that the economic benefits will flow to the Company, ' +
      'and the costs incurred in respect of the transaction can be measured reliably. Revenue is measured at the fair value of the consideration received, net of trade discounts and sales taxes.',
  },
  ppe: {
    standard: 'IAS 16',
    title: 'Property, Plant and Equipment',
    fullIFRS:
      'Property, plant and equipment are stated at cost less accumulated depreciation and any identified impairment loss, except for freehold land which is stated at cost. ' +
      'Cost includes expenditure that is directly attributable to the acquisition of the asset. ' +
      'Subsequent costs are included in the asset\'s carrying amount or recognised as a separate asset only when it is probable that future economic benefits will flow to the Company. ' +
      'Depreciation is charged to profit or loss on a {{depreciationMethod}} basis over the estimated useful lives of the assets at rates specified in Note 5. ' +
      'The assets\' residual values, useful lives and depreciation methods are reviewed at each reporting date and adjusted if appropriate. ' +
      'An asset\'s carrying amount is written down immediately to its recoverable amount if the carrying amount is greater than its estimated recoverable amount. ' +
      'Gains and losses on disposals are determined by comparing proceeds with the carrying amount and are included in profit or loss.',
    smeText:
      'Items of property, plant and equipment are measured at cost less accumulated depreciation and any accumulated impairment losses. ' +
      'Depreciation is charged so as to allocate the cost over the estimated useful lives, using the {{depreciationMethod}} method. ' +
      'Gains and losses on disposal are recognised in profit or loss.',
  },
  intangible_assets: {
    standard: 'IAS 38',
    title: 'Intangible Assets',
    fullIFRS:
      'Intangible assets acquired separately are measured on initial recognition at cost. ' +
      'Following initial recognition, intangible assets are carried at cost less any accumulated amortisation and accumulated impairment losses. ' +
      'Internally generated intangible assets, excluding capitalised development costs, are not capitalised and the related expenditure is charged to profit or loss. ' +
      'The useful lives of intangible assets are assessed to be either finite or indefinite. ' +
      'Intangible assets with finite lives are amortised over the useful economic life and assessed for impairment whenever there is an indication of impairment. ' +
      'Amortisation is charged on a straight-line basis over the estimated useful lives.',
    smeText:
      'Intangible assets are measured at cost less accumulated amortisation and any accumulated impairment losses. ' +
      'All intangible assets are considered to have finite useful lives and are amortised on a straight-line basis over their estimated useful lives.',
  },
  inventories: {
    standard: 'IAS 2',
    title: 'Inventories',
    fullIFRS:
      'Inventories are valued at the lower of cost and net realisable value. ' +
      'Cost is determined using the {{costFormula}} method. ' +
      'Cost of finished goods and work-in-progress comprises raw materials, direct labour, other direct costs and related production overheads (based on normal operating capacity). ' +
      'Net realisable value is the estimated selling price in the ordinary course of business less the estimated costs of completion and the estimated costs necessary to make the sale. ' +
      'Provision is made for obsolete and slow-moving inventory items.',
    smeText:
      'Inventories are stated at the lower of cost and estimated selling price less costs to complete and sell. ' +
      'Cost is determined using the {{costFormula}} method. ' +
      'Cost of manufactured goods includes direct materials, direct labour and appropriate production overheads.',
  },
  financial_instruments: {
    standard: 'IFRS 9 / IAS 39',
    title: 'Financial Instruments',
    fullIFRS:
      'Financial assets are classified at initial recognition and subsequently measured at amortised cost, fair value through other comprehensive income (FVOCI), or fair value through profit or loss (FVTPL). ' +
      'The classification depends on the Company\'s business model for managing the financial assets and the contractual cash flow characteristics of the financial asset.\n\n' +
      'Financial assets at amortised cost: Assets held to collect contractual cash flows where those cash flows represent solely payments of principal and interest are measured at amortised cost using the effective interest method.\n\n' +
      'Impairment: The Company applies the IFRS 9 simplified approach to measuring expected credit losses (ECL) which uses a lifetime expected loss allowance for all trade receivables. ' +
      'The expected credit losses on trade receivables are estimated using a provision matrix based on the Company\'s historical credit loss experience.\n\n' +
      'Financial liabilities are initially recognised at fair value and subsequently measured at amortised cost using the effective interest method. ' +
      'A financial liability is derecognised when the obligation under the liability is discharged, cancelled or expired.',
    smeText:
      'Basic financial instruments are initially measured at the transaction price including transaction costs. ' +
      'At the end of each reporting period, basic financial instruments are measured at amortised cost using the effective interest method. ' +
      'The Company assesses at each reporting date whether there is objective evidence that financial assets are impaired.',
  },
  leases: {
    standard: 'IFRS 16',
    title: 'Leases',
    fullIFRS:
      'At inception of a contract, the Company assesses whether a contract is, or contains, a lease based on whether the contract conveys the right to control the use of an identified asset for a period of time in exchange for consideration.\n\n' +
      'As a lessee, the Company recognises a right-of-use asset and a lease liability at the lease commencement date. ' +
      'The right-of-use asset is initially measured at cost, which comprises the initial amount of the lease liability adjusted for any lease payments made at or before the commencement date, ' +
      'plus any initial direct costs incurred and an estimate of costs to dismantle and remove the underlying asset.\n\n' +
      'The right-of-use asset is subsequently depreciated using the straight-line method from the commencement date to the earlier of the end of the useful life or the end of the lease term. ' +
      'The lease liability is initially measured at the present value of the lease payments that are not paid at the commencement date, discounted using the interest rate implicit in the lease, or the Company\'s incremental borrowing rate.\n\n' +
      'The Company has elected not to recognise right-of-use assets and lease liabilities for short-term leases (lease term of 12 months or less) and leases of low-value assets. ' +
      'Lease payments associated with these leases are recognised as an expense on a straight-line basis over the lease term.',
    smeText:
      'Leases are classified as finance leases whenever the terms of the lease transfer substantially all the risks and rewards of ownership to the lessee. All other leases are classified as operating leases. ' +
      'Finance lease assets are capitalised at the lower of the fair value of the leased asset and the present value of the minimum lease payments. ' +
      'Operating lease payments are recognised as an expense on a straight-line basis over the lease term.',
    conditions: ['hasLeases'],
  },
  employee_benefits: {
    standard: 'IAS 19',
    title: 'Employee Benefits',
    fullIFRS:
      'Short-term employee benefits: Salaries, wages, bonuses and social security contributions are recognised as an expense in the period in which the associated services are rendered by employees.\n\n' +
      'Defined contribution plans: The Company operates a recognised provident fund for its permanent employees. Equal monthly contributions are made by the Company and the employees. ' +
      'The Company\'s contributions are charged to profit or loss.\n\n' +
      'Defined benefit plans: The Company operates an unfunded/funded gratuity scheme for its eligible employees. ' +
      'The cost of providing benefits under the defined benefit plan is determined using the projected unit credit method. ' +
      'Remeasurements, comprising actuarial gains and losses, are recognised immediately in other comprehensive income.\n\n' +
      'Compensated absences: The Company accounts for compensated absences on the basis of unavailed leave balance of each employee at the reporting date.',
    smeText:
      'The cost of short-term employee benefits is recognised in the period in which the service is rendered. ' +
      'The Company operates a defined contribution provident fund scheme, contributions to which are charged to profit or loss. ' +
      'A provision for staff gratuity is maintained based on the number of completed years of service.',
    conditions: ['hasEmployeeBenefits'],
  },
  provisions_policy: {
    standard: 'IAS 37',
    title: 'Provisions',
    fullIFRS:
      'Provisions are recognised when the Company has a present legal or constructive obligation as a result of past events, ' +
      'it is probable that an outflow of resources embodying economic benefits will be required to settle the obligation, ' +
      'and a reliable estimate of the amount can be made. ' +
      'Provisions are measured at the present value of the expenditures expected to be required to settle the obligation using a pre-tax rate that reflects current market assessments of the time value of money and the risks specific to the obligation. ' +
      'The increase in the provision due to the passage of time is recognised as a finance cost.',
    smeText:
      'Provisions are recognised when the Company has an obligation at the reporting date as a result of a past event, ' +
      'it is probable that the Company will be required to transfer economic benefits in settlement, and the amount can be estimated reliably. ' +
      'Provisions are measured at the best estimate of the amount required to settle the obligation at the reporting date.',
  },
  taxation_policy: {
    standard: 'IAS 12',
    title: 'Taxation',
    fullIFRS:
      'Current tax: The charge for current taxation is based on taxable income at the current rates of taxation after taking into account applicable tax credits, rebates and exemptions. ' +
      'The charge for the current tax also includes adjustments relating to prior years, if considered necessary.\n\n' +
      'Deferred tax: Deferred tax is recognised using the balance sheet liability method on all temporary differences between the tax bases of assets and liabilities and their carrying amounts in the financial statements. ' +
      'Deferred tax liabilities are generally recognised for all taxable temporary differences. ' +
      'Deferred tax assets are recognised for all deductible temporary differences, carry-forward of unused tax credits and unused tax losses, to the extent that it is probable that taxable profit will be available. ' +
      'Deferred tax is calculated at the rates that are expected to apply to the period when the differences reverse based on tax rates that have been enacted or substantively enacted by the reporting date.',
    smeText:
      'Current tax is the expected tax payable on the taxable income for the year, using tax rates enacted at the reporting date. ' +
      'Deferred tax is provided using the balance sheet liability method for temporary differences between the carrying amounts of assets and liabilities for financial reporting purposes and the amounts used for taxation purposes.',
    conditions: ['hasTaxation'],
  },
  foreign_currency_policy: {
    standard: 'IAS 21',
    title: 'Foreign Currency Transactions',
    fullIFRS:
      'Transactions in foreign currencies are translated into the functional currency using the exchange rates prevailing at the dates of the transactions. ' +
      'Monetary assets and liabilities denominated in foreign currencies are retranslated at the rate of exchange ruling at the reporting date. ' +
      'Non-monetary items that are measured in terms of historical cost in a foreign currency are translated using the exchange rate at the date of the transaction. ' +
      'Exchange differences arising on translation are recognised in profit or loss.',
    smeText:
      'A foreign currency transaction is recorded at the spot exchange rate at the date of the transaction. ' +
      'At the end of each reporting period, foreign currency monetary items are translated using the closing rate. ' +
      'Exchange differences are recognised in profit or loss in the period in which they arise.',
    conditions: ['hasForeignCurrency'],
  },
  borrowing_costs: {
    standard: 'IAS 23',
    title: 'Borrowing Costs',
    fullIFRS:
      'Borrowing costs that are directly attributable to the acquisition, construction or production of qualifying assets, ' +
      'which are assets that necessarily take a substantial period of time to get ready for their intended use or sale, are capitalised as part of the cost of those assets. ' +
      'All other borrowing costs are recognised in profit or loss in the period in which they are incurred.',
    smeText:
      'All borrowing costs are recognised as an expense in profit or loss in the period in which they are incurred.',
    conditions: ['hasBorrowings'],
  },
  government_grants_policy: {
    standard: 'IAS 20',
    title: 'Government Grants',
    fullIFRS:
      'Government grants are recognised at their fair value where there is a reasonable assurance that the grant will be received and all attached conditions will be complied with. ' +
      'Government grants relating to costs are deferred and recognised in profit or loss over the period necessary to match them with the costs that they are intended to compensate. ' +
      'Government grants relating to assets are presented as deferred income and are credited to profit or loss on a systematic basis over the useful life of the asset.',
    smeText:
      'Government grants are recognised when there is reasonable assurance that the entity will comply with the conditions attached to them and the grants will be received. ' +
      'Grants relating to income are recognised as income over the periods necessary to match them with the related costs. ' +
      'Grants relating to assets are recognised as deferred income and amortised to profit or loss over the expected useful life of the asset.',
    conditions: ['hasGovernmentGrants'],
  },
  impairment: {
    standard: 'IAS 36',
    title: 'Impairment of Non-Financial Assets',
    fullIFRS:
      'The Company assesses at each reporting date whether there is any indication that an asset may be impaired. ' +
      'If any such indication exists, the Company estimates the recoverable amount of the asset. ' +
      'The recoverable amount of an asset is the higher of its fair value less costs of disposal and its value in use. ' +
      'Where the carrying amount of an asset exceeds its recoverable amount, the asset is considered impaired and is written down to its recoverable amount. ' +
      'Impairment losses are recognised in profit or loss. ' +
      'A previously recognised impairment loss is reversed only if there has been a change in the estimates used to determine the asset\'s recoverable amount since the last impairment loss was recognised.',
    smeText:
      'At each reporting date, the Company reviews the carrying amounts of its assets to determine whether there is any indication that those assets have suffered an impairment loss. ' +
      'If any such indication exists, the recoverable amount of the asset is estimated. An impairment loss is recognised when the carrying amount exceeds the recoverable amount.',
  },
  fair_value_measurement: {
    standard: 'IFRS 13',
    title: 'Fair Value Measurement',
    fullIFRS:
      'Fair value is the price that would be received to sell an asset or paid to transfer a liability in an orderly transaction between market participants at the measurement date. ' +
      'The Company uses valuation techniques that are appropriate in the circumstances and for which sufficient data are available to measure fair value, ' +
      'maximising the use of relevant observable inputs and minimising the use of unobservable inputs.\n\n' +
      'All assets and liabilities for which fair value is measured or disclosed in the financial statements are categorised within the fair value hierarchy based on the lowest level input that is significant to the fair value measurement:\n' +
      '- Level 1: Quoted (unadjusted) market prices in active markets\n' +
      '- Level 2: Valuation techniques for which the lowest level input is directly or indirectly observable\n' +
      '- Level 3: Valuation techniques for which the lowest level input is unobservable',
    smeText:
      'The Company measures certain financial instruments and assets at fair value at each reporting date. ' +
      'Fair value is determined based on observable market data where available, and otherwise using valuation techniques.',
  },
  cash_flow_statement: {
    standard: 'IAS 7',
    title: 'Cash and Cash Equivalents',
    fullIFRS:
      'Cash and cash equivalents comprise cash in hand, balances with banks on current and deposit accounts and short-term highly liquid investments with original maturities of three months or less ' +
      'that are readily convertible to known amounts of cash and which are subject to an insignificant risk of changes in value. ' +
      'For the purpose of the statement of cash flows, cash and cash equivalents consist of cash and short-term deposits as defined above, net of outstanding bank overdrafts.',
    smeText:
      'Cash and cash equivalents include cash on hand, demand deposits and short-term highly liquid investments that are readily convertible to known amounts of cash and which are subject to an insignificant risk of changes in value.',
  },
};

export function getApplicablePolicies(profile: EntityProfile): typeof ACCOUNTING_POLICY_TEMPLATES {
  const applicable: typeof ACCOUNTING_POLICY_TEMPLATES = {};

  for (const [key, template] of Object.entries(ACCOUNTING_POLICY_TEMPLATES)) {
    if (!template.conditions || template.conditions.length === 0) {
      applicable[key] = template;
    } else {
      const allMet = template.conditions.every((condition) => {
        const value = (profile as unknown as Record<string, unknown>)[condition];
        return value === true;
      });
      if (allMet) {
        applicable[key] = template;
      }
    }
  }

  return applicable;
}

export function getPolicyText(
  key: string,
  framework: ReportingFramework,
): string {
  const template = ACCOUNTING_POLICY_TEMPLATES[key];
  if (!template) return '';
  return framework === 'full_ifrs' ? template.fullIFRS : template.smeText;
}

export function buildDefaultEntityProfile(): EntityProfile {
  return {
    companyType: 'medium',
    reportingFramework: 'ifrs_sme',
    listingStatus: 'private',
    industry: '',
    isRegulated: false,
    isNPO: false,
    hasSubsidiaries: false,
    hasAssociates: false,
    hasLeases: false,
    hasEmployeeBenefits: true,
    hasBorrowings: false,
    hasRelatedPartyTransactions: true,
    hasTaxation: true,
    hasContingencies: false,
    hasCommitments: false,
    hasGovernmentGrants: false,
    hasForeignCurrency: false,
  };
}
