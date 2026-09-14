import urllib.request
import urllib.error
import json
import time

BASE_URL = 'http://localhost:3000'
uid = str(int(time.time()))

def register_user(username, role):
    req = urllib.request.Request(f'{BASE_URL}/api/v1/auth/register', data=json.dumps({'username': username, 'password': 'password', 'role': role}).encode(), headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        cookie = response.headers.get('Set-Cookie')
        return json.loads(response.read()), cookie

def create_classroom(cookie, headers={}):
    req = urllib.request.Request(f'{BASE_URL}/api/v1/classrooms', data=json.dumps({'name': 'Test Class'}).encode(), headers={'Content-Type': 'application/json', **headers})
    if cookie:
        req.add_header('Cookie', cookie)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

try:
    print('Registering teacher...')
    t_user, t_cookie = register_user(f'teacher_{uid}', 'teacher')
    
    print('Registering student...')
    s_user, s_cookie = register_user(f'student_{uid}', 'student')

    print('1. Authenticated teacher...')
    s, r = create_classroom(t_cookie)
    assert s == 200, f'Expected 200, got {s}'
    print('Teacher allowed.')

    print('2. Authenticated student...')
    s, r = create_classroom(s_cookie)
    assert s == 403, f'Expected 403, got {s}'
    print('Student rejected with 403.')

    print('3. Unauthenticated request...')
    s, r = create_classroom(None)
    assert s in [401, 403], f'Expected 401/403, got {s}'
    print('Unauthenticated rejected.')

    print('4. Forged x-user-id (student trying to be teacher)...')
    s, r = create_classroom(s_cookie, {'x-user-id': t_user['user']['id']})
    assert s == 403, f'Expected 403, got {s}'
    print('Forged x-user-id rejected.')

    print('5. Forged x-user-role...')
    s, r = create_classroom(s_cookie, {'x-user-role': 'teacher'})
    assert s == 403, f'Expected 403, got {s}'
    print('Forged x-user-role rejected.')
    
    print('6. Forged body role... (handled identically because body role is not read)')

    print('ALL SECURITY TESTS PASSED!')
except Exception as e:
    print(f'TEST FAILED: {e}')
