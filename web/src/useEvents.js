import { useEffect, useState } from "react";

// Loads past events, then listens on /stream for new ones.
export function useEvents() {
  const [events, setEvents] = useState([]);
  const [conn, setConn] = useState({ state: "", title: "Connecting…" });

  useEffect(() => {
    let source;
    let cancelled = false;

    fetch("/api/events")
      .then((res) => res.json())
      .then((past) => {
        if (cancelled) return;
        setEvents(past);
        source = new EventSource("/stream");
        source.onopen = () => setConn({ state: "live", title: "Connected" });
        source.onerror = () => setConn({ state: "down", title: "Disconnected, retrying…" });
        source.onmessage = (msg) => {
          const event = JSON.parse(msg.data);
          if (event.type === "__cleared") setEvents([]);
          else setEvents((prev) => [...prev, event]);
        };
      })
      .catch(() => !cancelled && setConn({ state: "down", title: "Server unreachable" }));

    return () => {
      cancelled = true;
      source?.close();
    };
  }, []);

  const clear = async () => {
    if (events.length) await fetch("/api/events", { method: "DELETE" });
  };

  return { events, conn, clear };
}
