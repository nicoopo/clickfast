# Aide-mémoire des commandes

Sous Git Bash, préfixer par `MSYS_NO_PATHCONV=1` les commandes qui contiennent un chemin Linux (`/usr/...`), sinon Git Bash le réécrit en chemin Windows.

## Étape 2 : l'image du jeu

```bash
cd web
time docker build --no-cache -t clickfast-web .   # build à froid
time docker build -t clickfast-web .              # build à chaud
docker images clickfast-web
MSYS_NO_PATHCONV=1 docker run --rm clickfast-web ls -a /usr/share/nginx/html
docker run --rm clickfast-web whoami
docker run -d --name web -p 8080:80 clickfast-web
```

Parade non-root utilisée (à expliquer dans le Journal) : nginx veut écrire dans `/var/cache/nginx` et `/var/run/nginx.pid`, qui appartiennent à root. Le Dockerfile donne le cache à l'utilisateur `nginx`, déplace le pid dans `/tmp` et retire la directive `user`.

## Étape 3 : Postgres + API sur le bridge par défaut, par IP

```bash
docker volume create clickfast-data
docker run -d --name clickfast-db -e POSTGRES_USER=clickfast -e POSTGRES_PASSWORD=motdepasse -e POSTGRES_DB=clickfast -v clickfast-data:/var/lib/postgresql/data postgres:17.2-alpine3.20
docker network inspect bridge          # relever l'IPv4Address de clickfast-db
docker build -t clickfast-api ./api
docker run -d --name clickfast-api -p 3000:3000 -e DB_HOST=172.17.0.X -e DB_USER=clickfast -e DB_PASSWORD=motdepasse -e DB_NAME=clickfast clickfast-api
```

Tests de persistance :

```bash
docker stop clickfast-db && docker start clickfast-db      # le score est toujours là
docker rm -f clickfast-db && docker run ... (même volume)   # toujours là
docker volume create test-jetable                          # puis run dessus, insérer, rm, volume rm -> perdu
docker kill clickfast-db                                   # pendant une partie : l'API répond 503
```

## Étape 4 : network custom

```bash
docker network create clickfast-net
docker run -d --name clickfast-db --network clickfast-net ... (sans -p)
docker run -d --name clickfast-api --network clickfast-net -p 3000:3000 -e DB_HOST=clickfast-db ...
nc -zv localhost 5432                  # doit échouer
```

## Étape 6 : compose

```bash
cp .env.example .env                   # puis changer les valeurs
docker compose up -d --build
docker compose ps
docker compose logs api                # service par service
docker compose stop db                 # puis jouer une partie
docker compose start db
```

## Étape 8 : publier

```bash
docker login
docker build -t TONCOMPTE/clickfast-web:1.0.0 ./web
docker build -t TONCOMPTE/clickfast-api:1.0.0 ./api
docker build -t TONCOMPTE/clickfast-stats-api:1.0.0 ./stats-api
docker push TONCOMPTE/clickfast-web:1.0.0
docker push TONCOMPTE/clickfast-api:1.0.0
docker push TONCOMPTE/clickfast-stats-api:1.0.0
docker history --no-trunc TONCOMPTE/clickfast-api:1.0.0
```

Redéploiement : dans un dossier vide, copier `docker-compose.prod.yml` et un `.env` (avec `REGISTRY_USER` et `TAG`), puis lancer :

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Étape 9 : temps avant la 1re réponse

```bash
./scripts/time-to-ready.sh http://localhost:3000/health
```
