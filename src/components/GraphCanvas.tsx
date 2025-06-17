import React, { useEffect, useRef, useState } from "react";
import { CraftGraph } from "../models/CraftGraph";
import { Item } from "../models/Item";
import { Machine } from "../models/Machine";
import { RecipePath } from "../models/RecipePath";
import "./GraphCanvas.css";

export type GraphCanvasProps = {
    graph: CraftGraph;
    width: number;
    height: number;
    unlocked: Set<string>;
    starting: Set<string>;
    // Optional: target amount per click (defaults to 1)
    targetAmount?: number;
};

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
    graph,
    width,
    height,
    unlocked,
    starting,
    targetAmount = 1,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [hasMoved, setHasMoved] = useState(false);
    const itemPosRef = useRef<Map<Item, { x: number; y: number }>>(new Map());

    const allItems = Array.from(graph.items.values());
    const allRecipes = Array.from(graph.recipes.values());

    const unlockedMachines = new Set(
        Array.from(graph.machines.values()).filter((m) => unlocked.has(m.name))
    );
    const startingItems = new Set(
        Array.from(graph.items.values()).filter((i) => starting.has(i.id))
    );
    const reachableItems = graph.findReachable(unlockedMachines, startingItems);

    // Compute all paths and pick the shortest
    const allPaths = selectedItem
        ? graph.findPathsToItem(selectedItem, unlockedMachines, startingItems)
        : [];
    const bestPath: RecipePath | null = allPaths.length > 0
        ? allPaths.reduce((shortest, path) =>
            path.steps.length < shortest.steps.length ? path : shortest,
            allPaths[0]
        )
        : null;
    const allItemsFrom = selectedItem ? graph.itemsFrom(selectedItem, unlockedMachines) : [];
    

    // Compute requirements map for bestPath
    const requirements: Map<Item, number> = bestPath && selectedItem ? graph.computeRequirementsFromPath(bestPath, selectedItem, targetAmount) : new Map();
    if (selectedItem) {
        requirements.set(selectedItem, (requirements.get(selectedItem) || 0) + targetAmount);
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(scale, 0, 0, scale, offset.x, offset.y);
        ctx.clearRect(
            -offset.x / scale,
            -offset.y / scale,
            canvas.width / scale,
            canvas.height / scale
        );
        ctx.imageSmoothingEnabled = false;

        // Layout items
        const depthMap = graph.computeDepths();
        const depths = Array.from(new Set(depthMap.values())).sort((a, b) => a - b);
        const itemsByDepth = new Map<number, Item[]>();
        depths.forEach((d) => itemsByDepth.set(d, []));
        for (const [item, depth] of depthMap.entries()) {
            itemsByDepth.get(depth)!.push(item);
        }
        const colW = 150, rowH = 100;
        itemPosRef.current.clear();
        depths.forEach((d, i) => {
            itemsByDepth.get(d)!.forEach((item, j) => {
                itemPosRef.current.set(item, { x: i * colW, y: j * rowH });
            });
        });

        // Prepare templates
        const itemTemplate = document.createElement("canvas");
        itemTemplate.width = itemTemplate.height = 32;
        const itx = itemTemplate.getContext("2d")!;
        itx.fillStyle = "#888";
        itx.fillRect(0, 0, 32, 32);
        itx.strokeStyle = "#555";
        itx.strokeRect(0, 0, 32, 32);

        const machineTemplate = document.createElement("canvas");
        machineTemplate.width = machineTemplate.height = 24;
        const mtx = machineTemplate.getContext("2d")!;
        mtx.fillStyle = "#666";
        mtx.fillRect(0, 0, 24, 24);
        mtx.strokeStyle = "#333";
        mtx.strokeRect(0, 0, 24, 24);

        // Build edge sets
        const allEdges = new Set<string>();
        const bestEdges = new Set<string>();
        const fromEdges = new Set<string>();
        if (bestPath) {
            for (const path of allPaths) {
                for (const step of path.steps) {
                    for (const [inItem] of step.inputs) {
                        for (const [outItem] of step.outputs) {
                            allEdges.add(`${inItem.id}->${outItem.id}`);
                        }
                    }
                }
            }
            for (const step of bestPath.steps) {
                for (const [inItem] of step.inputs) {
                    for (const [outItem] of step.outputs) {
                        bestEdges.add(`${inItem.id}->${outItem.id}`);
                    }
                }
            }
            for (const item of allItemsFrom) {
                const recipes = item.usedIn
                for (const recipe of recipes) {
                    const outputs = recipe.outputs;
                    for (const [output, _] of outputs) {
                        fromEdges.add(`${item.id}->${output.id}`);
                    }
                }
            }
        }

        // Draw edges with machine icons on bestEdges
        for (const recipe of allRecipes) {
            const ok = Array.from(recipe.inputs.keys()).every((i) => reachableItems.has(i))
                && unlockedMachines.has(recipe.machine);
            if (!ok) continue;

            for (const [inItem] of recipe.inputs) {
                for (const [outItem] of recipe.outputs) {
                    const key = `${inItem.id}->${outItem.id}`;
                    const from = itemPosRef.current.get(inItem)!;
                    const to = itemPosRef.current.get(outItem)!;

                    ctx.beginPath();
                    if (bestEdges.has(key)) {
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 3;
                    } else if (allEdges.has(key)) {
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 1;
                    } else if (fromEdges.has(key)) {
                        ctx.strokeStyle="green";
                        ctx.lineWidth = 3;
                    }
                    else {
                        ctx.strokeStyle = "#aaa";
                        ctx.lineWidth = 1;
                    }
                    ctx.moveTo(from.x + 16, from.y + 16);
                    ctx.lineTo(to.x + 16, to.y + 16);
                    ctx.stroke();

                    // Draw machine icon for bestEdges only
                    if ((bestEdges.has(key) || fromEdges.has(key)) && recipe.machine) {
                        const midX = (from.x + to.x) / 2 + 16;
                        const midY = (from.y + to.y) / 2 + 16;
                        const img = recipe.machine.image ? recipe.machine.image : machineTemplate;
                        ctx.drawImage(img, midX - 12, midY - 12, 24, 24);
                        
                    }
                }
            }
        }

        for (const item of allItems) {
            const pos = itemPosRef.current.get(item)!;

            ctx.globalAlpha = reachableItems.has(item) ? 1 : 0.3;

            // Draw the item image
            const img = item.image ?? itemTemplate;
            ctx.drawImage(img, pos.x, pos.y, 32, 32);

            // Draw the requirement label, if applicable
            if (requirements.has(item)) {
                const label = requirements.get(item)!.toFixed(2);
                ctx.fillText(label, pos.x + 30, pos.y + 30);
            }
        }
        ctx.globalAlpha = 1;
    }, [
        graph,
        scale,
        offset,
        unlocked,
        starting,
        selectedItem,
        targetAmount,
    ]);

    // Wheel zoom
    useEffect(() => {
        const canvas = canvasRef.current!;
        const handler = (e: WheelEvent) => {
            e.preventDefault(); e.stopPropagation();
            const zoom = e.deltaY < 0 ? 1.1 : 0.9;
            const newScale = scale * zoom;
            const cx = width/2, cy = height/2;
            const wx = (cx - offset.x)/scale, wy = (cy - offset.y)/scale;
            setScale(newScale);
            setOffset({ x: cx - wx*newScale, y: cy - wy*newScale });
        };
        canvas.addEventListener("wheel", handler, { passive: false });
        return () => canvas.removeEventListener("wheel", handler);
    }, [scale, offset, width, height]);

    // Pan & click
    const onMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        setHasMoved(false);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging || !dragStart) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        if (Math.hypot(dx-offset.x, dy-offset.y) > 3) setHasMoved(true);
        setOffset({ x: dx, y: dy });
    };
    const onMouseUp = () => setDragging(false);

    const onClick = (e: React.MouseEvent) => {
        if (hasMoved) return;
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width/rect.width;
        const sy = canvas.height/rect.height;
        const cx = (e.clientX - rect.left)*sx;
        const cy = (e.clientY - rect.top)*sy;
        const wx = (cx - offset.x)/scale;
        const wy = (cy - offset.y)/scale;
        for (const [item,pos] of itemPosRef.current.entries()) {
            if (wx>=pos.x && wx<=pos.x+32 && wy>=pos.y && wy<=pos.y+32) {
                setSelectedItem(item);
                return;
            }
        }
        setSelectedItem(null);
    };

    function formatPrice(num: number): string {
        const units = [
            { value: 1e18, suffix: "e18" },
            { value: 1e15, suffix: "e15" },
            { value: 1e12, suffix: "T" },
            { value: 1e9, suffix: "B" },
            { value: 1e6, suffix: "M" },
            { value: 1e3, suffix: "K" },
        ];

        for (const { value, suffix } of units) {
            if (num >= value) {
            const formatted = num / value;
            return formatted % 1 === 0
                ? `${formatted}${suffix}`
                : `${formatted.toFixed(1)}${suffix}`;
            }
        }

        return num % 1 === 0 ? `${num}` : num.toFixed(1);
    }

    return (
  <div style={{ position: "relative", width, height }}>
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`canvas ${dragging ? 'grabbing' : 'grab'}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={onClick}
    />

    {selectedItem && (
      <div className="item-info">
        {selectedItem.image && (<img src={selectedItem.image.src} alt={selectedItem.name} className="item-image-info"/>)}
        <div className="item-name-info"><b>{selectedItem.name}</b></div>
        <div className="item-price-info"><b>Price: ${formatPrice(selectedItem.price)}</b></div>
        <button onClick={() => setSelectedItem(null)} className="close-button">
          Close
        </button>
      </div>
    )}
  </div>
);

};