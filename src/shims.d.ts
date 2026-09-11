// TypeScript 5.5+ changed Body.json() to return Promise<unknown>.
// Restore Promise<any> for compatibility with existing codebase.
interface Body {
  json(): Promise<any>;
}
