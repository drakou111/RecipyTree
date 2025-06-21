import { Recipe } from './Recipe';

/**
 * Represents a sequence of recipes with quantities needed to build a target item.
 */
export class RecipePath {
  steps: Array<{ recipe: Recipe; count: number }> = [];

  add(recipe: Recipe, count: number = 1) {
    const existing = this.steps.find(e => e.recipe.id === recipe.id);
    if (existing) {
      existing.count += count;
    } else {
      this.steps.push({ recipe, count });
    }
  }

  prepend(recipe: Recipe, count: number = 1) {
    const existing = this.steps.find(e => e.recipe.id === recipe.id);
    if (existing) {
      existing.count += count;
    } else {
      this.steps.unshift({ recipe, count });
    }
  }

  totalSteps(): number {
    return this.steps.reduce((sum, e) => sum + e.count, 0);
  }

  merge(other: RecipePath) {
    other.steps.forEach(e => this.add(e.recipe, e.count));
  }

  clone(): RecipePath {
    const copy = new RecipePath();
    this.steps.forEach(e => copy.steps.push({ recipe: e.recipe, count: e.count }));
    return copy;
  }

  scale(factor: number): RecipePath {
    this.steps.forEach(e => {
      e.count *= factor;
    });
    return this;
  }
}
