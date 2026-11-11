import { useMemo, useState } from "react";
import { useEvents } from "./useEvents.js";
import Header from "./components/Header.jsx";
import Stats from "./components/Stats.jsx";
import Feed from "./components/Feed.jsx";

export default function App() {
  const { events, conn, clear } = useEvents();
  const [agent, setAgent] = useState("all");
  const [errorsOnly, setErrorsOnly] = useState(false);

  const visible = useMemo(
    () =>
      events
        .filter((e) => agent === "all" || e.agent === agent)
        .filter((e) => !errorsOnly || e.type === "error")
        .reverse(),
    [events, agent, errorsOnly]
  );

  return (
    <>
      <Header
        conn={conn}
        agent={agent}
        onAgentChange={setAgent}
        errorsOnly={errorsOnly}
        onErrorsOnlyChange={setErrorsOnly}
        onClear={clear}
      />
      <Stats events={events} />
      <main>
        <Feed events={visible} />
        {events.length === 0 && (
          <p className="empty">
            Waiting for events… Run <code>npm run samples</code> to send test data,
            or start Claude Code / Codex with the hooks installed.
          </p>
        )}
      </main>
    </>
  );
}
