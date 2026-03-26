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
  Account?: { Name: string };
  Programme__r?: { Name: string };
}

// ─── Programmes ───────────────────────────────────────────────────────────────

export type ProgrammeType = 'all' | 'fellowship' | 'exchange' | 'ltd' | 'other';

export interface ProgrammeOpportunity {
  Id: string;
  Name: string;
  Amount: number | null;
  StageName: string;
  Probability: number | null;
  CloseDate: string | null;
  Total_Places__c: number | null;
  Organisation_Sector__c: string | null;
  Account?: { Name: string };
  Programme__r?: { Name: string };
}

export interface ProgrammesData {
  ytdConfirmed: number;
  ytdTarget: number;
  variance: number;
  months: MonthlyData[];                          // all types combined
  opportunities: ProgrammeOpportunity[];           // current FY, all types
  opportunitiesLY: ProgrammeOpportunity[];         // last FY confirmed, all types
  targetsByType: Record<ProgrammeType, Record<string, number>>; // monthDate → target
  lastUpdated: string;
}

// ─── Advisory ─────────────────────────────────────────────────────────────────

export interface AdvisoryData {
  ytdConfirmed: number;
  ytdTarget: number;
  ytdCosts: number;
  ytdMargin: number;
  variance: number;
  months: MonthlyData[];
  opportunities: AdvisoryOpportunity[];
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
