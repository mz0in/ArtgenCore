import { Module } from '../../app/container';
import { moduleRef } from '../../app/container/module-ref';
import { SchemaModule } from '../schema/schema.module';
import { RestCreateLambda } from './lambda/rest-create.lambda';
import { RestFindLambda } from './lambda/rest-find.lambda';
import { RestListLambda } from './lambda/rest-list.lambda';
import { RestReadLambda } from './lambda/rest-read.lambda';
import { RestUpdateLambda } from './lambda/rest-update.lambda';
import { RestGateway } from './rest.gateway';
import { OpenApiService } from './service/openapi.service';
import { RestService } from './service/rest.service';

@Module({
  imports: [moduleRef(() => SchemaModule)],
  providers: [
    RestService,
    OpenApiService,
    RestGateway,
    RestCreateLambda,
    RestReadLambda,
    RestUpdateLambda,
    RestFindLambda,
    RestListLambda,
  ],
})
export class RestModule {}
