'use client';

import { useState } from 'react';

export default function UploadTest() {
  const [status, setStatus] = useState('');

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setStatus('Uploading and processing...');

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    setStatus(JSON.stringify(data, null, 2));
  };

  return (
    <div className="max-w-xl mx-auto py-12">
      <form onSubmit={handleUpload} className="space-y-4">
        <input type="file" name="file" accept=".pdf" required />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-lg">
          Upload PDF
        </button>
      </form>
      <pre className="mt-4 text-sm bg-gray-100 p-4 rounded">{status}</pre>
    </div>
  );
}