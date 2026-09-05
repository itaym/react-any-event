import React from 'react';

// Renders the last few entries of a running log, newest first, so firing
// events is visible without opening devtools.
export default function EventLog({ entries }: { entries: string[] }) {
  return (
    <code className="preview">
      {entries.length === 0 ? '(no events yet)' : entries.slice().reverse().join('\n')}
    </code>
  );
}
