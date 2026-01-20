<p align="center">
  <img src="frontend/public/logo_full.png" alt="Logo ReView" width="400">
</p>

<p align="center">
  <b>L'Outil Ultime de Révision Vidéo & Créative</b><br>
  Open-source, auto-hébergeable et précis.<br>
  v1.1.0 - La Mise à Jour Globale 🌍<br>
  <a href="https://discord.gg/vw7h6BqcNc">
    <img src="https://img.shields.io/discord/1330663471017398292?color=5865F2&label=Discord&logo=discord&logoColor=white" alt="Discord Server" />
  </a>
  <br>
  <a href="./README.md">🇺🇸 English Version</a>
</p>

---

**ReView** permet aux créateurs, studios et développeurs de fluidifier les cycles de feedback. Révisez collaborativement des Vidéos, Images et **Modèles 3D** avec une précision à l'image près.

## 🚀 Quoi de neuf dans la v1.1.0 ?

La **Mise à Jour Globale** apporte l'internationalisation et des améliorations massives pour la 3D !

- **🌍 Support Multilingue** : Interface et documentation maintenant disponibles en Français et Anglais.
- **🧊 Révision 3D Avancée** : Hotspots ancrés sur la surface, conversion FBX native et GIFs de présentation.
- **🎨 Refonte UI & UX** : Guide redessiné et interface polie.
- **📩 Communications Intelligentes** : Notifications améliorées et digests par email.

![Tableau de bord](frontend/public/Guide/DASHBOARD.png)

## ✨ Fonctionnalités

### 🖊️ Annotation de Précision
Dessinez sur les frames avec des outils vectoriels (Crayon, Flèche, Formes). Les commentaires sont liés à la frame exacte (vidéo) ou à la position (image/3D).

![Révision Vidéo](frontend/public/Guide/VIDEO_REVIEW.png)

### 🧊 3D & Animation
Inspectez des modèles GLB/FBX avec une vue à 360°. Placez des **hotspots directement sur la surface 3D**. Support des textures et de la lecture d'animations.

<p align="center">
  <img src="frontend/public/Guide/THREED_REVIEW.png" width="80%">
</p>

### 🔄 Versioning & Comparaison
Suivez l'historique des vidéos et modèles. Comparez les versions côte à côte pour voir les progrès instantanément.

![Versions](frontend/public/Guide/VERSIONS.png)

### 👥 Équipes & Collaboration
- **Discussions en temps réel** : Commentaires filés et mentions (@Utilisateur).
- **Gestion d'équipe** : Rôles personnalisés (Admin, Membre, Client).
- **Révision Client** : Liens sécurisés sur invitation pour les invités externes.

## 🚀 Démarrage Rapide

Déployez rapidement ReView avec Docker (Recommandé) ou Node.js.

```bash
# Cloner le dépôt
git clone https://github.com/YvigUnderscore/review-app.git

# Installer les dépendances (Backend)
cd review/backend
npm install

# Installer les dépendances (Frontend)
cd ../frontend
npm install
```

Voir le [Guide d'Installation](./installation.md) pour les instructions complètes de déploiement.

## 🛠 Stack Technique

Construit avec des technologies modernes et robustes :
- **Frontend** : React, Vite, TailwindCSS, Framer Motion
- **Backend** : Node.js, Express, Socket.IO, Prisma
- **Média** : FFmpeg, Google <model-viewer>

## 🙏 Remerciements & Licences

ReView ne serait pas possible sans ces incroyables projets open-source. Un immense merci à leurs créateurs et contributeurs !

### Cœur & Frameworks
- **[React](https://react.dev/)** (MIT) - La bibliothèque pour les interfaces utilisateur web et natives.
- **[Vite](https://vitejs.dev/)** (MIT) - Outil frontend de nouvelle génération.
- **[Node.js](https://nodejs.org/)** (MIT) - Environnement d'exécution JavaScript.
- **[Express](https://expressjs.com/)** (MIT) - Framework web rapide et minimaliste pour Node.js.
- **[Prisma](https://www.prisma.io/)** (Apache-2.0) - ORM Node.js et TypeScript de nouvelle génération.

### UI & Expérience
- **[TailwindCSS](https://tailwindcss.com/)** (MIT) - Construction rapide de sites web modernes.
- **[Framer Motion](https://www.framer.com/motion/)** (MIT) - Bibliothèque d'animation prête pour la production pour React.
- **[Lucide React](https://lucide.dev/)** (ISC) - Kit d'icônes beau et cohérent.
- **[Sonner](https://sonner.emilkowal.ski/)** (MIT) - Composant de notifications (toasts) pour React.
- **[React Markdown](https://github.com/remarkjs/react-markdown)** (MIT) - Composant Markdown pour React.

### Média & 3D
- **[FFmpeg](https://ffmpeg.org/)** (LGPL/GPL) - Le framework multimédia leader.
- **[Google <model-viewer>](https://modelviewer.dev/)** (Apache-2.0) - Affichage facile de modèles 3D interactifs sur le web.
- **[Three.js](https://threejs.org/)** (MIT) - Bibliothèque 3D JavaScript.
- **[PDFKit](https://pdfkit.org/)** (MIT) - Bibliothèque de génération de PDF pour Node et le navigateur.

### Backend & Utilitaires
- **[Socket.IO](https://socket.io/)** (MIT) - Communication bidirectionnelle basée sur les événements.
- **[Multer](https://github.com/expressjs/multer)** (MIT) - Middleware pour gérer `multipart/form-data`.
- **[Bcrypt.js](https://github.com/dcodeIO/bcrypt.js)** (MIT) - Bcrypt optimisé en JavaScript sans dépendances.
- **[JsonWebToken](https://github.com/auth0/node-jsonwebtoken)** (MIT) - Implémentation JSON Web Token.
- **[Node-cron](https://github.com/node-cron/node-cron)** (ISC) - Planificateur de tâches en JavaScript pur.
- **[Nodemailer](https://nodemailer.com/)** (MIT) - Envoi d'emails depuis Node.js.
- **[Helmet](https://helmetjs.github.io/)** (MIT) - Sécurisation des applications Express via en-têtes HTTP.
- **[Cors](https://github.com/expressjs/cors)** (MIT) - Middleware pour activer CORS.
- **[Axios](https://axios-http.com/)** (MIT) - Client HTTP basé sur les promesses.
- **[Adm-zip](https://github.com/cthackers/adm-zip)** (MIT) - Implémentation Javascript de zip pour nodejs.
- **[CSV-Writer](https://github.com/ryu1kn/csv-writer)** (MIT) - Conversion d'objets/tableaux en CSV.
- **[Puppeteer](https://pptr.dev/)** (Apache-2.0) - API Node.js pour Chrome headless.

## 📄 Licence

Ce projet est sous licence MIT.
