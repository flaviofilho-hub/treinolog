import re
import threading
import time
from collections import deque

import bcrypt
from flask import Blueprint, current_app, jsonify, request, session
from sqlalchemy import text

from .. import db
from ..models import LEGACY_EMAIL, User, _senha_bytes

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")

# Hash descartável: mantém o custo do bcrypt mesmo quando o e-mail não existe,
# evitando descobrir contas cadastradas pelo tempo de resposta.
_DUMMY_HASH = bcrypt.hashpw(
    b"treinolog-dummy-password", bcrypt.gensalt()
).decode("utf-8")

LOGIN_WINDOW = 15 * 60
LOGIN_MAX_PER_EMAIL = 8
LOGIN_MAX_PER_IP = 25
REGISTER_WINDOW = 60 * 60
REGISTER_MAX_PER_IP = 10


def _limiter():
    state = current_app.extensions.get("treinolog_auth_limiter")
    if state is None:
        state = {"lock": threading.Lock(), "login": {}, "register": {}}
        current_app.extensions["treinolog_auth_limiter"] = state
    return state


def _client_ip():
    return request.remote_addr or "desconhecido"


def _prune(bucket, key, now, window):
    attempts = bucket.get(key)
    if not attempts:
        return []
    while attempts and now - attempts[0] > window:
        attempts.popleft()
    if not attempts:
        bucket.pop(key, None)
    return attempts


def _limited(kind, key, window, limit):
    state = _limiter()
    now = time.monotonic()
    with state["lock"]:
        return len(_prune(state[kind], key, now, window)) >= limit


def _record(kind, key):
    state = _limiter()
    now = time.monotonic()
    with state["lock"]:
        state[kind].setdefault(key, deque()).append(now)


def _clear(kind, key):
    state = _limiter()
    with state["lock"]:
        state[kind].pop(key, None)


def _text(value):
    return value.strip() if isinstance(value, str) else ""


@auth_bp.post("/register")
def register():
    ip = _client_ip()
    if _limited("register", ip, REGISTER_WINDOW, REGISTER_MAX_PER_IP):
        return (
            jsonify({"error": "Muitas contas criadas. Tente novamente mais tarde."}),
            429,
        )
    _record("register", ip)

    payload = request.get_json(silent=True) or {}
    nome = _text(payload.get("nome"))
    email = _text(payload.get("email")).lower()
    senha = payload.get("senha")
    senha = senha if isinstance(senha, str) else ""

    if not nome:
        return jsonify({"error": "Informe o nome."}), 400
    if len(nome) > 80:
        return jsonify({"error": "O nome deve ter no máximo 80 caracteres."}), 400
    if not email or len(email) > 120 or not EMAIL_RE.match(email):
        return jsonify({"error": "Informe um e-mail válido."}), 400
    if email == LEGACY_EMAIL:
        return jsonify({"error": "Este e-mail é reservado."}), 409
    if len(senha) < 8:
        return jsonify({"error": "A senha deve ter pelo menos 8 caracteres."}), 400
    if len(senha.encode("utf-8")) > 72:
        return jsonify({"error": "A senha deve ter no máximo 72 caracteres."}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Este e-mail já está cadastrado."}), 409

    user = User(nome=nome, email=email)
    user.set_senha(senha)
    db.session.add(user)
    db.session.flush()

    # A primeira conta real herda os treinos antigos (criados antes do
    # multi-usuário, quando ainda não existia user_id).
    other_users = User.query.filter(
        User.id != user.id, User.email != LEGACY_EMAIL
    ).count()
    if other_users == 0:
        db.session.execute(
            text("UPDATE workouts SET user_id = :uid WHERE user_id IS NULL"),
            {"uid": user.id},
        )

    db.session.commit()

    session.clear()
    session["user_id"] = user.id

    return jsonify({"user": user.to_dict()}), 201


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = _text(payload.get("email")).lower()
    senha = payload.get("senha")
    senha = senha if isinstance(senha, str) else ""

    if not email or not senha:
        return jsonify({"error": "Informe e-mail e senha."}), 400

    ip = _client_ip()
    email_key = f"{ip}|{email}"
    ip_key = f"ip|{ip}"
    if _limited(
        "login", email_key, LOGIN_WINDOW, LOGIN_MAX_PER_EMAIL
    ) or _limited("login", ip_key, LOGIN_WINDOW, LOGIN_MAX_PER_IP):
        return (
            jsonify(
                {"error": "Muitas tentativas. Aguarde alguns minutos e tente novamente."}
            ),
            429,
        )

    user = User.query.filter_by(email=email).first()
    if user is not None and user.email == LEGACY_EMAIL:
        # Conta técnica do modo X-API-Key: não aceita login por senha.
        user = None
    if user is None:
        bcrypt.checkpw(_senha_bytes(senha), _DUMMY_HASH.encode("utf-8"))
        valid = False
    else:
        valid = user.check_senha(senha)

    if not valid:
        _record("login", email_key)
        _record("login", ip_key)
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

    _clear("login", email_key)
    _clear("login", ip_key)
    session.clear()
    session["user_id"] = user.id

    return jsonify({"user": user.to_dict()}), 200


@auth_bp.post("/logout")
def logout():
    session.clear()
    return jsonify({"ok": True}), 200


@auth_bp.get("/me")
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Não autenticado."}), 401

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return jsonify({"error": "Usuário não encontrado."}), 401

    return jsonify({"user": user.to_dict()}), 200
