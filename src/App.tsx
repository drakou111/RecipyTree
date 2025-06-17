import { CraftGraph } from "./models/CraftGraph";
import { GraphPage } from "./components/GraphPage";
import { useEffect, useState } from "react";
import "./App.css";
import { Toggle } from "./components/Toggle";
import useLocalStorage from "use-local-storage";

function App() {
  const [graph, setGraph] = useState<CraftGraph | null>(null);
  const preference = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [isDark, setIsDark] = useLocalStorage("isDark", preference);

  useEffect(() => {
    const g = new CraftGraph();
    g.loadItems()
      .then(() => g.loadMachines())
      .then(() => setGraph(g));
  }, []);

  return (
    <div>
      {graph ? (
        <div className="App" data-theme={isDark ? "dark" : "light"}>
          <h1 className="title">Recipe Tree</h1>
          <Toggle
            isChecked={isDark}
            handleChange={() => setIsDark(!isDark)}
          />
          <GraphPage graph={graph} />
        </div>
      ) : (
        "Loading..."
      )}
    </div>
  );
}

export default App;
