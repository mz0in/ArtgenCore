import { IEdge } from './edge.interface';
import { INode } from './node.interface';

export interface IFlow {
  /**
   * UUID generated when initialized
   */
  readonly id: string;

  /**
   * Human readable display name
   */
  name: string;

  /**
   * Contained nodes
   */
  nodes: INode[];

  /**
   * Edges between nodes
   */
  edges: IEdge[];
}