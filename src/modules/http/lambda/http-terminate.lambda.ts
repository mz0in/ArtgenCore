import { inject } from '@loopback/context';
import { IContext, Service } from '../../../app/container';
import { Lambda } from '../../lambda/decorator/lambda.decorator';
import { InputHandleDTO } from '../../lambda/dto/input-handle.dto';
import { ILambda } from '../../lambda/interface/lambda.interface';
import { WorkflowSession } from '../../workflow/library/workflow.session';
import { HttpTriggerConfig } from './http-trigger.lambda';

type IConfig = {
  statusCode: string;
};

@Service({
  tags: 'lambda',
})
@Lambda({
  type: 'terminate.http',
  icon: 'response.png',
  description: 'Formulate a HTTP response',
  handles: [new InputHandleDTO('response', null)],
  config: {
    type: 'object',
    properties: {
      statusCode: {
        title: 'Status Code',
        enum: ['200', '201', '400', '401', '404', '500'],
      },
    },
  },
})
export class HttpTerminateLambda implements ILambda {
  constructor(
    @inject.context()
    readonly ctx: IContext,
  ) {}

  async invoke(session: WorkflowSession) {
    const config = session.getConfig() as IConfig;
    const triggerId = session.initialTriggerId;

    // Change the
    (
      session.getContext().$nodes[triggerId].config as HttpTriggerConfig
    ).response = session.getInput('response') as string;

    (
      session.getContext().$nodes[triggerId].config as HttpTriggerConfig
    ).statusCode = parseInt(config.statusCode, 10);
  }
}