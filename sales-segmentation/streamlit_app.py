"""
Streamlit App — Segmentasi Performa Sales (K-Means Clustering)
Skripsi: Penerapan K-Means Clustering untuk Segmentasi Performa Sales
Berbasis Data Pipeline — PT Indotek Buana Karya.

Jalankan:  streamlit run streamlit_app.py
"""

from io import BytesIO

import pandas as pd
import plotly.express as px
import streamlit as st

from core import clustering, config, ingest, insights, sample

st.set_page_config(page_title="Segmentasi Performa Sales", layout="wide")
LABEL_COLORS = {"High": "#16a34a", "Medium": "#f59e0b", "Low": "#dc2626"}


# --------------------------------------------------------------------------- #
# Sidebar — sumber data
# --------------------------------------------------------------------------- #
st.sidebar.title("⚙️ Konfigurasi Analisis")

source = st.sidebar.radio(
    "Sumber Data",
    ["Upload Dataset", "Gunakan Data Contoh"],
    help="Upload Dataset = fokus penelitian. Data contoh untuk uji cepat.",
)

df_raw = None
if source == "Upload Dataset":
    up = st.sidebar.file_uploader("File Excel / CSV", type=["xlsx", "xls", "csv"])
    if up is not None:
        df_raw = pd.read_csv(up) if up.name.endswith(".csv") else pd.read_excel(up)
else:
    which = st.sidebar.selectbox(
        "Dataset contoh",
        ["10 Sales (tahunan)", "40 baris Sales-Quarter"],
    )
    df_raw = (
        sample.make_annual_10() if which.startswith("10")
        else sample.make_sales_quarter_40()
    )

# Template unduhan (skema sesuai data pipeline riil: per sales-quarter)
tmpl_df = pd.DataFrame({
    "Sales Executive": ["Ari", "Ari", "Budi"],
    "Quarter": ["Q1", "Q2", "Q1"],
    "Lead": [5, 7, 4], "Prospecting": [4, 5, 3], "Negotiating": [3, 4, 2],
    "Won": [3, 3, 2], "Lost": [0, 1, 1], "Hold": [0, 0, 1],
})
tmpl = BytesIO()
tmpl_df.to_excel(tmpl, index=False)
st.sidebar.download_button(
    "⬇️ Unduh template dataset", tmpl.getvalue(),
    file_name="template_dataset_sales.xlsx",
)

# --------------------------------------------------------------------------- #
# Header
# --------------------------------------------------------------------------- #
st.title("📊 Segmentasi Performa Sales — K-Means Clustering")
st.caption("Decision Support System · PT Indotek Buana Karya")

if df_raw is None:
    st.info("Silakan upload dataset atau pilih data contoh pada panel kiri.")
    st.stop()

# Normalisasi kolom (mendukung 'Sales Executive', 'Negotiating', dll.)
df = ingest.normalize_columns(df_raw)

try:
    clustering.validate_dataframe(df)
except ValueError as e:
    st.error(str(e))
    st.caption("Kolom minimum: name/Sales Executive, Lead, Prospecting, "
               "Negotiating, Won, Lost, Hold. Quarter & won_value opsional.")
    st.stop()

# --------------------------------------------------------------------------- #
# Sidebar — mode analisis (muncul bila ada kolom Quarter)
# --------------------------------------------------------------------------- #
if ingest.has_quarter(df):
    mode = st.sidebar.selectbox(
        "Mode Analisis",
        ["Akumulasi Tahunan", "Per Quarter", "Sales-Quarter (semua baris)"],
        help="Tahunan: jumlah Q1..Q4 per sales. Sales-Quarter: dataset lebih "
             "gemuk untuk pengujian metode.",
    )
    if mode == "Akumulasi Tahunan":
        data = ingest.aggregate_annual(df)
        period = "2025 · Akumulasi Tahunan"
    elif mode == "Per Quarter":
        q = st.sidebar.selectbox("Pilih Quarter", ingest.available_quarters(df))
        data = ingest.filter_quarter(df, q)
        period = f"2025 · {q}"
    else:
        data = ingest.as_sales_quarter(df)
        period = "2025 · Sales-Quarter (40 baris)"
else:
    data = df
    period = "Dataset (apa adanya)"

k = st.sidebar.number_input(
    "Jumlah Cluster (K)", min_value=2, max_value=6, value=config.N_CLUSTERS,
    help="Default 3 (High/Medium/Low). Ubah hanya untuk eksplorasi.",
)
st.sidebar.markdown("---")
st.sidebar.caption(
    "Fitur clustering: " + ", ".join(config.active_features(data.columns))
    + ". Dinormalisasi (StandardScaler) sebelum K-Means."
)

# --------------------------------------------------------------------------- #
# 1) Preview
# --------------------------------------------------------------------------- #
st.subheader("1. Preview Dataset")
st.caption(f"Periode: **{period}** · {len(data)} baris")
st.dataframe(data, width='stretch', hide_index=True)

# Streamlit menjalankan ulang skrip ini setiap kali widget disentuh. Tanpa
# session_state, mengubah filter apa pun setelah generate akan menghapus hasil
# dan memaksa klik ulang. Hasil disimpan bersama "tanda tangan" input-nya supaya
# otomatis kedaluwarsa ketika dataset/mode/K berubah.
signature = (period, int(k), len(data), tuple(sorted(data.columns)),
             pd.util.hash_pandas_object(data, index=False).sum())

if st.button("🚀 Generate Clustering", type="primary"):
    st.session_state["run"] = {
        "signature": signature,
        "output": clustering.run_clustering(data, k=int(k)),
    }

run = st.session_state.get("run")
if run is None:
    st.stop()
if run["signature"] != signature:
    st.info("Konfigurasi berubah sejak clustering terakhir. "
            "Klik **Generate Clustering** untuk memperbarui hasil.")
    st.stop()

# --------------------------------------------------------------------------- #
# 2) Proses
# --------------------------------------------------------------------------- #
result, sil = run["output"]

st.subheader("2. Proses Clustering")
c1, c2, c3, c4 = st.columns(4)
c1.metric("Algoritma", "K-Means")
c2.metric("Jumlah Cluster", int(k))
c3.metric("Normalisasi", "StandardScaler")
c4.metric("Silhouette Score", f"{sil:.4f}" if sil is not None else "N/A")

if sil is not None:
    quality = "kuat" if sil >= 0.5 else "cukup baik" if sil >= 0.25 else "lemah"
    st.caption(f"Kualitas pemisahan cluster tergolong **{quality}** "
               f"(Silhouette {sil:.3f}).")

with st.expander("🔍 Perbandingan nilai K (mendukung pemilihan K=3)"):
    sweep = clustering.sweep_k(data)
    st.dataframe(sweep, width='stretch', hide_index=True)
    valid = sweep.dropna(subset=["silhouette"])
    if not valid.empty:
        st.plotly_chart(
            px.line(valid, x="k", y="silhouette", markers=True,
                    title="Silhouette Score per nilai K"),
            width='stretch',
        )

# --------------------------------------------------------------------------- #
# 3) Hasil
# --------------------------------------------------------------------------- #
st.subheader("3. Hasil Segmentasi")
show_cols = (
    [c for c in ["sales_id", "name", "quarter"] if c in result.columns]
    + config.active_features(result.columns)
    + ["cluster", "label", "score"]
)
styled = result[show_cols].copy()
styled["score"] = styled["score"].round(2)
st.dataframe(
    styled.style.apply(
        lambda r: [f"background-color: {LABEL_COLORS[r['label']]}22"] * len(r),
        axis=1,
    ),
    width='stretch', hide_index=True,
)

# --------------------------------------------------------------------------- #
# 4) Visualisasi
# --------------------------------------------------------------------------- #
st.subheader("4. Visualisasi Hasil")
v1, v2 = st.columns(2)
dist = result["label"].value_counts().reindex(config.LABEL_ORDER).dropna()
with v1:
    st.plotly_chart(
        px.pie(names=dist.index, values=dist.values, title="Distribusi Cluster",
               color=dist.index, color_discrete_map=LABEL_COLORS, hole=0.4),
        width='stretch',
    )
with v2:
    st.plotly_chart(
        px.bar(result.sort_values("score", ascending=False),
               x="name", y="won", color="label",
               color_discrete_map=LABEL_COLORS, title="Total Won per Sales"),
        width='stretch',
    )

coords = clustering.pca_2d(result)
result["_pc1"], result["_pc2"] = coords[:, 0], coords[:, 1]
fig_sc = px.scatter(
    result, x="_pc1", y="_pc2", color="label", text="name",
    color_discrete_map=LABEL_COLORS,
    labels={"_pc1": "Komponen 1", "_pc2": "Komponen 2"},
    title="Sebaran Cluster (proyeksi PCA 2D)",
)
fig_sc.update_traces(textposition="top center", marker=dict(size=14))
st.plotly_chart(fig_sc, width='stretch')

# --------------------------------------------------------------------------- #
# 5) Insight & Rekomendasi
# --------------------------------------------------------------------------- #
st.subheader("5. Insight & Rekomendasi Manajerial")
for ins in insights.build_insights(result):
    with st.container(border=True):
        st.markdown(f"### {ins['label']} — {ins['jumlah_sales']} sales")
        st.caption("Anggota: " + ", ".join(ins["anggota"]))
        cc1, cc2 = st.columns(2)
        with cc1:
            st.markdown("**Karakteristik (rata-rata)**")
            lines = [
                f"- Won: **{ins['rata_won']:.1f}**",
                f"- Lost: **{ins['rata_lost']:.1f}**",
                f"- Hold: **{ins['rata_hold']:.1f}**",
            ]
            if ins["rata_won_value"] is not None:
                lines.append(f"- Nilai Won: **{ins['rata_won_value']:.0f}**")
            st.markdown("\n".join(lines))
            for c in ins["karakteristik"]:
                st.markdown(f"- {c}")
        with cc2:
            st.markdown("**Rekomendasi**")
            for r in ins["rekomendasi"]:
                st.markdown(f"- {r}")

# --------------------------------------------------------------------------- #
# 6) Simpan
# --------------------------------------------------------------------------- #
st.subheader("6. Simpan Hasil")
out = BytesIO()
result[show_cols].to_excel(out, index=False)

# Nama file memuat mode analisis, bukan hanya tahun — tiga mode berbeda
# sebelumnya menghasilkan nama file identik dan saling menimpa di folder unduhan.
slug = (period.replace("·", " ").replace("(", " ").replace(")", " ")
        .lower().split())
st.download_button(
    "⬇️ Unduh hasil clustering (Excel)", out.getvalue(),
    file_name=f"hasil_clustering_{'_'.join(slug)}_k{int(k)}.xlsx",
)
