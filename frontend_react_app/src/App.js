import React, { useState, useEffect, useRef } from "react";
import "./App.css";

/**
 * BiteSize Frontend
 *
 * A responsive, modern app for summary generation, preferences, 
 * bookmarks, account/profile, and seamless interaction with backend REST API.
 */

// --- API Helper Functions ---

const API_BASE = process.env.REACT_APP_API_BASE || ""; // Use proxy/local or .env

// PUBLIC_INTERFACE
export async function apiFetch(endpoint, opts = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: "include",
    headers: {"Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw await res.json();
  return await res.json();
}

// --- Main App ---

function App() {
  const [theme, setTheme] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );
  const [user, setUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [route, setRoute] = useState(window.location.hash.replace(/^#/, "") || "summarize");
  const [summaries, setSummaries] = useState([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarksLoading, setBookmarksLoading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState({
    reading_level: "average",
    summary_detail: "medium",
    preferred_topics: "",
  });
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesMsg, setPreferencesMsg] = useState("");

  // Theme + Branding color integration
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Routing (hash-based, for SPA simplicity)
  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.replace(/^#/, "") || "summarize");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Fetch user profile
  useEffect(() => {
    setProfileLoading(true);
    apiFetch("/api/auth/user")
      .then(res => { setUser(res); })
      .catch(() => setUser(null))
      .finally(() => setProfileLoading(false));
  }, []);

  // Fetch preferences once logged in
  useEffect(() => {
    if (!user) return;
    setPreferencesLoading(true);
    apiFetch("/api/user/preferences")
      .then(res => { setPreferences(res); })
      .catch(() => setPreferences({ reading_level: "average", summary_detail: "medium", preferred_topics: "" }))
      .finally(() => setPreferencesLoading(false));
  }, [user]);

  // Fetch summaries when on home
  useEffect(() => {
    if (!user) return;
    setSummariesLoading(true);
    apiFetch("/api/summaries")
      .then(res => setSummaries(res))
      .catch(() => setSummaries([]))
      .finally(() => setSummariesLoading(false));
  }, [user, submissionResult]);

  // Fetch bookmarks
  useEffect(() => {
    if (!user) return;
    setBookmarksLoading(true);
    apiFetch("/api/bookmarks")
      .then(res => setBookmarks(res))
      .catch(() => setBookmarks([]))
      .finally(() => setBookmarksLoading(false));
  }, [user, submissionResult]);

  // --- HANDLERS ---

  // PUBLIC_INTERFACE
  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  // PUBLIC_INTERFACE
  function handleNav(path) {
    window.location.hash = path;
    setRoute(path);
    setShowSidebar(false);
  }

  // PUBLIC_INTERFACE
  function handleLogin() {
    window.location.href = `${API_BASE}/api/auth/login`;
  }

  // PUBLIC_INTERFACE
  function handleLogout() {
    apiFetch("/api/auth/logout", { method: "POST" })
      .finally(() => window.location.reload());
  }

  // Preferences form
  // PUBLIC_INTERFACE
  function handlePreferencesChange(ev) {
    const { name, value } = ev.target;
    setPreferences((prev) => ({ ...prev, [name]: value }));
  }

  // PUBLIC_INTERFACE
  function handlePreferencesSave(ev) {
    ev.preventDefault();
    setPreferencesSaving(true);
    setPreferencesMsg("");
    apiFetch("/api/user/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    })
      .then(() => setPreferencesMsg("Preferences saved!"))
      .catch(() => setPreferencesMsg("Failed to save preferences."))
      .finally(() => setPreferencesSaving(false));
  }

  // --- Summary submission ---

  // Using a single form for URL, text, and browsing (news), with tabs.
  const [submitTab, setSubmitTab] = useState("url");
  const urlRef = useRef();
  const textRef = useRef();
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);

  useEffect(() => {
    if (submitTab === "news") {
      setNewsLoading(true);
      apiFetch("/api/news")
        .then(res => setNewsItems(res))
        .catch(() => setNewsItems([]))
        .finally(() => setNewsLoading(false));
    }
  }, [submitTab]);

  // PUBLIC_INTERFACE
  function handleSummarySubmit(ev) {
    ev.preventDefault();
    setSubmissionResult(null);
    setSubmissionError(null);
    setSubmitting(true);

    let summaryReq = {};
    if (submitTab === "url") {
      summaryReq = { source_type: "url", source_value: urlRef.current.value };
    } else if (submitTab === "text") {
      summaryReq = { source_type: "text", source_value: textRef.current.value, input_title: "Custom Text" };
    } else if (submitTab === "news") {
      let id = ev.target.elements.news_article.value;
      if (!id) {
        setSubmissionError("Select a news article.");
        setSubmitting(false);
        return;
      }
      summaryReq = { source_type: "news", source_value: id };
    }

    apiFetch("/api/summaries", {
      method: "POST",
      body: JSON.stringify(summaryReq),
    })
      .then(res => setSubmissionResult(res))
      .catch(e => setSubmissionError(e?.message || "Submission failed."))
      .finally(() => setSubmitting(false));
  }

  // PUBLIC_INTERFACE
  function handleBookmark(summary) {
    apiFetch("/api/bookmarks", {
      method: "POST",
      body: JSON.stringify({ summary_id: summary.id }),
    })
    .then(() => setSubmissionResult(r => ({...r, bookmarkSuccess: true})))
    .catch(() => setSubmissionResult(r => ({...r, bookmarkSuccess: false})));
  }

  // PUBLIC_INTERFACE
  function handleUnbookmark(bmId) {
    apiFetch(`/api/bookmarks/${bmId}`, {
      method: "DELETE"
    })
    .then(() => setBookmarks(bms => bms.filter(b => b.id !== bmId)))
    .catch(() => {});
  }

  // ---------- UI COMPONENTS ----------

  // PUBLIC_INTERFACE
  function Navbar() {
    return (
      <nav className="navbar" style={{
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "relative",
        zIndex: 2
      }}>
        {/* Logo section */}
        <div className="navbar-left" style={{display: "flex", alignItems: "center", gap: "1em"}}>
          <span className="logo" style={{
            color: "#1976d2",
            fontWeight: "bold",
            fontSize: "1.4em",
            letterSpacing: ".03em"
          }}>
            <span role="img" aria-label="Lightning" style={{marginRight: 4}}>⚡</span>
            BiteSize
          </span>
        </div>
        {/* Nav Links */}
        <div className="navbar-center" style={{
          display: "flex",
          alignItems: "center",
          gap: ".8em"
        }}>
          <NavButton to="summarize" label="Summarize" icon="📝" />
          {user && (
            <>
              <NavButton to="bookmarks" label="Bookmarks" icon="⭐" />
              <NavButton to="preferences" label="Preferences" icon="⚙️" />
            </>
          )}
        </div>
        {/* Auth/Profile/Theme */}
        <div className="navbar-right" style={{
          display: "flex",
          alignItems: "center",
          gap: ".5em"
        }}>
          <button 
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={"Switch theme"}
            style={{marginRight: "8px"}}  
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          {profileLoading ? (
            <span>...</span>
          ) : !user ? (
            <button className="btn" onClick={handleLogin}>Sign in</button>
          ) : (
            <div style={{display: "flex", alignItems: "center", gap: "7px"}}>
              <img
                src={user.profile_pic || `https://ui-avatars.com/api/?name=${user.name || "U"}&background=1976d2&color=fff`}
                alt="avatar"
                style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: "2px solid #1976d2" }}
              />
              <span style={{fontWeight: 500, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis"}} title={user.name || user.email || ""}>
                {user.name || user.email}
              </span>
              <button className="btn" style={{ background: "#eee", color: "#1976d2" }} onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
          {/* mobile menu button */}
          <button 
            className="btn" style={{
              marginLeft: 10,
              display: "inline-block",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontWeight: 600,
              fontSize: 18
            }} 
            onClick={() => setShowSidebar(s => !s)}
            aria-label="Open menu"
          >☰</button>
        </div>
      </nav>
    );
  }

  // PUBLIC_INTERFACE
  function Sidebar() {
    return (
      <div
        className="sidebar"
        style={{
          position: "fixed",
          top: 0,
          right: showSidebar ? 0 : "-270px",
          height: "100vh",
          width: "260px",
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border-color)",
          boxShadow: "-2px 0 8px rgba(0,0,0,0.08)",
          transition: "right .29s cubic-bezier(.59,1.19,.42,1)",
          zIndex: 21,
          padding: "30px 20px 10px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "1em"
        }}
        role="navigation"
        aria-label="Sidebar navigation"
      >
        <button
          onClick={() => setShowSidebar(false)}
          className="btn"
          style={{
            background: "#1976d2",
            color: "#fff",
            alignSelf: "flex-end",
            marginRight: "-6px"
          }}
        >❌</button>
        <NavButton to="summarize" label="Summarize" icon="📝" />
        {user && (
          <>
            <NavButton to="bookmarks" label="Bookmarks" icon="⭐" />
            <NavButton to="preferences" label="Preferences" icon="⚙️" />
          </>
        )}
        <button className="btn" style={{ marginTop: "2em" }} onClick={toggleTheme}>
          Theme: {theme === "light" ? "🌙" : "☀️"}
        </button>
        {!user && !profileLoading && (
          <button className="btn" onClick={handleLogin}>Sign in</button>
        )}
        {user && (
          <button className="btn" onClick={handleLogout}>Logout</button>
        )}
      </div>
    );
  }

  // PUBLIC_INTERFACE
  function NavButton({ to, label, icon }) {
    return (
      <button
        className="btn"
        style={{
          background: route === to ? "#1976d2" : "#eee",
          color: route === to ? "#fff" : "#1976d2",
          fontWeight: 600,
          border: "none",
          padding: "8px 16px",
          borderRadius: "7px"
        }}
        onClick={() => handleNav(to)}
      >
        <span style={{fontSize:'1.17em'}}>{icon}</span>
        <span style={{marginLeft:7}}>{label}</span>
      </button>
    );
  }

  // PUBLIC_INTERFACE
  function SubmissionPanel() {
    return (
      <div className="container" style={{
        background: "var(--bg-secondary)",
        borderRadius: 12,
        boxShadow: "0 2px 9px rgba(0,0,0,0.08)",
        maxWidth: 560,
        margin: "32px auto",
        padding: "38px 24px 30px 24px"
      }}>
        <h1 className="title" style={{
          fontWeight: 700,
          fontSize: "1.6em",
          color: "#1976d2",
          marginBottom: "0.7em"
        }}>Summarize Content</h1>
        <div className="submission-tabs" style={{
          display: "flex",
          gap: "13px", marginBottom: "21px"
        }}>
          {[
            ["url", "🌐 URL"],
            ["text", "✍️ Text"],
            ["news", "📰 Browse"]
          ].map(([key, lbl]) => (
            <button
              key={key}
              className="btn"
              style={{
                background: submitTab === key ? "#1976d2" : "#eee",
                color: submitTab === key ? "#fff" : "#1976d2",
                padding: "10px 16px",
                borderRadius: "7px",
                fontWeight: 600
              }}
              onClick={() => setSubmitTab(key)}
            >{lbl}</button>
          ))}
        </div>
        <form onSubmit={handleSummarySubmit}>
          {submitTab === "url" && (
            <div>
              <label style={{fontWeight: 500, color:"#333"}}>Article URL</label>
              <input
                type="url"
                ref={urlRef}
                className="form-input"
                required
                style={inputStyle}
                placeholder="https://example.com/article"
                disabled={submitting}
              />
            </div>
          )}
          {submitTab === "text" && (
            <div>
              <label style={{fontWeight: 500, color:"#333"}}>Paste Text</label>
              <textarea
                ref={textRef}
                className="form-input"
                required
                rows={6}
                style={{...inputStyle, resize: "vertical"}}
                placeholder="Paste or type your text here."
                disabled={submitting}
              />
            </div>
          )}
          {submitTab === "news" && (
            <div>
              {newsLoading ? (
                <p>Loading news...</p>
              ) : (
                <>
                  <label style={{fontWeight:500, color:"#333"}}>Pick a news item</label>
                  <select name="news_article" className="form-input" style={inputStyle} disabled={submitting}>
                    <option value="" disabled selected>Choose news</option>
                    {Array.isArray(newsItems) && newsItems.length > 0 ?
                      newsItems.map((item) => (
                        <option key={item.id || item.title} value={item.id}>{item.title}</option>
                      )) : <option value="">No news data</option>
                    }
                  </select>
                </>
              )}
            </div>
          )}
          <button
            className="btn"
            type="submit"
            style={{
              background: "#1976d2",
              color: "#fff",
              fontWeight: 700,
              padding: "13px 18px",
              fontSize: "1.11em",
              borderRadius: "8px",
              marginTop: "1.5em"
            }}
            disabled={submitting}
          >
            {submitting ? "Summarizing..." : "Summarize"}
          </button>
          {submissionError && (
            <div style={{ color: "#c62828", marginTop: "0.7em" }}>{submissionError}</div>
          )}
        </form>
        {submissionResult && (
          <div
            className="summary-card"
            style={{
              background: "#fff",
              color: "#222",
              border: "1px solid #e4e4e4",
              borderRadius: 9,
              marginTop: 24,
              padding: 19
            }}
          >
            <h3 style={{fontWeight:600, marginBottom:".4em"}}>{submissionResult.input_title || "Summary"}</h3>
            <p style={{fontSize:"1.19em", lineHeight:1.46, color:"#222"}}>
              {submissionResult.summary_text}
            </p>
            {user && (
              <button
                className="btn"
                style={{background: "#fbc02d", color: "#222", fontWeight:600, marginTop:"12px"}}
                onClick={() => handleBookmark(submissionResult)}
              >
                ⭐ Bookmark
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // PUBLIC_INTERFACE
  function SummariesList() {
    if (summariesLoading)
      return <div style={{ margin: "3em" }}>Loading your summaries...</div>;
    if (!Array.isArray(summaries) || summaries.length === 0)
      return <div style={{ margin: "3em" }}>No summaries yet. Try submitting one above!</div>;
    return (
      <div style={{maxWidth: 680, margin: "0 auto"}}>
        <h2 style={{textAlign:"left", fontWeight:700, fontSize:"1.2em", margin:"28px 0 15px 7px"}}>Your Summaries</h2>
        {summaries.map((s) => (
          <div className="summary-card" key={s.id}
            style={{
              background: "#fff",
              color: "#222",
              border: "1px solid #e4e4e4",
              borderRadius: 9,
              margin: "0 0 18px 0",
              padding: 19,
              textAlign: "left",
              position: "relative"
            }}
          >
            <h4 style={{fontWeight:600, marginBottom:"0.25em"}}>{s.input_title}</h4>
            <span style={{
              color: "#999",
              fontSize: 13,
              marginBottom: 7,
              display: "block"
            }}>{(s.created_at+"").replace("T", " ").slice(0, 19)}</span>
            <p style={{minHeight:50, fontSize: "1.15em", color:"#232"}}>
              {s.summary_text}
            </p>
            {user && (
              <button 
                className="btn"
                style={{background:"#fbc02d", color:"#222", fontWeight:600, position:"absolute",top:14,right:15}}
                onClick={() => handleBookmark(s)}
              >⭐</button>
            )}
          </div>
        ))}
      </div>
    );
  }

  // PUBLIC_INTERFACE
  function PreferencesPanel() {
    return (
      <div className="container" style={{
        background: "var(--bg-secondary)",
        borderRadius: 12,
        maxWidth: 460,
        margin: "35px auto 24px auto",
        padding: "34px 20px"
      }}>
        <h1 className="title" style={{ color: "#1976d2", fontWeight:700, marginBottom: 18 }}>Preferences</h1>
        {preferencesLoading ? (
          <p>Loading preferences...</p>
        ) : (
          <form onSubmit={handlePreferencesSave}>
            <label>Reading Level</label>
            <select
              style={{...inputStyle, marginBottom:12}}
              name="reading_level"
              value={preferences.reading_level}
              onChange={handlePreferencesChange}
              disabled={preferencesSaving}
            >
              <option value="child">Child</option>
              <option value="student">Student</option>
              <option value="average">Average Adult</option>
              <option value="advanced">Advanced</option>
            </select>
            <label>Summary Detail</label>
            <select
              style={{...inputStyle, marginBottom:12}}
              name="summary_detail"
              value={preferences.summary_detail}
              onChange={handlePreferencesChange}
              disabled={preferencesSaving}
            >
              <option value="brief">Brief (Key points only)</option>
              <option value="medium">Medium</option>
              <option value="detailed">Detailed</option>
            </select>
            <label>Topics of Interest</label>
            <input 
              name="preferred_topics"
              style={inputStyle}
              type="text"
              value={preferences.preferred_topics}
              placeholder="science, history..."
              onChange={handlePreferencesChange}
              disabled={preferencesSaving}
            />
            <button
              className="btn"
              type="submit"
              style={{
                background: "#1976d2",
                color: "#fff",
                fontWeight: 700,
                marginTop: "2em",
                borderRadius: "7px"
              }}
              disabled={preferencesSaving}
            >
              {preferencesSaving ? "Saving..." : "Save"}
            </button>
            {!!preferencesMsg && (
              <div style={{ color: "#1976d2", marginTop: "1em", fontWeight: 600 }}>{preferencesMsg}</div>
            )}
          </form>
        )}
      </div>
    );
  }

  // PUBLIC_INTERFACE
  function BookmarksPanel() {
    if (bookmarksLoading)
      return <div style={{margin:"3em"}}>Loading bookmarks...</div>;
    if (!Array.isArray(bookmarks) || bookmarks.length === 0)
      return <div style={{margin:"3em"}}>You have no bookmarks yet!</div>;
    return (
      <div style={{maxWidth: 680, margin:"0 auto"}}>
        <h2 style={{textAlign:"left", fontWeight:700, fontSize:"1.2em", margin:"27px 0 16px 6px"}}>Bookmarked Summaries</h2>
        {bookmarks.map(b => (
          <div className="summary-card" key={b.id} style={{
            background: "#fff",
            border: "1px solid #e4e4e4",
            borderRadius: 9,
            margin: "0 0 18px 0",
            padding: 19,
            textAlign: "left",
            position: "relative"
          }}>
            <h4 style={{fontWeight:600, marginBottom:"0.25em"}}>{b.summary?.input_title}</h4>
            <span style={{
              color: "#999",
              fontSize: 13,
              marginBottom: 7,
              display: "block"
            }}>{(b.created_at+"").replace("T", " ").slice(0, 19)}</span>
            <p style={{minHeight:50, fontSize: "1.15em", color:"#232"}}>
              {b.summary?.summary_text}
            </p>
            <button
              className="btn"
              style={{
                background: "#ddd", color: "#222", fontWeight:600, position:"absolute",top:14,right:18
              }}
              aria-label="Remove bookmark"
              onClick={() => handleUnbookmark(b.id)}
            >❌</button>
          </div>
        ))}
      </div>
    );
  }

  // PUBLIC_INTERFACE
  function MainContent() {
    if (!user && !profileLoading && ["bookmarks", "preferences"].includes(route)) {
      return (
        <div className="container" style={{margin:"2em auto",padding:"3em 2em",maxWidth:400,background:"#fff",borderRadius:10}}>
          <span style={{fontWeight:700,color:"#1976d2"}}>Sign in required.</span>
          <div style={{marginTop:20}}>
            <button className="btn" onClick={handleLogin}>Sign in</button>
          </div>
        </div>
      );
    }
    switch (route) {
      case "preferences": return <PreferencesPanel />;
      case "bookmarks": return <BookmarksPanel />;
      case "summarize":
      default:
        return (
          <>
            <SubmissionPanel />
            {user && <SummariesList />}
          </>
        );
    }
  }

  // ---------- RENDER ----------

  return (
    <div className="App" style={{
      background: "var(--bg-primary)",
      color: "var(--text-primary)",
      minHeight: "100vh",
      transition: "background-color 0.3s, color 0.3s"
    }}>
      <Navbar />
      <Sidebar />
      <div className="main-content" style={{
        margin: "0 auto",
        padding: "3.5em 0 2.5em 0",
        maxWidth: "900px",
        minHeight: "70vh"
      }}>
        <MainContent />
      </div>
      <footer style={{
        padding: "17px 0",
        background: "var(--bg-secondary)",
        color: "#444",
        borderTop: "1px solid var(--border-color)",
        marginTop: "3.5em",
        textAlign: "center",
        fontSize: "1em"
      }}>
        &copy; {new Date().getFullYear()} BiteSize &mdash; Fast, smart reading.
        <span style={{marginLeft: 13}}><a className="App-link" href="https://github.com/" style={{color:"var(--text-secondary)"}}>GitHub</a></span>
      </footer>
      {/* CSS-in-JS for responsive tweaks */}
      <style>{`
        @media (max-width: 700px) {
          .main-content { padding-top: 1.6em; }
          .container { padding: 18px 6px 14px 6px !important; }
        }
        @media (max-width: 450px) {
          .navbar-center, .navbar-left span { font-size: 1em !important;}
          .logo { font-size: 1.08em !important;}
        }
        .form-input {
          margin: 9px 0 17px 0;
          padding: 11px 12px;
          border-radius: 7px;
          border: 1px solid #e0e0e0;
          font-size: 1.07em;
          width: 100%;
          box-sizing: border-box;
          background: #fff;
        }
        .form-input:disabled { background: #f0f0f0; color: #bbb; }
        .btn {
          cursor: pointer;
          background: #1976d2;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 1em;
          font-family: inherit;
          font-weight: 600;
          padding: 8px 16px;
          margin-right: 0.7em;
          margin-bottom: 2px;
          transition: 0.2s all;
        }
        .btn:hover, .btn:focus { filter: brightness(1.07) contrast(1.08);}
        .btn:active { scale: 0.98;}
        .summary-card { transition: box-shadow .22s;}
        .summary-card:hover { box-shadow: 0 2.5px 12px rgba(33,33,33,0.09);}
      `}</style>
    </div>
  );
}

// Input widget style
const inputStyle = {
  display: "block",
  width: "100%",
  borderRadius: "7px",
  border: "1px solid #cfd8dc",
  fontSize: "1.09em",
  margin: "6px 0 18px 0",
  padding: "11px 12px",
};

// PUBLIC_INTERFACE
export default App;
