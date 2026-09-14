import urllib.request
import urllib.error
import json
import time

try:
    req = urllib.request.Request('http://localhost:3000/api/v1/auth/register', data=json.dumps({'username': f't_{time.time()}', 'password': 'password', 'role': 'teacher'}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        print(response.read())
except urllib.error.HTTPError as e:
    print(e.read())
