import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  IconLink, IconCircleCheck, IconCopy, IconCheck, IconQrcode,
  IconSearch, IconExternalLink, IconTrash,
} from "@tabler/icons-react";
import { HOST, normalizeUrl, shortLabel, shortUrl } from "./utils";

const STORAGE_KEY = "snip-links-v1";

const DEMO_LINKS = new Map([
  ["x7Kd2", "https://docs.google.com/presentation/d/1aBcD-eFgHiJkLmNoPqRsTuVwXyZ/edit"],
  ["menu", "https://cafebloom.in/menu/september-specials-and-seasonal-drinks"],
  ["resume", "https://drive.google.com/file/d/1zYxWvUtSrQpOnMlKjIhGfEdCbA/view"],
]);

function useLinks() {
  const [links, setLinks] = useState([]);
  useEffect(() => {
    let active = true;
    const loadLinks = async () => {
      try {
        let response = await fetch("/api/links");
        let saved = await response.json();
        if (!response.ok) throw new Error("Unable to load links.");
        if (saved.length === 0) {
          let local = [];
          try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (Array.isArray(stored)) local = stored.filter((link) => DEMO_LINKS.get(link.code) !== link.url);
          } catch {}
          for (const link of local) {
            await fetch("/api/links", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: link.code, url: link.url, clicks: link.clicks }),
            });
          }
          if (local.length) {
            response = await fetch("/api/links");
            saved = await response.json();
          }
        }
        if (active) setLinks(saved);
      } catch {
        if (active) setLinks([]);
      }
    };
    loadLinks();
    return () => { active = false; };
  }, []);
  return [links, setLinks];
}

function CopyButton({ text, label = "Copy", iconOnly = false }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  };
  const Icon = done ? IconCheck : IconCopy;
  return (
    <button className={iconOnly ? "btn icon" : "btn"} onClick={copy} aria-label={iconOnly ? `Copy ${text}` : undefined}>
      <Icon size={16} aria-hidden="true" />
      {!iconOnly && (done ? "Copied" : label)}
    </button>
  );
}

function NavBar() {
  return (
    <nav className="nav">
      <div className="brand"><IconLink size={20} className="accent" aria-hidden="true" />{HOST}</div>
      <div className="nav-links">
        <span className="current">Links</span>
      </div>
    </nav>
  );
}

function ShortenForm({ onCreate, error, setError }) {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onCreate(url, alias).then((created) => {
      if (created) { setUrl(""); setAlias(""); }
    });
  };

  return (
    <form className="hero" onSubmit={submit}>
      <h1>Shorten a link</h1>
      <p className="muted">Paste a long URL and get a short one you can share anywhere.</p>
      <div className="row">
        <input
          type="text" inputMode="url" value={url} aria-label="Long URL"
          placeholder="https://www.example.com/blog/how-to-plan-a-product-launch"
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
        />
        <button className="btn primary" type="submit">Shorten</button>
      </div>
      <div className="alias">
        <label htmlFor="alias">{window.location.host}/</label>
        <input
          id="alias" type="text" value={alias} placeholder="custom-alias" maxLength={24}
          onChange={(e) => { setAlias(e.target.value); setError(""); }}
        />
        <span className="hint">Optional</span>
      </div>
      <p className="error" role="alert">{error}</p>
    </form>
  );
}

function ResultCard({ link }) {
  const [showQr, setShowQr] = useState(false);
  useEffect(() => setShowQr(false), [link.code]);
  const short = shortUrl(link.code);
  return (
    <div className="result" aria-live="polite">
      <div className="result-main">
        <div className="result-text">
          <IconCircleCheck size={20} aria-hidden="true" />
          <div>
            <p className="result-link">{shortLabel(link.code)}</p>
            <p className="result-sub">Link created just now</p>
          </div>
        </div>
        <div className="actions">
          <CopyButton text={short} />
          <button className="btn icon" aria-label="Show QR code" aria-pressed={showQr} onClick={() => setShowQr((s) => !s)}>
            <IconQrcode size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {showQr && (
        <div className="qr"><QRCodeSVG value={short} size={120} bgColor="#ffffff" fgColor="#14231D" marginSize={2} /></div>
      )}
    </div>
  );
}

function Stats({ links }) {
  const clicks = links.reduce((n, l) => n + l.clicks, 0);
  const topLink = links.reduce((top, link) => !top || link.clicks > top.clicks ? link : top, null);
  const items = [
    ["Total links", links.length.toLocaleString()],
    ["Total clicks", clicks.toLocaleString()],
    ["Most opened", topLink ? shortLabel(topLink.code) : "—"],
  ];
  return (
    <div className="stats">
      {items.map(([label, value]) => (
        <div className="stat" key={label}>
          <p className="muted small">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
      ))}
    </div>
  );
}

function LinkList({ links, onDelete }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return links.filter((l) => !s || l.code.toLowerCase().includes(s) || l.url.toLowerCase().includes(s));
  }, [links, q]);

  return (
    <section className="recent">
      <div className="recent-head">
        <h2>Recent links</h2>
        <label className="search">
          <IconSearch size={15} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search links" aria-label="Search links" />
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <strong>{links.length ? "No links match" : "Shorten your first link"}</strong>
          {links.length ? "Try a different search." : "Paste a URL above and it'll show up here."}
        </div>
      ) : (
        <ul>
          {rows.map((l) => (
            <li key={l.code}>
              <div className="info">
                <p className="short">{shortLabel(l.code)}</p>
                <p className="long">{l.url}</p>
              </div>
              <span className="clicks">{l.clicks.toLocaleString()} {l.clicks === 1 ? "click" : "clicks"}</span>
                <CopyButton text={shortUrl(l.code)} iconOnly />
                <a className="btn icon" href={shortUrl(l.code)} target="_blank" rel="noopener noreferrer"
                   aria-label={`Open ${shortLabel(l.code)}`}>
                <IconExternalLink size={16} aria-hidden="true" />
              </a>
              <button className="btn icon" aria-label={`Delete ${shortLabel(l.code)}`} onClick={() => onDelete(l.code)}>
                <IconTrash size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const [links, setLinks] = useLinks();
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState("");
  const pathCode = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const [routeChecked, setRouteChecked] = useState(!pathCode);
  const routeHandled = useRef(false);

  useEffect(() => {
    if (!pathCode || routeHandled.current) return;
    routeHandled.current = true;
    let code;
    try { code = decodeURIComponent(pathCode); } catch {
      setRouteChecked(true);
      return;
    }
    const link = links.find((item) => item.code === code);
    if (!link) {
      setRouteChecked(true);
      return;
    }
    const updated = links.map((item) => item.code === code ? { ...item, clicks: item.clicks + 1 } : item);
    setLinks(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
    window.location.replace(link.url);
  }, [links, pathCode, setLinks]);

  const create = async (rawUrl, rawAlias) => {
    const url = normalizeUrl(rawUrl);
    const alias = rawAlias.trim();
    if (!url) { setError("Enter a valid web address, like example.com/page."); return false; }
    if (alias && !/^[A-Za-z0-9-]{3,24}$/.test(alias)) {
      setError("Use 3 to 24 letters, numbers, or hyphens for the alias."); return false;
    }
    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, alias }),
      });
      const link = await response.json();
      if (!response.ok) { setError(link.error); return false; }
      setLinks((current) => [link, ...current]);
      setLatest(link);
      return true;
    } catch {
      setError("Could not reach the link service. Please try again.");
      return false;
    }
  };

  const remove = async (code) => {
    try {
      const response = await fetch(`/api/links/${encodeURIComponent(code)}`, { method: "DELETE" });
      if (!response.ok) return;
      setLinks((current) => current.filter((link) => link.code !== code));
      if (latest?.code === code) setLatest(null);
    } catch {}
  };

  if (pathCode) {
    if (!routeChecked) return null;
    return (
      <div className="app">
        <NavBar />
        <section className="hero">
          <h1>Short link not found</h1>
          <p className="muted">This link does not exist in this browser or may have been deleted.</p>
          <a className="btn" href="/">Back to links</a>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <NavBar />
      <ShortenForm onCreate={create} error={error} setError={setError} />
      {latest && <div className="pad"><ResultCard link={latest} /></div>}
      <Stats links={links} />
      <LinkList links={links} onDelete={remove} />
    </div>
  );
}
