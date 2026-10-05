import { StrictMode, useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
type Benefit = {
  id: string;
  title: string;
  organization: string;
  region: string;
  category: string;
  summary: string;
  eligibility: string;
  support: string;
  applicationMethod: string;
  deadline: string | null;
  periodLabel: string;
  sourceUrl: string;
};
type IconName =
  | "search"
  | "arrow"
  | "bookmark"
  | "home"
  | "work"
  | "wallet"
  | "family"
  | "grid"
  | "pin"
  | "refresh"
  | "close"
  | "check"
  | "info"
  | "clock"
  | "leaf";
const paths: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  bookmark: <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" />,
  home: (
    <>
      <path d="m3 10 9-7 9 7M5 9v12h14V9" />
      <path d="M9 21v-8h6v8" />
    </>
  ),
  work: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="3" />
      <path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M12 12v4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 8V5l14-3v3M21 11h-6v5h6" />
      <path d="M17 13.5h.01" />
    </>
  ),
  family: (
    <>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  pin: (
    <>
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 7a9 9 0 1 0 1 8M20 2v6h-6" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 3C9 2 3 7 5 14s15 9 15-11Z" />
      <path d="M3 21 15 9" />
    </>
  ),
};
function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      className={`icon ${className}`}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Icon name="leaf" />
      </span>
      혜택<span>온</span>
      <span className="brand-dot" />
    </span>
  );
}
const categories: { name: string; icon: IconName; description: string }[] = [
  { name: "전체", icon: "grid", description: "모든 혜택 둘러보기" },
  { name: "주거", icon: "home", description: "내 공간을 위한 지원" },
  { name: "취업", icon: "work", description: "새로운 시작의 기회" },
  { name: "생활", icon: "wallet", description: "일상에 보탬이 되는" },
  { name: "가족", icon: "family", description: "함께하는 삶을 위한" },
];
const regions = [
  "전체",
  "서울",
  "경기",
  "인천",
  "부산",
  "대구",
  "대전",
  "광주",
  "울산",
  "세종",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
];
function readSaved(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem("benefit-saved") || "[]");
    return Array.isArray(value)
      ? value.filter((v) => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
function App() {
  const [items, setItems] = useState<Benefit[]>([]);
  const [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const [q, setQ] = useState(""),
    [region, setRegion] = useState("전체"),
    [category, setCategory] = useState("전체");
  const [openOnly, setOpenOnly] = useState(false),
    [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState(readSaved),
    [selected, setSelected] = useState<Benefit | null>(null);
  const [retry, setRetry] = useState(0),
    [notice, setNotice] = useState(""),
    [sort, setSort] = useState("default");
  const dialog = useRef<HTMLDialogElement>(null),
    searchInput = useRef<HTMLInputElement>(null);
  const activeFilters = Boolean(
    q.trim() || region !== "전체" || category !== "전체" || openOnly,
  );
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError(false);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q,
          region,
          category,
          openOnly: String(openOnly),
        });
        const response = await fetch(`${apiBase}/api/benefits?${params}`, {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error("Request failed");
        const data = await response.json();
        if (!Array.isArray(data.items)) throw new Error("Invalid response");
        if (!abort.signal.aborted) {
          setItems(data.items);
          setDemo(data.demo);
        }
      } catch {
        if (!abort.signal.aborted) setError(true);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [q, region, category, openOnly, retry]);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
    if (!selected) dialog.current?.close();
  }, [selected]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  function toggle(id: string) {
    const exists = saved.includes(id);
    const next = exists ? saved.filter((x) => x !== id) : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("benefit-saved", JSON.stringify(next));
      setNotice(
        exists ? "관심 혜택에서 해제했어요." : "관심 혜택에 저장했어요.",
      );
    } catch {
      setNotice("저장 공간을 사용할 수 없어 이번 방문에만 기억해요.");
    }
  }
  function resetFilters() {
    setQ("");
    setRegion("전체");
    setCategory("전체");
    setOpenOnly(false);
    setSort("default");
  }
  function showList(savedView: boolean) {
    setSavedOnly(savedView);
    resetFilters();
  }
  function goToResults() {
    document
      .getElementById("results")
      ?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  const visible = items
    .filter((b) => !savedOnly || saved.includes(b.id))
    .sort((a, b) =>
      sort === "deadline"
        ? (a.deadline || "9999").localeCompare(b.deadline || "9999")
        : sort === "title"
          ? a.title.localeCompare(b.title, "ko")
          : 0,
    );
  const emptyTitle =
    savedOnly && saved.length === 0
      ? "마음에 드는 혜택을 모아보세요"
      : activeFilters
        ? "조건에 맞는 혜택이 아직 없어요"
        : savedOnly
          ? "현재 조회할 수 있는 관심 혜택이 없어요"
          : "새로운 혜택을 준비하고 있어요";
  const emptyText =
    savedOnly && saved.length === 0
      ? "공고의 저장 버튼을 누르면 이곳에서 다시 확인할 수 있어요."
      : activeFilters
        ? "검색어를 줄이거나 지역과 분야를 넓혀서 다시 찾아보세요."
        : savedOnly
          ? "저장한 공고가 더 이상 제공되지 않을 수 있어요. 다른 혜택을 둘러보세요."
          : "아직 등록된 공고가 없어요. 새로운 공고가 등록되면 이곳에서 확인할 수 있어요.";

  return (
    <>
      <a className="skip-link" href="#results">
        혜택 목록으로 바로가기
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="/" aria-label="혜택온 홈">
            <Brand />
          </a>
          <nav aria-label="주 메뉴">
            <button
              className={!savedOnly ? "nav-active" : ""}
              aria-pressed={!savedOnly}
              onClick={() => showList(false)}
            >
              혜택 둘러보기
            </button>
            <button
              className={savedOnly ? "nav-active" : ""}
              aria-pressed={savedOnly}
              onClick={() => {
                showList(true);
                goToResults();
              }}
            >
              관심 혜택 <span className="nav-count">{saved.length}</span>
            </button>
          </nav>
          <span className="header-caption">
            <span />
            일상에 더하는 작은 기회
          </span>
        </div>
      </header>
      <main className="page-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow">
              <span /> 당신의 일상에, 혜택을 켜다
            </span>
            <h1 id="hero-title">
              나에게 필요한 혜택,
              <br />
              <em>더 가까이</em> 찾아보세요.
            </h1>
            <p>
              주거부터 취업, 생활까지.
              <br />
              놓치기 쉬운 지원 정보를 한곳에서 살펴보세요.
            </p>
            <button
              className="hero-link"
              onClick={() => {
                searchInput.current?.focus();
              }}
            >
              나에게 필요한 혜택 찾기 <Icon name="arrow" />
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-spark spark-one">✦</div>
            <div className="art-spark spark-two">✳</div>
            <div className="art-back" />
            <div className="art-main">
              <div className="art-card-top">
                <span className="art-logo">
                  <Icon name="leaf" />
                </span>
                <span>MY BENEFITS</span>
              </div>
              <strong>
                작은 발견이
                <br />더 나은 일상으로.
              </strong>
              <div className="art-rule" />
              <div className="art-tags">
                <span>주거</span>
                <span>취업</span>
                <span>생활</span>
              </div>
            </div>
            <div className="art-floating">
              <span>
                <Icon name="check" />
              </span>
              나를 위한 새로운 가능성
            </div>
            <div className="art-bookmark">
              <Icon name="bookmark" />
            </div>
          </div>
        </section>
        <form
          className="search-panel"
          onSubmit={(e) => {
            e.preventDefault();
            goToResults();
          }}
          role="search"
        >
          <label className="region-field">
            <span className="field-label">
              <Icon name="pin" />
              어디에 살고 계신가요?
            </span>
            <select
              aria-label="거주 지역"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r === "전체" ? "전국 · 모든 지역" : r}
                </option>
              ))}
            </select>
          </label>
          <div className="search-divider" />
          <label className="keyword-field">
            <span className="field-label">어떤 도움이 필요하세요?</span>
            <span className="input-wrap">
              <Icon name="search" />
              <input
                ref={searchInput}
                type="search"
                aria-label="지원금 검색"
                placeholder="지원금 이름이나 키워드를 입력하세요"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </span>
          </label>
          <button className="primary-button search-submit" type="submit">
            혜택 찾기 <Icon name="arrow" />
          </button>
        </form>
        <section className="category-section" aria-label="분야별 혜택">
          <div className="category-heading">
            <h2>어떤 혜택을 찾으세요?</h2>
            <span>관심 있는 분야를 선택해 보세요</span>
          </div>
          <div className="category-list">
            {categories.map((c) => (
              <button
                key={c.name}
                className={`category-button ${category === c.name ? "selected" : ""}`}
                aria-pressed={category === c.name}
                onClick={() => setCategory(c.name)}
              >
                <span className={`category-icon category-${c.icon}`}>
                  <Icon name={c.icon} />
                </span>
                <span>
                  <strong>{c.name === "전체" ? "전체 혜택" : c.name}</strong>
                  <small>{c.description}</small>
                </span>
                {category === c.name && (
                  <Icon name="check" className="category-check" />
                )}
              </button>
            ))}
          </div>
        </section>
        {demo && (
          <div className="demo-banner" role="status">
            <Icon name="info" />
            데모 미리보기 · 아래 공고는 가상 예시이며 실제 신청할 수 없습니다.
          </div>
        )}
        <div className="content-layout">
          <section
            id="results"
            className="results"
            aria-labelledby="results-title"
            aria-busy={loading}
          >
            <div className="results-heading">
              <div>
                <span className="section-kicker">
                  {savedOnly ? "MY COLLECTION" : "DISCOVER"}
                </span>
                <h2 id="results-title">
                  {savedOnly ? "저장한 관심 혜택" : "지금 살펴볼 혜택"}
                  {!loading && !error && (
                    <span className="result-count">{visible.length}</span>
                  )}
                </h2>
              </div>
              <label className="sort-field">
                <span className="sr-only">목록 정렬</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="default">기본순</option>
                  <option value="deadline">마감 가까운 순</option>
                  <option value="title">이름순</option>
                </select>
              </label>
            </div>
            <div className="filter-toolbar">
              <label className="check">
                <input
                  type="checkbox"
                  checked={openOnly}
                  onChange={(e) => setOpenOnly(e.target.checked)}
                />
                마감된 공고 제외
              </label>
              <button
                className="reset-button"
                onClick={resetFilters}
                disabled={!activeFilters && sort === "default"}
              >
                <Icon name="refresh" />
                조건 초기화
              </button>
            </div>
            {activeFilters && (
              <div className="active-filters" aria-label="적용된 검색 조건">
                {q.trim() && (
                  <button
                    onClick={() => setQ("")}
                    aria-label={`검색어 ${q} 해제`}
                  >
                    “{q}” <Icon name="close" />
                  </button>
                )}
                {region !== "전체" && (
                  <button onClick={() => setRegion("전체")}>
                    {region}
                    <span className="sr-only"> 지역 해제</span>
                    <Icon name="close" />
                  </button>
                )}
                {category !== "전체" && (
                  <button onClick={() => setCategory("전체")}>
                    {category}
                    <span className="sr-only"> 분야 해제</span>
                    <Icon name="close" />
                  </button>
                )}
              </div>
            )}
            <p className="sr-only" role="status">
              {loading
                ? "혜택을 불러오는 중입니다."
                : error
                  ? "혜택 조회에 실패했습니다."
                  : `${visible.length}개의 혜택이 있습니다.`}
            </p>
            {loading ? (
              <div className="benefit-grid" aria-label="혜택 불러오는 중">
                {[1, 2, 3, 4].map((n) => (
                  <div className="skeleton-card" key={n}>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="empty-state" role="alert">
                <span className="empty-icon error-icon">
                  <Icon name="info" />
                </span>
                <h3>혜택을 불러오지 못했어요</h3>
                <p>
                  연결이 일시적으로 지연되고 있어요.
                  <br />
                  잠시 후 다시 시도해 주세요.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  <Icon name="refresh" />
                  다시 불러오기
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration">
                  <span className="empty-dot dot-one" />
                  <span className="empty-dot dot-two" />
                  <div className="empty-paper">
                    <Icon
                      name={
                        savedOnly
                          ? "bookmark"
                          : activeFilters
                            ? "search"
                            : "leaf"
                      }
                    />
                    <span />
                    <span />
                  </div>
                </div>
                <span className="empty-label">
                  {savedOnly
                    ? "나만의 혜택 보관함"
                    : activeFilters
                      ? "조금 더 넓게 찾아볼까요?"
                      : "새로운 기회를 기다리는 중"}
                </span>
                <h3>{emptyTitle}</h3>
                <p>{emptyText}</p>
                {savedOnly ? (
                  <button
                    className="primary-button"
                    onClick={() => showList(false)}
                  >
                    전체 혜택 둘러보기 <Icon name="arrow" />
                  </button>
                ) : activeFilters ? (
                  <button className="primary-button" onClick={resetFilters}>
                    검색 조건 초기화 <Icon name="refresh" />
                  </button>
                ) : (
                  <button
                    className="secondary-button"
                    onClick={() => setRetry((v) => v + 1)}
                  >
                    <Icon name="refresh" />
                    새로 확인하기
                  </button>
                )}
                <div className="empty-footer">
                  <Icon name="info" />
                  신청 전에는 해당 기관의 공식 안내를 꼭 확인하세요.
                </div>
              </div>
            ) : (
              <div className="benefit-grid">
                {visible.map((b) => (
                  <article className="benefit-card" key={b.id}>
                    <div className="card-top">
                      <span className="tag">{b.category}</span>
                      <span className="card-region">{b.region}</span>
                      <button
                        className={`bookmark-button ${saved.includes(b.id) ? "is-saved" : ""}`}
                        aria-label={`${b.title} 관심목록 ${saved.includes(b.id) ? "해제" : "저장"}`}
                        aria-pressed={saved.includes(b.id)}
                        onClick={() => toggle(b.id)}
                      >
                        <Icon name="bookmark" />
                      </button>
                    </div>
                    <p className="organization">{b.organization}</p>
                    <h3>
                      <button onClick={() => setSelected(b)}>{b.title}</button>
                    </h3>
                    <p className="card-summary">{b.summary}</p>
                    <div className="card-bottom">
                      <span>
                        <Icon name="clock" />
                        {b.deadline
                          ? `${b.deadline}까지`
                          : b.periodLabel || "기간 별도 확인"}
                      </span>
                      <button
                        aria-label={`${b.title} 자세히 보기`}
                        onClick={() => setSelected(b)}
                      >
                        <Icon name="arrow" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <aside className="side-column" aria-label="혜택 이용 가이드">
            <section className="saved-panel">
              <span className="saved-panel-icon">
                <Icon name="bookmark" />
              </span>
              <h2>
                좋은 혜택은,
                <br />
                기억해 두세요.
              </h2>
              <p>
                관심 있는 공고를 저장하고
                <br />
                필요할 때 다시 찾아보세요.
              </p>
              <button
                onClick={() => {
                  showList(true);
                  goToResults();
                }}
              >
                내 관심 혜택{" "}
                <span>
                  {saved.length}
                  <Icon name="arrow" />
                </span>
              </button>
              <small>이 브라우저에 저장돼요</small>
            </section>
            <section className="guide-panel">
              <h2>이렇게 이용해 보세요</h2>
              <ol>
                <li>
                  <span>01</span>
                  <div>
                    <strong>내 지역과 분야 선택</strong>
                    <p>전국 대상 공고도 함께 찾아요.</p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <strong>지원 대상 꼼꼼히 확인</strong>
                    <p>공고마다 신청 조건이 달라요.</p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <strong>공식 안내에서 신청</strong>
                    <p>기간과 신청 방법을 확인해요.</p>
                  </div>
                </li>
              </ol>
            </section>
            <a
              className="official-link"
              href="https://www.gov.kr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>
                <small>공식 정보가 필요하다면</small>
                <strong>정부24 바로가기</strong>
              </span>
              <Icon name="arrow" />
            </a>
          </aside>
        </div>
        <section className="bottom-note">
          <span className="note-icon">
            <Icon name="leaf" />
          </span>
          <div>
            <h2>작은 혜택 하나가, 일상의 여유가 되도록.</h2>
            <p>
              혜택온은 필요한 지원 정보를 더 쉽게 발견할 수 있도록 돕습니다.
            </p>
          </div>
          <span className="note-wordmark">혜택온</span>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <Brand />
          <p>더 나은 일상을 위한 작은 발견</p>
        </div>
        <p>
          지원 자격과 신청 기간은 해당 기관의 공식 안내를 확인해 주세요.
          <br />
          관심 혜택은 현재 브라우저에 저장되며, 다른 기기와 동기화되지 않습니다.
        </p>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setSelected(null)}
        onClose={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === dialog.current) {
            const rect = dialog.current.getBoundingClientRect();
            if (
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom
            )
              setSelected(null);
          }
        }}
        aria-labelledby="detail-title"
      >
        {selected && (
          <>
            <div className="dialog-top">
              <span className="tag">
                {selected.category} · {selected.region}
              </span>
              <button
                className="close-button"
                aria-label="상세 닫기"
                onClick={() => setSelected(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="organization">{selected.organization}</p>
            <h2 id="detail-title">{selected.title}</h2>
            {demo && (
              <p className="demo-banner">
                가상 예시 공고입니다. 실제 신청할 수 없습니다.
              </p>
            )}
            <p className="detail-summary">{selected.summary}</p>
            <dl>
              {[
                ["지원 대상", selected.eligibility],
                ["지원 내용", selected.support],
                [
                  "신청 기간",
                  selected.deadline || selected.periodLabel || "공식 안내 확인",
                ],
                ["신청 방법", selected.applicationMethod],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <div className="dialog-actions">
              <button
                className="secondary-button"
                onClick={() => toggle(selected.id)}
              >
                <Icon name="bookmark" />
                {saved.includes(selected.id)
                  ? "관심 혜택 해제"
                  : "관심 혜택 저장"}
              </button>
              {!demo && /^https?:\/\//.test(selected.sourceUrl) && (
                <a
                  className="primary-button"
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  공식 안내 확인 <Icon name="arrow" />
                </a>
              )}
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
