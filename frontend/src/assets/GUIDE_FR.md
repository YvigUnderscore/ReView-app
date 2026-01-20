# Guide Utilisateur

Bienvenue sur ReView ! Ce guide vous aidera à comprendre comment utiliser la plateforme pour collaborer sur des projets vidéo, image et 3D.

## 💬 Rejoignez Notre Communauté

Vous avez des questions ou besoin d'aide ? Rejoignez notre communauté Discord pour échanger avec d'autres utilisateurs, obtenir de l'aide et rester informé des dernières fonctionnalités !

👉 **[Rejoindre le Discord ReView](https://discord.gg/vw7h6BqcNc)**

## Table des Matières

1. [Projets](#projets)
2. [Équipes](#equipes)
3. [Révision & Commentaires](#revision--commentaires)
4. [Annotations](#annotations)
5. [Révision Client](#revision-client)
6. [Corbeille & Récupération](#corbeille--recuperation)

---

## Projets

Les projets sont le cœur de ReView. Chaque projet peut contenir plusieurs versions de vidéos, de séries d'images ou d'actifs 3D.

### Créer un Projet
Pour créer un nouveau projet, cliquez sur le bouton **Nouveau Projet** dans la barre latérale ou sur le tableau de bord.

![Tableau de bord](/Guide/DASHBOARD.png "Dashboard")

Vous pouvez choisir entre :
- **Vidéo** : Téléchargez un fichier vidéo unique.
- **Image** : Téléchargez une séquence d'images ou une image unique.
- **Actif 3D** : Téléchargez des fichiers `.glb` ou `.fbx`.

### Versions
Vous pouvez télécharger de nouvelles versions d'un projet pour suivre l'évolution de votre travail.
- Dans la vue Projet, utilisez le bouton d'importation dans la barre supérieure.
- Les versions sont accessibles via le menu déroulant en haut à gauche.

![Versions](/Guide/VERSIONS.png "Versions")

### Mode Comparaison
Pour les projets vidéo, vous pouvez comparer deux versions côte à côte.
- Cliquez sur l'icône **Comparer** dans la barre supérieure.
- Sélectionnez la version à comparer.
- Vous pouvez synchroniser la lecture et comparer l'audio.

---

---

## Équipes & Paramètres

Organisez vos projets par **Équipes** pour une meilleure collaboration.

### Créer une Équipe
- Allez dans la section **Équipes** de la barre latérale.
- Configurez le nom et l'identifiant (slug) de votre équipe.

### Gérer les Membres
- Invitez des collaborateurs par email.
- Définissez les rôles : Propriétaire, Administrateur, Membre ou Client.

### Paramètres d'Équipe
*Configurable par les Propriétaires d'équipe et les Administrateurs.*

- **Intégration Discord** : Connectez votre équipe à un canal Discord pour recevoir des notifications en temps réel pour les commentaires et révisions.
- **Timecode de Départ** : Définissez un timecode de départ personnalisé (ex: `01:00:00:00`) pour les projets vidéo afin de correspondre à votre pipeline de production.
- **Paramètres de Digest** : Contrôlez la fréquence et le contenu des digests email/Discord.
- **Quotas de Stockage** : Surveillez l'utilisation du stockage de votre équipe (limites définies par l'administrateur de l'instance).

---

## Administration & Configuration

*Fonctionnalités disponibles pour les Administrateurs de l'instance.*

### Configuration des Actifs 3D
- **Auto-Conversion** : Convertissez automatiquement les fichiers `.fbx` téléchargés en `.glb` pour une compatibilité universelle.
- **GIFs de Rotation** : Générez automatiquement des GIFs animés à 360° pour les actifs 3D à utiliser dans les notifications.

### Annonces Globales
- Les administrateurs peuvent diffuser des messages urgents ou des alertes de maintenance à tous les utilisateurs actifs via un système de popup.

### Système de Corbeille
- Les projets supprimés sont stockés en sécurité dans la Corbeille pendant 7 jours avant suppression définitive.
- Cette période de rétention permet de récupérer les suppressions accidentelles.

---

## Révision & Commentaires

L'interface de révision est conçue pour des retours précis et efficaces.

### Panneau d'Activité
Le panneau de droite regroupe tous les commentaires.
- **Resizable** : Ajustez la largeur du panneau en glissant son bord gauche.
- **Sticky** : La barre de saisie et les filtres restent toujours visibles.

![Filtres](/Guide/FILTERS.png "Filtres")

### Timeline Vidéo
La timeline permet une navigation précise à l'image près.
- **Timecode** : Affiche le temps exact et le numéro de l'image.
- **Commentaires par plage** : Maintenez `Shift` et glissez sur la timeline pour commenter une séquence entière.

---

## Annotations

Dessinez directement sur vos médias pour illustrer vos retours.

### Outils 2D (Vidéo & Image)
Utilisez la palette d'outils pour dessiner des flèches, des formes ou écrire du texte. Les annotations sont liées au moment exact de votre commentaire.

![Outils](/Guide/TOOLBOX.png "Outils")

### Annotations 3D
Pour les modèles 3D, vous pouvez placer des points d'intérêt (hotspots) directement sur la surface du modèle.
- Cliquez sur le modèle pour placer une annotation 3D.
- Une capture de la caméra est enregistrée pour que les autres voient exactement votre point de vue.

![3D](/Guide/THREED_REVIEW.png "3D Review")

---

## Révision Client

Partagez vos projets avec des intervenants externes sans qu'ils aient besoin de compte.

1. Passez le statut du projet en **Client Review**.
2. Générez un lien de partage via le bouton **Partager**.
3. Le client peut alors visionner et commenter en tant qu'invité.

---

## Corbeille & Récupération

Les projets supprimés sont conservés pendant 7 jours dans la **Corbeille** avant d'être définitivement effacés. Vous pouvez les restaurer à tout moment durant cette période.

![Corbeille](/Guide/TRASH.png "Corbeille")

---

*Besoin d'aide supplémentaire ? Contactez votre administrateur.*
