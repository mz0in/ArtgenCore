import { FileAddOutlined } from '@ant-design/icons';
import { Button, Input, Select, Statistic, Tabs } from 'antd';
import ErrorBoundary from 'antd/lib/alert/ErrorBoundary';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { v4 } from 'uuid';
import PageHeader from '../../admin/layout/page-header.component';
import PageWithHeader from '../../admin/layout/page-with-header.component';
import { useHttpClientOld } from '../../admin/library/http-client';
import { useHttpClient } from '../../admin/library/use-http-client';
import { toODataRoute } from '../../content/util/schema-url';
import { ISchema } from '../../schema';

export default function AnalyticsEditorComponent() {
  const [schema, setSchema] = useState<ISchema>(null);
  const [chartType, setChartType] = useState('counter');
  const [result, setResult] = useState(0);
  const client = useHttpClientOld();

  useEffect(() => {
    if (schema) {
      client
        .get<unknown[]>(
          toODataRoute({
            database: 'main',
            reference: schema.reference,
          }),
        )
        .then(r => setResult(r.data.length));
    } else {
      setResult(0);
    }
  }, [schema]);

  const [{ data, loading, error }] = useHttpClient<ISchema[]>(
    toODataRoute({
      database: 'main',
      reference: 'Schema',
    }),
  );

  if (!data) {
    return <h1>Loading...</h1>;
  }

  return (
    <ErrorBoundary>
      <PageWithHeader
        header={
          <PageHeader
            title="Analytics Wizard"
            actions={
              <Link key="save" to={`/admin/analytics/${v4()}/editor`}>
                <Button type="primary" icon={<FileAddOutlined />}>
                  Save
                </Button>
              </Link>
            }
          />
        }
      >
        <div className="content-box px-8 py-8" style={{ minHeight: 600 }}>
          <div className="flex">
            <div className="flex-grow">
              <Tabs size="large" tabPosition="left" defaultActiveKey="formula">
                <Tabs.TabPane key="appearance" tab="Appearance">
                  <Input
                    size="large"
                    placeholder="Product sold in the past week"
                  />
                </Tabs.TabPane>
                <Tabs.TabPane key="formula" tab="Formula">
                  <Select
                    className="w-96"
                    placeholder="Select data model"
                    onChange={v => setSchema(data.find(s => s.reference === v))}
                  >
                    {data.map(s => (
                      <Select.Option key={s.reference} value={s.reference}>
                        {s.title}
                      </Select.Option>
                    ))}
                  </Select>

                  <Select
                    placeholder="Choose X axis"
                    className="w-96 block my-4"
                  ></Select>
                  <Select
                    placeholder="Choose Y axis"
                    className="w-96 block"
                  ></Select>
                </Tabs.TabPane>
              </Tabs>
            </div>
            <div className="w-1/2 pl-8">
              {chartType === 'counter' ? (
                <Statistic title={`Count of ${schema?.title}`} value={result} />
              ) : undefined}
            </div>
          </div>
        </div>
      </PageWithHeader>
    </ErrorBoundary>
  );
}
