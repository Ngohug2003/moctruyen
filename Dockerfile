FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY TruyenBackend/requirements.lock.txt .
RUN pip install --no-cache-dir -r requirements.lock.txt && useradd --create-home --uid 10001 moc
COPY --chown=moc:moc TruyenBackend/data ./data
COPY --chown=moc:moc TruyenBackend/app ./app
COPY --chown=moc:moc TruyenBackend/tests ./tests
COPY TruyenBackend/alembic.ini TruyenBackend/pyproject.toml ./
USER moc
EXPOSE 8000
CMD ["sh", "-c", "echo '==> [1/3] Running database migrations...' && python -m alembic upgrade head && echo '==> [2/3] Seeding cultivation guide...' && python -m app.commands.seed_cultivation && echo \"==> [3/3] Starting Uvicorn on port ${PORT:-8000}...\" && exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
