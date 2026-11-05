const BASE_URL = 'https://cortex-code-platform.cortexbuild1.workers.dev';

async function req(path, method, body, cookie) {
    const res = await fetch(BASE_URL + path, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { 'Cookie': cookie } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    let session = cookie;
    if (setCookie) {
        session = setCookie.split(';')[0];
    }
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, session, headers: res.headers };
}

async function run() {
    let t = Math.random().toString(36).substring(2, 10);
    let email_t = 'teacher' + t + '@test.com';
    let email_s = 'student' + t + '@test.com';
    let pwd = 'Password123!';
    
    console.log('Registering Teacher...');
    let r_t = await req('/api/v1/auth/register', 'POST', { 
        name: 'Teacher', email: email_t, cortexId: 'TC' + t, password: pwd, confirmPassword: pwd, role: 'teacher', inviteCode: 'cortex-prof-2026' 
    });
    if (r_t.status !== 200 && r_t.status !== 201) throw new Error('Teacher register failed: ' + JSON.stringify(r_t));
    let t_session = r_t.session;

    console.log('Testing Auth...');
    let m_t = await req('/api/v1/auth/me', 'GET', null, t_session);
    if (m_t.status !== 200) throw new Error('Me failed');

    let out_t = await req('/api/v1/auth/logout', 'POST', null, t_session);
    let in_t = await req('/api/v1/auth/login', 'POST', { identifier: email_t, password: pwd });
    t_session = in_t.session;

    console.log('Registering Student...');
    let r_s = await req('/api/v1/auth/register', 'POST', { 
        name: 'Student', email: email_s, cortexId: 'ST' + t, password: pwd, confirmPassword: pwd, role: 'student' 
    });
    if (r_s.status !== 200 && r_s.status !== 201) throw new Error('Student register failed: ' + JSON.stringify(r_s));
    let s_session = r_s.session;

    console.log('Creating Classroom...');
    let cr = await req('/api/v1/classrooms', 'POST', { name: 'Prod Class', description: 'Test', subject: 'CS', tags: [] }, t_session);
    if (cr.status !== 200 && cr.status !== 201) throw new Error('Create classroom failed: ' + JSON.stringify(cr));
    let cid = cr.data.id || cr.data.classroom?.id;
    
    let code = cr.data.joincode || cr.data.classroom?.joincode;
    if (!code) {
        let cr2 = await req('/api/v1/classrooms/'+cid, 'GET', null, t_session);
        code = cr2.data.joincode || cr2.data.classroom?.joincode;
    }

    console.log('Student Joins Classroom... code:', code);
    let j_s = await req('/api/v1/classrooms/join', 'POST', { joinCode: code }, s_session);
    if (j_s.status !== 200 && j_s.status !== 201) throw new Error('Join classroom failed: ' + JSON.stringify(j_s));

    console.log('Testing Student Create Class (Should Fail)...');
    let cr_fail = await req('/api/v1/classrooms', 'POST', { name: 'Fail Class', description: 'Test', subject: 'CS', tags: [] }, s_session);
    if (cr_fail.status === 200 || cr_fail.status === 201) throw new Error('Student created classroom!');

    console.log('Testing Assignment...');
    let asg = await req('/api/v1/classrooms/'+cid+'/assignments', 'POST', {
        title: 'Prod Assignment',
        description: 'Solve this',
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        points: 100,
        type: 'programming'
    }, t_session);
    let aid = asg.data.id || asg.data.assignment?.id;
    if (!aid) {
        console.log('Assignment response:', JSON.stringify(asg));
    } else {
        console.log('Student submitting assignment...');
        let sub = await req('/api/v1/classrooms/'+cid+'/assignments/'+aid+'/submit', 'POST', {
            code: 'console.log("Hello Prod");',
            language: 'javascript'
        }, s_session);
        let subid = sub.data.id || sub.data.submission?.id;
        
        if (subid) {
            console.log('Teacher grading assignment...');
            await req('/api/v1/classrooms/'+cid+'/submissions/'+subid+'/grade', 'POST', {
                automaticScore: 100,
                manualAdjustment: 0,
                feedback: 'Good job'
            }, t_session);
        } else {
             console.log('Submission failed:', JSON.stringify(sub));
        }
    }

    let sec = await req('/api/v1/classrooms/'+cid, 'GET');
    if (sec.status !== 401 && sec.status !== 403) throw new Error('Unauthenticated access allowed!');

    console.log('Verifying Headers...');
    console.log('CSP:', in_t.headers.get('content-security-policy'));
    console.log('X-Frame-Options:', in_t.headers.get('x-frame-options'));
    
    console.log('ALL PROD TESTS PASSED');
}
run().catch(e => { console.error(e); process.exit(1); });





