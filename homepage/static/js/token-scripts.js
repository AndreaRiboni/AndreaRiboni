// --- Color palette: Pastel but with transparency for distinct tokens
const pastelColors = [
  "rgba(110,200,255,0.55)",  // light blue
  "rgba(160,110,255,0.55)",  // light purple
  "rgba(110,255,160,0.55)",  // light green
  "rgba(255,190,110,0.55)",  // light orange
  "rgba(255,110,200,0.55)",  // light pink
  "rgba(255,110,110,0.55)",  // light red
  "rgba(110,255,255,0.55)",  // light cyan
  "rgba(210,110,255,0.55)",  // violet
];

function randomTokenize(str) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    // Always separate contiguous whitespace as a token
    if (/\s/.test(str[i])) {
      let ws = '';
      while (i < str.length && /\s/.test(str[i])) ws += str[i++];
      tokens.push(ws);
    } else {
      // Random token length: 2-6 chars, but don't go past end
      let len = Math.min(str.length - i, Math.floor(Math.random() * 5) + 2);
      tokens.push(str.substr(i, len));
      i += len;
    }
  }
  return tokens;
}

function highlightAllTokens() {
  // Walk visible text nodes only
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (
          !p ||
          ["SCRIPT", "STYLE", "NOSCRIPT"].includes(p.tagName) ||
          getComputedStyle(p).display === "none" ||
          getComputedStyle(p).visibility === "hidden" ||
          +getComputedStyle(p).opacity === 0 ||
          !node.textContent.trim()
        )
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const textNodes = [];
  for (let n; (n = walker.nextNode()); ) textNodes.push(n);

  let colorIdx = 0;
  for (const node of textNodes) {
    const frag = document.createDocumentFragment();
    for (const tok of randomTokenize(node.textContent)) {
      if (/^\s+$/.test(tok)) {
        // Always preserve whitespace as-is
        frag.appendChild(document.createTextNode(tok));
      } else {
        const span = document.createElement("span");
        span.textContent = tok;
        span.dataset.llmToken = "";
        span.style.background = pastelColors[colorIdx++ % pastelColors.length];
        // No margin/padding/border radius: seamless, inline
        span.style.boxDecorationBreak = "clone";
        frag.appendChild(span);
      }
    }
    node.parentNode.replaceChild(frag, node);
  }
}

function removeAllTokenHighlights() {
  document.querySelectorAll("span[data-llm-token]").forEach(span => {
    span.replaceWith(document.createTextNode(span.textContent));
  });
}

// ----------- TOGGLE LOGIC ----------
window.onload = (event) => {
  const toggleBtn = document.getElementById("tokenToggle");
  const label    = document.getElementById("tokenToggleLabel");
  let tokenized  = false;

  toggleBtn.addEventListener("click", async e => {
    e.preventDefault();

    if (!tokenized) {
      highlightAllTokens();
      label.textContent = "I am a human!";
      tokenized = true;
    } else {
      // Remove the token highlights
      document.querySelectorAll("span[data-llm-token]").forEach(span => {
        span.replaceWith(document.createTextNode(span.textContent));
      });
      label.textContent = "I am an LLM";
      tokenized = false;
    }
  });
};
