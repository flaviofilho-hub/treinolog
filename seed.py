from dotenv import load_dotenv

load_dotenv()

from app import create_app, db  # noqa: E402
from app.models import Exercise  # noqa: E402

EXERCISES = [
    ("Supino reto", "Peito"),
    ("Supino inclinado", "Peito"),
    ("Crucifixo", "Peito"),
    ("Crossover", "Peito"),
    ("Desenvolvimento militar", "Ombros"),
    ("Elevação lateral", "Ombros"),
    ("Elevação frontal", "Ombros"),
    ("Tríceps pulley", "Tríceps"),
    ("Tríceps testa", "Tríceps"),
    ("Mergulho em paralelas", "Tríceps"),
    ("Puxada frente", "Costas"),
    ("Remada curvada", "Costas"),
    ("Remada baixa", "Costas"),
    ("Pulldown", "Costas"),
    ("Rosca direta", "Bíceps"),
    ("Rosca martelo", "Bíceps"),
    ("Rosca Scott", "Bíceps"),
    ("Agachamento livre", "Pernas"),
    ("Leg press", "Pernas"),
    ("Cadeira extensora", "Pernas"),
    ("Mesa flexora", "Pernas"),
    ("Stiff", "Posterior"),
    ("Panturrilha em pé", "Panturrilha"),
    ("Levantamento terra", "Costas"),
    ("Prancha", "Core"),
    ("Abdominal", "Core"),
]


def main():
    app = create_app()
    with app.app_context():
        existing = {exercise.nome.lower() for exercise in Exercise.query.all()}
        created = 0
        for nome, grupo in EXERCISES:
            if nome.lower() not in existing:
                db.session.add(Exercise(nome=nome, grupo_muscular=grupo))
                created += 1
        db.session.commit()
        total = Exercise.query.count()
        print(f"{created} exercício(s) criado(s). Total: {total}.")


if __name__ == "__main__":
    main()
