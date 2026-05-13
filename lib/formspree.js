function normalizeObject(value) {
  if (!value || typeof value !== "object") return {};
  return value;
}

async function forwardToFormspree({ endpoint, fields }) {
  const target = String(endpoint || "").trim();
  if (!target) return;

  const safeFields = normalizeObject(fields);
  const form = new FormData();

  Object.entries(safeFields).forEach(([key, value]) => {
    form.append(String(key), String(value ?? ""));
  });

  const response = await fetch(target, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload?.error || payload?.message || `Formspree forwarding failed with ${response.status}.`);
    error.statusCode = 502;
    error.serviceStatus = response.status;
    throw error;
  }
}

module.exports = { forwardToFormspree };

