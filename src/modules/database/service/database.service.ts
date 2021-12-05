import { Model } from 'objection';
import { Inject, Service } from '../../../app/container';
import { CollectionService } from '../../collection/service/collection.service';
import { IConnection } from '../interface';
import { IDatabase } from '../interface/database.interface';

type DatabaseModel = IDatabase & Model;

@Service()
export class DatabaseService {
  constructor(
    @Inject(CollectionService)
    readonly schemaService: CollectionService,
  ) {}

  /**
   * Synchronize a link's database into the database which stores the connections.
   */
  async synchronize(link: IConnection) {
    const model = this.schemaService.getModel<DatabaseModel>(
      'system',
      'Database',
    );

    let record = await model.query().findById(link.database.name);

    if (!record) {
      record = await model.query().insertAndFetch(link.database);
    } else {
      record = record.$set(link.database);

      await record.$query().update();
    }
  }

  /**
   * Fetch the newest schemas from the database, and use this opportunity to
   * ensure the local cache is up to date.
   */
  async findAll(): Promise<IDatabase[]> {
    return (
      await this.schemaService
        .getModel<DatabaseModel>('system', 'Database')
        .query()
    ).map(db => db.$toJson());
  }

  /**
   * Generates a database record based on the environment variables.
   * Database type is auto extracted from the DSN.
   */
  getSystem(): IDatabase {
    return {
      name: 'system',
      dsn: process.env.ARTGEN_DATABASE_DSN,
    };
  }
}
