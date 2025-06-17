import { Item } from './Item';
import { Machine } from './Machine';

export class Recipe {
  id: string;
  machine: Machine;
  inputs: Map<Item, number>;
  outputs: Map<Item, number>;

  constructor(
    id: string,
    machine: Machine,
    inputs: [Item, number][],
    outputs: [Item, number][]
  ) {
    this.id = id;
    this.machine = machine;
    this.inputs = new Map(inputs);
    this.outputs = new Map(outputs);
  }
}
