import { useEffect, useState } from "react";

// Loads past events, then listens on /stream for new ones.
export function useEvents() {
  const [events, setEvents] = useState([]);
  const [conn, setConn] = useState({ state: "", title: "Connecting…" });
  const [loaded, setLoaded] = useState(false);

  const dropSession = (agent, sessionId) =>
    setEvents((prev) => prev.filter((e) => !(e.agent === agent && e.sessionId === sessionId)));

  useEffect(() => {
    let source;
    let cancelled = false;

    fetch("/api/events")
      .then((res) => res.json())
      .then((past) => {
        if (cancelled) return;
        setEvents(past);
        setLoaded(true);
        source = new EventSource("/stream");
        source.onopen = () => setConn({ state: "live", title: "Connected" });
        source.onerror = () => setConn({ state: "down", title: "Disconnected, retrying…" });
        source.onmessage = (msg) => {
          const event = JSON.parse(msg.data);
          if (event.type === "__cleared") setEvents([]);
          else if (event.type === "__session_deleted") dropSession(event.agent, event.sessionId);
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

  // Deletes one session and its events on the server. Other open dashboards drop it
  // through the stream; this one drops it right away in case the stream is down.
  const deleteSession = async (agent, sessionId) => {
    const res = await fetch(`/api/sessions/${encodeURIComponent(agent)}/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || `Server answered ${res.status}`);
    }
    dropSession(agent, sessionId);
  };

  return { events, conn, clear, deleteSession, loaded };
}
