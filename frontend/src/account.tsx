import { createGuestSavedStore, savedKey } from "./guestSaved";
import { fetchJsonResponse } from "./request";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { type SupabaseClient, type Session } from "@supabase/supabase-js";
const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
export const accountRegions = [
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
export const accountCategories = [
  "전체",
  "주거",
  "취업",
  "생활",
  "가족",
  "교육",
  "건강",
  "문화",
  "기타",
];
export type Preferences = {
  region: string;
  category: string;
  notificationsEnabled: boolean;
};
type Alert = {
  id: number;
  benefitId: string;
  title: string;
  kind: string;
  createdAt: string;
  read: boolean;
};
export function useAccount() {
  const [client, setClient] = useState<SupabaseClient | null>(null),
    [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<
    "loading" | "ready" | "disabled" | "error"
  >("loading");
  const guestStore = useMemo(() => {
    try { return createGuestSavedStore(localStorage); }
    catch { return createGuestSavedStore(null); }
  }, []);
  const guestSnapshot = useSyncExternalStore(guestStore.subscribe, guestStore.getSnapshot);
  const guest = guestSnapshot.ids;
  const [remote, setRemote] = useState<string[]>([]);
  const [profile, setProfile] = useState<Preferences>({
      region: "전체",
      category: "전체",
      notificationsEnabled: false,
    }),
    [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [recovery, setRecovery] = useState(false);
  const [revision, setRevision] = useState(0);
  const current = useRef(session);
  const sessionEpoch = useRef(0);
  current.current = session;
  const saved = session ? remote : guest;
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === savedKey || event.key === null) guestStore.reload(); };
    addEventListener("storage", sync);
    return () => removeEventListener("storage", sync);
  }, [guestStore]);
  useEffect(() => { if (guestSnapshot.message) setError(guestSnapshot.message); }, [guestSnapshot]);
  function updateSession(value: Session | null) {
    // Invalidate outstanding requests immediately, before React's next render.
    if (current.current?.user.id !== value?.user.id || current.current?.access_token !== value?.access_token) sessionEpoch.current++;
    current.current = value;
    setSession(value);
    if (!value) setRecovery(false);
  }
  useEffect(() => {
    let disposed = false,
      subscription: { unsubscribe: () => void } | undefined,
      auth: SupabaseClient | undefined;
    const abort = new AbortController();
    setState("loading");
    (async () => {
      try {
        const r = await fetchJsonResponse(`${base}/api/client-config`, {
          signal: abort.signal,
        });
        if (!r.ok) throw Error();
        const c = await r.json();
        if (disposed) return;
        if (!c.authEnabled) {
          setState("disabled");
          return;
        }
        const { createClient } = await import("@supabase/supabase-js");
        if (disposed) return;
        auth = createClient(c.supabaseUrl, c.publishableKey);
        subscription = auth.auth.onAuthStateChange((event, s) => {
          if (disposed) return;
          updateSession(s);
          if (event === "PASSWORD_RECOVERY") setRecovery(true);
        }).data.subscription;
        const { data } = await auth.auth.getSession();
        if (!disposed) {
          updateSession(data.session);
          setClient(auth);
          setState("ready");
        }
      } catch {
        if (!disposed) setState("error");
      }
    })();
    return () => {
      disposed = true;
      abort.abort();
      subscription?.unsubscribe();
      auth?.auth.stopAutoRefresh();
    };
  }, [revision]);
  async function request<T>(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<T> {
    const epoch = sessionEpoch.current;
    const owner = current.current;
    if (!owner) throw Error("로그인이 필요해요.");
    const r = await fetchJsonResponse(`${base}/api/account${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${owner.access_token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (sessionEpoch.current !== epoch)
      throw Error("계정이 변경되었어요.");
    if (!r.ok)
      throw Error(
        r.status === 401
          ? "로그인 상태를 다시 확인해 주세요."
          : r.status === 400
            ? "저장 가능한 개수나 입력값을 확인해 주세요."
            : "연결이 지연되고 있어요. 다시 시도해 주세요.",
      );
    const result = r.status === 204 ? undefined : await r.json();
    if (sessionEpoch.current !== epoch)
      throw Error("계정이 변경되었어요.");
    return result as T;
  }
  async function refresh() {
    const epoch = sessionEpoch.current;
    setError("");
    setBusy(true);
    try {
      const [p, s, a] = await Promise.all([
        request<Preferences>("/profile"),
        request<string[]>("/saved"),
        request<Alert[]>("/notifications"),
      ]);
      if (sessionEpoch.current !== epoch) return;
      setProfile(p);
      setRemote(s);
      setAlerts(a);
      setReady(true);
    } catch (e) {
      if (sessionEpoch.current === epoch) setError((e as Error).message);
    } finally {
      if (sessionEpoch.current === epoch) setBusy(false);
    }
  }
  useEffect(() => {
    setRemote([]);
    setAlerts([]);
    setReady(false);
    setBusy(false);
    setError("");
    setProfile({
      region: "전체",
      category: "전체",
      notificationsEnabled: false,
    });
    if (session) void refresh();
  }, [session?.user.id, session?.access_token]);
  async function toggle(id: string) {
    const epoch = sessionEpoch.current;
    if (busy) return;
    if (!session) {
      setError("");
      guestStore.toggle(id);
      return;
    }
    if (!ready) {
      setError("관심목록을 먼저 새로고침해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await request<string[]>(
        remote.includes(id) ? `/saved/${encodeURIComponent(id)}` : "/saved",
        remote.includes(id) ? "DELETE" : "POST",
        remote.includes(id) ? undefined : { ids: [id] },
      );
      if (sessionEpoch.current === epoch) setRemote(result);
    } catch (e) {
      if (sessionEpoch.current === epoch) setError((e as Error).message);
    } finally {
      if (sessionEpoch.current === epoch) setBusy(false);
    }
  }
  async function saveProfile(p: Preferences) {
    const epoch = sessionEpoch.current;
    setBusy(true);
    setError("");
    try {
      const profile = await request<Preferences>("/profile", "PUT", p);
      if (sessionEpoch.current !== epoch) return false;
      setProfile(profile);
      const alerts = await request<Alert[]>("/notifications");
      if (sessionEpoch.current !== epoch) return false;
      setAlerts(alerts);
      return true;
    } catch (e) {
      if (sessionEpoch.current === epoch) setError((e as Error).message);
      return false;
    } finally {
      if (sessionEpoch.current === epoch) setBusy(false);
    }
  }
  async function importGuest() {
    const epoch = sessionEpoch.current;
    setBusy(true);
    setError("");
    try {
      const result = await request<string[]>("/saved", "POST", { ids: guest });
      if (sessionEpoch.current === epoch) setRemote(result);
    } catch (e) {
      if (sessionEpoch.current === epoch) setError((e as Error).message);
    } finally {
      if (sessionEpoch.current === epoch) setBusy(false);
    }
  }
  async function readAlert(a: Alert) {
    const epoch = sessionEpoch.current;
    try {
      await request(`/notifications/${a.id}/read`, "PUT");
      if (sessionEpoch.current !== epoch) return;
      setAlerts((items) =>
        items.map((x) => (x.id === a.id ? { ...x, read: true } : x)),
      );
    } catch (e) {
      if (sessionEpoch.current === epoch) setError((e as Error).message);
    }
  }
  return {
    client,
    session,
    state,
    saved,
    guest,
    profile,
    alerts,
    error,
    busy,
    ready,
    recovery,
    setRecovery,
    toggle,
    refresh,
    saveProfile,
    importGuest,
    readAlert,
    retry: () => setRevision((v) => v + 1),
  };
}
export type Account = ReturnType<typeof useAccount>;
export function AccountPanel({
  account: a,
  onClose,
  onApply,
  onOpen,
}: {
  account: Account;
  onClose: () => void;
  onApply: (p: Preferences) => void;
  onOpen: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const [prefs, setPrefs] = useState(a.profile);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => setPrefs(a.profile), [a.profile]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!a.client) return;
    setPending(true);
    setMessage("");
    try {
      const result = a.recovery
        ? await a.client.auth.updateUser({ password })
        : mode === "login"
          ? await a.client.auth.signInWithPassword({ email, password })
          : mode === "signup"
            ? await a.client.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: location.origin + "/" },
              })
            : await a.client.auth.resetPasswordForEmail(email, {
                redirectTo: location.origin + "/",
              });
      if (result.error) throw result.error;
      setPassword("");
      if (a.recovery) {
        a.setRecovery(false);
        setMessage("비밀번호를 변경했어요.");
      } else if (mode === "signup")
        setMessage(
          "인증 메일을 확인해 주세요. 메일의 링크를 열면 가입을 완료할 수 있어요.",
        );
      else if (mode === "reset")
        setMessage("등록된 이메일이면 비밀번호 변경 안내가 발송됩니다.");
    } catch {
      setMessage(
        "요청을 완료하지 못했어요. 입력한 정보와 이메일 인증 여부를 확인하고 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      className="account-dialog"
      ref={dialog}
      onCancel={onClose}
      onClose={onClose}
      aria-labelledby="account-title"
    >
      <div className="dialog-top">
        <span className="section-kicker">MY BENEFITS</span>
        <button
          className="close-button"
          onClick={onClose}
          aria-label="내 계정 닫기"
        >
          ×
        </button>
      </div>
      <h2 id="account-title">
        {a.session ? "나의 혜택 공간" : "로그인하고 이어서 모아보세요"}
      </h2>
      {a.state === "loading" ? (
        <p role="status">회원 기능을 확인하고 있어요…</p>
      ) : a.state === "disabled" ? (
        <div className="account-note">
          <h3>회원 기능을 준비하고 있어요</h3>
          <p>
            지금은 로그인 없이 혜택을 찾고 이 브라우저에 관심 공고를 저장할 수
            있어요.
          </p>
        </div>
      ) : a.state === "error" ? (
        <div role="alert">
          <p>회원 기능에 연결하지 못했어요.</p>
          <button onClick={a.retry} className="secondary-button">
            다시 연결
          </button>
        </div>
      ) : null}
      {a.state === "ready" && (!a.session || a.recovery) && (
        <form className="account-form" onSubmit={submit}>
          {!a.recovery && (
            <div className="account-tabs">
              {(["login", "signup", "reset"] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m);
                    setMessage("");
                  }}
                >
                  {m === "login"
                    ? "로그인"
                    : m === "signup"
                      ? "회원가입"
                      : "비밀번호 찾기"}
                </button>
              ))}
            </div>
          )}
          {!a.recovery && (
            <label>
              이메일
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {(mode !== "reset" || a.recovery) && (
            <label>
              {a.recovery ? "새 비밀번호" : "비밀번호"}
              <input
                type="password"
                autoComplete={
                  mode === "signup" || a.recovery
                    ? "new-password"
                    : "current-password"
                }
                minLength={mode === "signup" || a.recovery ? 8 : 1}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <button className="primary-button" disabled={pending}>
            {pending
              ? "처리 중…"
              : a.recovery
                ? "비밀번호 변경"
                : mode === "login"
                  ? "로그인"
                  : mode === "signup"
                    ? "인증 메일 받기"
                    : "변경 안내 받기"}
          </button>
          <p className="account-help">
            계정 인증은 Supabase를 통해 처리됩니다. 관심 지역과 분야는 추천
            조건으로 저장하며, 실제 지원 자격은 공식 안내를 확인해 주세요.
          </p>
        </form>
      )}
      {message && (
        <p role="status" className="account-note">
          {message}
        </p>
      )}
      {a.error && (
        <p role="alert" className="account-note">
          {a.error}
        </p>
      )}
      {a.session && !a.recovery && (
        <>
          <div className="account-user">
            <span>{a.session.user.email}</span>
            <button
              className="secondary-button"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                const result = await a.client?.auth.signOut();
                if (result?.error)
                  setMessage("로그아웃하지 못했어요. 다시 시도해 주세요.");
                setPending(false);
              }}
            >
              로그아웃
            </button>
          </div>
          <button className="text-button" disabled={a.busy} onClick={a.refresh}>
            {a.busy ? "불러오는 중…" : "계정 정보 새로고침"}
          </button>
          {a.ready && (
            <>
              <form
                className="account-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (await a.saveProfile(prefs))
                    setMessage("맞춤 조건을 저장했어요.");
                }}
              >
                <h3>나의 관심 조건</h3>
                <div className="account-selects">
                  <label>
                    관심 지역
                    <select
                      value={prefs.region}
                      onChange={(e) =>
                        setPrefs({ ...prefs, region: e.target.value })
                      }
                    >
                      {accountRegions.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    관심 분야
                    <select
                      value={prefs.category}
                      onChange={(e) =>
                        setPrefs({ ...prefs, category: e.target.value })
                      }
                    >
                      {accountCategories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={prefs.notificationsEnabled}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        notificationsEnabled: e.target.checked,
                      })
                    }
                  />
                  사이트 내 알림 받기
                </label>
                <p className="account-help">
                  방문 시 관심 조건에 맞는 최근 7일 새 공고와 저장한 공고의 7일
                  이내 마감을 확인해요. 이메일·푸시 알림은 발송하지 않아요.
                </p>
                <div className="dialog-actions">
                  <button className="primary-button" disabled={a.busy}>
                    조건 저장
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      onApply(prefs);
                      onClose();
                    }}
                  >
                    이 조건으로 찾아보기
                  </button>
                </div>
              </form>
              {a.guest.length > 0 && (
                <div className="account-note">
                  <p>
                    이 브라우저에 저장한 관심 혜택 {a.guest.length}개를 계정에도
                    보관할 수 있어요.
                  </p>
                  <button
                    className="secondary-button"
                    disabled={a.busy}
                    onClick={a.importGuest}
                  >
                    브라우저 관심 혜택 가져오기
                  </button>
                </div>
              )}
              <section className="inbox" aria-label="내 알림">
                <h3>
                  내 알림 <span>{a.alerts.filter((n) => !n.read).length}</span>
                </h3>
                {a.alerts.length === 0 ? (
                  <p>
                    {a.profile.notificationsEnabled
                      ? "아직 새로운 알림이 없어요."
                      : "사이트 내 알림을 켜면 여기에서 확인할 수 있어요."}
                  </p>
                ) : (
                  <ul>
                    {a.alerts.map((n) => (
                      <li key={n.id} className={n.read ? "is-read" : ""}>
                        <button
                          onClick={() => {
                            void a.readAlert(n);
                            onOpen(n.benefitId);
                            onClose();
                          }}
                        >
                          <small>
                            {!n.read ? "● " : ""}
                            {n.kind === "closing" ? "마감 임박" : "새로운 혜택"}
                          </small>
                          <strong>{n.title}</strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </dialog>
  );
}
