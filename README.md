# SoundVault

**A Game Audio Asset Management Tool**

SoundVault is a web-based application designed to help game developers and audio creators organize, preview, and manage their sound effect libraries.

Built as a personal portfolio project, SoundVault focuses on making audio asset management more convenient through a clean interface and practical workflow features.

## Features

### Audio Asset Management
- Import multiple WAV and MP3 files directly from your computer.
- Preview audio files in the browser.
- Search and filter assets by name and category.
- Edit asset metadata, including names, categories, and tags.
- Delete individual assets or manage multiple assets at once.

### Bulk Management
- Select multiple audio assets.
- Change categories in bulk.
- Assign assets to game projects.
- Add tags to multiple assets.
- Delete selected assets.

### Game Project Organization
- Create, edit, and delete game projects.
- Organize audio assets by project.
- View project details and associated assets.
- Save project information between sessions.

### Dashboard
- View audio library statistics.
- Track asset categories and project organization.
- Access recently added assets.

## Technologies Used

- **Next.js** – React framework
- **React** – User interface development
- **TypeScript** – Type-safe application logic
- **Tailwind CSS** – Styling and responsive layout
- **IndexedDB** – Local storage for audio assets
- **LocalStorage** – Persistent game project data

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

1. Clone the repository:

   ```bash
   git clone <your-github-repository-url>
   ```

2. Navigate to the project directory:

   ```bash
   cd soundvault
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Storage

SoundVault currently stores audio assets and project information locally in the browser.

Audio files are imported from the user's computer and stored using IndexedDB, while project information is saved using LocalStorage.

This version is designed for local use in the browser.

## Project Background

SoundVault was developed as a personal portfolio project to explore web application development and create a practical tool for game development workflows.

The project combines my background in game development with my interest in audio organization and software development.

## Future Improvements

- Audio waveform visualization
- Advanced audio filtering and sorting
- Additional audio metadata tools
- Cloud storage and synchronization

## Author

**David Teo**

Game Development Graduate | Gameplay Programmer

