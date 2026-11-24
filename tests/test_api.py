def workout_payload(exercise_id, client_id="test-client-1"):
    return {
        "client_id": client_id,
        "data": "2026-11-24",
        "nome": "Treino A - Superior",
        "duracao_min": 55,
        "observacoes": "Boa sessão",
        "sets": [
            {"exercise_id": exercise_id, "serie": 1, "reps": 8, "carga_kg": 80},
            {"exercise_id": exercise_id, "serie": 2, "reps": 8, "carga_kg": 80},
            {"exercise_id": exercise_id, "serie": 3, "reps": 6, "carga_kg": 85},
        ],
    }


def test_api_requires_key(client, auth):
    assert client.get("/api/exercicios").status_code == 401
    response = client.get("/api/exercicios", headers=auth)
    assert response.status_code == 200
    assert response.get_json() == []


def test_create_exercise_rejects_duplicate(client, auth, exercise):
    response = client.post(
        "/api/exercicios",
        json={"nome": "supino RETO", "grupo_muscular": "Peito"},
        headers=auth,
    )
    assert response.status_code == 409


def test_create_workout_and_fetch(client, auth, exercise):
    response = client.post(
        "/api/treinos", json=workout_payload(exercise["id"]), headers=auth
    )
    assert response.status_code == 201
    created = response.get_json()

    assert created["nome"] == "Treino A - Superior"
    assert created["resumo"] == {
        "series": 3,
        "reps": 22,
        "volume_kg": 1790.0,
        "carga_max_kg": 85.0,
    }
    assert created["exercicios"][0]["exercicio"]["nome"] == "Supino reto"
    assert [item["serie"] for item in created["exercicios"][0]["series"]] == [1, 2, 3]

    detail = client.get(f"/api/treinos/{created['id']}", headers=auth)
    assert detail.status_code == 200
    assert detail.get_json()["client_id"] == "test-client-1"

    listing = client.get("/api/treinos", headers=auth)
    assert listing.status_code == 200
    assert listing.get_json()["total"] == 1


def test_client_id_makes_creation_idempotent(client, auth, exercise):
    first = client.post(
        "/api/treinos", json=workout_payload(exercise["id"]), headers=auth
    )
    second = client.post(
        "/api/treinos", json=workout_payload(exercise["id"]), headers=auth
    )

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.get_json()["id"] == second.get_json()["id"]
    assert client.get("/api/treinos", headers=auth).get_json()["total"] == 1


def test_workout_validation(client, auth, exercise):
    payload = workout_payload(exercise["id"])
    payload["sets"] = []
    assert client.post("/api/treinos", json=payload, headers=auth).status_code == 400

    payload = workout_payload(exercise["id"], client_id="test-client-2")
    payload["sets"][0]["exercise_id"] = 999
    assert client.post("/api/treinos", json=payload, headers=auth).status_code == 400

    payload = workout_payload(exercise["id"], client_id="test-client-3")
    payload["sets"][1]["serie"] = 1
    assert client.post("/api/treinos", json=payload, headers=auth).status_code == 400

    payload = workout_payload(exercise["id"], client_id="test-client-4")
    payload["data"] = "24/11/2026"
    assert client.post("/api/treinos", json=payload, headers=auth).status_code == 400


def test_progress_aggregation(client, auth, exercise):
    first = workout_payload(exercise["id"], client_id="test-client-10")
    first["data"] = "2026-11-01"
    first["sets"] = [
        {"exercise_id": exercise["id"], "serie": 1, "reps": 10, "carga_kg": 60},
        {"exercise_id": exercise["id"], "serie": 2, "reps": 8, "carga_kg": 70},
    ]
    second = workout_payload(exercise["id"], client_id="test-client-11")
    second["data"] = "2026-11-15"
    second["sets"] = [
        {"exercise_id": exercise["id"], "serie": 1, "reps": 8, "carga_kg": 80},
    ]

    assert (
        client.post("/api/treinos", json=first, headers=auth).status_code == 201
    )
    assert (
        client.post("/api/treinos", json=second, headers=auth).status_code == 201
    )

    response = client.get(f"/api/progresso/{exercise['id']}", headers=auth)
    assert response.status_code == 200
    data = response.get_json()

    assert data["labels"] == ["2026-11-01", "2026-11-15"]
    assert data["datasets"]["carga_max"] == [70.0, 80.0]
    assert data["datasets"]["volume"] == [1160.0, 640.0]
    assert data["resumo"]["pr_carga_kg"] == 80.0
    assert data["resumo"]["pr_reps"] == 8
    assert data["resumo"]["variacao_pct"] == 14.3
    assert data["resumo"]["sessoes"] == 2

    filtered = client.get(
        f"/api/progresso/{exercise['id']}?de=2026-11-10", headers=auth
    ).get_json()
    assert filtered["labels"] == ["2026-11-15"]
    assert filtered["resumo"]["variacao_pct"] is None


def test_stats_and_delete(client, auth, exercise):
    created = client.post(
        "/api/treinos", json=workout_payload(exercise["id"]), headers=auth
    ).get_json()

    stats = client.get("/api/estatisticas", headers=auth).get_json()
    assert stats["total_treinos"] == 1
    assert stats["total_series"] == 3
    assert stats["volume_total_kg"] == 1790.0
    assert stats["recordes"][0]["nome"] == "Supino reto"
    assert stats["recordes"][0]["carga_kg"] == 85.0
    assert stats["ultimos"][0]["id"] == created["id"]
    assert stats["ultimos"][0]["exercicios"][0]["exercicio"]["nome"] == "Supino reto"

    response = client.delete(f"/api/treinos/{created['id']}", headers=auth)
    assert response.status_code == 204
    assert client.get(f"/api/treinos/{created['id']}", headers=auth).status_code == 404
