# User Guide

Welcome to ReView! This guide will help you understand how to use the platform to collaborate on video, image, and 3D projects.

## Table of Contents

1. [Projects](#projects)
2. [Teams](#teams)
3. [Review & Comments](#review--comments)
4. [Annotations](#annotations)
5. [Client Review](#client-review)
6. [Trash & Recovery](#trash--recovery)

---

## Projects

Projects are the core of ReView. Each project can contain multiple versions of videos, image sets, or 3D assets.

### Creating a Project
To create a new project, click the **New Project** button in the sidebar or on the dashboard.

![Dashboard](/Guide/DASHBOARD.png "Dashboard")

You can choose between:
- **Video**: Upload a single video file.
- **Image**: Upload a sequence of images or a single image.
- **3D Asset**: Upload `.glb` or `.fbx` files.

### Versions
You can upload new versions of a project to track progress.
- In the Project View, click the **Upload Version** button in the top bar.
- Access previous versions via the dropdown menu in the top left.

![Versions](/Guide/VERSIONS.png "Versions")

### Comparison Mode
For video projects, you can compare two versions side-by-side.
- Click the **Compare** icon in the top bar.
- Select the version you want to compare against.
- Enable **Compare Audio** to mix audio from both versions.

---

---

## Teams & Settings

ReView allows you to organize projects into **Teams** for better collaboration.

### Creating a Team
- Navigate to the **Teams** section in the sidebar.
- Give your team a name and a unique slug.

### Managing Members
- Invite members via email.
- Assign roles: Owner, Co-Owner, Member, or Client.

### Team Settings
*Configurable by Team Owners and Admins.*

- **Discord Integration**: Connect your team to a Discord channel to receive real-time notifications for comments and reviews.
- **Start Timecode**: Set a custom start timecode (e.g., `01:00:00:00`) for video projects to match your production pipeline.
- **Digest Settings**: Control the frequency and content of email/Discord digests.
- **Storage Quotas**: Monitor your team's storage usage (limits set by instance administrator).

---

## Admin & Configuration

*Features available to Instance Administrators.*

### 3D Asset Configuration
- **Auto-Conversion**: Automatically convert uploaded `.fbx` files to `.glb` for universal compatibility.
- **Turnaround GIFs**: Automatically generate animated 360° GIFs for 3D assets to use in notifications.

### Global Announcements
- Administrators can broadcast urgent messages or maintenance alerts to all active users via a popup system.

### Trash System
- Deleted projects are safely stored in the Trash for 7 days before permanent deletion.
- This retention period allows for accidental deletion recovery.

---

## Review & Comments

The review interface is designed for precise and actionable feedback.

### Activity Panel
The right-hand panel displays all comments and activity.
- **Resizable**: Adjust the width of the panel by dragging its left edge.
- **Sticky UI**: The comment input and filters remain fixed at the top/bottom for easy access.

![Filters](/Guide/FILTERS.png "Filters")

### Timeline Navigation
The timeline provides frame-accurate control for video projects.
- **Frame Counting**: View the exact frame number and timecode.
- **Range Comments**: Hold `Shift` and drag on the timeline to select a specific time range for your comment.

---

## Annotations

Draw directly on the media to provide clear visual feedback.

### 2D Drawing Tools (Video & Image)
Open the toolbox next to the comment input to use arrows, shapes, or freehand drawing. Annotations are pinned to the exact frame or image.

![Toolbox](/Guide/TOOLBOX.png "Toolbox")

### 3D Annotations
For 3D assets, you can anchor annotations directly to the surface of the model.
- Click anywhere on the 3D model to place a hotspot.
- The camera state is saved, allowing others to see the exact perspective you were viewing.

![3D Review](/Guide/THREED_REVIEW.png "3D Review")

---

## Client Review

Share your work with external clients without requiring them to have an account.

1. Set the project status to **Client Review** in the top bar.
2. Click the **Share** button to copy the unique review link.
3. Clients can view and leave comments as "Guests".

---

## Trash & Recovery

Deleted projects are moved to the **Trash**.
- Projects are kept for 7 days before permanent deletion.
- You can **Restore** projects at any time from the Trash page.

![Trash](/Guide/TRASH.png "Trash")

---

*Need more help? Contact your administrator.*
