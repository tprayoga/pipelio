export function formatCurrency(value) {
  if (value == null || isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Rupiah ringkas untuk kartu KPI — "Rp 82,4 M" alih-alih "Rp 82.394.000.000"
 * yang meluber keluar kartu.
 */
export function formatCurrencyCompact(value) {
  if (value == null || isNaN(value)) return "Rp 0";
  const units = [
    [1e12, "T"],
    [1e9, "M"],
    [1e6, "jt"],
    [1e3, "rb"],
  ];
  for (const [size, suffix] of units) {
    if (Math.abs(value) >= size) {
      const scaled = value / size;
      // 1 desimal di bawah 100, bulat di atasnya — supaya lebarnya konsisten
      const digits = Math.abs(scaled) < 100 ? 1 : 0;
      return `Rp ${scaled.toLocaleString("id-ID", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })} ${suffix}`;
    }
  }
  return formatCurrency(value);
}

export function formatNumber(value) {
  if (value == null || isNaN(value)) return "0";
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatPercent(value) {
  if (value == null || isNaN(value)) return "0%";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}