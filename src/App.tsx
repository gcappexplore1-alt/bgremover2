import { Component, useEffect, useState, type ReactNode } from "react";
import RootLayout from "@/app/layout";
import EditorPage from "@/app/editor/page";
import EmbedPage from "@/app/embed/page";
import HelpPage from "@/app/help/page";
import HomePage from "@/app/page";

/**
 * Entry point (this build has no Next.js router).
 *
 * Routes match the Next.js app: "/" (app/page.tsx), "/editor" (app/editor/page.tsx),
 * "/embed" (app/embed/page.tsx), "/help" (app/help/page.tsx). Hash URLs work on any static
 * host ("#/editor"); path URLs also resolve when the host serves index.html for unknown paths,
 * which is what the WordPress plugin's iframe (…/embed) expects.
 */
type Route = "home" | "editor" | "embed" | "help";

function parseRoute(): Route {
  const fromHash = window.location.hash.replace(/^#\/?/, "").split(/[?#]/)[0];
  const path = fromHash || window.location.pathname.replace(/\/+$/, "").split("/").pop() || "";
  if (path === "editor" || path === "embed" || path === "help") return path;
  return "home";
}

const TITLES: Record<Route, string> = {
  home: "Clipping World - Cutout Studio",
  editor: "Clipping World - Cutout Studio",
  embed: "Clipping World - Cutout Studio",
  help: "Help & privacy – Cutout Studio",
};

/** Never show a blank page: if anything in the app throws, say so instead. */
class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.message) {
      return (
        <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "#1e293b" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong.</h1>
          <p style={{ fontSize: 14, marginBottom: 8 }}>The editor hit an unexpected error. Reloading usually fixes it.</p>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap", background: "#f6f7f9", border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>{this.state.message}</pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 12, height: 40, padding: "0 18px", borderRadius: 999, border: "none", background: "#0733eb", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = TITLES[route];
  }, [route]);

  return (
    <ErrorBoundary>
      <RootLayout>
        {route === "editor" ? <EditorPage /> : route === "embed" ? <EmbedPage /> : route === "help" ? <HelpPage /> : <HomePage />}
      </RootLayout>
    </ErrorBoundary>
  );
}
