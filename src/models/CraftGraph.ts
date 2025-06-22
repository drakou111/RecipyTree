import { Item } from "./Item";
import { Machine } from "./Machine";
import { Recipe } from "./Recipe";
import { RecipePath } from "./RecipePath";

export class CraftGraph {
    items: Item[] = [];
    machines: Machine[] = [];
    recipes: Recipe[] = [];

    private bestPathCache = new Map<string, RecipePath | null>();

    private makeKey(
        target: Item,
        unlocked: Set<Machine>,
        starting: Set<Item>,
        amount: number
    ): string {
        const uIds = Array.from(unlocked).map(m => m.name).sort().join(",");
        const sIds = Array.from(starting).map(i => i.id).sort().join(",");
        return `${target.id}|U:${uIds}|S:${sIds}|A:${amount}`;
    }

    async loadItems(url = import.meta.env.BASE_URL + '/items.json') {
        const list: { id: string; name: string; price: number; image: string; generator: boolean; container: boolean }[] = await fetch(url).then(r => r.json());
        for (const ic of list) {
            this.items.push(new Item(ic.id, ic.name, ic.price, import.meta.env.BASE_URL + `/images/${ic.image}`, ic.generator, ic.container));
        }
    }

    async loadMachines(url = import.meta.env.BASE_URL + '/machines.json') {
        type SlotConfig = { item: string; amount: number };
        type RecipeConfig = { id: string; inputs: SlotConfig[]; outputs: SlotConfig[] };
        type MachineConfig = { name: string; image: string; inputSlots: number; outputSlots: number; pullsItems: boolean, recipes: RecipeConfig[] };

        const cfgs: MachineConfig[] = await fetch(url).then(r => r.json());
        for (const mc of cfgs) {
            console.log(mc.image);
            const m = new Machine(mc.name, import.meta.env.BASE_URL + `/images/${mc.image}`, mc.pullsItems, mc.inputSlots, mc.outputSlots);
            this.machines.push(m);

            for (const rc of mc.recipes) {
                const inputs = this.mergeSlots(rc.inputs);
                const outputs = this.mergeSlots(rc.outputs);
                const r = new Recipe(rc.id, m, inputs, outputs);
                this.recipes.push(r);
                m.recipes.push(r);
                inputs.forEach(([it]) => it.usedIn.push(r));
                outputs.forEach(([it]) => it.producedBy.push(r));
            }
        }
    }

    mergeSlots(slots: { item: string; amount: number }[]): [Item, number][] {
        const merged = new Map<Item, number>();
        for (const s of slots) {
            const item = this.getItemById(s.item);
            merged.set(item, (merged.get(item) || 0) + s.amount);
        }
        return Array.from(merged.entries());
    }

    private getItemById(id: string): Item {
        const item = this.items.find(i => i.id === id);
        if (!item) throw new Error(`Item not found: ${id}`);
        return item;
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

    findBestPathToItem(
        target: Item,
        unlocked: Set<Machine>,
        starting: Set<Item>,
        amount: number = 1,
        memo: Map<string, RecipePath | null> = new Map()
    ): RecipePath | null {
        const key = this.makeKey(target, unlocked, starting, amount);
        if (memo.has(key) || this.bestPathCache.has(key)) {
            return memo.get(key) ?? this.bestPathCache.get(key)!;
        }

        const result = this._findBestPathToItem(target, starting, unlocked, amount, memo);
        memo.set(key, result);
        this.bestPathCache.set(key, result);
        return result;
    }

    private _findBestPathToItem(
        target: Item,
        starting: Set<Item>,
        unlocked: Set<Machine>,
        amount: number,
        memo: Map<string, RecipePath | null>
    ): RecipePath | null {
        if (starting.has(target)) return new RecipePath();

        let bestPerUnit: RecipePath | null = null;
        let bestRecipe: Recipe | null = null;

        const uniqueRecipes = Array.from(new Set(target.producedBy.map(r => r.id)))
            .map(id => target.producedBy.find(r => r.id === id)!);

        for (const recipe of uniqueRecipes) {
            if (!unlocked.has(recipe.machine)) continue;

            const candidate = new RecipePath();
            let ok = true;

            for (const [inItem, inQty] of recipe.inputs) {
                const sub = this.findBestPathToItem(inItem, unlocked, starting, inQty, memo);
                if (!sub) { ok = false; break; }
                candidate.merge(sub);
            }

            if (!ok) continue;

            // Add this recipe once (per unit basis)
            candidate.add(recipe, 1);

            if (!bestPerUnit || candidate.totalSteps() < bestPerUnit.totalSteps()) {
                bestPerUnit = candidate;
                bestRecipe = recipe;
            }
        }

        if (!bestPerUnit || !bestRecipe) return null;

        // Now compute how many times to run the chosen recipe
        const outputQty = bestRecipe.outputs.get(target) ?? 1;
        const runs = amount / outputQty;

        const scaled = bestPerUnit.clone().scale(runs);
        return scaled;
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

    computeDepths(
        startingItems: Set<Item>,
        unlockedMachines: Set<Machine>
    ): Map<Item, number> {
        const depth = new Map<Item, number>();
        for (const it of this.items.values()) {
            depth.set(it, this.depthOf(it, new Set(), startingItems, unlockedMachines));
        }
        return depth;
    }

    private depthOf(
        item: Item,
        seen: Set<Item>,
        startingItems: Set<Item>,
        unlockedMachines: Set<Machine>
    ): number {
        // anything we already have is depth 0
        if (startingItems.has(item)) return 0;

        // break cycles
        if (seen.has(item)) return 0;
        const newSeen = new Set(seen);
        newSeen.add(item);

        let max = 0;
        for (const r of item.producedBy) {
            if (!unlockedMachines.has(r.machine)) continue;

            let d = 0;
            for (const inItem of r.inputs.keys()) {
                d = Math.max(
                    d,
                    this.depthOf(inItem, newSeen, startingItems, unlockedMachines)
                );
            }
            max = Math.max(max, d + 1);
        }

        return max;
    }

    estimateArea(
        path: RecipePath,
        starting: Set<Item>
    ): {machineSlots: number, generatorSlots: number, generatorOptimisationSlots: number, total: number } {
        // 2) Machine slot cost (as before)
        const machineSlots = path.steps.reduce((sum, { recipe, count }) => {
            let slots = 1;
            if (recipe.machine.pullsItems) {
                slots += recipe.inputs.size;
            }
            console.log("ADDED " + slots + " FROM " + recipe.machine.name)
            console.log("NOW AT " + (sum + Math.ceil(slots * count)))
            return sum + Math.ceil(slots * Math.ceil(count));
        }, 0);

        // 3) Generator slot cost: for each “root” item, we need 5× as many slots
        let generatorSlots = 0;
        let generatorOptimisationSlots = 0;
        for (const { recipe, count } of path.steps) {
            let sum = 0;
            for (const [item, c] of recipe.inputs) {
                if (starting.has(item)) {
                    let amount = c;
                    if (item.generator && !item.container)
                        amount *= 5
                    if (amount > 0 && recipe.machine.pullsItems)
                        generatorOptimisationSlots++;
                    sum += Math.ceil(count * amount);
                }
            }
            generatorSlots += Math.ceil(sum);
        }
        return {machineSlots: machineSlots, generatorSlots: generatorSlots, generatorOptimisationSlots: generatorOptimisationSlots, total: (machineSlots + generatorSlots - generatorOptimisationSlots) }
    }

}
