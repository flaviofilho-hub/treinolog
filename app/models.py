from datetime import date, datetime, timezone

from . import db
import bcrypt


def utcnow():
    return datetime.now(timezone.utc)


def _senha_bytes(senha):
    """bcrypt aceita no máximo 72 bytes; trunca de forma consistente."""
    return senha.encode("utf-8")[:72]


WORKOUT_TIPOS = ("forca", "cardio")
LEGACY_EMAIL = "legacy@teste.com"


class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(128), nullable=False)
    api_key = db.Column(db.String(64), unique=True, nullable=True)

    def set_senha(self, senha):
        self.senha_hash = bcrypt.hashpw(_senha_bytes(senha), bcrypt.gensalt()).decode("utf-8")

    def check_senha(self, senha):
        return bcrypt.checkpw(_senha_bytes(senha), self.senha_hash.encode("utf-8"))

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "email": self.email,
        }


class Exercise(db.Model):
    __tablename__ = "exercises"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(80), unique=True, nullable=False)
    grupo_muscular = db.Column(db.String(40), nullable=True)
    bodyweight = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    sets = db.relationship("WorkoutSet", back_populates="exercise", lazy="dynamic")

    def to_dict(self):
        return {
            "id": self.id,
            "nome": self.nome,
            "grupo_muscular": self.grupo_muscular,
            "bodyweight": self.bodyweight,
        }


class Workout(db.Model):
    __tablename__ = "workouts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    client_id = db.Column(db.String(64), unique=True, nullable=True)
    data = db.Column(db.Date, nullable=False, default=date.today, index=True)
    nome = db.Column(db.String(80), nullable=False)
    duracao_min = db.Column(db.Integer, nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    tipo = db.Column(db.String(20), nullable=True)  # forca | cardio | misto
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)

    sets = db.relationship(
        "WorkoutSet",
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.id",
        lazy="selectin",
    )

    @property
    def total_series(self):
        return len(self.sets)

    @property
    def total_reps(self):
        return sum(item.reps for item in self.sets)

    @property
    def volume_kg(self):
        return round(sum(item.reps * item.carga_kg for item in self.sets), 1)

    @property
    def carga_max_kg(self):
        return round(max((item.carga_kg for item in self.sets), default=0.0), 1)

    @property
    def tipo_efetivo(self):
        """Treinos antigos (sem tipo) são de força."""
        return self.tipo or "forca"

    def to_dict(self, include_sets=True):
        payload = {
            "id": self.id,
            "client_id": self.client_id,
            "data": self.data.isoformat(),
            "nome": self.nome,
            "tipo": self.tipo_efetivo,
            "duracao_min": self.duracao_min,
            "observacoes": self.observacoes or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "resumo": {
                "series": self.total_series,
                "reps": self.total_reps,
                "volume_kg": self.volume_kg,
                "carga_max_kg": self.carga_max_kg,
            },
        }
        if include_sets:
            payload["exercicios"] = self._exercicios_dict()
        return payload

    def _exercicios_dict(self):
        grouped = {}
        order = []
        for item in self.sets:
            if item.exercise_id not in grouped:
                grouped[item.exercise_id] = {
                    "exercicio": item.exercise.to_dict(),
                    "series": [],
                }
                order.append(item.exercise_id)
            grouped[item.exercise_id]["series"].append(
                {
                    "id": item.id,
                    "serie": item.serie,
                    "reps": item.reps,
                    "carga_kg": item.carga_kg,
                }
            )
        return [grouped[exercise_id] for exercise_id in order]


class WorkoutSet(db.Model):
    __tablename__ = "workout_sets"
    __table_args__ = (
        db.UniqueConstraint(
            "workout_id", "exercise_id", "serie", name="uq_workout_exercise_serie"
        ),
        db.Index("ix_workout_sets_exercise_id", "exercise_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    workout_id = db.Column(
        db.Integer, db.ForeignKey("workouts.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id = db.Column(db.Integer, db.ForeignKey("exercises.id"), nullable=False)
    serie = db.Column(db.Integer, nullable=False)
    reps = db.Column(db.Integer, nullable=False)
    carga_kg = db.Column(db.Float, nullable=False)

    workout = db.relationship("Workout", back_populates="sets")
    exercise = db.relationship("Exercise", back_populates="sets", lazy="joined")