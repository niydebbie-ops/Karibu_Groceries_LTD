document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = window.KGL_API_BASE || (["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://localhost:5000" : "");
  const form = document.getElementById("loginForm");
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const rememberMeInput = document.getElementById("rememberMe");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const forgotPasswordLink = document.getElementById("forgotPasswordLink");

  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast show ${type}`;
    toast.textContent = message;
    container.prepend(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function consumePendingToast() {
    try {
      const raw = sessionStorage.getItem("pendingToast");
      if (!raw) return;
      sessionStorage.removeItem("pendingToast");
      const parsed = JSON.parse(raw);
      if (!parsed?.message) return;
      showToast(parsed.message, parsed.type || "info");
    } catch (_) {
      sessionStorage.removeItem("pendingToast");
    }
  }

  // For security, do not preload saved credentials on the login screen.
  localStorage.removeItem("rememberedEmail");
  if (rememberMeInput) rememberMeInput.checked = false;
  consumePendingToast();

  togglePasswordBtn?.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    const eyeOpen = togglePasswordBtn.querySelector(".eye-open");
    const eyeClosed = togglePasswordBtn.querySelector(".eye-closed");
    passwordInput.type = isHidden ? "text" : "password";
    eyeOpen?.classList.toggle("hidden", isHidden);
    eyeClosed?.classList.toggle("hidden", !isHidden);
    togglePasswordBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    togglePasswordBtn.setAttribute("title", isHidden ? "Hide password" : "Show password");
  });

  forgotPasswordLink?.addEventListener("click", (e) => {
    e.preventDefault();
    showToast('Please contact "Director" for password support.', "info");
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email && !password) {
      showToast("Email and password are required.", "error");
      return;
    }
    if (!email) {
      showToast("Email is required.", "error");
      return;
    }
    if (!password) {
      showToast("Password is required.", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const apiMessage = String(data?.message || "").trim();
        showToast(apiMessage || `Login failed (HTTP ${res.status}).`, "error");
        return;
      }

      const payload = data?.data || {};
      const role = String(payload.role || "").trim();
      const roleKey = role.toLowerCase();
      const redirectMap = {
        manager: "manager.html",
        salesagent: "sales.html",
        director: "director.html"
      };

      localStorage.setItem("token", data.token || "");
      localStorage.setItem("role", role);
      localStorage.setItem("userId", payload.id || "");
      localStorage.setItem("userName", payload.fullName || payload.name || "");
      localStorage.setItem("branch", payload.branch || "");

      // Never persist login email/password on this shared login page.
      localStorage.removeItem("rememberedEmail");

      // Clear credentials before redirect to prevent back-button exposure.
      if (form) form.reset();
      emailInput.value = "";
      passwordInput.value = "";

      sessionStorage.removeItem("pendingToast");
      showToast(`Welcome ${payload.fullName || payload.name || "User"}!`, "success");

      setTimeout(() => {
        const nextPage = redirectMap[roleKey];
        if (nextPage) window.location.href = nextPage;
        else showToast(`Unknown account role: ${role || "empty"}`, "error");
      }, 900);
    } catch (err) {
      showToast(`Server unavailable: ${err?.message || "network error"}`, "error");
    }
  });
});
