FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

# Dependency disalin lebih dulu supaya layer-nya ter-cache dan build ulang
# setelah perubahan kode tidak mengunduh paket lagi.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY core ./core
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini docker-entrypoint.sh ./
COPY data ./data

RUN chmod +x docker-entrypoint.sh \
    && useradd --create-home --uid 1000 pipelio \
    && chown -R pipelio:pipelio /srv
USER pipelio

EXPOSE 8000
ENTRYPOINT ["./docker-entrypoint.sh"]
# --proxy-headers: hormati X-Forwarded-Proto/For dari nginx, sehingga log dan
#   pembentukan URL memakai skema asli (https) dan IP klien sebenarnya.
# --forwarded-allow-ips=*: aman di sini karena port 8000 tidak dipublikasikan —
#   satu-satunya yang bisa menjangkau container ini adalah nginx di jaringan
#   internal Compose. Jangan longgarkan bila port ini dibuka ke luar.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
