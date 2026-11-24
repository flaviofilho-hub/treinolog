from app import (
    create_app,
    db,
    resolve_database_uri,
    ensure_database_directory,
)


def test_resolve_database_url_prefers_explicit(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://user:pass@host/dbname")
    assert resolve_database_uri("sqlite:///default.db") == "postgresql+psycopg://user:pass@host/dbname"


def test_resolve_database_url_fallbacks_to_sqlite_local(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert resolve_database_uri("sqlite:///default.db") == "sqlite:///default.db"


def test_resolve_database_url_handles_postgres_schemes(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://user:pass@host/dbname")
    assert resolve_database_uri("sqlite:///default.db") == "postgres://user:pass@host/dbname"


def test_resolve_database_url_handles_postgresql_schemes(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@host/dbname")
    assert resolve_database_uri("sqlite:///default.db") == "postgresql://user:pass@host/dbname"


def test_resolve_database_url_empty_fallbacks(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert resolve_database_uri("sqlite:///default.db") == "sqlite:///default.db"


def test_ensure_database_directory_sqlite(monkeypatch, tmp_path):
    database = tmp_path / "treinolog.db"
    uri = f"sqlite:///{database.as_posix()}"
    ensure_database_directory(uri)
    assert database.parent.is_dir()


def test_ensure_database_directory_postgres_ignored(monkeypatch):
    # PostgreSQL URLs não devem tentar criar pasta
    ensure_database_directory("postgresql+psycopg://user:pass@host/dbname")
    # Não deve levantar erro


def test_create_app_uses_sqlite_fallback(monkeypatch):
    # Sem DATABASE_URL, usa SQLite local (desenvolvimento)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    app = create_app({"TESTING": True, "API_KEY": "test-key"})
    assert "sqlite" in app.config["SQLALCHEMY_DATABASE_URI"]
    assert "instance" in app.config["SQLALCHEMY_DATABASE_URI"]


def test_create_app_falls_back_to_sqlite_local(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    app = create_app({"TESTING": True, "API_KEY": "test-key"})
    # Deve usar o SQLite local em instance/
    assert "instance" in app.config["SQLALCHEMY_DATABASE_URI"]
    assert app.config["SQLALCHEMY_DATABASE_URI"].endswith("treinolog.db")


def test_create_app_initializes_database(monkeypatch, tmp_path):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv(
        "SQLALCHEMY_DATABASE_URI",
        f"sqlite:///{(tmp_path / 'minha.db').as_posix()}"
    )
    app = create_app({"TESTING": True, "API_KEY": "test-key"})
    with app.app_context():
        # Tabela deve existir sem erro
        from app.models import Exercise
        count = Exercise.query.count()
        assert True  # se chegou aqui, create_all funcionou


def test_healthz_checks_database(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_api_status_checks_database(client):
    response = client.get("/api/status")
    assert response.status_code == 200
    data = response.get_json()
    assert "status" in data