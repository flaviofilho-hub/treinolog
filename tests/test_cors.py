def test_cors_preflight_allows_capacitor_origin(client):
    response = client.options(
        "/api/treinos",
        headers={
            "Origin": "https://localhost",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-api-key",
        },
    )

    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "https://localhost"
    assert "x-api-key" in response.headers["Access-Control-Allow-Headers"].lower()


def test_cors_rejects_unknown_origin(client):
    response = client.get(
        "/api/exercicios",
        headers={"Origin": "https://exemplo-invasor.test", "X-API-Key": "test-key"},
    )

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response.headers
