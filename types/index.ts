export interface ProgrammeFinanceRecord {
  Id: string;
  Name: string;
  Type__c: string;
  Programme__r?: {
    Name: string;
    RecordType?: { DeveloperName: string };
  };
  Recruitment_Target_Month__c: string; // end-of-month date, e.g. "2026-03-31"
  Target_Amount__c: number | null;
  Monthly_Confirmed__c: number | null;
  Monthly_Expected__c: number | null;
  Monthly_Potential__c: number | null;
  Monthly_Costs__c: number | null;
  Invoiced_Paid__c: number | null;
  Invoiced_Amount__c: number | null;
}

export interface MonthlyData {
  month: string;       // e.g. "Mar"
  monthDate: string;   // e.g. "2026-03-31"
  target: number;
  confirmed: number;
  expected: number;
  potential: number;
  costs: number;
  margin: number;      // confirmed - costs
  isPast: boolean;
  isCurrentMonth: boolean;
  confirmedLY?: number;  // Confirmed income in the same month last FY (optional)
  preFY?: boolean;       // Jan/Feb before FY starts — no targets, excluded from YTD
  invoiced?: number;     // Monthly invoiced amount (from Orders, pre-prorated by SF)
  paid?: number;         // Monthly paid amount (from Orders, pre-prorated by SF)
}

export interface AdvisoryOpportunity {
  Id: string;
  Name: string;
  Amount: number | null;
  StageName: string;
  Probability: number | null;
  Start_Date_All__c: string | null;
  End_DateAll__c: string | null;
  Number_of_Months__c: number | null;
  Organisation_Sector__c: string | null;
  Order__c: string | null; // lookup to linked Order record
  Costs__c: number | null;
  Project_Code__c: string | null;
  Account?: { Id: string; Name: string };
  Programme__r?: { Name: string };
}

// ─── Programmes ───────────────────────────────────────────────────────────────

export type ProgrammeType = 'all' | 'fellowship' | 'exchange' | 'ltd' | 'other';

// Place line item on a programme opp — UnitPrice is the achieved price/place,
// ListPrice the price-book list price/place (drives the list-vs-actual metric).
export interface ProgrammeLineItem {
  Quantity: number | null;
  UnitPrice?: number | null;
  ListPrice?: number | null;
  Product2?: { ProductCode: string | null; Name?: string | null };
}

export interface ProgrammeOpportunity {
  Id: string;
  Name: string;
  Amount: number | null;
  StageName: string;
  Probability: number | null;
  CloseDate: string | null;
  Total_Places__c: number | null;
  Organisation_Sector__c: string | null;
  Order__c: string | null;
  Account?: { Id: string; Name: string };
  Programme__r?: { Name: string };
  OpportunityLineItems?: { records: ProgrammeLineItem[] } | null;
}

export interface ProgrammesData {
  ytdConfirmed: number;
  ytdTarget: number;
  variance: number;
  months: MonthlyData[];                          // all types combined
  opportunities: ProgrammeOpportunity[];           // current FY, all types
  opportunitiesLY: ProgrammeOpportunity[];         // last FY confirmed, all types
  targetsByType: Record<ProgrammeType, Record<string, number>>; // monthDate → target
  orders: AdvisoryOrder[];                         // orders linked to programme opps
  uninvoicedStarted: ProgrammeOpportunity[];       // confirmed, closed, zero invoices
  lastUpdated: string;
}

// ─── Advisory ─────────────────────────────────────────────────────────────────

export interface Invoice {
  Id: string;
  Name: string;
  Stage__c: string; // 'New' | 'Submitted' | 'Added to Xero'
  Invoice_Amount__c: number | null;
}

export interface AdvisoryOrder {
  Id: string;
  Name: string;
  OpportunityId: string | null;
  Status: string; // 'New' | 'Ready to Invoice' | 'Invoice Sent' | 'Partially Invoiced' | 'Invoice Paid'
  TotalAmount: number | null;
  Project_Start_Date__c: string | null;
  Project_End_Date__c: string | null;
  Project_Length_Months__c: number | null;
  Number_of_invoices__c: number | null;
  Invoiced_Amount__c: number | null;
  Monthly_Invoiced_Amount__c: number | null;
  Paid_Amount__c: number | null;
  Paid_Amount_Per_Month__c: number | null;
  Invoice_Amount_Remaining__c: number | null;
  Sector__c: string | null;
  Invoices__r: { records: Invoice[] } | null; // sub-queried real invoice records
}

export interface AdvisoryMismatch {
  oppId: string;
  oppName: string;
  orgName: string;
  oppAmount: number;
  orderAmount: number;
}

export interface AdvisoryData {
  ytdConfirmed: number;
  ytdTarget: number;
  ytdCosts: number;
  ytdMargin: number;
  variance: number;
  months: MonthlyData[];
  opportunities: AdvisoryOpportunity[];
  orders: AdvisoryOrder[];
  totalWon: number;
  totalInvoiced: number;
  totalPaid: number;
  mismatches: AdvisoryMismatch[];
  uninvoicedStarted: AdvisoryOpportunity[]; // confirmed, started, zero invoices raised
  lastUpdated: string;
}

export interface ProgrammeGroup {
  name: string;
  type: 'advisory' | 'programmes';
  totalTarget: number;
  totalConfirmed: number;
  totalExpected: number;
  totalPotential: number;
  months: MonthlyData[];
}

// ─── Organisations ────────────────────────────────────────────────────────────

export interface OrganisationAccount {
  Id: string;
  Name: string;
  Advisory_Potential__c?: number | null;
  Advisory_Potential_Percent__c?: number | null;
  Programme_Potential__c?: number | null;
  Programme_Potential_Percent__c?: number | null;
}

export interface OrganisationSummary {
  accountId: string;
  name: string;
  sector: string;
  // Advisory income
  advisoryConfirmed: number;
  advisoryExpected: number;
  advisoryPipeline: number;
  // Advisory potential (from Account fields)
  advisoryPotential: number | null;
  advisoryPotentialPct: number | null;
  advisoryWeighted: number | null;       // potential × pct / 100
  // Programmes income
  programmesConfirmed: number;
  programmesExpected: number;
  programmesPipeline: number;
  // Programmes potential (from Account fields)
  programmePotential: number | null;
  programmePotentialPct: number | null;
  programmeWeighted: number | null;      // potential × pct / 100
  // Combined
  combinedConfirmed: number;
  combinedExpected: number;
  totalPotential: number | null;         // advisory + programme potential
  totalWeighted: number | null;          // advisory + programme weighted
}

export interface SectorSummary {
  sector: string;
  // Income
  advisoryConfirmed: number;
  advisoryExpected: number;
  programmeConfirmed: number;
  programmeExpected: number;
  combinedConfirmed: number;
  combinedExpected: number;
  // Potential
  advisoryPotential: number;
  advisoryWeighted: number;
  programmePotential: number;
  programmeWeighted: number;
  totalPotential: number;
  totalWeighted: number;
}

export interface OrganisationsData {
  organisations: OrganisationSummary[];
  sectors: SectorSummary[];
  lastUpdated: string;
}

// ─── Fellowship ─────────────────────────────────────────────────────────────

// Place products on a Fellowship opportunity. The sector split (and the "free"
// bursary count) is read off the product code on each line item, NOT the
// account's Organisation_Sector__c field.
//   FIFPPRIV → Private · FIFPPUB → Public · FIFPSOC → Social · FIFPFREE → Free
export interface FellowshipLineItem {
  Quantity: number | null;
  Product2?: { ProductCode: string | null; Name?: string | null };
}

export interface FellowshipOpportunity {
  Id: string;
  Name: string;
  Amount: number | null;
  StageName: string;            // Hopeful | Possible | Expecting | Confirmed (lost excluded)
  Probability: number | null;
  CloseDate: string | null;
  Total_Places__c: number | null;
  Organisation_Sector__c: string | null;
  Account?: { Id: string; Name: string; Owner?: { Name: string | null } }; // Owner = Partner Lead
  Programme__r?: { Name: string };
  OpportunityLineItems?: { records: FellowshipLineItem[] } | null;
}

// Lean shape for prior-cohort history — drives relationship classification + YoY.
export interface FellowshipHistoryOpp {
  Account?: { Id: string };
  Programme__r?: { Name: string };
  Amount: number | null;
  CloseDate: string | null;
  StageName: string;
}

// Derived from confirmed opps in prior cohorts (no Salesforce field needed):
//   sent-last-year → confirmed in the immediately-prior cohort
//   returning      → confirmed in an earlier cohort but not last year
//   new            → no confirmed Fellowship opp in any prior cohort
export type FellowshipRelationship = 'sent-last-year' | 'returning' | 'new';

export interface FellowshipData {
  cohortYear: number;            // e.g. 2026
  cohortNumber: number;          // year − 2014, e.g. 12
  opportunities: FellowshipOpportunity[];
  relationshipByAccount: Record<string, FellowshipRelationship>;
  // YoY confirmed: one series per cohort year, cumulative confirmed £ by calendar month (Jan–Dec)
  yoy: { year: number; label: string; monthly: number[] }[];
  lastUpdated: string;
}

export interface DashboardData {
  advisory: {
    ytdTarget: number;
    ytdConfirmed: number;
    variance: number;
    months: MonthlyData[];
  };
  programmes: {
    ytdTarget: number;
    ytdConfirmed: number;
    variance: number;
    months: MonthlyData[];
    breakdown: ProgrammeGroup[];
  };
  lastUpdated: string;
}
