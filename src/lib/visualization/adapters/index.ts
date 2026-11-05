/**
 * Cortex Universal Live Code Visualization Engine
 * Language Adapter Index & Auto-Registration
 */

import { registerAdapter } from '../registry';
import { pythonTracingAdapter } from './python-adapter';
import { javascriptTracingAdapter } from './javascript-adapter';
import { typescriptTracingAdapter } from './typescript-adapter';

// Auto-register verified adapters
registerAdapter(pythonTracingAdapter);
registerAdapter(javascriptTracingAdapter);
registerAdapter(typescriptTracingAdapter);

export { pythonTracingAdapter, javascriptTracingAdapter, typescriptTracingAdapter };
