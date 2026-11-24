import pytest

from app import create_app, db


@pytest.fixture()
def app(tmp_path):
    database = tmp_path / "test.db"
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database.as_posix()}",
            "API_KEY": "test-key",
        }
    )
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def auth():
    return {"X-API-Key": "test-key"}


@pytest.fixture()
def exercise(client, auth):
    response = client.post(
        "/api/exercicios",
        json={"nome": "Supino reto", "grupo_muscular": "Peito"},
        headers=auth,
    )
    assert response.status_code == 201
    return response.get_json()
