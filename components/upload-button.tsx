'use client';

import { useRef, useState } from 'react';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Status = { kind: 'idle' | 'working' | 'success' | 'error'; text: string };

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle', text: '' });

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: 'error', text: 'File is too large (max 10 MB).' });
      return;
    }

    setStatus({ kind: 'working', text: `Indexing ${file.name}…` });

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus({ kind: 'error', text: data?.error ?? 'Upload failed. Please try again.' });
        return;
      }
      setStatus({ kind: 'success', text: `${data.fileName} is ready to chat with.` });
    } catch {
      setStatus({ kind: 'error', text: 'Upload failed. Check your connection and try again.' });
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        disabled={status.kind === 'working'}
        onClick={() => inputRef.current?.click()}
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
      >
        {status.kind === 'working' ? 'Uploading…' : 'Upload PDF'}
      </button>
      {status.text && (
        <p
          role="status"
          className={`mt-2 text-xs break-words ${
            status.kind === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
