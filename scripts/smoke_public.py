"""Read-only public production smoke checks; no login, personal writes or collection triggers."""
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen
from zoneinfo import ZoneInfo


def run(base='https://benefit-alert.vercel.app'):
    queries = {
        'health': '/api/health',
        'all': '/api/benefits?size=12',
        'second_page': '/api/benefits?size=12&page=2',
        'gangnam': '/api/benefits?' + urlencode(dict(region='서울', district='강남구', size=100)),
        'seongnam': '/api/benefits?' + urlencode(dict(region='경기', district='성남시', page=2, size=12)),
        'yeongam': '/api/benefits?' + urlencode(dict(region='전남', district='영암군', size=100)),
        'open': '/api/benefits?openOnly=true&sort=deadline&size=100',
        'districts': '/api/regions/districts?' + urlencode(dict(region='경기')),
        'status': '/api/data-status',
        'report': '/api/data-report',
        'private': '/api/account/planning',
        'saved': '/api/benefits?savedOnly=true',
        'missing': '/api/benefits/smoke-definitely-missing-id',
    }
    def get(item):
        name,path=item
        try:
            response=urlopen(base+path,timeout=30)
        except HTTPError as error:
            response=error
        with response:
            return name,(response.status,dict(response.headers),json.load(response))
    with ThreadPoolExecutor(max_workers=3) as pool:
        result=dict(pool.map(get,queries.items()))
    for name,(code,_,_) in result.items():
        assert code == (401 if name in ('private','saved') else 404 if name=='missing' else 200),(name,code)
    data=lambda name:result[name][2]
    report=data('report');coverage=report['coverage']
    assert report['demo'] is False
    assert coverage['total']==coverage['nationwide']+coverage['regionKnown']+coverage['regionUnknown']
    assert 0<=coverage['districtKnown']<=coverage['regionKnown']
    assert 0<=coverage['deadlineKnown']<=coverage['total']
    assert len(report['history'])<=10
    assert all(set(r)=={'status','startedAt','finishedAt','fetchedCount','rejectedCount'} for r in report['history'])
    _,detail=get(('detail','/api/benefits/'+data('all')['items'][0]['id']))
    assert detail[0]==200 and detail[2]['sourceKind'] in ('gov24','manual') and detail[2]['updatedAt']

    assert data('health')['status']=='UP'
    assert data('all')['total']>0
    assert set(b['id'] for b in data('all')['items']).isdisjoint(b['id'] for b in data('second_page')['items'])
    for name,region,district in [('gangnam','서울','강남구'),('seongnam','경기','성남시'),('yeongam','전남','영암군')]:
        items=data(name)['items']
        assert items,(name,'empty')
        assert all(b['region']==region and (b.get('district')==district or b.get('district','').startswith(district+' ')) for b in items),name
    assert '성남시' in data('districts')
    today=datetime.now(ZoneInfo('Asia/Seoul')).date().isoformat()
    deadlines=[b['deadline'] for b in data('open')['items'] if b['deadline']]
    assert all(d>=today for d in deadlines)
    assert deadlines==sorted(deadlines)
    for name in ('private','saved','status','report'):
        headers={k.lower():v for k,v in result[name][1].items()}
        assert headers.get('cache-control')=='no-store',(name,headers.get('cache-control'))
    print(json.dumps({'checks':len(queries)+1,'total':data('all')['total'],'gangnam':data('gangnam')['total'],'seongnam':data('seongnam')['total'],'yeongam':data('yeongam')['total'],'status':'passed'},ensure_ascii=False))


if __name__=='__main__':
    run(sys.argv[1] if len(sys.argv)>1 else 'https://benefit-alert.vercel.app')
