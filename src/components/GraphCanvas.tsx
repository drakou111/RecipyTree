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
    const [focusItem, setFocusItem] = useState<Item | null>(null);
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
    const bestPath = selectedItem
        ? graph.findBestPathToItem(selectedItem, unlockedMachines, startingItems)
        : new RecipePath();
    const allItemsFrom = selectedItem ? graph.itemsFrom(selectedItem, unlockedMachines) : [];

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
        const bestEdges = new Set<string>();
        const fromEdges = new Set<string>();

        let visibleItems = new Set(allItems);
        let visibleEdges = new Set();

        if (focusItem) {
            visibleItems = new Set();
            visibleEdges = new Set();
        }

        if (bestPath) {
            for (const step of bestPath.steps) {
                for (const [inItem] of step.recipe.inputs) {
                    for (const [outItem] of step.recipe.outputs) {
                        const key = `${inItem.id}->${outItem.id}`;
                        bestEdges.add(key);
                        if (focusItem) {
                            visibleEdges.add(key);
                            visibleItems.add(inItem);
                            visibleItems.add(outItem);
                        }
                    }
                }
            }
            for (const item of allItemsFrom) {
                const recipes = item.usedIn
                for (const recipe of recipes) {
                    const outputs = recipe.outputs;
                    for (const [output, _] of outputs) {
                        const key = `${item.id}->${output.id}`
                        fromEdges.add(key);
                        if (focusItem) {
                            visibleEdges.add(key);
                            visibleItems.add(item);
                            visibleItems.add(output);
                        }
                    }
                }
            }
        }



        // Layout items
        const fullDepthMap = graph.computeDepths(startingItems, unlockedMachines);
        const depthMap = new Map<Item, number>();
        fullDepthMap.forEach((depth, item) => {
            if (!reachableItems.has(item)) return;
            if (visibleItems.has(item)) depthMap.set(item, depth);
        });
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


        // Draw edges with machine icons on bestEdges
        for (const recipe of allRecipes) {
            const ok = Array.from(recipe.inputs.keys()).every((i) => reachableItems.has(i))
                && unlockedMachines.has(recipe.machine);
            if (!ok) continue;

            for (const [inItem] of recipe.inputs) {
                for (const [outItem] of recipe.outputs) {
                    const key = `${inItem.id}->${outItem.id}`;
                    if (focusItem && !visibleEdges.has(key)) continue;

                    const from = itemPosRef.current.get(inItem)!;
                    const to = itemPosRef.current.get(outItem)!;

                    ctx.beginPath();
                    if (bestEdges.has(key)) {
                        ctx.strokeStyle = "red";
                        ctx.lineWidth = 2;
                    } else if (fromEdges.has(key)) {
                        ctx.strokeStyle = "green";
                        ctx.lineWidth = 2;
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
            if (!visibleItems.has(item)) continue;
            if (!reachableItems.has(item)) continue

            const pos = itemPosRef.current.get(item)!;

            ctx.globalAlpha = 1;

            // Draw the item image
            const img = item.image ?? itemTemplate;
            ctx.drawImage(img, pos.x, pos.y, 32, 32);
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
        focusItem
    ]);

    // Wheel zoom
    useEffect(() => {
        const canvas = canvasRef.current!;
        const handler = (e: WheelEvent) => {
            e.preventDefault(); e.stopPropagation();
            const zoom = e.deltaY < 0 ? 1.1 : 0.9;
            const newScale = scale * zoom;
            const cx = width / 2, cy = height / 2;
            const wx = (cx - offset.x) / scale, wy = (cy - offset.y) / scale;
            setScale(newScale);
            setOffset({ x: cx - wx * newScale, y: cy - wy * newScale });
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
        if (Math.hypot(dx - offset.x, dy - offset.y) > 3) setHasMoved(true);
        setOffset({ x: dx, y: dy });
    };
    const onMouseUp = () => setDragging(false);

    const onClick = (e: React.MouseEvent) => {
        if (hasMoved) return;
        if (focusItem) {
        }
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * sx;
        const cy = (e.clientY - rect.top) * sy;
        const wx = (cx - offset.x) / scale;
        const wy = (cy - offset.y) / scale;
        for (const [item, pos] of itemPosRef.current.entries()) {
            if (wx >= pos.x && wx <= pos.x + 32 && wy >= pos.y && wy <= pos.y + 32) {
                setSelectedItem(item);
                return;
            }
        }
        setSelectedItem(null);
        setFocusItem(null);
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

    const area = bestPath
        ? graph.estimateArea(bestPath, startingItems)
        : null;

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
                onDoubleClick={(e) => {
                    if (selectedItem) setFocusItem(focusItem?.id === selectedItem.id ? null : selectedItem);
                    else setFocusItem(null);
                }}
            />

            {selectedItem && (
                <div className="item-info">
                    {selectedItem.image && (<img src={selectedItem.image.src} alt={selectedItem.name} className="item-image-info" />)}
                    <div className="item-name-info"><b>{selectedItem.name}</b></div>
                    <div className="item-price-info"><b>Price: ${formatPrice(selectedItem.price)}</b></div>
                    <button onClick={() => setSelectedItem(null)} className="close-button">
                        Close
                    </button>
                </div>
            )}

            {bestPath && bestPath.steps.length >= 1 && (

                <div className="recipe-steps-panel">

                    {bestPath.steps.map((step, idx) => (
                        <div key={idx} className="recipe-step">
                            <div className="inputs">
                                {Array.from(step.recipe.inputs.keys()).map((i) => {
                                    const perRecipe = step.recipe.inputs.get(i) || 0;
                                    return (
                                        <div key={i.id} className="step-item-container">
                                            <img
                                                src={i.image?.src}
                                                alt={i.name}
                                                className="step-item"
                                                title={i.name}
                                            />
                                            <div className="step-count">
                                                {(step.count * perRecipe).toFixed(2)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <span className="arrow">➔</span>

                            <div className="step-machine-container">
                                <img
                                    src={step.recipe.machine.image?.src || ""}
                                    alt={step.recipe.machine.name}
                                    className="step-machine"
                                />
                            </div>

                            <span className="arrow">➔</span>

                            <div className="outputs">
                                {Array.from(step.recipe.outputs.keys()).map((o) => {

                                    const perRecipe = step.recipe.outputs.get(o) || 0;
                                    return (
                                        <div key={o.id} className="step-item-container">
                                            <img
                                                src={o.image?.src}
                                                alt={o.name}
                                                className="step-item"
                                            />
                                            <div className="step-count">
                                                {(step.count * perRecipe).toFixed(2)}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    {area && (
                        <div className="area-info">
                            <div>Estimated area
                                <span className="info-icon">
                                    
                                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" fill="none" />
                                        <rect x="7.25" y="7" width="1.5" height="4.5" fill="currentColor" />
                                        <circle cx="8" cy="4.25" r="0.75" fill="currentColor" />
                                    </svg>
                                    <span className="tooltip">This calculation does not take <br></br>
                                        into account multiple machines using <br></br>
                                        the same generators, and re-using machines <br></br>
                                        for multiple recipes. So the actual <br></br>
                                        result should be a bit lower.
                                    </span>
                                </span>:
                            </div>
                            <ul>
                                <li>Machine blocks: {area.machineSlots}</li>
                                <li>Generator blocks: {area.generatorSlots}</li>
                                <li>Generator optimisation blocks: {area.generatorOptimisationSlots}</li>
                                <li><strong>Total: {area.machineSlots} + {area.generatorSlots} - {area.generatorOptimisationSlots} = {area.total} Blocks</strong></li>
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );

};