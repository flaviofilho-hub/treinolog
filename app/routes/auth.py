from flask import Blueprint, jsonify, request, session
from sqlalchemy import text

from .. import db
from ..models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    nome = (payload.get("nome") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    senha = payload.get("senha") or ""

    if not nome:
        return jsonify({"error": "Informe o nome."}), 400
    if not email:
        return jsonify({"error": "Informe o e-mail."}), 400
    if len(senha) < 6:
        return jsonify({"error": "A senha deve ter pelo menos 6 caracteres."}), 400
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
        User.id != user.id, User.email != "legacy@teste.com"
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
    email = (payload.get("email") or "").strip().lower()
    senha = payload.get("senha") or ""

    if not email or not senha:
        return jsonify({"error": "Informe e-mail e senha."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_senha(senha):
        return jsonify({"error": "E-mail ou senha inválidos."}), 401

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
