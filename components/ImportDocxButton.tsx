// ImportDocxButton.tsx
//
// This component demonstrates how to replace an existing "Import .docx" button
// with the new `DocxToTxtUpload` file picker component. It imports the
// client-side upload component and passes in the ID of the Google Drive folder
// where the resulting `.txt` files should be saved. Use this component
// wherever you previously rendered your "IMPORT .docx" button.

import DocxToTxtUpload from './DocxToTxtUpload';

interface ImportDocxButtonProps {
  /**
   * The Google Drive folder ID used when uploading converted documents.
   */
  folderId: string;
  /**
   * The user's OAuth access token for Google Drive API access.
   */
  accessToken: string;
}

export default function ImportDocxButton({ folderId, accessToken }: ImportDocxButtonProps) {
  return (
    <DocxToTxtUpload folderId={folderId} accessToken={accessToken} />
  );
}