/**
 * SQL Result Formatter
 * Formats relational columns and rows into formatted ASCII tables for terminal output.
 */

export function formatSqlResultsToAsciiTable(columns: string[], rows: any[][]): string {
  if (!columns || columns.length === 0) {
    return 'Query executed successfully with 0 columns returned.\n';
  }

  const colWidths = columns.map((col, idx) => {
    let max = col.length;
    for (const r of rows) {
      const val = r[idx] === null ? 'NULL' : String(r[idx]);
      if (val.length > max) max = val.length;
    }
    return Math.max(max, 3);
  });

  const divider = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';

  const header =
    '|' +
    columns
      .map((col, idx) => {
        const padding = ' '.repeat(colWidths[idx] - col.length);
        return ` ${col}${padding} `;
      })
      .join('|') +
    '|';

  const rowStrings = rows.map((r) => {
    return (
      '|' +
      columns
        .map((_, idx) => {
          const val = r[idx] === null ? 'NULL' : String(r[idx]);
          const padding = ' '.repeat(colWidths[idx] - val.length);
          return ` ${val}${padding} `;
        })
        .join('|') +
      '|'
    );
  });

  const rowCountStr = `(${rows.length} row${rows.length === 1 ? '' : 's'} affected)\n`;

  return [divider, header, divider, ...rowStrings, divider, rowCountStr].join('\n');
}
