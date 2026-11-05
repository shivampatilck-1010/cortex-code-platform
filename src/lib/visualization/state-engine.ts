/**
 * Cortex Universal Live Code Visualization Engine
 * State Reconstruction Engine
 * 
 * Deterministically constructs execution state snapshots from recorded trace events,
 * provides forward/backward timeline navigation, and infers genuine data structure representations.
 */

import {
  TraceEvent,
  ExecutionStateSnapshot,
  VariableRecord,
  CallStackFrame,
  CollectionRecord,
  ExceptionRecord,
  StructureHint,
  ExecutionExplanation,
} from './types';

/**
 * Builds a deterministic state snapshot up to the specified step index.
 */
export function reconstructState(
  events: TraceEvent[],
  stepIndex: number
): ExecutionStateSnapshot {
  if (!events || events.length === 0) {
    const emptyEvent: TraceEvent = {
      id: 'empty',
      seq: 0,
      sessionId: 'empty',
      timestamp: Date.now(),
      type: 'program_start',
      file: 'main',
      line: 1,
    };
    return {
      stepIndex: 0,
      totalSteps: 0,
      currentEvent: emptyEvent,
      currentLine: 1,
      currentFile: 'main',
      variables: {},
      changedVariables: [],
      callStack: [],
      outputHistory: '',
      collections: {},
      structureVisualizations: [],
      explanation: {
        headline: 'Ready to Trace',
        detail: 'Run code or step forward to begin runtime analysis.',
        category: 'start',
      },
    };
  }

  const safeIndex = Math.max(0, Math.min(stepIndex, events.length - 1));
  const currentEvent = events[safeIndex];
  const previousEvent = safeIndex > 0 ? events[safeIndex - 1] : undefined;

  const variables: Record<string, VariableRecord> = {};
  const changedVariables: string[] = [];
  let callStack: CallStackFrame[] = [];
  let outputHistory = '';
  let activeException: ExceptionRecord | undefined = undefined;
  const collections: Record<string, CollectionRecord> = {};

  let currentLine = 1;
  let currentFile = currentEvent.file || 'main.py';
  let previousLine: number | undefined = undefined;

  for (let i = 0; i <= safeIndex; i++) {
    const ev = events[i];
    const isCurrentStep = i === safeIndex;

    // Track Line Position
    if (ev.line) {
      if (isCurrentStep) {
        previousLine = currentLine;
      }
      currentLine = ev.line;
      if (ev.file) currentFile = ev.file;
    }

    // Call Stack Handling
    if (ev.callStack && ev.callStack.length > 0) {
      callStack = [...ev.callStack];
    } else if (ev.type === 'function_call' && ev.call) {
      callStack.push({
        name: ev.call.functionName,
        file: ev.call.file || currentFile,
        line: ev.call.line || currentLine,
        scopeId: ev.scope?.id,
      });
    } else if (ev.type === 'function_return') {
      if (callStack.length > 0) {
        callStack.pop();
      }
    }

    // Keep top call stack frame line synchronized
    if (callStack.length > 0 && ev.line) {
      callStack[callStack.length - 1] = {
        ...callStack[callStack.length - 1],
        line: ev.line,
      };
    }

    // Variable State Tracking
    if (ev.type === 'variable_created' || ev.type === 'variable_changed') {
      if (ev.variable) {
        const varName = ev.variable.name;
        variables[varName] = { ...ev.variable };
        if (isCurrentStep) {
          changedVariables.push(varName);
        }
      }
    }

    // Scope Exit Variable Cleanup (if scope provided)
    if (ev.type === 'scope_exit' && ev.scope?.id) {
      const exitScopeId = ev.scope.id;
      for (const [vName, vRecord] of Object.entries(variables)) {
        if (vRecord.scopeId === exitScopeId) {
          delete variables[vName];
        }
      }
    }

    // Collection Tracking
    if (ev.type === 'collection_changed' && ev.collection) {
      collections[ev.collection.name] = { ...ev.collection };
    }

    // Output History
    if (ev.type === 'output' && ev.output) {
      outputHistory += ev.output.text;
    }

    // Exception Tracking
    if (ev.type === 'exception' && ev.exception) {
      activeException = { ...ev.exception };
    }
  }

  // Automatic Data Structure Inference
  const structureVisualizations = detectStructures(variables, callStack, collections);

  // Generate clear, contextual explanation of the current operation
  const explanation = getDetailedExplanation(currentEvent, previousEvent, variables, changedVariables);

  return {
    stepIndex: safeIndex,
    totalSteps: events.length,
    currentEvent,
    currentLine,
    currentFile,
    previousLine,
    variables,
    changedVariables,
    callStack,
    outputHistory,
    activeException,
    collections,
    structureVisualizations,
    explanation,
  };
}

/**
 * Automatically infers genuine structure representations from current variables and call stack.
 */
export function detectStructures(
  variables: Record<string, VariableRecord>,
  callStack: CallStackFrame[],
  collections: Record<string, CollectionRecord>
): StructureHint[] {
  const hints: StructureHint[] = [];

  // 1. Recursion Tree / Call Stack Depth
  if (callStack.length >= 2) {
    const funcCounts: Record<string, number> = {};
    for (const frame of callStack) {
      funcCounts[frame.name] = (funcCounts[frame.name] || 0) + 1;
    }
    const recursiveFunc = Object.entries(funcCounts).find(([_, count]) => count >= 2);
    if (recursiveFunc) {
      hints.push({
        category: 'recursion',
        label: `Recursion: ${recursiveFunc[0]} (Depth ${recursiveFunc[1]})`,
        data: {
          functionName: recursiveFunc[0],
          depth: recursiveFunc[1],
          frames: callStack.filter((f) => f.name === recursiveFunc[0]),
        },
      });
    }
  }

  // Look for any variable representing visited set/list for graph rendering
  let visitedSet: Set<string> | undefined = undefined;
  for (const [varName, varRecord] of Object.entries(variables)) {
    if (varName.toLowerCase().includes('visited')) {
      if (Array.isArray(varRecord.value)) {
        visitedSet = new Set(varRecord.value.map(String));
      } else if (typeof varRecord.value === 'object' && varRecord.value !== null) {
        visitedSet = new Set(Object.keys(varRecord.value).map(String));
      }
    }
  }

  for (const [name, variable] of Object.entries(variables)) {
    const lowerName = name.toLowerCase();

    // 2. Stacks & Queues vs Standard Arrays
    if (Array.isArray(variable.value)) {
      const isStack =
        lowerName.includes('stack') ||
        lowerName.includes('stk') ||
        collections[name]?.operation === 'pop';

      const isQueue =
        lowerName.includes('queue') ||
        lowerName === 'q' ||
        lowerName.includes('deque');

      if (isStack) {
        hints.push({
          category: 'stack',
          label: `Stack: ${name} (LIFO)`,
          data: {
            name,
            elements: variable.value,
            topIndex: variable.value.length - 1,
            topElement: variable.value[variable.value.length - 1],
            size: variable.value.length,
          },
        });
      } else if (isQueue) {
        hints.push({
          category: 'queue',
          label: `Queue: ${name} (FIFO)`,
          data: {
            name,
            elements: variable.value,
            frontElement: variable.value[0],
            backElement: variable.value[variable.value.length - 1],
            size: variable.value.length,
          },
        });
      } else {
        hints.push({
          category: 'array',
          label: `List: ${name} [${variable.value.length}]`,
          data: {
            name,
            elements: variable.value,
            length: variable.value.length,
            type: variable.type,
          },
        });
      }
    } else if (
      typeof variable.value === 'object' &&
      variable.value !== null &&
      !Array.isArray(variable.value)
    ) {
      const val = variable.value;

      // 3. Linked List Detection (object with value/val and next pointer)
      if (('val' in val || 'value' in val || 'data' in val) && 'next' in val) {
        const nodes: any[] = [];
        let curr: any = val;
        let depth = 0;
        const visited = new Set();
        while (curr && depth < 25) {
          if (visited.has(curr)) {
            nodes.push({ value: '[Cycle Detected]', isCycle: true });
            break;
          }
          visited.add(curr);
          nodes.push({
            id: `ll_node_${depth}`,
            value: curr.val ?? curr.value ?? curr.data,
            hasNext: Boolean(curr.next),
          });
          curr = curr.next;
          depth++;
        }
        hints.push({
          category: 'linked_list',
          label: `Linked List: ${name}`,
          data: {
            name,
            nodes,
            length: nodes.length,
          },
        });
      }
      // 4. Binary Tree Detection (object with value/val and left/right pointers)
      else if (
        ('val' in val || 'value' in val || 'data' in val) &&
        ('left' in val || 'right' in val)
      ) {
        const treeNodes: Array<{
          id: string;
          value: any;
          leftId?: string;
          rightId?: string;
          depth: number;
          x: number;
          y: number;
          path: string;
        }> = [];

        const treeLinks: Array<{
          from: string;
          to: string;
          label: 'L' | 'R';
        }> = [];

        const visitedTree = new Set();

        const buildTreeLayout = (node: any, depth: number, xMin: number, xMax: number, pathStr: string, parentId?: string, label?: 'L' | 'R'): string | undefined => {
          if (!node || depth > 6 || visitedTree.has(node)) return undefined;
          visitedTree.add(node);

          const nodeId = `tree_${pathStr || 'root'}`;
          const x = (xMin + xMax) / 2;
          const y = 45 + depth * 65;
          const nodeVal = node.val ?? node.value ?? node.data ?? '?';

          const leftId = node.left ? buildTreeLayout(node.left, depth + 1, xMin, x, pathStr ? `${pathStr}.L` : 'L', nodeId, 'L') : undefined;
          const rightId = node.right ? buildTreeLayout(node.right, depth + 1, x, xMax, pathStr ? `${pathStr}.R` : 'R', nodeId, 'R') : undefined;

          treeNodes.push({
            id: nodeId,
            value: nodeVal,
            leftId,
            rightId,
            depth,
            x,
            y,
            path: pathStr || 'root',
          });

          if (parentId && label) {
            treeLinks.push({ from: parentId, to: nodeId, label });
          }

          return nodeId;
        };

        buildTreeLayout(val, 0, 10, 90, '');

        hints.push({
          category: 'tree',
          label: `Binary Tree: ${name}`,
          data: {
            name,
            root: val,
            nodes: treeNodes,
            links: treeLinks,
            totalNodes: treeNodes.length,
          },
        });
      }
      // 5. Graph Detection (Adjacency list dictionary)
      else if (
        (lowerName.includes('graph') ||
          lowerName.includes('adj') ||
          lowerName.includes('edge')) &&
        Object.keys(val).length > 0 &&
        Object.values(val).some((v) => Array.isArray(v))
      ) {
        const vertices = Object.keys(val);
        const edges: Array<{ from: string; to: string }> = [];

        for (const [u, neighbors] of Object.entries(val)) {
          if (Array.isArray(neighbors)) {
            for (const v of neighbors) {
              edges.push({ from: String(u), to: String(v) });
            }
          }
        }

        hints.push({
          category: 'graph',
          label: `Graph: ${name} (${vertices.length} vertices)`,
          data: {
            name,
            vertices,
            edges,
            visited: visitedSet ? Array.from(visitedSet) : [],
          },
        });
      }
      // 6. Generic Object / Record (fallback for complex objects)
      else {
        const className = val._class || 'Object';
        const fields = Object.entries(val).filter(([k]) => !k.startsWith('_'));
        hints.push({
          category: 'object',
          label: `Object: ${name} (${className})`,
          data: {
            name,
            className,
            fields,
          },
        });
      }
    }
  }

  return hints;
}

/**
 * Returns a concise human-readable description for an execution event.
 */
export function getStepSummary(event: TraceEvent): string {
  switch (event.type) {
    case 'program_start':
      return `Program started (${event.file})`;
    case 'line_executed':
      return `Executed line ${event.line}`;
    case 'variable_created':
      return `Created ${event.variable?.name} = ${JSON.stringify(event.variable?.value)}`;
    case 'variable_changed':
      return `Updated ${event.variable?.name} = ${JSON.stringify(event.variable?.value)}`;
    case 'function_call':
      return `Called ${event.call?.functionName}(${Object.entries(event.call?.arguments || {})
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ')})`;
    case 'function_return':
      return `Returned from ${event.return?.functionName}: ${JSON.stringify(event.return?.returnValue)}`;
    case 'collection_changed':
      return `Collection ${event.collection?.name} ${event.collection?.operation}: ${JSON.stringify(event.collection?.value ?? event.collection?.elements)}`;
    case 'output':
      return `Output: ${event.output?.text.trim()}`;
    case 'exception':
      return `Exception [${event.exception?.type}]: ${event.exception?.message}`;
    case 'program_end':
      return 'Program execution finished';
    default:
      return `Step at line ${event.line}`;
  }
}

/**
 * Generates an educational, contextual explanation in simple language based on genuine recorded trace events.
 */
export function getDetailedExplanation(
  current: TraceEvent,
  previous?: TraceEvent,
  variables?: Record<string, VariableRecord>,
  changedVariables: string[] = []
): ExecutionExplanation {
  switch (current.type) {
    case 'program_start':
      return {
        headline: 'Program Start',
        detail: `Execution initiated in ${current.file || 'main program'}. Environment and runtime initialized.`,
        category: 'start',
        affectedLine: current.line,
      };

    case 'variable_created': {
      const v = current.variable;
      const vName = v?.name || 'variable';
      const valStr = typeof v?.value === 'object' && v?.value !== null ? JSON.stringify(v.value) : String(v?.value);
      return {
        headline: `Created Variable ${vName}`,
        detail: `Allocated memory for new ${v?.type || 'value'} ${vName} and assigned initial value ${valStr}.`,
        category: 'assignment',
        affectedVariable: vName,
        affectedLine: current.line,
        observedOperation: `${vName} = ${valStr}`,
      };
    }

    case 'variable_changed': {
      const v = current.variable;
      const vName = v?.name || 'variable';
      const valStr = typeof v?.value === 'object' && v?.value !== null ? JSON.stringify(v.value) : String(v?.value);
      const prevValStr = v?.previousValue !== undefined
        ? (typeof v.previousValue === 'object' && v.previousValue !== null ? JSON.stringify(v.previousValue) : String(v.previousValue))
        : undefined;

      return {
        headline: `Mutated Variable ${vName}`,
        detail: prevValStr !== undefined
          ? `Updated ${vName} from ${prevValStr} to ${valStr}.`
          : `Updated ${vName} to ${valStr}.`,
        category: 'assignment',
        affectedVariable: vName,
        affectedLine: current.line,
        observedOperation: prevValStr !== undefined ? `${vName}: ${prevValStr} -> ${valStr}` : `${vName} = ${valStr}`,
      };
    }

    case 'function_call': {
      const call = current.call;
      const fName = call?.functionName || 'function';
      const argsStr = Object.entries(call?.arguments || {})
        .map(([k, val]) => `${k}=${JSON.stringify(val)}`)
        .join(', ');

      return {
        headline: `Called Function ${fName}()`,
        detail: `Pushed new stack frame for ${fName} with arguments (${argsStr}). Execution jumps to line ${current.line}.`,
        category: 'call',
        affectedLine: current.line,
        observedOperation: `${fName}(${argsStr})`,
      };
    }

    case 'function_return': {
      const ret = current.return;
      const fName = ret?.functionName || 'function';
      const retValStr = JSON.stringify(ret?.returnValue);

      return {
        headline: `Returned from ${fName}()`,
        detail: `Function ${fName} concluded execution and returned ${retValStr}. Stack frame popped from memory.`,
        category: 'return',
        affectedLine: current.line,
        observedOperation: `return ${retValStr}`,
      };
    }

    case 'collection_changed': {
      const coll = current.collection;
      const cName = coll?.name || 'collection';
      const op = coll?.operation || 'mutation';
      return {
        headline: `Collection Mutation (${op})`,
        detail: `Applied ${op} operation to ${cName}. Resulting size: ${coll?.size ?? (coll?.elements ? coll.elements.length : 'updated')}.`,
        category: 'assignment',
        affectedVariable: cName,
        affectedLine: current.line,
        observedOperation: `${cName}.${op}()`,
      };
    }

    case 'output': {
      const txt = current.output?.text.trim() || '';
      return {
        headline: 'Standard Output Emitted',
        detail: `Program wrote to stdout: "${txt}".`,
        category: 'output',
        affectedLine: current.line,
        observedOperation: `print -> "${txt}"`,
      };
    }

    case 'exception': {
      const exc = current.exception;
      return {
        headline: `Runtime Error: ${exc?.type || 'Exception'}`,
        detail: exc?.message ? `Uncaught error halted execution: ${exc.message}` : 'Program raised an exception.',
        category: 'exception',
        affectedLine: current.line,
        observedOperation: `raise ${exc?.type}: ${exc?.message}`,
      };
    }

    case 'line_executed': {
      const changed = changedVariables.length > 0 ? ` (mutated ${changedVariables.join(', ')})` : '';
      return {
        headline: `Executed Line ${current.line}`,
        detail: `Program evaluated statement at line ${current.line}${changed}.`,
        category: 'loop',
        affectedLine: current.line,
        observedOperation: `line ${current.line}`,
      };
    }

    case 'program_end':
      return {
        headline: 'Execution Complete',
        detail: 'Program reached termination cleanly. All scopes and frames finalized.',
        category: 'end',
        affectedLine: current.line,
      };

    default:
      return {
        headline: `Step at Line ${current.line}`,
        detail: `Executed instruction at line ${current.line}.`,
        category: 'general',
        affectedLine: current.line,
      };
  }
}
