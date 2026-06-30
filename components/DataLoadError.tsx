'use client';

import { useState } from 'react';

// Friendly, reassuring error state for when a live Salesforce fetch fails.
// Reassures (this is usually a brief blip, not data loss / not a breach),
// offers a one-click retry, and tucks the raw error behind a toggle for devs.
export default function DataLoadError({
  title = 'Live data is momentarily unavailable',
  error,
}: {
  title?: string;
  error?: string | null;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="fi-card border-l-4 border-[#dd6945]">
      <p className="font-bold text-[#212122] mb-1" style={{ fontFamily: 'Inria Serif, serif' }}>
        {title}
      </p>
      <p className="text-sm text-[#8a7a6a] font-[Geist] mb-4 max-w-xl">
        We couldn’t reach Salesforce just now — this is almost always a brief connection
        hiccup, not a problem with your data. Try again in a moment.
      </p>

      <div className="flex items-center gap-4">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-full bg-[#212122] text-[#fcf2e3] text-sm font-[Geist] hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
        {error && (
          <button
            onClick={() => setShowDetails(v => !v)}
            className="text-xs text-[#8a7a6a] font-[Geist] underline underline-offset-2 hover:text-[#212122]"
          >
            {showDetails ? 'Hide technical details' : 'Technical details'}
          </button>
        )}
      </div>

      {showDetails && error && (
        <pre className="text-xs text-[#8a7a6a] font-[Geist] whitespace-pre-wrap break-all bg-[#f5ebe0] rounded-lg p-3 mt-3">
          {error}
        </pre>
      )}
    </div>
  );
}
