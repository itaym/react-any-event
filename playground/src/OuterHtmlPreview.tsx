import React, { useEffect, useRef, useState } from 'react';

// Renders the live outerHTML of a target element, refreshed on every
// childList/attribute mutation, so the wrapper markup <AnyEvent>/useAnyEvent
// actually produces is visible without opening devtools.
export default function OuterHtmlPreview({ targetId }: { targetId: string }) {
  const [html, setHtml] = useState('');
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }
    const update = () => setHtml(target.outerHTML);
    update();
    observerRef.current = new MutationObserver(update);
    observerRef.current.observe(target, { attributes: true, childList: true, subtree: true });
    return () => observerRef.current?.disconnect();
  });

  return <code className="preview">{html}</code>;
}
