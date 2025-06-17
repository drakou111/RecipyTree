import { Recipe } from './Recipe';

export class RecipePath {
  steps: Recipe[] = [];

  prepend(r: Recipe) {
    this.steps.unshift(r);
  }
}
