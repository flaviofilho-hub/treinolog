# treinolog

Painel pessoal para registrar treinos, séries, repetições e carga — e acompanhar a evolução por exercício com gráficos.

- **Backend:** Flask + SQLite + Flask-SQLAlchemy (API JSON)
- **Frontend:** SPA em HTML/CSS/JS puro + Chart.js (vendorizado, sem CDN)
- **App:** Android via Capacitor (WebView) com fila offline
- **Autenticação:** chave compartilhada `X-API-Key` (uso pessoal)

## Estrutura

```
app/                  backend Flask (modelos, rotas, auth)
frontend/             SPA servida pelo Flask e empacotada no APK
tests/                testes da API com pytest
android/              projeto Android gerado pelo Capacitor
assets/               ícone e splash de origem (gerados)
instance/             SQLite local (ignorado no git)
seed.py               catálogo inicial de exercícios
wsgi.py               ponto de entrada WSGI
run.py                servidor local de desenvolvimento
Dockerfile            deploy em Fly.io / Render
Procfile              deploy em Railway
```

## Rodando localmente

Requisitos: Python 3.11+.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py
flask --app wsgi run --debug
```

Abra `http://127.0.0.1:5000`.

Para popular dados de exemplo, registre um treino pela interface. O banco fica em `instance/treinolog.db`.

### Testes

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

## Configuração

Variáveis de ambiente (veja `.env.example`; `python-dotenv` carrega `.env`):

| Variável | Padrão | Descrição |
|---|---|---|
| `API_KEY` | vazio | Se definida, todas as rotas `/api` exigem `X-API-Key`. **Defina em produção.** |
| `DATABASE_URL` | `sqlite:///instance/treinolog.db` | Use caminho absoluto no servidor. |
| `CORS_ORIGINS` | `https://localhost,capacitor://localhost,...` | Origens permitidas para o WebView. |

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

O `client_id` é gerado no aparelho e garante que um reenvio da fila offline não duplique o treino (resposta `200` com o registro existente em vez de `201`).

## App Android

Pré-requisitos no computador: **Node 22+**, **JDK 21** e **Android SDK 36** (via Android Studio ou command-line tools). O Capacitor 8 não compila com Java 8.

```powershell
npm install
npx cap sync
npx cap open android
```

No Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**. O APK de debug fica em `android/app/build/outputs/apk/debug/app-debug.apk`.

Para gerar um APK de release assinado, crie um keystore e configure `android/keystore.properties` (não versione esse arquivo).

### Build por linha de comando

Com JDK 21 e Android SDK instalados (ou nas pastas portáteis `.tools/jdk21` e `.tools/android-sdk`):

```powershell
.\scripts\build-apk.ps1
```

O script sincroniza o frontend, compila o APK de debug e copia o resultado para `dist\treinolog-debug.apk`. Para instalar no aparelho:

```powershell
adb install -r dist\treinolog-debug.apk
```

O APK de debug é assinado com a chave de debug do Android e serve para uso pessoal. Para publicar na Play Store, gere um APK/AAB de release com keystore próprio.

### Primeiro uso no aparelho

1. Abra o app e toque no ícone de engrenagem.
2. Informe a URL pública da API (ex.: `https://treinolog-production.up.railway.app`).
3. Informe a `API_KEY` configurada no servidor.
4. Toque em **Testar conexão** e depois em **Salvar**.

A URL e a chave ficam no armazenamento local do app; trocar de servidor não exige rebuild.

### HTTP em desenvolvimento

O Android bloqueia HTTP sem TLS por padrão. Para testar contra o PC na rede local, use um túnel HTTPS (Cloudflare Tunnel ou Tailscale) ou configure temporariamente `usesCleartextTraffic` no manifesto de debug. Em produção, use HTTPS.

### Fila offline

Se o envio falhar por rede, o treino é guardado no aparelho e aparece com o selo **pendente** no histórico. A sincronização acontece ao abrir o app, ao voltar a conexão, pelo botão **Enviar pendentes** ou ao abrir o treino pendente. Erros de validação (4xx) ficam marcados e podem ser reenviados manualmente ou descartados.

O catálogo de exercícios é armazenado no aparelho após a primeira carga, então a tela de novo treino continua funcionando sem conexão.

O gráfico de progresso considera apenas treinos confirmados no servidor.

### Package ID

O ID original `io.github.flaviofilho-hub.treinolog` contém hífen, inválido em pacotes Android/Java. O projeto usa **`io.github.flaviofilho_hub.treinolog`** (underscore). Para trocar, edite `capacitor.config.json`, `android/app/build.gradle` e `android/app/src/main/res/values/strings.xml` antes de gerar o APK.

## Deploy com volume persistente

O ponto crítico: **SQLite precisa de disco persistente**. Planos gratuitos de Render/Vercel/Netlify usam filesystem efêmero e apagariam o banco a cada deploy. Use um volume.

### Railway (recomendado)

1. Suba o projeto para um repositório no GitHub.
2. Em [railway.app](https://railway.app), crie um projeto → **Deploy from GitHub repo**.
3. No serviço, adicione um **Volume** montado em `/data`.
4. Variáveis:
   - `DATABASE_URL=sqlite:////data/treinolog.db` (quatro barras: o caminho é absoluto)
   - `API_KEY=<chave gerada>`
5. O `Procfile` já define `gunicorn --workers 1 --threads 4 wsgi:app` (um worker por causa do SQLite).
6. Gere um domínio público em **Settings → Networking**.
7. Rode o seed uma vez pelo shell do Railway: `python seed.py`.
8. Teste: `GET https://<dominio>/api/exercicios` com o header `X-API-Key`.

O volume `/data` sobrevive a deploys e restarts; a conta é criada uma única vez.

### Fly.io

```bash
fly launch --no-deploy
fly volumes create treinolog_data --size 1
fly secrets set API_KEY="<chave>"
fly deploy
```

Adicione ao `fly.toml`:

```toml
[env]
  DATABASE_URL = "sqlite:////data/treinolog.db"

[mounts]
  source = "treinolog_data"
  destination = "/data"
```

Seed: `fly ssh console -C "python seed.py"`.

### Render (pago)

Web Service com Dockerfile, plano Starter (o free não tem disco), disco persistente montado em `/var/data` e `DATABASE_URL=sqlite:////var/data/treinolog.db`.

### Alwaysdata (alternativa gratuita)

Plano free de 100 MB com home persistente e Python WSGI. Aponte o site para um arquivo WSGI:

```python
import sys

path = "/home/<usuario>/treinolog"
if path not in sys.path:
    sys.path.insert(0, path)

from wsgi import app as application
```

Defina `API_KEY` e `DATABASE_URL` no ambiente. O SQLite em `instance/treinolog.db` fica no home e sobrevive aos deploys.

> Se o cadastro no PythonAnywhere falhar, verifique o nome de usuário: ele não aceita hífen. Use apenas letras e números.

## Backup

O banco inteiro é um arquivo:

- local: `instance/treinolog.db`
- Railway: `/data/treinolog.db`
- Fly: `/data/treinolog.db`

Copie esse arquivo periodicamente (Railway shell, `fly ssh sftp get` ou snapshot do volume). Não há backup automático configurado.

## Segurança

- A `API_KEY` embutida no APK é extraível; ela evita escrita casual, não é autenticação forte. Para algo mais sério, coloque o serviço atrás do Cloudflare Access ou implemente login.
- Use sempre HTTPS em produção.
- O app é single-user: não há cadastro/login de usuários.
- Treinos pendentes ficam em `localStorage` no aparelho; limpar os dados do app apaga a fila.

## Roadmap v1.1

- Testes físicos (`PhysicalTest` + `TestResult`)
- Edição de treino e exclusão de exercícios
- Exportação/importação do banco
- Cache offline de leitura do histórico e das estatísticas (hoje o catálogo de exercícios e a fila de escrita funcionam offline)
