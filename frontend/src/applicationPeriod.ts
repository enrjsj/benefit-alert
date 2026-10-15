import type { Benefit } from './benefit';
export const periodLabels = { dated: '날짜 마감', ongoing: '상시 신청', guidance: '별도 안내' } as const;
export type PeriodType = keyof typeof periodLabels;
export type PeriodFilter = 'all' | PeriodType;
export function periodType(benefit: Pick<Benefit,'deadline'|'periodLabel'|'periodType'>): PeriodType {
  if (benefit.deadline) return 'dated';
  if (benefit.periodType && Object.hasOwn(periodLabels, benefit.periodType)) return benefit.periodType;
  return ['상시','상시신청','상시접수','연중','연중신청','연중접수'].includes((benefit.periodLabel || '').replace(/[\s\u00a0]+/g,'')) ? 'ongoing' : 'guidance';
}
