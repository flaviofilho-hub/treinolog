# treinolog

Painel pessoal para registrar treinos, séries, repetições e carga — e acompanhar a evolução por exercício com gráficos.

- **Backend:** Flask + SQLAlchemy (PostgreSQL via Neon ou SQLite local)
- **Frontend:** SPA em HTML/CSS/JS puro + Chart.js (vendorizado, sem CDN)
- **Hospedagem:** Render (Free/Starter) + Neon Postgres (Free)
- **Autenticação:** chave compartilhada `X-API-Key` (uso pessoal)
- **App:** Progressive Web App (PWA) — adicionar à tela inicial do celular, sem APK

## Estrutura

```
app/                  backend Flask (modelos, rotas, auth)
frontend/             SPA servida pelo Flask
tests/                testes da API com pytest
instance/             SQLite local (ignorado no git)
seed.py               catálogo inicial de exercícios
wsgi.py               ponto de entrada WSGI
run.py                servidor local de desenvolvimento
render.yaml           blueprint do Render
```

## Rodando localmente

Requisitos: Python 3.11+.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py
python wsgi.py
```

Abra `http://127.0.0.1:5000`.

Para popular dados de exemplo, registre um treino pela interface. O banco fica em `instance/treinolog.db` (SQLite) ou na instância do Neon (Postgres).

### Testes

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## Configuração

Variáveis de ambiente (veja `.env.example`; `python-dotenv` carrega `.env`):

| Variável | Padrão | Descrição |
|---|---|---|
| `API_KEY` | vazia | Se definida, todas as rotas `/api` exigem `X-API-Key`. **Defina em produção.** |
| `DATABASE_URL` | `sqlite:///instance/treinolog.db` | Use `postgresql+psycopg://...` para Neon. Caminho absoluto no servidor. |
| `CORS_ORIGINS` | `https://localhost,http://localhost:5000,...` | Origens permitidas. |

Gerar uma chave forte:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

> Com `API_KEY` vazia, a API fica aberta — use apenas em desenvolvimento local.

## API

| Método | Rota | Função |
|---|---|---|
| GET | `/api/exercicios` | Lista o catálogo |
| POST | `/api/exercicios` | Cria exercício (`nome`, `grupo_muscular`) |
| GET | `/api/treinos?limit=&offset=&exercicio_id=&de=&ate=` | Histórico paginado |
| POST | `/api/treinos` | Cria treino com séries (idempotente por `client_id`) |
| GET | `/api/treinos/<id>` | Detalhe |
| DELETE | `/api/treinos/<id>` | Remove treino |
| GET | `/api/estatisticas` | Totais, últimos treinos e recordes |
| GET | `/api/progresso/<exercise_id>?de=&ate=` | Carga máxima, volume e 1RM estimado por data |
| GET | `/api/status` | Status do servidor e conexão com o banco |

Exemplo de criação de treino:

```json
{
  "client_id": "3f1c2a9e-8b7d-4c6a-9e2f-1a2b3c4d5e6f",
  "data": "2026-11-24",
  "nome": "Treino A — Superior",
  "duracao_min": 55,
  "observacoes": "Boa sessão",
  "sets": [
    { "exercise_id": 1, "serie": 1, "reps": 8, "carga_kg": 80 },
    { "exercise_id": 1, "serie": 2, "reps": 8, "carga_kg": 80 }
  ]
}
```

O `client_id` é gerado no navegador e garante que um reenvio da fila offline não duplique o treino (resposta `200` com o registro existente em vez de `201`).

## PWA (Progressive Web App)

O site pode ser **adicionado à tela inicial** do celular, funcionando como um aplicativo nativo:

- Ícones e manifesto (`manifest.webmanifest`) já inclusos.
- Service Worker (`sw.js`) em cache: HTML, CSS, JS, Chart.js, ícones.
- Requisições `/api/*` sempre vão para a rede (sem cache de dados).
- Navegação offline cai na página shell em cache.
- Estratégia *stale-while-revalidate* para arquivos estáticos.
- O service worker é registrado automaticamente em HTTPS (produção) ou localhost (desenvolvimento).

### Como instalar no celular

1. Abra o site no navegador do celular (Chrome ou Edge).
2. No menu do navegador, toque em **"Adicionar à tela inicial"** (ou "Instalar app").
3. Confirme o nome **treinolog** e o ícone.
4. O ícone aparecerá na tela do celular — toque para abrir o app.

**Funcionalidades offline:**
- O catálogo de exercícios é carregado na primeira vez e fica disponível offline.
- Treinos pendentes são salvos no `localStorage` e enviados quando a conexão voltar.
- O gráfico de progresso precisa de rede (dados do servidor).

## Deploy no Render (Free + Neon Postgres)

1. **No GitHub:** garanta que o repositório tem todos os arquivos (incluindo `render.yaml`, `render` da pasta raiz).
2. **No Neon:** crie uma conta gratuita em [neon.tech], crie um projeto e copie a **Connection String** (formato `postgresql+psycopg://`).
3. **No Render:**
   - Acesse [render.com](https://render.com) e crie uma nova conta.
   - Clique em **New** → **Blueprint**.
   - Conecte o repositório GitHub `flaviofilho-hub/treinolog`.
   - O `render.yaml` será lido automaticamente.
   - Quando Render pedir as variáveis de ambiente:
     - `API_KEY`: deixe como gerado ou defina uma chave longa e aleatória.
     - `DATABASE_URL`: cole a Connection String do Neon (ex.: `postgresql+psycopg://ep-name:password@db-name.us-east-2.aws.neon.tech/db-name`).
     - `CORS_ORIGINS`: `https://seu-servico.onrender.com,http://localhost:5000` (opcional).
   - Clique em **Create Web Service**.
4. **Deploy:** O Render vai rodar `pip install -r requirements.txt`, `python seed.py` e `gunicorn --workers 1 --threads 4 --bind 0.0.0.0:$PORT wsgi:app`.
5. **Pós-deploy:**
   - Abra `https://seu-servico.onrender.com`.
   - Como não há `API_KEY` definida no ambiente ainda, o app vai abrir o modal de ajustes pedindo a chave.
   - Informe a `API_KEY` que você gerou (ou a que o Render gerou automaticamente).
   - Toque em **Testar conexão** — deve conectar usando o PostgreSQL do Neon.
   - Agora você pode usar o treinarolog: registrar treinos, ver histórico e progresso.

### Dicas do Render Free

- O plano Free **hiberna** após ~15 min de inatividade. O primeiro acesso depois do hibernação pode demorar 30–60s para "acordar" a instância.
- O Neon Postgres free tem limites de consumo de métricas, mas os dados persistem.
- Para evitar hibernação acidental, crie um *cron job* simples ou use um túnel keep-alive.

## Backup

- **Neon:** use o recurso nativo de *branches* e *point-in-time recovery* do painel do Neon.
- **SQLite local:** o banco é o arquivo `instance/treinolog.db`. copie-o periodicamente.
- Não há backup automático configurado.

## Segurança

- A `API_KEY` evita escrita casual, não é autenticação forte. Para algo mais sério, coloque o serviço atrás do Cloudflare Access ou implemente login.
- Use sempre HTTPS em produção (o Render fornece HTTPS gratuito).
- O app é **single-user**: não há cadastro/login de múltiplos usuários.
- Treinos pendentes ficam em `localStorage` no navegador; limpar os dados do app apaga a fila.

## Roadmap v1.1

- Edição de treino e exclusão de exercícios
- Exportação/importação do banco
- Cache offline de leitura do histórico e das estatísticas (hoje o catálogo de exercícios e a fila de escrita funcionam offline)
- Suporte a múltiplos usuários (opcional)