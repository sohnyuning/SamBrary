import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://nngarqnhakdmiwuthdtt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uZ2FycW5oYWtkbWl3dXRoZHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMjg2NjMsImV4cCI6MjA5NTgwNDY2M30.SsV_q-
";

const EMOJIS = ["📖", "🌿", "🔥", "🌊", "🌙", "✨", "🍂", "🖋️"];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : null;
}

export default function App() {
  const [records, setRecords] = useState([]);
  const [memberNames, setMemberNames] = useState(["멤버1", "멤버2", "멤버3"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingNames, setEditingNames] = useState(["멤버1", "멤버2", "멤버3"]);
  const [form, setForm] = useState({ date: "", book: "", author: "", reviews: {} });
  const [expandedId, setExpandedId] = useState(null);
  const [editingReview, setEditingReview] = useState(null);
  const [editingText, setEditingText] = useState("");

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [recs, settings] = await Promise.all([
        sbFetch("records?select=*&order=created_at.desc"),
        sbFetch("settings?select=*"),
      ]);
      setRecords(recs || []);
      const memberSetting = (settings || []).find(s => s.key === "members");
      if (memberSetting) setMemberNames(memberSetting.value);
      setLastSync(new Date());
    } catch (e) {
      setError("데이터를 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  function openForm() {
    // 인덱스 기반으로 reviews 초기화 (0, 1, 2)
    setForm({
      date: new Date().toISOString().split("T")[0],
      book: "",
      author: "",
      reviews: { "0": "", "1": "", "2": "" }
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.book.trim()) return;
    setSaving(true);
    try {
      await sbFetch("records", {
        method: "POST",
        body: JSON.stringify({
          id: Date.now(),
          date: form.date,
          book: form.book.trim(),
          author: form.author.trim(),
          reviews: form.reviews,
        }),
      });
      await loadData();
      setShowForm(false);
    } catch (e) {
      alert("저장에 실패했어요: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("이 기록을 삭제할까요?")) return;
    setSaving(true);
    try {
      await sbFetch(`records?id=eq.${id}`, {
        method: "DELETE",
        headers: { "Prefer": "" }
      });
      await loadData();
    } catch (e) {
      alert("삭제에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  function startEditReview(e, recordId, idx, currentText) {
    e.stopPropagation();
    setEditingReview({ recordId, idx });
    setEditingText(currentText || "");
  }

  async function saveReview(recordId) {
    setSaving(true);
    try {
      const rec = records.find(r => r.id === recordId);
      const newReviews = { ...rec.reviews, [String(editingReview.idx)]: editingText.trim() };
      await sbFetch(`records?id=eq.${recordId}`, {
        method: "PATCH",
        body: JSON.stringify({ reviews: newReviews }),
      });
      setEditingReview(null);
      await loadData();
      } catch (e) {
  alert("저장 실패: " + JSON.stringify(e.message) + " / " + e.toString());
  }
    } finally {
      setSaving(false);
    }
  }

  async function saveNames() {
    setSaving(true);
    try {
      const trimmed = editingNames.map((n, i) => n.trim() || `멤버${i + 1}`);
      // 이름만 바꾸면 됨 — reviews는 인덱스 기반이라 그대로
      await sbFetch("settings?key=eq.members", {
        method: "PATCH",
        body: JSON.stringify({ value: trimmed }),
      });
      await loadData();
      setShowSettings(false);
    } catch (e) {
      alert("저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  }

  const emoji = (i) => EMOJIS[i % EMOJIS.length];
  const syncText = lastSync
    ? `${lastSync.getHours().toString().padStart(2,"0")}:${lastSync.getMinutes().toString().padStart(2,"0")} 동기화됨`
    : "";

  if (loading) return (
    <div style={{ ...styles.root, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>📚</div>
      <div style={{ color: "#7a6f5e", fontSize: 14 }}>불러오는 중...</div>
    </div>
  );

  return (
    <div style={styles.root}>
      <div style={styles.bg} />

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>📚</div>
          <div>
            <div style={styles.title}>SamBrary</div>
            <div style={styles.subtitle}>{saving ? "저장 중..." : syncText}{" · "}{records.length}권의 기록</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.iconBtn} onClick={loadData}>🔄</button>
          <button style={styles.iconBtn} onClick={() => { setEditingNames([...memberNames]); setShowSettings(true); }}>⚙️</button>
          <button style={styles.addBtn} onClick={openForm}>+ 새 기록</button>
        </div>
      </header>

      <main style={styles.main}>
        {error && <div style={styles.errorBox}>{error}</div>}
        <div style={styles.notice}>🔗 3명이 실시간 공유 · ✏️ 눌러서 한줄평 수정 가능</div>

        {records.length === 0 && !error && (
          <div style={styles.empty}>
            <div style={{ fontSize: 48 }}>📖</div>
            <div style={styles.emptyText}>아직 기록이 없어요</div>
            <div style={styles.emptySubtext}>첫 번째 독서모임을 기록해보세요!</div>
          </div>
        )}

        {records.map((rec, idx) => {
          const isOpen = expandedId === rec.id;
          return (
            <div key={rec.id} style={styles.card}>
              <div style={styles.cardTop} onClick={() => setExpandedId(isOpen ? null : rec.id)}>
                <div style={styles.cardEmoji}>{emoji(idx)}</div>
                <div style={styles.cardInfo}>
                  <div style={styles.bookTitle}>{rec.book}</div>
                  {rec.author && <div style={styles.bookAuthor}>{rec.author}</div>}
                  <div style={styles.bookDate}>{formatDate(rec.date)}</div>
                </div>
                <div style={styles.cardActions}>
                  <button style={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(rec.id); }}>🗑</button>
                  <div style={{ ...styles.chevron, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▾</div>
                </div>
              </div>

              {isOpen && (
                <div style={styles.reviews}>
                  {memberNames.map((name, i) => {
                    const isEditing = editingReview?.recordId === rec.id && editingReview?.idx === i;
                    const reviewText = rec.reviews?.[String(i)] || "";
                    return (
                      <div key={i} style={styles.reviewRow}>
                        <div style={styles.reviewName}>{name}</div>
                        <div style={{ flex: 1 }}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <input
                                autoFocus
                                style={styles.reviewInput}
                                value={editingText}
                                onChange={e => setEditingText(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") saveReview(rec.id); if (e.key === "Escape") setEditingReview(null); }}
                                placeholder="한 줄로 남겨보세요"
                                onClick={e => e.stopPropagation()}
                              />
                              <button style={styles.saveReviewBtn} onClick={e => { e.stopPropagation(); saveReview(rec.id); }} disabled={saving}>✓</button>
                              <button style={styles.cancelReviewBtn} onClick={e => { e.stopPropagation(); setEditingReview(null); }}>✕</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={styles.reviewText}>
                                {reviewText || <span style={{ opacity: 0.35 }}>아직 한줄평이 없어요</span>}
                              </div>
                              <button style={styles.editReviewBtn} onClick={e => startEditReview(e, rec.id, i, reviewText)}>✏️</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {showForm && (
        <div style={styles.overlay} onClick={() => setShowForm(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>새 독서모임 기록</div>
            <label style={styles.label}>날짜</label>
            <input type="date" style={styles.input} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <label style={styles.label}>책 제목 *</label>
            <input style={styles.input} placeholder="예: 채식주의자" value={form.book} onChange={e => setForm(f => ({ ...f, book: e.target.value }))} />
            <label style={styles.label}>저자</label>
            <input style={styles.input} placeholder="예: 한강" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
            <div style={styles.divider} />
            <div style={{ fontSize: 12, color: "#7a6f5e" }}>* 한줄평은 나중에 카드에서도 수정할 수 있어요</div>
            {memberNames.map((name, i) => (
              <div key={i}>
                <label style={styles.label}>{name}의 한줄평</label>
                <input
                  style={styles.input}
                  placeholder="한 줄로 남겨보세요"
                  value={form.reviews[String(i)] || ""}
                  onChange={e => setForm(f => ({ ...f, reviews: { ...f.reviews, [String(i)]: e.target.value } }))}
                />
              </div>
            ))}
            <div style={styles.modalBtns}>
              <button style={styles.cancelBtn} onClick={() => setShowForm(false)}>취소</button>
              <button style={styles.submitBtn} onClick={handleSubmit} disabled={!form.book.trim() || saving}>{saving ? "저장 중..." : "저장하기"}</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div style={styles.overlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalTitle}>멤버 이름 설정</div>
            <div style={{ fontSize: 12, color: "#7a6f5e", marginBottom: 16 }}>이름을 바꿔도 기존 한줄평은 그대로예요 😊</div>
            {[0, 1, 2].map(i => (
              <div key={i}>
                <label style={styles.label}>멤버 {i + 1}</label>
                <input style={styles.input} value={editingNames[i]} onChange={e => { const arr = [...editingNames]; arr[i] = e.target.value; setEditingNames(arr); }} />
              </div>
            ))}
            <div style={styles.modalBtns}>
              <button style={styles.cancelBtn} onClick={() => setShowSettings(false)}>취소</button>
              <button style={styles.submitBtn} onClick={saveNames} disabled={saving}>{saving ? "저장 중..." : "저장하기"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { minHeight: "100vh", background: "#0f0e0c", color: "#e8e2d5", fontFamily: "'Georgia', 'Noto Serif KR', serif", position: "relative", overflowX: "hidden" },
  bg: { position: "fixed", inset: 0, background: "radial-gradient(ellipse at 20% 0%, #2a1f0e 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #1a0f1f 0%, transparent 60%)", pointerEvents: "none", zIndex: 0 },
  header: { position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", background: "rgba(15,14,12,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 28 },
  title: { fontSize: 18, fontWeight: "bold", letterSpacing: "-0.02em", color: "#f0e8d5" },
  subtitle: { fontSize: 11, color: "#7a6f5e", marginTop: 2 },
  headerRight: { display: "flex", alignItems: "center", gap: 8 },
  iconBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "6px 8px", borderRadius: 8, color: "#7a6f5e" },
  addBtn: { background: "#c8a96e", color: "#0f0e0c", border: "none", borderRadius: 20, padding: "8px 18px", fontWeight: "bold", fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  main: { position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: "16px 16px 80px", display: "flex", flexDirection: "column", gap: 12 },
  notice: { background: "rgba(200,169,110,0.08)", border: "1px solid rgba(200,169,110,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#c8a96e", textAlign: "center" },
  errorBox: { background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#ff8080", textAlign: "center" },
  empty: { textAlign: "center", padding: "80px 0", opacity: 0.5 },
  emptyText: { fontSize: 18, marginTop: 16, color: "#e8e2d5" },
  emptySubtext: { fontSize: 13, marginTop: 8, color: "#7a6f5e" },
  card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "18px 20px" },
  cardTop: { display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer" },
  cardEmoji: { fontSize: 24, flexShrink: 0, marginTop: 2 },
  cardInfo: { flex: 1, minWidth: 0 },
  bookTitle: { fontSize: 17, fontWeight: "bold", color: "#f0e8d5", letterSpacing: "-0.01em" },
  bookAuthor: { fontSize: 13, color: "#c8a96e", marginTop: 3 },
  bookDate: { fontSize: 12, color: "#5a5248", marginTop: 5 },
  cardActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  deleteBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.3, padding: 4, color: "#e8e2d5" },
  chevron: { color: "#7a6f5e", fontSize: 28, transition: "transform 0.25s ease", userSelect: "none" },
  reviews: { marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 14 },
  reviewRow: { display: "flex", gap: 12, alignItems: "flex-start" },
  reviewName: { flexShrink: 0, width: 60, fontSize: 11, fontWeight: "bold", color: "#c8a96e", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 4 },
  reviewText: { flex: 1, fontSize: 14, color: "#c8bfb0", lineHeight: 1.6, fontStyle: "italic" },
  editReviewBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 13, opacity: 0.4, padding: 2, flexShrink: 0 },
  reviewInput: { flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(200,169,110,0.4)", borderRadius: 8, padding: "6px 10px", color: "#e8e2d5", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%" },
  saveReviewBtn: { background: "#c8a96e", border: "none", borderRadius: 6, padding: "5px 8px", color: "#0f0e0c", fontWeight: "bold", cursor: "pointer", fontSize: 13, flexShrink: 0 },
  cancelReviewBtn: { background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "5px 8px", color: "#7a6f5e", cursor: "pointer", fontSize: 13, flexShrink: 0 },
  overlay: { position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#1a1814", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: "#f0e8d5", marginBottom: 20, letterSpacing: "-0.01em" },
  label: { display: "block", fontSize: 11, fontWeight: "bold", color: "#c8a96e", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#e8e2d5", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  divider: { borderTop: "1px solid rgba(255,255,255,0.08)", margin: "20px 0 6px" },
  modalBtns: { display: "flex", gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, padding: "12px", color: "#7a6f5e", fontSize: 14, cursor: "pointer", fontFamily: "inherit" },
  submitBtn: { flex: 2, background: "#c8a96e", border: "none", borderRadius: 10, padding: "12px", color: "#0f0e0c", fontSize: 14, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" },
};
