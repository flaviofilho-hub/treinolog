import re
from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from .. import db
from ..auth import init_api_auth
from ..models import Exercise, Workout, WorkoutSet

api_bp = Blueprint("api", __name__, url_prefix="/api")
init_api_auth(api_bp)

CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def error(message, status=400, details=None):
    payload = {"error": message}
    if details:
        payload["details"] = details
    return jsonify(payload), status


def parse_iso_date(value, field="data"):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"{field} deve estar no formato AAAA-MM-DD.")


def parse_int(value, field, minimum, maximum):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} deve ser um número inteiro.")
    if not minimum <= number <= maximum:
        raise ValueError(f"{field} deve estar entre {minimum} e {maximum}.")
    return number


def parse_float(value, field, minimum, maximum):
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field} deve ser um número.")
    if not minimum <= number <= maximum:
        raise ValueError(f"{field} deve estar entre {minimum} e {maximum}.")
    return round(number, 2)


@api_bp.get("/exercicios")
def list_exercises():
    search = (request.args.get("q") or "").strip()
    query = Exercise.query
    if search:
        query = query.filter(Exercise.nome.ilike(f"%{search}%"))
    exercises = query.order_by(Exercise.grupo_muscular, Exercise.nome).all()
    return jsonify([exercise.to_dict() for exercise in exercises])


@api_bp.post("/exercicios")
def create_exercise():
    payload = request.get_json(silent=True) or {}
    nome = (payload.get("nome") or "").strip()
    grupo = (payload.get("grupo_muscular") or "").strip() or None

    if not nome:
        return error("Informe o nome do exercício.")
    if len(nome) > 80:
        return error("O nome deve ter no máximo 80 caracteres.")
    if grupo and len(grupo) > 40:
        return error("O grupo muscular deve ter no máximo 40 caracteres.")

    existing = Exercise.query.filter(func.lower(Exercise.nome) == nome.lower()).first()
    if existing:
        return error("Este exercício já está cadastrado.", 409)

    exercise = Exercise(nome=nome, grupo_muscular=grupo)
    db.session.add(exercise)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return error("Este exercício já está cadastrado.", 409)
    return jsonify(exercise.to_dict()), 201


@api_bp.get("/treinos")
def list_workouts():
    try:
        limit = parse_int(request.args.get("limit", 30), "limit", 1, 100)
        offset = parse_int(request.args.get("offset", 0), "offset", 0, 100000)
    except ValueError as exc:
        return error(str(exc))

    query = Workout.query.options(selectinload(Workout.sets))

    exercise_id = request.args.get("exercicio_id", type=int)
    if exercise_id:
        query = query.filter(Workout.sets.any(WorkoutSet.exercise_id == exercise_id))

    try:
        if request.args.get("de"):
            query = query.filter(Workout.data >= parse_iso_date(request.args["de"], "de"))
        if request.args.get("ate"):
            query = query.filter(Workout.data <= parse_iso_date(request.args["ate"], "ate"))
    except ValueError as exc:
        return error(str(exc))

    total = query.count()
    workouts = (
        query.order_by(Workout.data.desc(), Workout.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return jsonify(
        {
            "items": [workout.to_dict() for workout in workouts],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )


@api_bp.post("/treinos")
def create_workout():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return error("Envie um JSON válido.")

    client_id = (payload.get("client_id") or "").strip() or None
    if client_id and not CLIENT_ID_RE.match(client_id):
        return error("client_id inválido.")
    if client_id:
        existing = Workout.query.filter_by(client_id=client_id).first()
        if existing:
            return jsonify(existing.to_dict()), 200

    try:
        data = parse_iso_date(payload.get("data") or date.today().isoformat())
    except ValueError as exc:
        return error(str(exc))

    nome = (payload.get("nome") or "").strip()
    if not nome:
        return error("Informe o nome do treino.")
    if len(nome) > 80:
        return error("O nome do treino deve ter no máximo 80 caracteres.")

    duracao = payload.get("duracao_min")
    if duracao in (None, ""):
        duracao = None
    else:
        try:
            duracao = parse_int(duracao, "duracao_min", 0, 1440)
        except ValueError as exc:
            return error(str(exc))

    observacoes = (payload.get("observacoes") or "").strip() or None
    if observacoes and len(observacoes) > 2000:
        return error("As observações devem ter no máximo 2000 caracteres.")

    raw_sets = payload.get("sets")
    if not isinstance(raw_sets, list) or not raw_sets:
        return error("Adicione pelo menos uma série.")
    if len(raw_sets) > 300:
        return error("Máximo de 300 séries por treino.")

    exercise_ids = set()
    for index, raw in enumerate(raw_sets, start=1):
        if not isinstance(raw, dict):
            return error(f"Série {index} inválida.")
        try:
            exercise_ids.add(int(raw.get("exercise_id")))
        except (TypeError, ValueError):
            return error(f"Série {index}: exercise_id inválido.")

    found_ids = {
        exercise.id
        for exercise in Exercise.query.filter(Exercise.id.in_(exercise_ids)).all()
    }
    missing = sorted(exercise_ids - found_ids)
    if missing:
        return error(
            "Exercício(s) não encontrado(s).",
            details=[f"IDs inexistentes: {', '.join(map(str, missing))}"],
        )

    workout = Workout(
        client_id=client_id,
        data=data,
        nome=nome,
        duracao_min=duracao,
        observacoes=observacoes,
    )

    seen = set()
    for index, raw in enumerate(raw_sets, start=1):
        try:
            exercise_id = int(raw.get("exercise_id"))
            serie = parse_int(raw.get("serie", index), "serie", 1, 100)
            reps = parse_int(raw.get("reps"), "reps", 1, 1000)
            carga = parse_float(raw.get("carga_kg", 0), "carga_kg", 0, 2000)
        except (TypeError, ValueError) as exc:
            return error(f"Série {index}: {exc}")

        key = (exercise_id, serie)
        if key in seen:
            return error(f"Série {serie} duplicada para o mesmo exercício.")
        seen.add(key)
        workout.sets.append(
            WorkoutSet(
                exercise_id=exercise_id,
                serie=serie,
                reps=reps,
                carga_kg=carga,
            )
        )

    db.session.add(workout)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        if client_id:
            existing = Workout.query.filter_by(client_id=client_id).first()
            if existing:
                return jsonify(existing.to_dict()), 200
        return error("Não foi possível salvar o treino (dados duplicados).", 409)

    return jsonify(workout.to_dict()), 201


@api_bp.get("/treinos/<int:workout_id>")
def get_workout(workout_id):
    workout = db.session.get(Workout, workout_id)
    if not workout:
        return error("Treino não encontrado.", 404)
    return jsonify(workout.to_dict())


@api_bp.delete("/treinos/<int:workout_id>")
def delete_workout(workout_id):
    workout = db.session.get(Workout, workout_id)
    if not workout:
        return error("Treino não encontrado.", 404)
    db.session.delete(workout)
    db.session.commit()
    return "", 204


@api_bp.get("/estatisticas")
def stats():
    total_workouts = db.session.query(func.count(Workout.id)).scalar() or 0
    totals = db.session.query(
        func.count(WorkoutSet.id),
        func.coalesce(func.sum(WorkoutSet.reps), 0),
        func.coalesce(func.sum(WorkoutSet.reps * WorkoutSet.carga_kg), 0.0),
    ).one()

    ultimos = (
        Workout.query.order_by(Workout.data.desc(), Workout.id.desc()).limit(5).all()
    )

    rn = func.row_number().over(
        partition_by=WorkoutSet.exercise_id,
        order_by=(
            WorkoutSet.carga_kg.desc(),
            Workout.data.desc(),
            WorkoutSet.id.desc(),
        ),
    ).label("rn")
    ranked = (
        db.session.query(
            WorkoutSet.exercise_id.label("exercise_id"),
            Exercise.nome.label("nome"),
            WorkoutSet.carga_kg.label("carga_kg"),
            WorkoutSet.reps.label("reps"),
            Workout.data.label("data"),
            rn,
        )
        .join(Workout, Workout.id == WorkoutSet.workout_id)
        .join(Exercise, Exercise.id == WorkoutSet.exercise_id)
        .subquery()
    )
    recordes = (
        db.session.query(ranked)
        .filter(ranked.c.rn == 1)
        .order_by(ranked.c.data.desc())
        .limit(8)
        .all()
    )

    return jsonify(
        {
            "total_treinos": int(total_workouts),
            "total_series": int(totals[0] or 0),
            "total_reps": int(totals[1] or 0),
            "volume_total_kg": round(float(totals[2] or 0), 1),
            "ultimos": [
                workout.to_dict() for workout in ultimos
            ],
            "recordes": [
                {
                    "exercise_id": record.exercise_id,
                    "nome": record.nome,
                    "carga_kg": round(float(record.carga_kg), 1),
                    "reps": record.reps,
                    "data": record.data.isoformat()
                    if hasattr(record.data, "isoformat")
                    else str(record.data),
                }
                for record in recordes
            ],
        }
    )


@api_bp.get("/progresso/<int:exercise_id>")
def progress(exercise_id):
    exercise = db.session.get(Exercise, exercise_id)
    if not exercise:
        return error("Exercício não encontrado.", 404)

    try:
        de = parse_iso_date(request.args["de"], "de") if request.args.get("de") else None
        ate = (
            parse_iso_date(request.args["ate"], "ate")
            if request.args.get("ate")
            else None
        )
    except ValueError as exc:
        return error(str(exc))

    query = (
        db.session.query(
            Workout.data.label("data"),
            func.max(WorkoutSet.carga_kg).label("carga_max"),
            func.sum(WorkoutSet.reps * WorkoutSet.carga_kg).label("volume"),
            func.max(
                WorkoutSet.carga_kg * (1 + (WorkoutSet.reps / 30.0))
            ).label("e1rm"),
        )
        .join(WorkoutSet, WorkoutSet.workout_id == Workout.id)
        .filter(WorkoutSet.exercise_id == exercise_id)
    )
    if de:
        query = query.filter(Workout.data >= de)
    if ate:
        query = query.filter(Workout.data <= ate)

    rows = query.group_by(Workout.data).order_by(Workout.data).all()

    pr_query = (
        db.session.query(WorkoutSet, Workout)
        .join(Workout, Workout.id == WorkoutSet.workout_id)
        .filter(WorkoutSet.exercise_id == exercise_id)
    )
    if de:
        pr_query = pr_query.filter(Workout.data >= de)
    if ate:
        pr_query = pr_query.filter(Workout.data <= ate)
    pr_row = pr_query.order_by(
        WorkoutSet.carga_kg.desc(),
        Workout.data.desc(),
        WorkoutSet.id.desc(),
    ).first()

    labels = [row.data.isoformat() for row in rows]
    cargas = [round(float(row.carga_max), 1) for row in rows]
    volumes = [round(float(row.volume), 1) for row in rows]
    e1rms = [round(float(row.e1rm), 1) for row in rows]

    variacao = None
    if len(cargas) >= 2 and cargas[0] > 0:
        variacao = round((cargas[-1] - cargas[0]) / cargas[0] * 100, 1)

    return jsonify(
        {
            "exercicio": exercise.to_dict(),
            "labels": labels,
            "datasets": {
                "carga_max": cargas,
                "volume": volumes,
                "e1rm": e1rms,
            },
            "resumo": {
                "pr_carga_kg": round(float(pr_row[0].carga_kg), 1) if pr_row else None,
                "pr_reps": pr_row[0].reps if pr_row else None,
                "pr_data": pr_row[1].data.isoformat() if pr_row else None,
                "primeira_carga_kg": cargas[0] if cargas else None,
                "ultima_carga_kg": cargas[-1] if cargas else None,
                "variacao_pct": variacao,
                "sessoes": len(rows),
            },
        }
    )
