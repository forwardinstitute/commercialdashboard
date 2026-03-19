export interface ProgrammeFinanceRecord {
  Id: string;
  Name: string;
  Target_Amount__c: number;
  Confirmed__c: number;
  Expected__c: number;
  Potential__c: number;
  Recruitment_Target_Month__c: string;
  Month__c: number;
  Year__c: number;
  Type__c: string;
  Programme__r?: { Name: string };
}

export interface MonthlyData {
  month: string;
  monthDate: string;
  target: number;
  confirmed: number;
  expected: number;
  potential: number;
  isPast: boolean;
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
