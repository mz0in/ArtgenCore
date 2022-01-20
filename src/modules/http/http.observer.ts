import { debounce, DebouncedFunc } from 'lodash';
import isEqual from 'lodash.isequal';
import { Inject } from '../../app/container';
import { toStructure } from '../database/library/structure/to-structure';
import { Observer, On } from '../event';
import { ISchema } from '../schema';
import { HttpService } from './service/http.service';

@Observer()
export class HttpObserver {
  protected __update: DebouncedFunc<() => Promise<void>>;

  constructor(
    @Inject(HttpService)
    readonly service: HttpService,
  ) {
    this.__update = debounce(() => this.service.updateUpstream(), 300);
  }

  @On('crud.main.Schema.created')
  async onSchemaCread() {
    this.__update();
  }

  @On('crud.main.Schema.deleted')
  async onSchemaDelete() {
    this.service.updateUpstream();
  }

  @On('crud.main.Schema.updated')
  async onSchemaUpdated(newSchema: ISchema, oldSchema: ISchema) {
    const newStruct = toStructure(newSchema);
    const oldStruct = toStructure(oldSchema);

    if (
      !isEqual(newStruct, oldStruct) ||
      !isEqual(newSchema.access, oldSchema.access)
    ) {
      this.__update();
    }
  }

  @On('crud.main.Page.*')
  async onPageChange() {
    this.__update();
  }

  @On('crud.main.Flow.*')
  async onFlowChange() {
    this.__update();
  }
}
