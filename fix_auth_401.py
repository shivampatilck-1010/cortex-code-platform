"""
Fix: Routes calling getCurrentUser directly without null protection will 500 on unauth.
Pattern: Routes that call getCurrentUser without a preceding verifyAccess need explicit 401 guard.
The safest fix is to add a null guard wrapper at the beginning of the auth catch block.
"""
import os, re

# These are routes where getCurrentUser is called DIRECTLY (not after verifyAccess)
# and the failure manifests as a 500 instead of 401. We fix by catching the specific
# auth error and returning 401.
routes_to_fix = [
    r'src/app/api/v1/arena/run/route.ts',
    r'src/app/api/v1/arena/submit/route.ts',
    r'src/app/api/v1/arena/workspace/route.ts',
    r'src/app/api/v1/auth/me/dashboard/route.ts',
    r'src/app/api/v1/benchmark/run/route.ts',
    r'src/app/api/v1/benchmark/workspace/route.ts',
    r'src/app/api/v1/notifications/route.ts',
]

# For these routes, add a try/catch that catches the auth error and returns 401
# The pattern is to change the generic err catch to check for auth errors
AUTH_ERROR_CATCH = '''  } catch (err: any) {
    if (err?.message?.includes('Authentication required')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}'''

GENERIC_CATCH = '''  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}'''

GENERIC_CATCH2 = '''  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed'''

fixed = 0
skipped = 0

for path in routes_to_fix:
    if not os.path.exists(path):
        print(f'  SKIP (not found): {path}')
        skipped += 1
        continue
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'Authentication required' in content and 'status: 401' in content:
        print(f'  SKIP (already fixed): {path}')
        skipped += 1
        continue

    # Replace all catch blocks to properly return 401 for auth errors
    new_content = re.sub(
        r'\} catch \(err: any\) \{\s*\n\s*return NextResponse\.json\(\{ error: err\?\.message \|\| [^}]+\}, \{ status: 500 \}\);\s*\n\s*\}',
        lambda m: m.group(0).replace(
            '} catch (err: any) {',
            '} catch (err: any) {\n    if (err?.message?.includes(\'Authentication required\')) {\n      return NextResponse.json({ error: \'Authentication required\' }, { status: 401 });\n    }'
        ),
        content
    )
    
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'  PATCHED: {path}')
        fixed += 1
    else:
        # Try simpler substring approach
        # Find all error catches and inject auth check
        if 'getCurrentUser' in content:
            new_c = content.replace(
                '  } catch (err: any) {\n    return NextResponse.json({ error: err?.message ||',
                '  } catch (err: any) {\n    if (err?.message?.includes(\'Authentication required\')) {\n      return NextResponse.json({ error: \'Authentication required\' }, { status: 401 });\n    }\n    return NextResponse.json({ error: err?.message ||',
            )
            if new_c != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_c)
                print(f'  PATCHED (v2): {path}')
                fixed += 1
            else:
                print(f'  WARN - could not patch: {path}')
                skipped += 1
        else:
            skipped += 1

print(f'\nDone. Fixed: {fixed}, Skipped: {skipped}')
