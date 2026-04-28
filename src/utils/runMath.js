export const parseTimeToSeconds = (value) => {
  if (!value || typeof value !== "string") return null;
  const parts = value.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;

  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }

  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }

  return null;
};

export const formatSecondsToHms = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const formatSecondsToMmSs = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const safeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const formatDateForInput = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};
