import json
with open('wrangler.jsonc', 'r') as f:
    data = json.load(f)
if 'r2_buckets' in data and type(data['r2_buckets']) == str:
    del data['r2_buckets']
data['r2_buckets'] = [{'binding': 'ASSETS_BUCKET', 'bucket_name': 'cortex-assets'}]
data['queues'] = {'producers': [{'queue': 'cortex-queue', 'binding': 'CORTEX_QUEUE'}], 'consumers': [{'queue': 'cortex-queue', 'max_batch_size': 1, 'max_batch_timeout': 1}]}
with open('wrangler.jsonc', 'w') as f:
    json.dump(data, f, indent=2)
