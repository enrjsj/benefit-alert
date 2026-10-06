export const searchRegions = ['전체','서울','경기','인천','부산','대구','대전','광주','울산','세종','강원','충북','충남','전북','전남','경북','경남','제주'];
export const searchCategories = ['전체','주거','취업','생활','가족','교육','건강','문화','기타'];
export function readSearchState(search: string) {
  const p = new URLSearchParams(search);
  const region = searchRegions.includes(p.get('region') || '') ? p.get('region')! : '전체';
  const rawDistrict = p.get('district') || '';
  const rawPage = Number(p.get('page'));
  return {
    q: (p.get('q') || '').slice(0, 200), region,
    district: region !== '전체' && rawDistrict.length <= 50 && /^[가-힣]+[시군구](?: [가-힣]+구)?$/.test(rawDistrict) ? rawDistrict : '',
    category: searchCategories.includes(p.get('category') || '') ? p.get('category')! : '전체',
    sort: ['default','deadline','title'].includes(p.get('sort') || '') ? p.get('sort')! : 'default',
    page: Number.isFinite(rawPage) ? Math.max(1, Math.min(10000, Math.floor(rawPage))) : 1,
    openOnly: p.get('openOnly') === 'true', savedOnly: p.get('view') === 'saved',
    detailId: (p.get('benefit') || '').slice(0, 100),
  };
}
