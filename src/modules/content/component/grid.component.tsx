import {
  FileOutlined,
  FilterOutlined,
  ReloadOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { ColumnApi, GridApi } from 'ag-grid-community';
import 'ag-grid-community/dist/styles/ag-grid.css';
import 'ag-grid-community/dist/styles/ag-theme-balham-dark.css';
import { AgGridColumnProps, AgGridReact } from 'ag-grid-react';
import { Button, message } from 'antd';
import { debounce } from 'lodash';
import { QueryBuilder } from 'odata-query-builder';
import React, { useEffect, useState } from 'react';
import { RowLike } from '../../../app/interface/row-like.interface';
import { useHttpClientSimple } from '../../admin/library/http-client';
import { useHttpClient } from '../../admin/library/use-http-client';
import { FieldTag, FieldType, ISchema } from '../../schema';
import { FieldTool } from '../../schema/util/field-tools';
import { toRestRecordRoute, toRestRoute } from '../util/schema-url';
import ContentCreateComponent from './create.component';
import './grid.component.less';
import ContentUpdateComponent from './update.component';

type Props = {
  schema: ISchema;
};

export default function GridComponent({ schema }: Props) {
  const httpClient = useHttpClientSimple();

  // Extended views in drawer
  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [showEdit, setShowEdit] = useState<RowLike>(null);

  // Pagination
  const [perPage, setPerPage] = useState(25);

  // AG Grid API access
  const [gridApi, setGridApi] = useState<GridApi>(null);
  const [columnApi, setColumnApi] = useState<ColumnApi>(null);

  // Grid content state
  const [columns, setColumns] = useState<AgGridColumnProps[]>([]);
  const [rows, setRows] = useState<RowLike[]>(null);

  // Load initial content
  const [{ data: content, loading: isContentLoading }, __do_fetch] =
    useHttpClient<object[]>(
      toRestRoute(schema) + new QueryBuilder().top(perPage).toQuery(),
    );

  // Rebuild the request and fetch the new data
  const refetch = () => {
    const qb = new QueryBuilder();

    // Pagination limit
    qb.top(perPage);

    // Sorting
    for (const col of columnApi.getAllColumns()) {
      if (col.isSorting()) {
        qb.orderBy(`${col.getId()} ${col.getSort()}`);
      }
    }

    // Lock the view with loading
    gridApi.showLoadingOverlay();

    // Start the HTTP request
    __do_fetch({
      url: toRestRoute(schema) + qb.toQuery(),
    });
  };

  const rebuildMeta = () => {
    if (columnApi) {
      const originalMeta = schema.meta?.grid ?? {};

      const fieldOrder = columnApi
        .getAllGridColumns()
        .map((column, idx) => column.getId())
        .filter(id => id != '0');

      console.log('Order', fieldOrder);

      // Create a default if there is no meta
      if (!schema.meta?.grid) {
        schema.meta.grid = {};
      }

      schema.meta.grid.fieldOrder = fieldOrder;

      httpClient
        .patch(
          toRestRoute({
            database: 'main',
            reference: 'Schema',
          }) + `/${schema.database}/${schema.reference}`,
          schema,
        )
        .then(() => {
          message.success(`Grid's configuration has been saved!`);
        })
        .catch(e => {
          message.warn(`Could not save the grid configuration`);
          console.error(e);
        });
    }
  };

  const doDelete = async (record: RowLike) => {
    try {
      await httpClient.delete<any>(toRestRecordRoute(schema, record));

      message.warning(`Record deleted`);
      refetch();
    } catch (error) {
      message.error(`Error while deleting the record!`);
    }
  };

  // Unlock the loading screen when the content arrvies
  useEffect(() => {
    if (!isContentLoading) {
      if (gridApi) {
        gridApi.hideOverlay();
      }

      setRows(content);
    }
  }, [content]);

  useEffect(() => {
    const columnDef: AgGridColumnProps[] = [];

    for (const field of schema.fields) {
      let sortable = true;
      let resizable = true;
      let cellRenderer: AgGridColumnProps['cellRenderer'];
      let initialWidth: AgGridColumnProps['initialWidth'];
      let minWidth: AgGridColumnProps['minWidth'];
      let maxWidth: AgGridColumnProps['maxWidth'];
      const cellClass: AgGridColumnProps['cellClass'] = [];

      // UUID rendering
      if (field.type === FieldType.UUID) {
        cellRenderer = prop => {
          return prop.value ? prop.value.substring(0, 8) : 'null';
        };

        // Fixed with for the cut 8 char
        initialWidth = 100;
        minWidth = 100;
        maxWidth = 100;
        resizable = false;

        cellClass.push('text-green-500');
      }

      // Hightlight the primary fields
      if (FieldTool.isPrimary(field)) {
        cellClass.push('text-primary-500');
      }

      // Hightlight the unique fields
      if (field.tags.includes(FieldTag.UNIQUE)) {
        cellClass.push('text-yellow-500');
      }

      // JSON need special handling to not to crash the renderer
      if (field.type === FieldType.JSON || field.type === FieldType.JSONB) {
        // Some engine can't sort JSON
        sortable = false;
        resizable = false;

        // Reach cannot render JSON as object
        cellRenderer = params => {
          return `<code class="bg-midnight-600 p-0.5 rounded-md"
            >${
              params.value
                ? JSON.stringify(params.value).substring(0, 8)
                : 'null'
            }</code>`;
        };
      }

      if (field.tags.includes(FieldTag.TAGS)) {
        cellRenderer = params => (params.value ? params.value.join(',') : '-');
      }

      const fieldDef: AgGridColumnProps = {
        field: field.reference,
        headerName: field.title,
        resizable,
        initialWidth,
        minWidth,
        maxWidth,
        cellRenderer,
        sortable,
        cellClass,
      };

      columnDef.push(fieldDef);
    }

    // Has grid configuration
    if (schema.meta?.grid) {
      if (schema.meta.grid?.fieldOrder) {
        console.log('FieldOrder', schema.meta.grid?.fieldOrder);

        columnDef.sort((a, b) => {
          // Field has no ref?
          if (!a.field) {
            return 0;
          }

          const aIdx = schema.meta.grid.fieldOrder.findIndex(i => i == a.field);
          const bIdx = schema.meta.grid.fieldOrder.findIndex(i => i == b.field);

          return aIdx > bIdx ? 1 : -1;
        });
      }
    }

    // Pinned column at the end
    columnDef.push({
      headerName: 'Actions',
      field: null,
      width: 90,
      maxWidth: 90,
      sortable: false,
      resizable: false,
      suppressAutoSize: true,
      suppressSizeToFit: true,
      suppressMovable: true,
      filter: false,
      cellClass: ['text-center'],
      cellRenderer: () => {
        return '[D]';
      },
    });

    setColumns(columnDef);
  }, [schema]);

  const bouncedMeta = debounce(() => {
    rebuildMeta();
    console.log('Bounced');
  }, 1_000);

  return (
    <>
      <div className="flex flex-row-reverse">
        <Button.Group className="mb-2">
          <Button icon={<FileOutlined />} onClick={() => setShowCreate(true)}>
            New
          </Button>
          <Button icon={<FilterOutlined />}>Filter</Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Reload
          </Button>
          <Button icon={<RollbackOutlined />}>Reset</Button>
        </Button.Group>
      </div>

      <div className="ag-theme-balham-dark w-full" style={{ height: 600 }}>
        <AgGridReact
          reactUi={true}
          columnDefs={columns}
          rowData={rows}
          rowSelection="multiple"
          onGridReady={readyEvent => {
            readyEvent.api.sizeColumnsToFit();

            setColumnApi(readyEvent.columnApi);
            setGridApi(readyEvent.api);
          }}
          onSortChanged={sortChangedEvent => {
            refetch();
          }}
          onColumnMoved={colMovedEvent => {
            console.log(colMovedEvent, 'onColumnMoved');
            bouncedMeta();
          }}
          onRowDoubleClicked={dblClickEvent => {
            setShowEdit(dblClickEvent.data);
          }}
        />
      </div>

      {showCreate ? (
        <ContentCreateComponent
          schema={schema}
          onClose={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      ) : undefined}
      {showEdit ? (
        <ContentUpdateComponent
          content={showEdit}
          schema={schema}
          onClose={() => {
            setShowEdit(null);
            refetch();
          }}
        />
      ) : undefined}
    </>
  );
}
