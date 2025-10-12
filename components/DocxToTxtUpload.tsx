// DocxToTxtUpload.tsx
//
// A client-side React component that allows users to select a `.docx` file
// from their local machine. The component extracts the raw text using the
// `mammoth` library directly in the browser and then calls a server action
// (`uploadTextToDrive`) to save the extracted text as a `.txt` file in the
// user’s Google Drive. This approach avoids sending large DOCX files
// (which may contain embedded images) across the network, improving
// responsiveness and reducing server load.

"use client";

import { useState } from 'react';
import mammoth from 'mammoth';
import { uploadTextToDrive } from '../lib/docx-conversion-actions';


interface DocxToTxtUploadProps {
  /**
   * The Google Drive folder ID where uploaded .txt files should be stored.
   */
  folderId: string;
  /**
   * The user's OAuth access token for Google Drive API access.
   */
  accessToken: string;
}

export default function DocxToTxtUpload({ folderId, accessToken }: DocxToTxtUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.docx')) {
      alert('Please upload a .docx file.');
      return;
    }

    try {
      setUploading(true);
      setStatus('Extracting text from document…');

      // Read the .docx file into an ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      // Extract the raw text in the browser
      const result = await mammoth.extractRawText({ arrayBuffer });
      const text = result.value;

      setStatus('Uploading to Google Drive…');

      // Derive a .txt file name from the original .docx file name
      const txtFileName = file.name.replace(/\.docx$/i, '.txt');

      // Call the server action to upload the extracted text
      const response = await uploadTextToDrive(text, txtFileName, folderId, accessToken);
      setStatus(`Upload complete! File ID: ${response.fileId}`);
      alert('Successfully uploaded to Google Drive!');
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('Upload failed. See console for details.');
      alert('Upload failed. Check console for details.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept=".docx"
        onChange={handleUpload}
        disabled={uploading}
      />
      {status && <div>{status}</div>}
    </div>
  );
}