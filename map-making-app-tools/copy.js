(() => {
  "use strict";

  const CHROME_EXTENSIONS_URL = "chrome://extensions/";

  for (const button of document.querySelectorAll("[data-copy-chrome-url]")) {
    let resetTimer = null;

    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(CHROME_EXTENSIONS_URL);
        window.clearTimeout(resetTimer);
        button.classList.add("is-copied");
        button.setAttribute("aria-label", button.dataset.copiedLabel);
        const feedback = button.parentElement.querySelector(".copy-feedback");
        feedback.textContent = button.dataset.copiedLabel;

        resetTimer = window.setTimeout(() => {
          button.classList.remove("is-copied");
          button.setAttribute("aria-label", button.dataset.copyLabel);
          feedback.textContent = "";
        }, 2000);
      } catch {
        button.setAttribute("aria-label", button.dataset.copyErrorLabel);
      }
    });
  }
})();
