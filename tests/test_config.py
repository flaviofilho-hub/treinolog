from app import (
    create_app,
    db,
    ensure_database_directory,
    resolve_database_uri,
)


def test_resolve_database_uri_prefers_database_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:////tmp/custom.db")
    monkeypatch.setenv("RAILWAY_VOLUME_MOUNT_PATH", "/data")

    assert resolve_database_uri("sqlite:///default.db") == "sqlite:////tmp/custom.db"


def test_resolve_database_uri_uses_railway_volume(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("RAILWAY_VOLUME_MOUNT_PATH", "/data")

    assert resolve_database_uri("sqlite:///default.db") == "sqlite:////data/treinolog.db"


def test_resolve_database_uri_falls_back_to_default(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("RAILWAY_VOLUME_MOUNT_PATH", raising=False)

    assert resolve_database_uri("sqlite:///default.db") == "sqlite:///default.db"


def test_ensure_database_directory_creates_parent(tmp_path):
    database = tmp_path / "volume" / "treinolog.db"

    ensure_database_directory(f"sqlite:///{database.as_posix()}")

    assert database.parent.is_dir()


def test_create_app_uses_railway_volume(monkeypatch, tmp_path):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("RAILWAY_VOLUME_MOUNT_PATH", str(tmp_path))

    app = create_app({"TESTING": True, "API_KEY": "test-key"})

    expected = f"sqlite:///{(tmp_path / 'treinolog.db').as_posix()}"
    assert app.config["SQLALCHEMY_DATABASE_URI"] == expected
    assert (tmp_path / "treinolog.db").is_file()

    with app.app_context():
        db.session.remove()


def test_healthz_checks_database(client):
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}
