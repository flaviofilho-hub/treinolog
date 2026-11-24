import hmac

from flask import current_app, jsonify, request


def init_api_auth(blueprint):
    """Protects every route of the API blueprint with a shared API key.

    When API_KEY is empty (local development), authentication is disabled.
    """

    @blueprint.before_request
    def require_api_key():
        if request.method == "OPTIONS":
            return None
        expected = current_app.config.get("API_KEY") or ""
        if not expected:
            return None
        supplied = request.headers.get("X-API-Key", "")
        if not hmac.compare_digest(supplied, expected):
            return jsonify(error="Chave de API inválida ou ausente."), 401
        return None
