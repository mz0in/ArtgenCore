import { Button, Divider, message } from 'antd';
import ErrorBoundary from 'antd/lib/alert/ErrorBoundary';
import { saveAs } from 'file-saver';
import { Dispatch, SetStateAction } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { nord } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { ISchema } from '../..';

export default function SchemaExportComponent({
  schema,
  setSchema,
}: {
  schema: Partial<ISchema>;
  setSchema: Dispatch<SetStateAction<Partial<ISchema>>>;
}) {
  const doDownload = () => {
    const fileName = `schema-${schema.database}-${schema.reference}.json`;
    const fileContent = new Blob([JSON.stringify(schema, null, 2)], {
      type: 'application/json',
    });

    saveAs(fileContent, fileName);
  };

  const doCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    message.success('Schema copied to Your clipboard!', 2);
  };

  return (
    <ErrorBoundary>
      <Button.Group className="w-full">
        <Button block type="primary" ghost onClick={doDownload}>
          Download as JSON
        </Button>
        <Button block type="primary" onClick={doCopy}>
          Copy to Clipboard
        </Button>
      </Button.Group>
      <Divider />

      <SyntaxHighlighter
        className="bg-midnight-800 rounded-sm"
        language="json"
        style={nord}
        showLineNumbers={true}
        selected
      >
        {JSON.stringify(schema, null, 2)}
      </SyntaxHighlighter>
    </ErrorBoundary>
  );
}
