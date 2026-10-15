export type Benefit = {
  id: string;
  title: string;
  organization: string;
  region: string;
  district?: string;
  category: string;
  summary: string;
  eligibility: string;
  support: string;
  applicationMethod: string;
  deadline: string | null;
  periodLabel: string;
  periodType?: 'dated' | 'ongoing' | 'guidance';
  sourceUrl: string;
  sourceKind?: string | null;
  updatedAt?: string | null;
};
