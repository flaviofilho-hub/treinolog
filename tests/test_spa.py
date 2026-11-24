def test_spa_serves_index(client):
    response = client.get("/")
    assert response.status_code == 200
    assert b"treinolog" in response.data


def test_unknown_api_route_returns_json(client, auth):
    response = client.get("/api/nao-existe", headers=auth)
    assert response.status_code == 404
    assert response.get_json()["error"] == "Rota não encontrada."


def test_api_route_is_not_shadowed_by_spa(client, auth):
    assert client.get("/api/exercicios", headers=auth).status_code == 200
    assert client.get("/api/exercicios").status_code == 401
