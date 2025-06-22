import React, { useState, useEffect, useContext } from "react";
import { CraftGraph } from "../models/CraftGraph";
import { GraphCanvas } from "./GraphCanvas";
import { Item } from "../models/Item";
import { Machine } from "../models/Machine";
import "./GraphPage.css";

type Props = {
  graph: CraftGraph;
};

export const GraphPage: React.FC<Props> = ({ graph }) => {
  const [unlockedMachines, setUnlockedMachines] = useState<Set<Machine>>(new Set());
  const [startingItems, setStartingItems] = useState<Set<Item>>(new Set());

  useEffect(() => {
    setStartingItems(new Set(graph.items.filter(item => item.generator)));
  }, [graph]);

  const toggleMachine = (machine: Machine) => {
    const next = new Set(unlockedMachines);
    if (next.has(machine)) next.delete(machine);
    else next.add(machine);
    setUnlockedMachines(next);
  };

  const toggleItem = (item: Item) => {
    const next = new Set(startingItems);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setStartingItems(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", gap: "2rem" }}>
        <div>
          <h3>Unlocked Machines</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {graph.machines.map((m) => (
              <button key={m.name} onClick={() => toggleMachine(m)} title={m.name} className={`machine-select ${unlockedMachines.has(m) ? "selected" : ""}`}>
                {m.image ? (<img src={m.image.src} alt={m.name} className="machine-image"/>) : (m.name)}
              </button>
            ))}
          </div>
        </div>
      </div>


      <div>
        <h3>Starting Generators</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {graph.items
            .filter(item => item.generator)
            .map((item) => (
              <button key={item.id} onClick={() => toggleItem(item)} title={item.name} className={`item-select ${startingItems.has(item) ? "selected" : ""}`}>
                {item.image ? (<img src={item.image.src} alt={item.name} className="item-image"/>) : (item.name)}
              </button>
            ))}
        </div>
        <h3>Starting Containers</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {graph.items
            .filter(item => item.container)
            .map((item) => (
              <button key={item.id} onClick={() => toggleItem(item)} title={item.name} className={`item-select ${startingItems.has(item) ? "selected" : ""}`}>
                {item.image ? (<img src={item.image.src} alt={item.name} className="item-image"/>) : (item.name)}
              </button>
            ))}
        </div>

      </div>

      <GraphCanvas
        graph={graph}
        width={2500}
        height={900}
        unlocked={new Set([...unlockedMachines].map((m) => m.name))}
        starting={new Set([...startingItems].map((i) => i.id))}
      />

    </div>
  );
};
