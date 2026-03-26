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
