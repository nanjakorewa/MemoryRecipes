const firebaseAppUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
const firebaseAuthUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
const firebaseAnalyticsUrl = "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const ready = (cb) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", cb, { once: true });
  } else {
    cb();
  }
};

ready(async () => {
  const root = document.querySelector("[data-auth-root]");
  if (!root) return;

  const config = window.firebaseConfig;
  if (!config || !config.apiKey) {
    console.warn("Firebase config is missing. Skipping auth UI init.");
    return;
  }

  const statusEl = root.querySelector("[data-auth-status]");
  const logoutBtn = root.querySelector("[data-auth-logout]");
  const googleBtn = root.querySelector("[data-auth-google]");
  const messageEl = root.querySelector("[data-auth-message]");

  const strings = {
    loggedOut: root.dataset.statusLoggedOut || "未ログイン",
    loggedIn: root.dataset.statusLoggedIn || "ログイン中",
    loginSuccess: root.dataset.messageLoginSuccess || "ログインしました。",
    logoutSuccess: root.dataset.messageLogoutSuccess || "ログアウトしました。",
    genericError:
      root.dataset.messageErrorGeneric ||
      "エラーが発生しました。もう一度お試しください。",
  };

  const [{ initializeApp }, authPkg] = await Promise.all([
    import(firebaseAppUrl),
    import(firebaseAuthUrl),
  ]);
  const {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
  } = authPkg;

  const app = initializeApp(config);
  if (config.measurementId) {
    try {
      const { getAnalytics } = await import(firebaseAnalyticsUrl);
      getAnalytics(app);
    } catch (error) {
      console.warn("Firebase analytics init failed", error);
    }
  }
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text;
  };

  const showMessage = (text, isError = false) => {
    if (!messageEl) return;
    messageEl.textContent = text;
    messageEl.dataset.variant = isError ? "error" : "success";
  };

  const clearMessage = () => {
    if (messageEl) {
      messageEl.textContent = "";
      delete messageEl.dataset.variant;
    }
  };

  const toggleButtons = (loggedIn) => {
    if (logoutBtn) logoutBtn.hidden = !loggedIn;
    if (googleBtn) googleBtn.hidden = loggedIn;
  };

  const handleError = (error) => {
    console.error(error);
    if (!messageEl) return;
    let text = strings.genericError;
    if (error && typeof error.code === "string") {
      switch (error.code) {
        case "auth/popup-closed-by-user":
          text = "ポップアップが閉じられました。もう一度お試しください。";
          break;
        case "auth/cancelled-popup-request":
          text = "別のログイン処理が動作中です。少し待ってから再実行してください。";
          break;
        case "auth/network-request-failed":
          text = "ネットワークエラーが発生しました。接続を確認してください。";
          break;
        case "auth/too-many-requests":
          text = "試行回数が多すぎます。しばらくしてからお試しください。";
          break;
        default:
          text = strings.genericError;
     }
    }
    showMessage(text, true);
  };

  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      clearMessage();
      try {
        await signInWithPopup(auth, provider);
        showMessage(strings.loginSuccess);
      } catch (error) {
        handleError(error);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      clearMessage();
      try {
        await signOut(auth);
        showMessage(strings.logoutSuccess);
      } catch (error) {
        handleError(error);
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    const loggedIn = Boolean(user);
    toggleButtons(loggedIn);
    setStatus(loggedIn ? strings.loggedIn : strings.loggedOut);
    if (!loggedIn) return;
    clearMessage();
    showMessage(strings.loginSuccess);
  });
});
