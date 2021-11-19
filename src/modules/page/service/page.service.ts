import { readFile } from 'fs/promises';
import { join } from 'path';
import { ILogger, Inject, Logger, Service } from '../../../app/container';
import { ROOT_DIR } from '../../../app/globals';
import { SchemaService } from '../../schema/service/schema.service';
import { IPage } from '../interface/page.interface';

@Service()
export class PageService {
  protected isSeeded: boolean = false;

  constructor(
    @Logger()
    readonly logger: ILogger,
    @Inject(SchemaService)
    readonly schema: SchemaService,
  ) {}

  async loadRoutes(): Promise<IPage[]> {
    if (!this.isSeeded) {
      await this.seed();

      this.isSeeded = true;
    }

    const model = this.schema.model<IPage>('system', 'Page');
    const pages = await model.findAll({
      attributes: ['id', 'label', 'domain', 'path', 'tags'],
    });

    return pages.map(p => p.get({ plain: true }));
  }

  async getHtml(id: string): Promise<string> {
    const model = this.schema.model<IPage>('system', 'Page');
    const page: IPage = (await model.findByPk(id)).get({ plain: true });
    const html = `<html>
      <head>
        <title>${page.label}</title>
        <style>${page.content['gjs-css']}</style>
      </head>
      <body>${page.content['gjs-html']}</body>
    </html>`;

    return html;
  }

  async seed() {
    const model = this.schema.model('system', 'Page');

    // ALready exists
    if (await model.findByPk('1e1b9598-f8b8-4487-9b7b-166a363e8ce8')) {
      return;
    }

    const landing = await readFile(
      join(ROOT_DIR, 'storage/seed/page/landing.page.json'),
    );

    await model.create(JSON.parse(landing.toString()));
    this.logger.info('Pages seeded');
  }
}
