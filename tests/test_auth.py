def register(
    client,
    nome="Ana",
    email="ana@example.com",
    senha="senha-segura-1",
):
    return client.post(
        "/auth/register",
        json={"nome": nome, "email": email, "senha": senha},
    )


def workout_payload(exercise_id, client_id="auth-client-1"):
    return {
        "client_id": client_id,
        "data": "2026-11-24",
        "nome": "Treino A",
        "tipo": "forca",
        "duracao_min": 50,
        "sets": [
            {"exercise_id": exercise_id, "serie": 1, "reps": 8, "carga_kg": 40}
        ],
    }


def test_register_login_me_logout(client):
    response = register(client)
    assert response.status_code == 201
    assert response.get_json()["user"]["email"] == "ana@example.com"

    cookie = response.headers.get("Set-Cookie", "")
    assert "HttpOnly" in cookie
    assert "SameSite=Lax" in cookie

    assert client.get("/auth/me").status_code == 200

    client.post("/auth/logout")
    assert client.get("/auth/me").status_code == 401

    login = client.post(
        "/auth/login",
        json={"email": "ANA@example.com", "senha": "senha-segura-1"},
    )
    assert login.status_code == 200
    assert login.get_json()["user"]["nome"] == "Ana"


def test_register_rejects_weak_password_and_invalid_email(client):
    assert register(client, senha="1234567").status_code == 400
    assert register(client, email="sem-arroba").status_code == 400
    assert register(client, email="a@b").status_code == 400


def test_duplicate_email_is_rejected(client):
    assert register(client).status_code == 201
    assert register(client, nome="Outra").status_code == 409


def test_login_is_rate_limited(client):
    assert register(client).status_code == 201
    client.post("/auth/logout")

    for _ in range(8):
        response = client.post(
            "/auth/login",
            json={"email": "ana@example.com", "senha": "senha-errada"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/auth/login",
        json={"email": "ana@example.com", "senha": "senha-segura-1"},
    )
    assert blocked.status_code == 429


def test_users_only_see_their_own_workouts(client):
    first = register(client, nome="Ana", email="ana@example.com")
    assert first.status_code == 201

    exercise = client.post(
        "/api/exercicios",
        json={"nome": "Remada curvada", "grupo_muscular": "Costas"},
    ).get_json()

    created = client.post(
        "/api/treinos", json=workout_payload(exercise["id"], "shared-client")
    )
    assert created.status_code == 201
    workout_id = created.get_json()["id"]

    client.post("/auth/logout")

    second = register(client, nome="Bruno", email="bruno@example.com")
    assert second.status_code == 201

    assert client.get("/api/treinos").get_json()["total"] == 0
    assert client.get(f"/api/treinos/{workout_id}").status_code == 404
    assert client.delete(f"/api/treinos/{workout_id}").status_code == 404

    # Mesmo client_id de outra conta não pode vazar o treino nem sobrescrevê-lo.
    conflict = client.post(
        "/api/treinos", json=workout_payload(exercise["id"], "shared-client")
    )
    assert conflict.status_code == 409
    assert "error" in conflict.get_json()


def test_legacy_header_is_not_a_master_key(app):
    client = app.test_client()
    # Simula produção, onde API_KEY é um segredo em vez de "test-key".
    app.config["API_KEY"] = "segredo-de-producao"

    assert (
        client.get("/api/exercicios", headers={"X-API-Key": "test-key"}).status_code
        == 401
    )
    assert (
        client.get(
            "/api/exercicios", headers={"X-API-Key": "segredo-de-producao"}
        ).status_code
        == 200
    )


def test_security_headers(client):
    response = client.get("/")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Robots-Tag"] == "noindex, nofollow"
    assert response.headers["Referrer-Policy"] == "same-origin"
    assert "camera=()" in response.headers["Permissions-Policy"]
    policy = response.headers["Content-Security-Policy"]
    assert "default-src 'self'" in policy
    assert "frame-ancestors 'none'" in policy
    assert "object-src 'none'" in policy
