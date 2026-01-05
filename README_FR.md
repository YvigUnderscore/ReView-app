# ReView

ReView est une plateforme de collaboration vidéo open-source, sécurisée et auto-hébergeable. Conçue comme une alternative gratuite et accessible à des outils comme Frame.io ou SyncSketch, elle permet aux créateurs, studios et équipes de réviser leurs projets vidéo avec précision et efficacité.

Le projet met l'accent sur la confidentialité des données (vos fichiers restent chez vous) et la simplicité d'utilisation.

## Fonctionnalités Principales

### 🎥 Collaboration & Visionnage
- **Timeline Dynamique** : Navigation précise, marqueurs visuels groupés, et visualisation des plages de commentaires.
- **Support des Séquences d'Images** : Review de storyboards, concept arts ou affiches via une galerie d'images dédiée.
- **Support 3D** : Import et review de modèles 3D (.glb). Support des textures via import ZIP.
- **Comparaison Split-Screen** : Comparez deux versions d'une vidéo (V1 vs V2) côte à côte avec lecture synchronisée et mixage audio commutable.
- **Support Multi-Versions** : Gestion de l'historique des versions unifiée (Vidéos, Sets d'images et 3D).

### ✍️ Outils de Feedback Avancés
- **Annotations Vectorielles** : Dessinez sur les vidéos ET les images avec des outils précis (Crayon, Flèche Courbe, Bulle de Dialogue, Formes).
- **Commentaires sur Plage** : Maintenez `Shift + Drag` sur la timeline pour commenter une durée spécifique (vidéo uniquement).
- **Assignation de Tâches** : Transformez un commentaire en tâche actionnable en l'assignant à un membre de l'équipe. Cochez la case pour valider la tâche.
- **Mentions & Réponses** : Système de discussion complet avec mentions (`@Nom`, `@Rôle`) et fils de réponse.

### 📤 Export & Rapports
- **Exports PDF** : Générez des rapports visuels complets avec vignettes, timecodes et détails des tâches.
- **Exports CSV** : Téléchargez les données brutes pour intégration dans vos tableurs ou logiciels de montage.

### 👥 Gestion d'Équipe
- **Rôles Personnalisés** : Créez des tags colorés (ex: @Animateur, @Compositing) pour organiser votre équipe.
- **Permissions** : Gestion fine des droits (Propriétaire, Membre, Admin).
- **Revue Client** : Liens de partage sécurisés pour les clients externes sans compte.

## Installation et Démarrage

### Prérequis
- Docker et Docker Compose installés sur votre machine.

### Lancement Rapide

1. **Cloner le dépôt :**
   ```bash
   git clone <votre-repo-url>
   cd ReView
   ```

2. **Démarrer l'application :**
   ```bash
   docker-compose up -d --build
   ```

3. **Accéder à l'interface :**
   Ouvrez votre navigateur sur `http://localhost:3429`.

### Configuration
- **Premier compte :** Le premier utilisateur inscrit devient automatiquement **Administrateur**.
- **Invitations :** L'inscription se fait uniquement via invitation générée par un admin.
- **Stockage :** Les données sont stockées localement (volume Docker ou dossier configuré).

### Configuration SMTP

Vous pouvez configurer votre serveur mail pour l'envoi d'invitations et de notifications dans l'Admin Dashboard.

L'application propose des préréglages pour les fournisseurs courants :
- **OVH** : Sélectionner "OVH" remplira automatiquement les champs (Hôte: `ssl0.ovh.net`, Port: `465`, Sécurité: `SSL/TLS`).
- **Gmail** et **Outlook** sont également disponibles.
- Vous pouvez toujours entrer une configuration **Personnalisée**.

### Import 3D
Pour importer un modèle 3D avec des textures séparées :
1. Créez un fichier ZIP contenant :
   - Votre fichier `.glb`.
   - Vos textures (dans le même dossier ou des sous-dossiers, tant que les liens relatifs dans le GLB sont corrects).
2. Sélectionnez l'option "3D Asset" lors de la création du projet ou de l'upload d'une version.
3. Chargez le fichier ZIP.

---

## Mises à Jour (Version Actuelle)

Les fonctionnalités suivantes viennent d'être ajoutées :

- ✅ **Dashboard Unifié** : Vues Grille et Liste commutables.
- ✅ **Filtres Avancés** : Barre d'outils unifiée avec recherche, filtres (Statut, Date) et tri.
- ✅ **Support Image / Storyboard** : Upload et review de séquences d'images (JPG, PNG, WEBP).
- ✅ **Comparaison Split Screen** : Vues synchronisées pour comparer les versions.
- ✅ **Commentaires sur la durée** : Sélection de plage sur la timeline.
- ✅ **Export PDF/CSV** : Rapports détaillés pour la production.
- ✅ **Outils de Dessin** : Ajout des courbes, bulles et réglage d'épaisseur.
- ✅ **Tâches** : Assignation directe et suivi de résolution.
- ✅ **Toast Notifications** : Feedback visuel non intrusif pour les succès et erreurs.
- ✅ **Micro-interactions** : Animations fluides sur les cartes de projet (Play button, Scale, Shadow).
- ✅ **Upload Progress** : Barre de progression précise avec estimation du temps restant.
- ✅ **UI Modernisée** : Effets de flou (backdrop-blur) sur les modales.
- ✅ **Validation Inline** : Validation des formulaires en temps réel avec icône de visibilité du mot de passe.
- ✅ **Expérience Mobile** : Navigation par "Barre d'onglets" inférieure sur mobile portrait et zones de toucher agrandies.
- ✅ **Avatar Stack** : Visualisation rapide des membres de l'équipe sur les cartes de projet.
- ✅ **Notifications Groupées** : Organisation par projet dans le centre de notifications.

## Roadmap

Fonctionnalités futures envisagées :

1. **Authentification SSO** : Connexion via Google, GitHub, Discord...
2. **Double authentification (2FA)** : Sécurisation accrue.
3. **Quotas de stockage** : Gestion de l'espace disque.
4. **Raccourcis clavier personnalisables**.
5. **Intégrations Webhooks** (Slack/Discord/Teams).
6. **Transcodage adaptatif (HLS)** : Streaming optimisé.
7. **Dossiers et sous-dossiers** : Organisation avancée.
8. **Palette de Commandes (Cmd+K)** : Navigation rapide.
9. **Intégrations DCC** : Plugins pour Blender, Maya, Unreal Engine.

---
*ReView - Créez, Partagez, Validez.*
