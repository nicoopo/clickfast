# Procédure de déploiement — API de scores ClickFast

Pour la personne d'astreinte qui n'a jamais vu ce projet. Chaque commande se copie telle quelle,
dans **PowerShell**, depuis le dossier du projet. Chaque étape se termine par un point de vérification :
s'il n'est pas atteint, on s'arrête là et on va à la section [Pannes connues](#5-pannes-connues).

## 1. Avant de commencer

| Quoi | Valeur |
|---|---|
| Dossier du projet (toutes les commandes partent d'ici) | `C:\Users\nicol\Desktop\ClickFast` |
| Machine de production | conteneur `vm-prod` sur ce poste |
| Accès SSH | `ssh -i deploy_key -p 2222 root@localhost` (clé `deploy_key` dans le dossier du projet, jamais commitée) |
| Fichiers en production | `/srv/clickfast/` sur vm-prod : `compose.yml`, `.env` (mots de passe), `prometheus.yml`, `grafana/` |
| API | http://localhost:3000/health |
| Tableau de bord Grafana | http://localhost:3001 (lecture sans compte) |
| Prometheus | http://localhost:9090/targets |
| Pipeline | onglet **Actions** du dépôt GitHub `nicoopo/clickfast` |
| Images | Docker Hub `nicopoo/clickfast-api:<sha du commit>` |

Se placer dans le dossier :

```powershell
cd C:\Users\nicol\Desktop\ClickFast
```

**Vérification :** cette commande affiche les 4 conteneurs de la prod.

```powershell
ssh -i deploy_key -p 2222 root@localhost "docker ps --format '{{.Names}} {{.Image}} {{.Status}}'"
```

Attendu : `scores-api`, `scores-db (healthy)`, `prometheus`, `grafana`, tous `Up`.
Si `ssh` répond `Connection refused` : la machine est arrêtée, la relancer avec `docker start vm-prod`, attendre 10 s, recommencer.

## 2. Déploiement normal (automatique)

Un push sur `main` suffit. La pipeline lance dans l'ordre : `lint`, `test` et `api-test`, puis
`build-and-push` (images taguées au sha du commit), puis `deploy` sur le runner de ce poste.

**Durée attendue :** environ 2 min 30 pour toute la pipeline, dont environ 45 s pour `deploy`.
Au-delà de 5 minutes, quelque chose bloque : voir la panne « deploy reste Queued ».

1. Suivre la pipeline :

   ```powershell
   gh run watch
   ```

   **Vérification :** tous les jobs finissent en ✓, y compris `deploy`.

2. Lire la version réellement en production :

   ```powershell
   ssh -i deploy_key -p 2222 root@localhost "docker inspect -f '{{.Config.Image}}' scores-api"
   ```

   **Vérification :** le tag après `:` est égal au sha du dernier commit, affiché par `git log -1 --format=%H`.

3. Contrôler le service :

   ```powershell
   curl.exe -s localhost:3000/health
   ```

   **Vérification :** `{"status":"ok", ...}`, et dans Grafana le panneau **Disponibilité** affiche `UP`.

## 3. Déploiement manuel d'urgence (si la pipeline est en panne)

À utiliser seulement si l'image voulue existe déjà sur Docker Hub (elle a été construite par un run précédent).

1. Choisir le sha à déployer, dans l'onglet Actions ou avec :

   ```powershell
   git log --oneline -5
   ```

   Il faut le sha **complet** (40 caractères), donné par `git log -1 --format=%H <sha court>`.

2. Envoyer la configuration à jour :

   ```powershell
   scp -i deploy_key -P 2222 -r deploy/compose.yml deploy/prometheus.yml deploy/grafana root@localhost:/srv/clickfast/
   ```

   **Vérification :** la commande ne renvoie rien. Une erreur `Permission denied` veut dire que la clé est mauvaise.

3. Déployer, en remplaçant `<SHA>` :

   ```powershell
   ssh -i deploy_key -p 2222 root@localhost "cd /srv/clickfast && TAG=<SHA> docker compose up -d"
   ```

   **Vérification :** la sortie se termine par `Container scores-api  Started` ou `Running`.
   `manifest unknown` veut dire que ce tag n'existe pas sur Docker Hub : la prod n'a pas été touchée, vérifier le sha.

4. Contrôler : refaire l'étape 3 de la section 2.

## 4. Retour arrière

**Quand :** dans les 10 minutes qui suivent un déploiement,
- `/health` ne répond pas `ok` 60 s après la fin du job `deploy`, **ou**
- le panneau **Erreurs** reste au-dessus de 5 % pendant 2 minutes, **ou**
- une fonction visible est cassée (par exemple, le classement n'affiche plus les pseudos).

**Qui décide :** la personne d'astreinte, sans attendre l'auteur du commit. On revient en arrière d'abord, on cherche la cause ensuite.

1. Trouver la version précédente, celle qui marchait :

   ```powershell
   gh run list --workflow CI --branch main --status success --limit 5
   ```

   Prendre le commit du run vert **juste avant** le déploiement fautif, puis son sha complet :

   ```powershell
   git log -1 --format=%H <sha court>
   ```

2. Revenir dessus. Pas de build, pas de pipeline : l'image est déjà sur Docker Hub.

   ```powershell
   ssh -i deploy_key -p 2222 root@localhost "cd /srv/clickfast && TAG=<SHA PRÉCÉDENT> docker compose up -d"
   ```

   **Vérification :** `Container scores-api  Recreated` puis `Started`. Seule l'API est recréée, la base reste `Running`.

3. Contrôler :

   ```powershell
   curl.exe -s localhost:3000/health
   ```

   ```powershell
   curl.exe -s localhost:3000/api/scores
   ```

   **Vérification :** `ok`, le classement contient `id`, `username` et `score`, et le panneau **Erreurs** redescend à 0 en moins d'une minute.

4. Prévenir l'équipe : le prochain push sur `main` redéploiera le code fautif s'il n'est pas corrigé.

**Limite connue :** les images publiées **avant** le commit `eb5bf45` n'existent qu'en amd64. vm-prod tourne sur un poste ARM,
donc un retour vers elles échoue avec `no matching manifest for linux/arm64`. Ne pas revenir plus loin que `eb5bf45`.

## 5. Pannes connues

Toujours commencer par ces deux commandes, puis comparer avec le tableau :

```powershell
ssh -i deploy_key -p 2222 root@localhost "docker ps -a --format '{{.Names}} {{.Status}}'"
```

```powershell
curl.exe -s -m 3 -o NUL -w "%{http_code}" localhost:3000/health
```

`000` veut dire qu'il n'y a aucune réponse. Ensuite, ouvrir Grafana sur http://localhost:3001.

| Signature | Cause | Remède |
|---|---|---|
| **Disponibilité DOWN**, `/health` → `000`, `docker ps -a` : `scores-api Exited (0)` | L'API a été arrêtée | `ssh -i deploy_key -p 2222 root@localhost "docker start scores-api"` |
| **Disponibilité UP**, **Erreurs à 100 %**, **Latence p95 vers 2,5 s**, `/health` → `200`, `docker ps -a` : `scores-db Exited` | La base est arrêtée, l'API répond 503 | `ssh -i deploy_key -p 2222 root@localhost "docker start scores-db"`, puis l'API retrouve la base seule (pas besoin de la redémarrer) |
| **Disponibilité DOWN**, `/health` → `000`, **mais** `docker ps -a` : `scores-api Up` | L'API tourne mais n'est plus sur le réseau : ni Prometheus ni le port 3000 ne l'atteignent | `ssh -i deploy_key -p 2222 root@localhost "docker network connect clickfast_default scores-api"` |
| **Disponibilité DOWN**, `docker ps -a` : `scores-api Exited (1)` ; les logs (`docker logs scores-api`) disent `Variables d'environnement manquantes` | L'API a été relancée à la main sans sa config ni son réseau | `ssh -i deploy_key -p 2222 root@localhost "cd /srv/clickfast && TAG=`$(docker inspect -f '{{.Config.Image}}' scores-api \| cut -d: -f2) && docker rm -f scores-api && TAG=`$TAG docker compose up -d"` |
| **Rien de visible dans Grafana** (8 cœurs sur ce poste, l'API tient), mais `docker ps` montre `hog-1` à `hog-4` | Des conteneurs étrangers saturent le CPU | `ssh -i deploy_key -p 2222 root@localhost "docker rm -f hog-1 hog-2 hog-3 hog-4"` ; vérifier avec `docker stats --no-stream` |
| `docker compose up` répond `port is already allocated` | Le port 3000 est déjà pris sur vm-prod | Trouver qui le tient : `ssh -i deploy_key -p 2222 root@localhost "docker ps --filter publish=3000"`, le supprimer s'il n'est pas `scores-api`, puis relancer le déploiement |
| Le job `deploy` reste **Queued** indéfiniment | Le runner self-hosted est arrêté | Rouvrir un terminal dans `C:\actions-runner` et lancer `.\run.cmd` ; il doit afficher `Listening for Jobs` |
| Le job `deploy` échoue sur `Permission denied (publickey)` | Le secret `DEPLOY_SSH_KEY` ne correspond plus à la clé de vm-prod | Repousser la clé : `cmd /c "gh secret set DEPLOY_SSH_KEY < deploy_key"`, puis relancer le run |

**Après chaque remède :** `/health` répond `200`, et le panneau **Disponibilité** repasse à `UP` en moins de 15 s
(Prometheus relit l'API toutes les 5 s).
