"""Read-only direct/proxied API timing; no tokens, query text or response bodies logged."""
import argparse
import concurrent.futures
import json
import time
from urllib.request import urlopen
from urllib.error import HTTPError

TARGETS = {'direct': 'https://benefit-alert.onrender.com', 'proxy': 'https://benefit-alert.vercel.app'}
PATHS = {'health': '/api/health', 'list': '/api/benefits?size=12'}

def measure(target, endpoint, timeout):
    start = time.monotonic()
    result = {'target': target, 'endpoint': endpoint}
    try:
        try:
            response = urlopen(TARGETS[target] + PATHS[endpoint], timeout=timeout)
        except HTTPError as error:
            response = error
        with response:
            response.read()
            result.update(status=response.status, server_timing=response.headers.get('Server-Timing'), request_id=response.headers.get('X-Request-ID'))
    except Exception as error:
        result['error'] = type(error).__name__
    result['elapsed_ms'] = round((time.monotonic() - start) * 1000)
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--samples', type=int, choices=range(1, 6), default=2)
    parser.add_argument('--timeout', type=int, choices=range(1, 46), default=30)
    args = parser.parse_args()
    for sample in range(args.samples):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda pair: measure(*pair, args.timeout), [(t, e) for t in TARGETS for e in PATHS]))
        print(json.dumps({'sample': sample + 1, 'results': results}), flush=True)
    # A first sample is not necessarily cold. Match startup logs/request IDs before attributing delay.

if __name__ == '__main__':
    main()
