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
  sourceUrl: string;
  sourceKind?: string | null;
  updatedAt?: string | null;
};
