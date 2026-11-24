FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

# Cria as tabelas e garante o catálogo antes de subir o servidor.
# O volume do Railway é montado em /data e o banco fica em /data/treinolog.db.
CMD ["sh", "-c", "python seed.py && exec gunicorn --workers 1 --threads 4 --bind 0.0.0.0:${PORT:-8080} wsgi:app"]
