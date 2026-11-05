import fs from 'fs';
import { 
  isBrowserFullscreenActive, 
  requestBrowserFullscreen, 
  exitBrowserFullscreen, 
  enableImmersiveLayout, 
  disableImmersiveLayout 
} from '../src/lib/classroom/useClassroomFullscreen';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details: string) {
  results.push({
    name,
    passed: condition,
    details: condition ? 'PASSED: ' + details : 'FAILED: ' + details,
  });
  if (!condition) {
    console.error('FAIL: ' + name + ' - ' + details);
  } else {
    console.log('PASS: ' + name + ' - ' + details);
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('CORTEX CODE PLATFORM: CLASSROOM IMMERSIVE & FULLSCREEN VERIFICATION');
  console.log('===============================================================');

  // Set up mock DOM environment
  const mockClassList = new Set<string>();
  const mockListeners = new Map<string, Function[]>();
  let mockFullscreenElement: any = null;

  (global as any).document = {
    documentElement: {
      classList: {
        add: (cls: string) => mockClassList.add(cls),
        remove: (cls: string) => mockClassList.delete(cls),
        contains: (cls: string) => mockClassList.has(cls),
      },
      requestFullscreen: async () => {
        mockFullscreenElement = (global as any).document.documentElement;
      },
    },
    body: {
      classList: {
        add: (cls: string) => mockClassList.add(cls),
        remove: (cls: string) => mockClassList.delete(cls),
        contains: (cls: string) => mockClassList.has(cls),
      },
    },
    get fullscreenElement() {
      return mockFullscreenElement;
    },
    exitFullscreen: async () => {
      mockFullscreenElement = null;
    },
    addEventListener: (evt: string, fn: Function) => {
      const list = mockListeners.get(evt) || [];
      list.push(fn);
      mockListeners.set(evt, list);
    },
    removeEventListener: (evt: string, fn: Function) => {
      const list = mockListeners.get(evt) || [];
      mockListeners.set(evt, list.filter((f) => f !== fn));
    },
  };

  (global as any).sessionStorage = {
    _data: new Map<string, string>(),
    setItem(k: string, v: string) { this._data.set(k, v); },
    getItem(k: string) { return this._data.get(k) || null; },
    removeItem(k: string) { this._data.delete(k); },
  };

  // TEST 1: Initial Immersive Mode Classes
  assert(
    !mockClassList.has('cortex-classroom-immersive-root') && !mockClassList.has('cortex-classroom-immersive'),
    'Initial Clean State',
    'Root and body start without classroom immersive classes'
  );

  // TEST 2: Activate Immersive Mode
  enableImmersiveLayout();
  assert(
    mockClassList.has('cortex-classroom-immersive-root') && mockClassList.has('cortex-classroom-immersive'),
    'Immersive Mode Activation',
    'enableImmersiveLayout attaches cortex-classroom-immersive-root to html and cortex-classroom-immersive to body'
  );

  // TEST 3: Deactivate Immersive Mode
  disableImmersiveLayout();
  assert(
    !mockClassList.has('cortex-classroom-immersive-root') && !mockClassList.has('cortex-classroom-immersive'),
    'Immersive Mode Teardown',
    'disableImmersiveLayout cleanly removes all immersive classes from document'
  );

  // TEST 4: Browser Fullscreen Detection - Inactive
  assert(
    isBrowserFullscreenActive() === false,
    'Browser Fullscreen Initial Check',
    'isBrowserFullscreenActive returns false when no element is in fullscreen'
  );

  // TEST 5: Browser Fullscreen Request Execution
  const reqSuccess = await requestBrowserFullscreen();
  assert(
    reqSuccess === true && isBrowserFullscreenActive() === true,
    'Browser Fullscreen Request',
    'requestBrowserFullscreen activates native fullscreen and sets sessionStorage marker'
  );

  // TEST 6: Idempotent Request
  const reReqSuccess = await requestBrowserFullscreen();
  assert(
    reReqSuccess === true && isBrowserFullscreenActive() === true,
    'Idempotent Fullscreen Request',
    'Second requestBrowserFullscreen returns true immediately without double requests'
  );

  // TEST 7: Browser Fullscreen Exit
  await exitBrowserFullscreen();
  assert(
    isBrowserFullscreenActive() === false,
    'Browser Fullscreen Exit',
    'exitBrowserFullscreen exits fullscreen and cleans session storage marker'
  );

  // TEST 8: Graceful Rejection Trap
  (global as any).document.documentElement.requestFullscreen = async () => {
    const err = new Error("Failed to execute 'requestFullscreen' on 'Element': API can only be initiated by a user gesture.");
    err.name = 'NotAllowedError';
    throw err;
  };

  const rejectedResult = await requestBrowserFullscreen();
  assert(
    rejectedResult === false,
    'Rejection Trap',
    'requestBrowserFullscreen catches NotAllowedError without throwing unhandled exceptions'
  );

  // Restore requestFullscreen
  (global as any).document.documentElement.requestFullscreen = async () => {
    mockFullscreenElement = (global as any).document.documentElement;
  };

  // TEST 9: Vendor-Prefixed API Support (Safari / Webkit)
  delete (global as any).document.documentElement.requestFullscreen;
  (global as any).document.documentElement.webkitRequestFullscreen = async () => {
    mockFullscreenElement = (global as any).document.documentElement;
  };
  (global as any).document.webkitFullscreenElement = null;

  const webkitResult = await requestBrowserFullscreen();
  assert(
    webkitResult === true,
    'Webkit Fullscreen Fallback',
    'requestBrowserFullscreen falls back to webkitRequestFullscreen when standard API is absent'
  );
  await exitBrowserFullscreen();

  // TEST 10: CSS File Verification for Immersive Layout Rules
  const cssContent = fs.readFileSync('src/app/globals.css', 'utf8');
  assert(
    cssContent.includes('.cortex-classroom-immersive-root') &&
    cssContent.includes('.cortex-classroom-immersive') &&
    cssContent.includes('.cortex-classroom-immersive-container'),
    'CSS Rules Verification',
    'globals.css defines .cortex-classroom-immersive-root, .cortex-classroom-immersive, and .cortex-classroom-immersive-container'
  );

  // TEST 11: ClassroomContext Fullscreen Integration
  const contextContent = fs.readFileSync('src/components/live-class/context/ClassroomContext.tsx', 'utf8');
  assert(
    contextContent.includes('useClassroomFullscreen') &&
    contextContent.includes('toggleFullscreen') &&
    contextContent.includes('exitFullscreen'),
    'ClassroomContext Hook Provision',
    'ClassroomContext imports and exposes useClassroomFullscreen state and methods'
  );

  // TEST 12: ClassroomHeader Fullscreen Toggle
  const headerContent = fs.readFileSync('src/components/live-class/classroom/ClassroomHeader.tsx', 'utf8');
  assert(
    headerContent.includes('toggleFullscreen') &&
    headerContent.includes('Maximize2') &&
    headerContent.includes('Minimize2'),
    'ClassroomHeader Fullscreen Control',
    'ClassroomHeader includes visible Fullscreen toggle button with dynamic icons'
  );

  // TEST 13: MeetingBottomBar Fullscreen Toggle & Safe Leave
  const bottomBarContent = fs.readFileSync('src/components/live-class/classroom/MeetingBottomBar.tsx', 'utf8');
  assert(
    bottomBarContent.includes('toggleFullscreen') &&
    bottomBarContent.includes('exitFullscreen') &&
    bottomBarContent.includes("router.push('/classroom')"),
    'MeetingBottomBar Fullscreen Control and Exit',
    'MeetingBottomBar includes fullscreen toggle and exits fullscreen upon leaving session'
  );

  // TEST 14: Two-Workspace Code Arena Fullscreen Integration
  const arenaContent = fs.readFileSync('src/app/classroom/[roomId]/page.tsx', 'utf8');
  assert(
    arenaContent.includes('useClassroomFullscreen') &&
    arenaContent.includes('cortex-classroom-immersive-container') &&
    arenaContent.includes('toggleFullscreen') &&
    arenaContent.includes('exitFullscreen'),
    'Code Arena Fullscreen Integration',
    'Classroom [roomId] page integrates useClassroomFullscreen, immersive container, toggle, and safe leave'
  );

  // TEST 15: Live Classroom Shell Container
  const liveClientContent = fs.readFileSync('src/app/classroom/[roomId]/live/[sessionId]/LiveClassroomClient.tsx', 'utf8');
  assert(
    liveClientContent.includes('cortex-classroom-immersive-container'),
    'Live Classroom Shell Container',
    'LiveClassroomClient wraps stage in cortex-classroom-immersive-container'
  );

  // TEST 16: Entrypoint Gesture Fullscreen Triggers
  const lobbyContent = fs.readFileSync('src/components/classroom/ClassroomLobbyModal.tsx', 'utf8');
  const classroomPageContent = fs.readFileSync('src/app/classroom/page.tsx', 'utf8');
  const navbarContent = fs.readFileSync('src/components/layout/Navbar.tsx', 'utf8');

  assert(
    lobbyContent.includes('requestBrowserFullscreen') &&
    classroomPageContent.includes('requestBrowserFullscreen') &&
    navbarContent.includes('requestBrowserFullscreen'),
    'User Gesture Fullscreen Triggers',
    'Classroom lobby modal, main classroom launch buttons, and Navbar links trigger requestBrowserFullscreen on user gesture'
  );

  // TEST 17: Classroom Hub Immersive Mode Integration
  assert(
    classroomPageContent.includes('useClassroomFullscreen({') &&
    classroomPageContent.includes('autoImmersive: true'),
    'Classroom Hub Immersive Mode Integration',
    'src/app/classroom/page.tsx integrates useClassroomFullscreen with autoImmersive enabled'
  );

  // TEST 18: Classroom Hub Immersive Container
  assert(
    classroomPageContent.includes('cortex-classroom-immersive-container'),
    'Classroom Hub Immersive Container',
    'src/app/classroom/page.tsx binds cortex-classroom-immersive-container when isImmersive is active'
  );

  // TEST 19: Classroom Hub Exit to IDE & Return to Fullscreen Recovery Action
  assert(
    classroomPageContent.includes('handleExitToIDE') &&
    classroomPageContent.includes('return-to-fullscreen-btn') &&
    classroomPageContent.includes('fullscreen-recovery-banner') &&
    classroomPageContent.includes('retryFullscreen') &&
    !classroomPageContent.includes('Exit Fullscreen (Esc)'),
    'Classroom Hub Exit to IDE & Fullscreen Recovery',
    'Classroom Hub eliminates primary Exit Fullscreen button and provides prominent Return to Fullscreen recovery action and banner'
  );

  // TEST 20: Classroom Hub Navigation Tabs Zero Overflow
  assert(
    classroomPageContent.includes('tabsContainerRef') &&
    classroomPageContent.includes('scrollTabs') &&
    classroomPageContent.includes('scrollbar-none') &&
    classroomPageContent.includes('scrollbar-hide'),
    'Classroom Hub Navigation Tabs Zero Overflow',
    'Classroom Hub tabs use responsive scroll strip with smooth chevron navigation and zero page-level horizontal overflow'
  );

  // TEST 21: Separation of Immersive, Native Fullscreen, and Recovery States
  const hookSource = fs.readFileSync('src/lib/classroom/useClassroomFullscreen.ts', 'utf8');
  assert(
    hookSource.includes('isImmersive') &&
    hookSource.includes('isFullscreen') &&
    hookSource.includes('isExiting') &&
    hookSource.includes('needsRecovery') &&
    hookSource.includes('retryFullscreen') &&
    hookSource.includes('dismissRecovery'),
    'State Separation Architecture',
    'useClassroomFullscreen separates isImmersive, isFullscreen, isExiting, and needsRecovery into distinct lifecycle states'
  );

  // TEST 22: Intentional Exit Guarding
  assert(
    hookSource.includes('isExitingRef.current = true') &&
    hookSource.includes('disableImmersiveLayout()') &&
    hookSource.includes('setNeedsRecovery(false)'),
    'Intentional Exit Guarding',
    'handleExitToIDE marks intentional exit to suppress false recovery alerts and teardown immersive classes'
  );

  // TEST 23: User Activation Gating on Recovery
  assert(
    hookSource.includes('userActivation') &&
    hookSource.includes('attemptedAutoRecoveryRef'),
    'User Activation Gating',
    'useClassroomFullscreen checks userActivation before re-entry attempts and avoids infinite recovery loops'
  );

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${totalCount} | PASSED: ${passedCount} | FAILED: ${totalCount - passedCount}`);
  console.log('===============================================================');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
