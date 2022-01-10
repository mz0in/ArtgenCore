import { IFlow } from '../../flow/interface';
import { ISchema } from '../../schema';

export interface IBlueprint {
  /**
   * UUID
   */
  id: string;

  /**
   * Custom icon
   */
  icon?: string;

  /**
   * Display name
   */
  title: string;

  /**
   * SemVer
   */
  version: string;

  /**
   * Extension installed from
   */
  source: 'cloud' | 'offline';

  /**
   * Target database name
   */
  database: string;

  /**
   * KeyValue configurations
   */
  config: Record<string, string>;

  /**
   * Provided schemas
   */
  schemas: ISchema[];

  /**
   * Provided flows
   */
  flows: IFlow[];
}
