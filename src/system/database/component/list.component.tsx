import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { Avatar, Button, List, Popconfirm, Skeleton } from 'antd';
import { QueryBuilder } from 'odata-query-builder';
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { routeCrudAPI } from '../../../content/crud/util/schema-url';
import { breadcrumbsAtom } from '../../../management/backoffice/backoffice.atoms';
import PageHeader from '../../../management/backoffice/layout/PageHeader';
import PageWithHeader from '../../../management/backoffice/layout/PageWithHeader';
import { useHttpClient } from '../../../management/backoffice/library/use-http-client';
import { IDatabase } from '../interface';

export default function DatabaseListComponent() {
  const setBreadcrumb = useSetRecoilState(breadcrumbsAtom);

  const [{ data: databases, loading, error }] = useHttpClient<IDatabase[]>(
    routeCrudAPI({ database: 'system', reference: 'Database' }) +
      new QueryBuilder().top(100).toQuery(),
  );

  if (error) {
    return <h1>Error while loading the page</h1>;
  }

  useEffect(() => {
    setBreadcrumb(routes =>
      routes.concat({
        breadcrumbName: 'Database List',
        path: 'system/database',
      }),
    );

    return () => {
      setBreadcrumb(routes => routes.slice(0, routes.length - 1));
    };
  }, [location]);

  return (
    <PageWithHeader
      header={
        <PageHeader
          title="Database"
          subTitle="Manage database connections"
          avatar={{
            icon: <DatabaseOutlined />,
          }}
          actions={
            <>
              <Link key="create" to="/backoffice/system/database/add">
                <Button type="primary" icon={<FileAddOutlined />}>
                  Add Database
                </Button>
              </Link>
            </>
          }
        />
      }
    >
      <Skeleton loading={loading}>
        <List
          bordered
          size="large"
          dataSource={databases}
          renderItem={(db, k) => (
            <List.Item key={`db-${k}`}>
              <List.Item.Meta
                avatar={
                  <Avatar
                    shape="square"
                    size="large"
                    className="bg-dark"
                    icon={<DatabaseOutlined />}
                  />
                }
                title={<span className="text-xl font-thin">{db.name}</span>}
              />

              <Link
                to={`/backoffice/system/database/${db.name}/edit`}
                onClick={e => e.stopPropagation()}
              >
                <Button
                  icon={<EditOutlined />}
                  className="rounded-md mr-1 hover:text-green-500 hover:border-green-500"
                ></Button>
              </Link>
              <Popconfirm
                title="Are You sure to delete this workflow?"
                okText="Yes, delete"
                cancelText="No"
                placement="left"
                icon={<QuestionCircleOutlined />}
              >
                <Button
                  onClick={e => e.stopPropagation()}
                  icon={<DeleteOutlined />}
                  className="rounded-md hover:text-red-500 hover:border-red-500"
                ></Button>
              </Popconfirm>
            </List.Item>
          )}
        ></List>
      </Skeleton>
    </PageWithHeader>
  );
}
