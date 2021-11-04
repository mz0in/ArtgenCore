import { TableOutlined } from '@ant-design/icons';
import Form from '@rjsf/antd';
import { Button, message, Skeleton } from 'antd';
import { QueryBuilder } from 'odata-query-builder';
import { useEffect, useState } from 'react';
import { useHistory } from 'react-router';
import { useParams } from 'react-router-dom';
import PageHeader from '../../../management/backoffice/layout/PageHeader';
import PageWithHeader from '../../../management/backoffice/layout/PageWithHeader';
import { useHttpClientOld } from '../../../management/backoffice/library/http-client';
import { useHttpClient } from '../../../management/backoffice/library/use-http-client';
import { ISchema } from '../../schema';
import { CrudAction } from '../interface/crud-action.enum';
import { schemaToJsonSchema } from '../util/schema-to-jsonschema';
import { routeCrudAPI, routeCrudUI } from '../util/schema-url';

interface RouteParams {
  database: string;
  reference: string;
}

export default function CrudCreateComponent() {
  const history = useHistory();
  const httpClient = useHttpClientOld();

  const route = useParams<RouteParams>();
  const [formSchema, setFormSchema] = useState({});

  // Load schema
  const [{ data: schemas, loading: iSchemaLoading }] = useHttpClient<ISchema[]>(
    routeCrudAPI({ database: 'system', reference: 'Schema' }) +
      new QueryBuilder()
        .filter(f =>
          f
            .filterExpression('database', 'eq', route.database)
            .filterExpression('reference', 'eq', route.reference),
        )
        .top(1)
        .toQuery(),
  );

  useEffect(() => {
    if (schemas && schemas.length) {
      setFormSchema(schemaToJsonSchema(schemas[0], CrudAction.CREATE));
    }

    return () => {
      setFormSchema({});
    };
  }, [schemas]);

  const doCreate = async (form: any) => {
    console.log('Sending', form.formData);

    try {
      await httpClient.post<any>(routeCrudAPI(schemas[0]), form.formData);
      message.success(`New record created!`);

      history.push(routeCrudUI(schemas[0]));
    } catch (error) {
      message.error(`Error while creating the record!`);
      console.error(error);
    }
  };

  return (
    <Skeleton loading={iSchemaLoading}>
      <PageWithHeader
        header={
          <PageHeader
            title={`Create New ${schemas ? schemas[0].label : '~'}`}
            avatar={{
              icon: <TableOutlined />,
            }}
          />
        }
      >
        <div className="content-box px-24 py-12 w-2/3 mx-auto">
          <Form schema={formSchema} onSubmit={form => doCreate(form)}>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form>
        </div>
      </PageWithHeader>
    </Skeleton>
  );
}