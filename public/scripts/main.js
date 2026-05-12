// ============================================================
// Cloudflare Demo Shop — Global Alpine.js logic
// ============================================================

// No global Alpine data needed at this stage.
// Alpine components are defined inline on each page using x-data.

// Utility: smooth scroll to an element by ID
function scrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Utility: copy text to clipboard and briefly show feedback
function copyToClipboard(text, feedbackEl) {
  navigator.clipboard.writeText(text).then(() => {
    if (feedbackEl) {
      feedbackEl.textContent = 'Copied!';
      setTimeout(() => { feedbackEl.textContent = ''; }, 2000);
    }
  });
}
