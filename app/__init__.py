import hashlib
import hmac
import os
import secrets
from pathlib import Path
from urllib.parse import urlparse

from flask import Flask, g, jsonify, request, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from werkzeug.middleware.proxy_fix import ProxyFix

db = SQLAlchemy()

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
INSTANCE_DIR = BASE_DIR / "instance"

def normalize_db_url(url):
    """Normaliza URLs de banco: trata postgres:// e ajusta drivers."""
    if not url:
        return url
    url = url.strip()
    # Se já vier com driver SQLAlchemy, usa como está
    if url.startswith("sqlite://") or url.startswith("postgres://") or url.startswith("postgresql://"):
        return url
    # Fallback: se for um caminho relativo, vira SQLite local
    return url

def resolve_database_uri(default_uri):
    """Resolve o DATABASE_URL: PostgreSQL (Neon) > SQLite local (desenvolvimento)."""
    # Check DATABASE_URL first (explicit database URL)
    explicit = os.environ.get("DATABASE_URL", "").strip()
    if explicit:
        return normalize_db_url(explicit)

    # Fallback para SQLALCHEMY_DATABASE_URI (também usado por testes)
    sqlalchemy_explicit = os.environ.get("SQLALCHEMY_DATABASE_URI", "").strip()
    if sqlalchemy_explicit:
        return normalize_db_url(sqlalchemy_explicit)

    # Fallback para SQLite local (apenas para desenvolvimento)
    return normalize_db_url(default_uri)

def ensure_database_directory(uri):
    """Cria pasta pai apenas para SQLite local. PostgreSQL não precisa."""
    try:
        url = urlparse(uri)
    except Exception:
        return

    if url.scheme != "sqlite":
        return  # PostgreSQL não tem caminho de arquivo no sistema

    database = url.path.lstrip("/")
    if not database or database == ":memory:":
        return

    Path(database).parent.mkdir(parents=True, exist_ok=True)

def ensure_schema():
    """Ajustes idempotentes para bancos criados por versões anteriores."""
    from sqlalchemy import inspect

    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())

    if "user" in tables:
        user_columns = {column["name"] for column in inspector.get_columns("user")}
        if "api_key" not in user_columns:
            db.session.execute(text('ALTER TABLE "user" ADD COLUMN api_key VARCHAR(64)'))
            db.session.commit()

    if "workouts" in tables:
        workout_columns = {
            column["name"] for column in inspector.get_columns("workouts")
        }
        if "user_id" not in workout_columns:
            db.session.execute(
                text(
                    'ALTER TABLE workouts ADD COLUMN user_id INTEGER '
                    'REFERENCES "user"(id)'
                )
            )
            db.session.commit()

        if "tipo" not in workout_columns:
            db.session.execute(
                text("ALTER TABLE workouts ADD COLUMN tipo VARCHAR(20)")
            )
            db.session.commit()


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    INSTANCE_DIR.mkdir(parents=True, exist_ok=True)

    default_db_uri = f"sqlite:///{(INSTANCE_DIR / 'treinolog.db').as_posix()}"
    database_uri = resolve_database_uri(default_db_uri)
    api_key = os.environ.get("API_KEY", "").strip()
    is_sqlite = database_uri.startswith("sqlite")

    # Em produção (Postgres) o segredo de sessão não pode ser o padrão de
    # desenvolvimento. Sem SECRET_KEY explícita, deriva da API_KEY ou usa um
    # valor aleatório (sessões caem a cada restart, mas continuam seguras).
    secret_key = os.environ.get("SECRET_KEY", "").strip()
    if not secret_key:
        if is_sqlite:
            secret_key = "dev-secret-change-in-production"
        elif api_key:
            secret_key = hashlib.sha256(
                f"treinolog-session:{api_key}".encode("utf-8")
            ).hexdigest()
        else:
            secret_key = secrets.token_hex(32)

    cookie_secure_env = os.environ.get("SESSION_COOKIE_SECURE", "").strip().lower()
    if cookie_secure_env in {"1", "true", "yes", "on"}:
        cookie_secure = True
    elif cookie_secure_env in {"0", "false", "no", "off"}:
        cookie_secure = False
    else:
        # Produção usa Postgres e HTTPS; testes/dev usam SQLite em HTTP local.
        cookie_secure = not is_sqlite

    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=database_uri,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SQLALCHEMY_ENGINE_OPTIONS={
            "pool_pre_ping": True,
            "pool_recycle": 300,
        },
        API_KEY=api_key,
        SECRET_KEY=secret_key,
        MAX_CONTENT_LENGTH=2 * 1024 * 1024,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=cookie_secure,
    )

    if test_config:
        app.config.update(test_config)

    if not os.environ.get("SECRET_KEY", "").strip() and not is_sqlite:
        app.logger.warning(
            "SECRET_KEY não configurada em produção; usando valor derivado. "
            "Defina SECRET_KEY no ambiente para controlar as sessões."
        )

    # Atrás do proxy do Render, respeita X-Forwarded-Proto/For para HTTPS,
    # IP real (rate limit) e URLs absolutas corretas.
    app.wsgi_app = ProxyFix(
        app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1
    )

    ensure_database_directory(app.config["SQLALCHEMY_DATABASE_URI"])

    app.json.sort_keys = False
    db.init_app(app)

    # Importa os modelos antes do create_all para registrar as tabelas no metadata.
    from .models import LEGACY_EMAIL, User, Workout  # noqa: F401

    with app.app_context():
        db.create_all()
        ensure_schema()

    allowed_origins = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "https://localhost,http://localhost:5000,http://127.0.0.1:5000",
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
    from .routes.auth import auth_bp
    from .routes.spa import spa_bp

    app.register_blueprint(api_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(spa_bp)

    @app.before_request
    def load_current_user():
        g.current_user = None
        user_id = session.get("user_id")
        if user_id:
            g.current_user = db.session.get(User, user_id)
        else:
            # Compatibilidade com o modelo antigo de chave compartilhada:
            # aceita a API_KEY configurada no ambiente ou a chave "test-key".
            supplied_key = (request.headers.get("X-API-Key") or "").strip()
            expected_key = app.config.get("API_KEY") or ""
            legacy_key_ok = bool(supplied_key) and bool(expected_key) and (
                hmac.compare_digest(supplied_key, expected_key)
            )
            if legacy_key_ok:
                user = User.query.filter_by(email=LEGACY_EMAIL).first()
                if not user:
                    user = User(nome="Legacy", email=LEGACY_EMAIL)
                    # Senha aleatória: esta conta é técnica e não deve ter
                    # login por senha conhecida.
                    user.set_senha(secrets.token_urlsafe(32))
                    db.session.add(user)
                    db.session.commit()
                g.current_user = user

        # Rotas da API requerem autenticação (exceto OPTIONS para CORS preflight)
        # Estas rotas são públicas:
        PUBLIC_API_ROUTES = ["/api/status", "/api/healthz"]
        
        if (g.current_user is None 
            and request.method != "OPTIONS" 
            and request.path.startswith("/api/")
            and request.path not in PUBLIC_API_ROUTES):
            return jsonify({"error": "Não autorizado"}), 401

    @app.get("/healthz")
    def healthz():
        try:
            db.session.execute(text("SELECT 1"))
        except Exception:
            return jsonify(status="error"), 503
        return jsonify(status="ok")

    @app.get("/api/status")
    def api_status():
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify({"status": "ok", "db": "connected"})
        except Exception:
            return jsonify({"status": "error", "db": "disconnected"}), 503

    @app.after_request
    def apply_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "same-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
        # CSP: nenhum recurso externo; scripts/estilos inline são necessários
        # pelo app atual. Ainda bloqueia injeção de scripts de terceiros.
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "object-src 'none'; "
            "base-uri 'self'; "
            "form-action 'self'; "
            "frame-ancestors 'none'",
        )
        if request.is_secure:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response

    return app