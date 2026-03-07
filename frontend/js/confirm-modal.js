(() => {
  function ensureConfirmModal() {
    let overlay = document.getElementById("confirmModalOverlay");
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = "confirmModalOverlay";
    overlay.className = "confirm-modal-overlay hidden";
    overlay.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirmModalTitle">
        <h3 id="confirmModalTitle">Confirm Delete</h3>
        <p id="confirmModalMessage">Are you sure?</p>
        <div class="confirm-modal-actions">
          <button type="button" id="confirmModalCancel" class="confirm-btn confirm-cancel">Cancel</button>
          <button type="button" id="confirmModalAccept" class="confirm-btn confirm-delete">Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    return overlay;
  }

  window.confirmDeleteAction = function confirmDeleteAction(message) {
    const overlay = ensureConfirmModal();
    const messageEl = overlay.querySelector("#confirmModalMessage");
    const cancelBtn = overlay.querySelector("#confirmModalCancel");
    const acceptBtn = overlay.querySelector("#confirmModalAccept");

    if (!messageEl || !cancelBtn || !acceptBtn) {
      return Promise.resolve(window.confirm(message || "Delete this record?"));
    }

    messageEl.textContent = message || "Delete this record? This action cannot be undone.";

    return new Promise((resolve) => {
      let done = false;

      const cleanup = (answer) => {
        if (done) return;
        done = true;
        overlay.classList.add("hidden");
        cancelBtn.removeEventListener("click", onCancel);
        acceptBtn.removeEventListener("click", onAccept);
        overlay.removeEventListener("click", onOverlayClick);
        document.removeEventListener("keydown", onKeyDown);
        resolve(answer);
      };

      const onCancel = () => cleanup(false);
      const onAccept = () => cleanup(true);
      const onOverlayClick = (e) => {
        if (e.target === overlay) cleanup(false);
      };
      const onKeyDown = (e) => {
        if (e.key === "Escape") cleanup(false);
      };

      cancelBtn.addEventListener("click", onCancel);
      acceptBtn.addEventListener("click", onAccept);
      overlay.addEventListener("click", onOverlayClick);
      document.addEventListener("keydown", onKeyDown);

      overlay.classList.remove("hidden");
      cancelBtn.focus();
    });
  };
})();
