import { Item } from "./Item";
import { Machine } from "./Machine";
import { Recipe } from "./Recipe";
import { RecipePath } from "./RecipePath";

export class CraftGraph {
    items: Item[] = [];
    machines: Machine[] = [];
    recipes: Recipe[] = [];

    async loadItems(url = import.meta.env.BASE_URL + '/items.json') {
        const list: { id: string; name: string; price: number; image: string }[] = await fetch(url).then(r => r.json());
        for (const ic of list) {
            this.items.push(new Item(ic.id, ic.name, ic.price, import.meta.env.BASE_URL + `/images/${ic.image}`));
        }
    }

    async loadMachines(url = import.meta.env.BASE_URL + '/machines.json') {
        type SlotConfig = { item: string; amount: number };
        type RecipeConfig = { id: string; inputs: SlotConfig[]; outputs: SlotConfig[] };
        type MachineConfig = { name: string; image: string; inputSlots: number; outputSlots: number; recipes: RecipeConfig[] };

        const cfgs: MachineConfig[] = await fetch(url).then(r => r.json());
        for (const mc of cfgs) {
            console.log(mc.image);
            const m = new Machine(mc.name, import.meta.env.BASE_URL + `/images/${mc.image}`, mc.inputSlots, mc.outputSlots);
            this.machines.push(m);

            for (const rc of mc.recipes) {
                const inputs = rc.inputs.map(s => [this.getItemById(s.item), s.amount] as [Item, number]);
                const outputs = rc.outputs.map(s => [this.getItemById(s.item), s.amount] as [Item, number]);
                const r = new Recipe(rc.id, m, inputs, outputs);
                this.recipes.push(r);
                m.recipes.push(r);
                inputs.forEach(([it]) => it.usedIn.push(r));
                outputs.forEach(([it]) => it.producedBy.push(r));
            }
        }
    }

    private getItemById(id: string): Item {
        const item = this.items.find(i => i.id === id);
        if (!item) throw new Error(`Item not found: ${id}`);
        return item;
    }

    computeRequirementsFromPath(path: RecipePath, target: Item, targetAmount: number): Map<Item, number> {
        const needed = new Map<Item, number>();
        const have = new Map<Item, number>();

        needed.set(target, targetAmount);
        const steps = [...path.steps].reverse();

        for (const recipe of steps) {
            for (const [outItem, produced] of recipe.outputs) {
                const amountNeeded = needed.get(outItem) || 0;
                if (amountNeeded === 0) continue;
                const times = amountNeeded / produced;
                needed.delete(outItem);
                have.set(outItem, (have.get(outItem) || 0) + amountNeeded);
                for (const [inItem, amt] of recipe.inputs) {
                    needed.set(inItem, (needed.get(inItem) || 0) + amt * times);
                }
            }
        }

        return needed;
    }

    findReachable(unlocked: Set<Machine>, starting: Set<Item>): Set<Item> {
        const reachable = new Set(starting);
        let changed: boolean;
        do {
            changed = false;
            for (const m of unlocked) {
                for (const r of m.recipes) {
                    if ([...r.inputs.keys()].every(i => reachable.has(i))) {
                        for (const out of r.outputs.keys()) {
                            if (!reachable.has(out)) {
                                reachable.add(out);
                                changed = true;
                            }
                        }
                    }
                }
            }
        } while (changed);
        return reachable;
    }

    findPathsToItem(target: Item, unlocked: Set<Machine>, starting: Set<Item>): RecipePath[] {
        const memo = new Map<Item, RecipePath[]>();
        return this._findPathsToItem(target, starting, unlocked, memo);
    }

    private _findPathsToItem(
        target: Item,
        starting: Set<Item>,
        unlocked: Set<Machine>,
        memo: Map<Item, RecipePath[]>
    ): RecipePath[] {
        if (starting.has(target)) return [new RecipePath()];
        if (memo.has(target)) return memo.get(target)!;
        const paths: RecipePath[] = [];

        for (const r of target.producedBy) {
            if (!unlocked.has(r.machine)) continue;
            const inputPathsMap = new Map<Item, RecipePath[]>();
            let allInputs = true;
            for (const inItem of r.inputs.keys()) {
                const inPaths = this._findPathsToItem(inItem, starting, unlocked, memo);
                if (inPaths.length === 0) { allInputs = false; break; }
                inputPathsMap.set(inItem, inPaths);
            }
            if (!allInputs) continue;
            const combos = this.crossProduct(Array.from(inputPathsMap.values()));
            for (const combo of combos) {
                const p = new RecipePath();
                combo.forEach(sub => p.steps.push(...sub.steps));
                p.steps.push(r);
                paths.push(p);
            }
        }

        memo.set(target, paths);
        return paths;
    }

    itemsFrom(source: Item, unlocked: Set<Machine>): Set<Item> {
        const visited = new Set<Item>();
        const queue: Item[] = [source];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            for (const recipe of current.usedIn) {
                if (!unlocked.has(recipe.machine)) continue;
                for (const [outItem] of recipe.outputs) {
                    if (!visited.has(outItem)) {
                        queue.push(outItem);
                    }
                }
            }
        }

        return visited;
    }

    private crossProduct<T>(lists: T[][]): T[][] {
        if (lists.length === 0) return [[]];
        const [first, ...rest] = lists;
        const restProd = this.crossProduct(rest);
        const result: T[][] = [];
        for (const f of first) {
            for (const r of restProd) result.push([f, ...r]);
        }
        return result;
    }

    computeDepths(): Map<Item, number> {
        const depth = new Map<Item, number>();
        for (const it of this.items.values()) depth.set(it, this.depthOf(it, new Set()));
        return depth;
    }

    private depthOf(item: Item, seen: Set<Item>): number {
        if (seen.has(item)) return 0;
        seen.add(item);
        let max = 0;
        for (const r of item.producedBy) {
            let d = 0;
            for (const inItem of r.inputs.keys()) {
                d = Math.max(d, this.depthOf(inItem, seen));
            }
            max = Math.max(max, d + 1);
        }
        return max;
    }
}
