from flask import Blueprint, abort, jsonify, send_from_directory

from .. import FRONTEND_DIR

spa_bp = Blueprint("spa", __name__)


@spa_bp.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


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
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, "index.html")
