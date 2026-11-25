from dotenv import load_dotenv

load_dotenv()

from app import create_app, db  # noqa: E402
from app.models import Exercise  # noqa: E402

# (nome, grupo_muscular, bodyweight)
EXERCISES = [
    # Peito
    ("Supino reto", "Peito", False),
    ("Supino inclinado", "Peito", False),
    ("Supino reto (halteres)", "Peito", False),
    ("Supino declinado", "Peito", False),
    ("Flexão de braço", "Peito", True),
    ("Crucifixo", "Peito", False),
    ("Crossover", "Peito", False),
    ("Crossover (polia baixa)", "Peito", False),
    ("Crossover (polia alta)", "Peito", False),
    # Ombros
    ("Desenvolvimento militar", "Ombros", False),
    ("Desenvolvimento (máquina)", "Ombros", False),
    ("Desenvolvimento Arnold", "Ombros", False),
    ("Elevação lateral", "Ombros", False),
    ("Elevação lateral (halteres)", "Ombros", False),
    ("Elevação frontal", "Ombros", False),
    ("Elevação frontal (halteres)", "Ombros", False),
    ("Crucifixo inverso", "Ombros", False),
    ("Encolhimento com halteres (trapézio)", "Ombros", False),
    # Tríceps
    ("Tríceps pulley", "Tríceps", False),
    ("Tríceps testa", "Tríceps", False),
    ("Mergulho em paralelas", "Tríceps", True),
    ("Tríceps francês (halteres)", "Tríceps", False),
    ("Tríceps francês (polia)", "Tríceps", False),
    ("Mergulho no banco", "Tríceps", True),
    # Costas
    ("Puxada frente", "Costas", False),
    ("Remada curvada", "Costas", False),
    ("Remada baixa", "Costas", False),
    ("Pulldown", "Costas", False),
    ("Levantamento terra", "Costas", False),
    ("Barra fixa", "Costas", True),
    ("Remada sentado", "Costas", False),
    ("Remada curvada (halteres)", "Costas", False),
    ("Face pull", "Costas", False),
    # Bíceps
    ("Rosca direta", "Bíceps", False),
    ("Rosca martelo", "Bíceps", False),
    ("Rosca Scott", "Bíceps", False),
    ("Rosca direta (halteres)", "Bíceps", False),
    ("Rosca direta (polia)", "Bíceps", False),
    ("Rosca no banco 45°", "Bíceps", False),
    ("Rosca concentrada", "Bíceps", False),
    # Quadriceps
    ("Agachamento livre", "Quadriceps", False),
    ("Leg press", "Quadriceps", False),
    ("Cadeira extensora", "Quadriceps", False),
    ("Agachamento (Smith)", "Quadriceps", False),
    ("Agachamento (Hack)", "Quadriceps", False),
    ("Cadeira adutora", "Quadriceps", False),
    ("Agachamento búlgaro", "Quadriceps", False),
    ("Afundo", "Quadriceps", False),
    ("Agachamento sumô", "Quadriceps", False),
    # Posterior
    ("Stiff", "Posterior", False),
    ("Mesa flexora", "Posterior", False),
    ("Cadeira flexora", "Posterior", False),
    # Gluteos
    ("Hip thrust", "Gluteos", False),
    ("Cadeira abdutora (glúteos)", "Gluteos", False),
    ("Agachamento búlgaro (glúteos)", "Gluteos", False),
    ("Afundo (glúteos)", "Gluteos", False),
    # Panturrilha
    ("Panturrilha em pé", "Panturrilha", False),
    ("Panturrilha sentada", "Panturrilha", False),
    ("Panturrilha unilateral", "Panturrilha", False),
    # Core
    ("Prancha", "Core", True),
    ("Abdominal", "Core", True),
    ("Abdominal (polia)", "Core", False),
    ("Abdominal bicicleta", "Core", True),
    ("Prancha lateral", "Core", True),
    ("Elevação de pernas", "Core", True),
    # Antebraço
    ("Rosca inversa", "Antebraço", False),
    ("Flexão de punho", "Antebraço", True),
]


def main():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()
        created = 0
        for nome, grupo, bodyweight in EXERCISES:
            db.session.add(
                Exercise(nome=nome, grupo_muscular=grupo, bodyweight=bodyweight)
            )
            created += 1
        db.session.commit()
        total = Exercise.query.count()
        print(f"{created} exercício(s) criado(s). Total: {total}.")


if __name__ == "__main__":
    main()
