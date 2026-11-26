from flask import Blueprint, abort, jsonify, send_from_directory

from .. import FRONTEND_DIR

spa_bp = Blueprint("spa", __name__)

ASSET_SUFFIXES = {
    ".css",
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".json",
    ".map",
    ".mjs",
    ".otf",
    ".png",
    ".svg",
    ".ttf",
    ".txt",
    ".wasm",
    ".webmanifest",
    ".webp",
    ".woff",
    ".woff2",
    ".xml",
}


def _no_store(response):
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return response


@spa_bp.get("/")
def index():
    return _no_store(send_from_directory(FRONTEND_DIR, "index.html"))


@spa_bp.get("/<path:filename>")
def static_or_spa(filename):
    if filename == "api" or filename.startswith("api/"):
        return jsonify(error="Rota não encontrada."), 404

    candidate = (FRONTEND_DIR / filename).resolve()
    try:
        candidate.relative_to(FRONTEND_DIR.resolve())
    except ValueError:
        abort(404)

    if candidate.is_file():
        response = send_from_directory(FRONTEND_DIR, filename)
        suffix = candidate.suffix.lower()

        if suffix in {".html", ".webmanifest"}:
            return _no_store(response)

        # Estáticos (JS/CSS) precisam revalidar para não ficarem presos em cache.
        if suffix in ASSET_SUFFIXES:
            response.headers["Cache-Control"] = "no-cache, max-age=0, must-revalidate"
        return response

    # Nunca devolver index.html para um arquivo estático ausente: o navegador
    # receberia HTML no lugar de JS/CSS e falharia com erro de MIME type.
    if candidate.suffix.lower() in ASSET_SUFFIXES:
        abort(404)

    return _no_store(send_from_directory(FRONTEND_DIR, "index.html"))
