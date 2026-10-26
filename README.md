# ClickFast

<!-- À ÉCRIRE AVEC TES MOTS : ce que fait le jeu, en 2-3 phrases. -->

## Lancer le projet

<!-- À ÉCRIRE AVEC TES MOTS. Les commandes sont dans COMMANDES.md, l'essentiel :
cp .env.example .env   (puis changer les valeurs)
docker compose up -d --build
jeu : http://localhost:8080 · API : :3000 · stats : :5000/stats · Adminer : :8081 (serveur "db")
-->

## Mesures

| Image | Taille | Couches (poids max) | Build froid / chaud | Temps 1re réponse HTTP |
|---|---|---|---|---|
| clickfast (le jeu) | | | | |
| l'API de scores | | | | |
| stats-api | | | | |

<!-- Ta cible par image, et pourquoi ce chiffre-là. -->

## Journal de bord

<!-- Une entrée par étape : ce qui a été mesuré, ce qui a cassé, et pourquoi. -->

### 1. Le jeu tourne

### 2. L'image du jeu
<!-- taille avant/après, build froid/chaud, parade non-root choisie et pourquoi -->

### 3. Le scoreboard
<!-- commande docker run complète, IP interne utilisée, nombre d'étapes manuelles -->

### 4. Le réseau isolé
<!-- commande docker network create, nom retenu, résultat de nc -zv localhost 5432 -->

### 5. La configuration sort du code
<!-- comment l'URL de l'API est traitée dans le JS, et ce que ça implique sur un autre environnement -->

### 6. Toute la stack dans un fichier
<!-- temps pour passer Healthy, ajustements de noms, mot de passe commenté, Postgres arrêté -->

### 7. Le service de stats

### 8. Publier et redéployer

### 9. Mesurer, puis optimiser
<!-- coût x50 builds/jour, régressions éventuelles, où tu as arrêté de compresser -->

### 10. Le test qui rejoue toute la journée
