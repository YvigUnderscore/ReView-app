# ReView

[🇫🇷 Version Française](./README_FR.md)

ReView is an open-source, secure, and self-hostable video collaboration platform. Designed as a free and accessible alternative to tools like Frame.io or SyncSketch, it enables creators, studios, and teams to review their video projects with precision and efficiency.

The project emphasizes data privacy (your files stay with you) and ease of use.

## Key Features

### 🎥 Collaboration & Viewing
- **Dynamic Timeline**: Precise navigation, grouped visual markers, and visualization of comment ranges.
- **Image Sequence Support**: Review storyboards, concept arts, or posters via a dedicated image gallery.
- **3D Support**: Import and review 3D models (.glb). Texture support via ZIP import.
- **Split-Screen Comparison**: Compare two video versions (V1 vs V2) side-by-side with synchronized playback and toggleable audio mixing.
- **Multi-Version Support**: Unified version history management (Videos, Image Sets, and 3D).

### ✍️ Advanced Feedback Tools
- **Vector Annotations**: Draw on videos AND images with precise tools (Pencil, Curved Arrow, Speech Bubble, Shapes).
- **Range-Based Comments**: Hold `Shift + Drag` on the timeline to comment on a specific duration (video only).
- **Task Assignment**: Turn a comment into an actionable task by assigning it to a team member. Check the box to mark it as resolved.
- **Mentions & Replies**: Full threading system with mentions (`@Name`, `@Role`) and reply threads.

### 📤 Exports & Reports
- **PDF Exports**: Generate comprehensive visual reports with thumbnails, timecodes, and task details.
- **CSV Exports**: Download raw data for integration into spreadsheets or editing software.

### 👥 Team Management
- **Custom Roles**: Create colored tags (e.g., @Animator, @Compositor) to organize your team.
- **Permissions**: Fine-grained access control (Owner, Member, Admin).
- **Client Review**: Secure sharing links for external clients without requiring an account.

## Installation and Startup

Please refer to the [Installation Guide](./installation.md) for detailed instructions.

---

## Recent Updates (Current Version)

The following features have just been added:

- ✅ **Unified Dashboard**: Switchable Grid and List views.
- ✅ **Advanced Filters**: Unified toolbar with search, filters (Status, Date), and sorting.
- ✅ **Image / Storyboard Support**: Upload and review image sequences (JPG, PNG, WEBP).
- ✅ **Split Screen Comparison**: Synchronized views to compare versions.
- ✅ **Duration Comments**: Range selection on the timeline.
- ✅ **PDF/CSV Export**: Detailed reports for production.
- ✅ **Drawing Tools**: Added curves, bubbles, and thickness adjustment.
- ✅ **Tasks**: Direct assignment and resolution tracking.
- ✅ **Toast Notifications**: Non-intrusive visual feedback for successes and errors.
- ✅ **Micro-interactions**: Smooth animations on project cards (Play button, Scale, Shadow).
- ✅ **Upload Progress**: Precise progress bar with remaining time estimation.
- ✅ **Modernized UI**: Blur effects (backdrop-blur) on modals.
- ✅ **Inline Validation**: Real-time form validation with password visibility icon.
- ✅ **Mobile Experience**: Bottom "Tab Bar" navigation on portrait mobile and enlarged touch zones.
- ✅ **Avatar Stack**: Quick visualization of team members on project cards.
- ✅ **Grouped Notifications**: Organized by project in the notification center.

## Roadmap

Future planned features:

1. **SSO Authentication**: Login via Google, GitHub, Discord...
2. **Two-Factor Authentication (2FA)**: Enhanced security.
3. **Storage Quotas**: Disk space management.
4. **Customizable Keyboard Shortcuts**.
5. **Webhook Integrations** (Slack/Discord/Teams).
6. **Adaptive Transcoding (HLS)**: Optimized streaming.
7. **Folders and Subfolders**: Advanced organization.
8. **Command Palette (Cmd+K)**: Quick navigation.
9. **DCC Integrations**: Plugins for Blender, Maya, Unreal Engine.

---
*ReView - Create, Share, Validate.*
