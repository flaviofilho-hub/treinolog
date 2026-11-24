import os
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from sqlalchemy.engine import make_url

db = SQLAlchemy()

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
INSTANCE_DIR = BASE_DIR / "instance"


def resolve_database_uri(default_uri):
    """Escolhe o banco: DATABASE_URL > volume do Railway > instance local."""
    explicit = os.environ.get("DATABASE_URL", "").strip()
    if explicit:
        return explicit

    volume_path = os.environ.get("RAILWAY_VOLUME_MOUNT_PATH", "").strip()
    if volume_path:
        database = Path(volume_path) / "treinolog.db"
        return f"sqlite:///{database.as_posix()}"

    return default_uri


def ensure_database_directory(uri):
    """Cria a pasta do SQLite para o volume existir antes do primeiro acesso."""
    try:
        url = make_url(uri)
    except Exception:
        return

    if url.get_backend_name() != "sqlite":
        return

    database = url.database
    if not database or database == ":memory:":
        return

    Path(database).expanduser().parent.mkdir(parents=True, exist_ok=True)


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

    default_db_uri = f"sqlite:///{(INSTANCE_DIR / 'treinolog.db').as_posix()}"
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=resolve_database_uri(default_db_uri),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={"pool_pre_ping": True},
        API_KEY=os.environ.get("API_KEY", "").strip(),
        MAX_CONTENT_LENGTH=2 * 1024 * 1024,
    )
    if test_config:
        app.config.update(test_config)

    ensure_database_directory(app.config["SQLALCHEMY_DATABASE_URI"])

    app.json.sort_keys = False
    db.init_app(app)

    allowed_origins = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "https://localhost,capacitor://localhost,"
            "http://localhost:5000,http://127.0.0.1:5000",
        ).split(",")
        if origin.strip()
    ]
    CORS(
        app,
        resources={r"/api/*": {"origins": allowed_origins}},
        allow_headers=["Content-Type", "X-API-Key"],
        methods=["GET", "POST", "DELETE", "OPTIONS"],
        max_age=86400,
    )

    from .routes.api import api_bp
    from .routes.spa import spa_bp

    app.register_blueprint(api_bp)
    app.register_blueprint(spa_bp)

    with app.app_context():
        db.create_all()

    @app.get("/healthz")
    def healthz():
        try:
            db.session.execute(text("SELECT 1"))
        except Exception:
            return jsonify(status="error"), 503
        return jsonify(status="ok")

    @app.errorhandler(413)
    def payload_too_large(_error):
        if request.path.startswith("/api/"):
            return jsonify(error="Requisição muito grande."), 413
        return "Requisição muito grande.", 413

    @app.errorhandler(405)
    def method_not_allowed(_error):
        if request.path.startswith("/api/"):
            return jsonify(error="Método não permitido."), 405
        return "Método não permitido.", 405

    return app
