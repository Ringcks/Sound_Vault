"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type AudioAsset = {
  id: number;
  name: string;
  fileName: string;
  category: string;
  project: string;
  tags: string[];
  notes: string;
  createdAt?: number;
  updatedAt?: number;
  previewUrl?: string;
  fileData?: Blob;
  hasAudio: boolean;
};

const initialAssets: AudioAsset[] = [
  { id: 1, name: "Old Wooden Door Creak", fileName: "No file imported yet", category: "Foley", project: "Horror Prototype", tags: ["door", "wood", "creak"], notes: "Long creak for an abandoned building.", hasAudio: false },
  { id: 2, name: "Footsteps on Concrete", fileName: "No file imported yet", category: "Footsteps", project: "Horror Prototype", tags: ["footsteps", "concrete", "walking"], notes: "Check volume and loop consistency.", hasAudio: false },
  { id: 3, name: "Low Ambient Drone", fileName: "No file imported yet", category: "Ambience", project: "Memento Shadows", tags: ["ambient", "dark", "tension"], notes: "Background layer for a quiet puzzle room.", hasAudio: false },
];

const categories = ["Ambience", "Foley", "Footsteps", "Impact", "UI", "Music", "Voice", "Creature", "Other"];


const DB_NAME = "soundvault-library";
const DB_STORE = "audio-assets";

function openSoundVaultDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readSavedAssets(): Promise<AudioAsset[]> {
  const db = await openSoundVaultDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readonly");
    const request = transaction.objectStore(DB_STORE).getAll();

    request.onsuccess = () => {
      const savedAssets = (request.result as AudioAsset[]).map((asset) => ({
        ...asset,
        previewUrl: asset.fileData
          ? URL.createObjectURL(asset.fileData)
          : undefined,
        hasAudio: Boolean(asset.fileData),
      }));

      db.close();
      resolve(savedAssets);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function writeSavedAssets(assets: AudioAsset[]): Promise<void> {
  const db = await openSoundVaultDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, "readwrite");
    const store = transaction.objectStore(DB_STORE);

    store.clear();

    assets.forEach((asset) => {
      const { previewUrl, ...storedAsset } = asset;
      store.put(storedAsset);
    });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };

    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

type AssetFormValues = { name: string; category: string; project: string; tags: string; notes: string };
const emptyForm: AssetFormValues = { name: "", category: "Foley", project: "", tags: "", notes: "" };

export default function Home() {
  const [assets, setAssets] = useState<AudioAsset[]>(initialAssets);
  const [storageReady, setStorageReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState(
    "Loading saved library..."
  );
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAsset, setEditAsset] = useState<AssetFormValues>(emptyForm);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [projects, setProjects] = useState<string[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    readSavedAssets()
      .then((savedAssets) => {
        if (cancelled) {
          savedAssets.forEach((asset) => {
            if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
          });
          return;
        }

        const wasInitialized =
          window.localStorage.getItem("soundvault-initialized") === "true";

        setAssets(
          savedAssets.length > 0 || wasInitialized
            ? savedAssets
            : initialAssets
        );

        setStorageMessage("Library loaded from this browser");
      })
      .catch((error) => {
        console.error("Could not load SoundVault library:", error);

        if (!cancelled) {
          setStorageMessage(
            "Browser storage unavailable; changes may not be saved"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setStorageReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    writeSavedAssets(assets)
      .then(() => {
        window.localStorage.setItem("soundvault-initialized", "true");
        setStorageMessage("Saved in this browser");
      })
      .catch((error) => {
        console.error("Could not save SoundVault library:", error);
        setStorageMessage(
          "Could not save library; check available browser storage"
        );
      });
  }, [assets, storageReady]);

  useEffect(() => {
    const savedProjects = localStorage.getItem("soundvault-projects");

    if (savedProjects) {
      setProjects(JSON.parse(savedProjects));
    }

    setProjectsLoaded(true);
  }, []);

  useEffect(() => {
    if (!projectsLoaded) {
      return;
    }

    localStorage.setItem(
      "soundvault-projects",
      JSON.stringify(projects)
    );
  }, [projects, projectsLoaded]);

  const toggleAssetSelection = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredAssets.map((asset) => asset.id);

    const allSelected =
      filteredIds.length > 0 &&
      filteredIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !filteredIds.includes(id))
      );
    } else {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...filteredIds]))
      );
    }
  };

  const unassignedCount = assets.filter((asset) => !asset.project.trim() || asset.project === "Unassigned").length;
  const categoryCount = new Set(assets.map((asset) => asset.category)).size;
  const projectCount = new Set(assets.map((asset) => asset.project.trim()).filter((project) => project && project !== "Unassigned")).size;
  const recentAssets = [...assets]
    .filter((asset) => asset.createdAt || asset.updatedAt)
    .sort(
      (a, b) =>
        (b.updatedAt ?? b.createdAt ?? 0) -
        (a.updatedAt ?? a.createdAt ?? 0)
    )
    .slice(0, 5);
  const projectOptions = Array.from(
    new Set(
      assets
        .map((asset) => asset.project.trim())
        .filter((project) => project && project !== "Unassigned")
    )
  ).sort((a, b) => a.localeCompare(b));

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch = !query || asset.name.toLowerCase().includes(query) || asset.fileName.toLowerCase().includes(query) || asset.category.toLowerCase().includes(query) || asset.project.toLowerCase().includes(query) || asset.tags.some((tag) => tag.toLowerCase().includes(query)) || asset.notes.toLowerCase().includes(query);
      return matchesSearch && (categoryFilter === "All" || asset.category === categoryFilter);
    });
  }, [assets, search, categoryFilter]);

  const allFilteredSelected =
    filteredAssets.length > 0 &&
    filteredAssets.every((asset) => selectedIds.includes(asset.id));

  function importFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) => /\.(wav|mp3)$/i.test(file.name) || ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3"].includes(file.type));
    if (!selectedFiles.length) {
      if (event.target.files?.length) alert("Please select WAV or MP3 audio files.");
      event.target.value = "";
      return;
    }
    const imported: AudioAsset[] = selectedFiles.map((file, index) => {
      const name = file.name.replace(/\.(wav|mp3)$/i, "").replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();

      const now = Date.now();
      return {
        id: Date.now() + index,
        name: name || file.name,
        fileName: file.name,
        category: "Other",
        project: "Unassigned",
        tags: [],
        notes: "",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        previewUrl: URL.createObjectURL(file),
        fileData: file,
        hasAudio: true,
      };
    });
    setAssets((current) => [...imported, ...current]);
    event.target.value = "";
  }

  function startEditing(asset: AudioAsset) {
    setEditingId(asset.id);
    setEditAsset({ name: asset.name, category: asset.category, project: asset.project, tags: asset.tags.join(", "), notes: asset.notes });
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editAsset.name.trim()) {
      alert("Please enter an asset name.");
      return;
    }

    setAssets((current) =>
      current.map((asset) =>
        asset.id === editingId
          ? {
            ...asset,
            name: editAsset.name.trim(),
            category: editAsset.category,
            project: editAsset.project.trim() || "Unassigned",
            tags: editAsset.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
            notes: editAsset.notes.trim(),
            updatedAt: Date.now(),
          }
          : asset
      )
    );

    setEditingId(null);
  }

  function deleteAsset(id: number) {
    const asset = assets.find((item) => item.id === id);
    if (!window.confirm(`Remove "${asset?.name ?? "this audio asset"}" from SoundVault? The original audio file on your computer will not be deleted.`)) return;
    if (asset?.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    setAssets((current) => current.filter((item) => item.id !== id));
    if (editingId === id) setEditingId(null);
    if (playingId === id) setPlayingId(null);
  }

  function bulkDeleteAssets() {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${selectedIds.length} selected audio asset(s)? The original audio files on your computer will not be deleted.`
    );

    if (!confirmed) return;

    const selectedAssets = assets.filter((asset) =>
      selectedIds.includes(asset.id)
    );

    selectedAssets.forEach((asset) => {
      if (asset.previewUrl) {
        URL.revokeObjectURL(asset.previewUrl);
      }
    });

    setAssets((current) =>
      current.filter((asset) => !selectedIds.includes(asset.id))
    );

    if (editingId !== null && selectedIds.includes(editingId)) {
      setEditingId(null);
    }

    if (playingId !== null && selectedIds.includes(playingId)) {
      setPlayingId(null);
    }

    setSelectedIds([]);
  }

  function bulkChangeCategory(category: string) {
    if (!category || selectedIds.length === 0) return;

    setAssets((current) =>
      current.map((asset) =>
        selectedIds.includes(asset.id)
          ? { ...asset, category }
          : asset
      )
    );
  }

  function bulkAssignProject(project: string) {
    if (!project.trim() || selectedIds.length === 0) return;

    setAssets((current) =>
      current.map((asset) =>
        selectedIds.includes(asset.id)
          ? { ...asset, project: project.trim() }
          : asset
      )
    );
  }

  function createAndAssignProject() {
    const project = newProjectName.trim();

    if (!project || selectedIds.length === 0) {
      alert("Please enter a project name.");
      return;
    }

    bulkAssignProject(project);
    setNewProjectName("");
  }

  function createProject() {
    const projectName = newProjectName.trim();

    if (projectName === "") {
      alert("Please enter a project name.");
      return;
    }

    if (projects.includes(projectName)) {
      alert("This project already exists.");
      return;
    }

    setProjects([...projects, projectName]);
    setNewProjectName("");
  }

  function renameProject(oldName: string, newName: string) {
    const updatedName = newName.trim();

    if (updatedName === "") {
      alert("Please enter a new project name.");
      return;
    }

    if (projects.includes(updatedName)) {
      alert("This project name already exists.");
      return;
    }

    setProjects((current) =>
      current.map((project) =>
        project === oldName ? updatedName : project
      )
    );

    setAssets((current) =>
      current.map((asset) =>
        asset.project === oldName
          ? { ...asset, project: updatedName }
          : asset
      )
    );
  }

  function deleteProject(projectName: string) {
    const confirmed = window.confirm(
      `Delete project "${projectName}"? Its audio assets will remain in your library but become Unassigned.`
    );

    if (!confirmed) {
      return;
    }

    setProjects((current) =>
      current.filter((project) => project !== projectName)
    );

    setAssets((current) =>
      current.map((asset) =>
        asset.project === projectName
          ? { ...asset, project: "Unassigned" }
          : asset
      )
    );
  }

  function bulkAddTag() {
    const tag = newTagName.trim();

    if (!tag || selectedIds.length === 0) {
      alert("Please enter a tag name.");
      return;
    }

    setAssets((current) =>
      current.map((asset) =>
        selectedIds.includes(asset.id)
          ? {
            ...asset,
            tags: asset.tags.includes(tag)
              ? asset.tags
              : [...asset.tags, tag],
          }
          : asset
      )
    );

    setNewTagName("");
  }

  function bulkRemoveTag(tag: string) {
    if (!tag || selectedIds.length === 0) return;

    setAssets((current) =>
      current.map((asset) =>
        selectedIds.includes(asset.id)
          ? {
            ...asset,
            tags: asset.tags.filter(
              (existingTag) => existingTag !== tag
            ),
          }
          : asset
      )
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="flex w-full flex-col bg-slate-950 p-5 text-white md:min-h-screen md:w-64 md:shrink-0">
        <div className="mb-10 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 text-xl font-bold">S</div><div><h1 className="text-lg font-bold">SoundVault</h1><p className="text-xs text-slate-400">Game audio workspace</p></div></div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">Workspace</p>
        <nav className="space-y-2">
          {[
            { id: "overview", icon: "▦", label: "Overview" },
            { id: "library", icon: "♫", label: "Audio Library" },
            { id: "projects", icon: "▧", label: "Game Projects" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSelectedProject(null);
              }} className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition ${activeTab === item.id
                ? "bg-indigo-500 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>       
        <div className="mt-auto hidden border-t border-slate-800 pt-5 text-sm text-slate-400 md:block">Portfolio project · v0.3</div>
      </aside>

      <section className="min-w-0 flex-1 p-5 sm:p-8">

        {activeTab === "projects" ? (
          selectedProject ? (
            <div>
              <button
                onClick={() => setSelectedProject(null)}
                className="mb-6 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                ← Back to Projects
              </button>

              <header className="mb-8">
                <p className="text-sm text-slate-500">
                  SoundVault / Game Projects / {selectedProject}
                </p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight">
                  {selectedProject}
                </h2>
                <p className="mt-2 text-slate-500">
                  Audio assets assigned to this project.
                </p>
              </header>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-lg font-bold">Project Audio Assets</h3>

                {assets.filter((asset) => asset.project === selectedProject).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No audio assets assigned to this project yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {assets
                      .filter((asset) => asset.project === selectedProject)
                      .map((asset) => (
                        <div
                          key={asset.id}
                          className="rounded-xl border border-slate-100 p-4"
                        >
                          <div className="mb-3">
                            <p className="truncate font-medium">{asset.name}</p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                                {asset.fileName.split(".").pop()?.toUpperCase() || "AUDIO"}
                              </span>

                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                {asset.category}
                              </span>

                              {asset.fileData && (
                                <span className="text-xs text-slate-400">
                                  {(asset.fileData.size / (1024 * 1024)).toFixed(2)} MB
                                </span>
                              )}
                            </div>
                          </div>

                          {asset.previewUrl || asset.fileData ? (
                            <audio
                              controls
                              src={
                                asset.previewUrl ||
                                URL.createObjectURL(asset.fileData!)
                              }
                              className="w-full"
                            />
                          ) : (
                            <p className="text-xs text-slate-400">
                              Audio preview unavailable
                            </p>
                          )}

                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => {
                                const confirmed = window.confirm(
                                  `Remove "${asset.name}" from "${selectedProject}"?`
                                );

                                if (confirmed) {
                                  setAssets((currentAssets) =>
                                    currentAssets.map((currentAsset) =>
                                      currentAsset.id === asset.id
                                        ? { ...currentAsset, project: "Unassigned" }
                                        : currentAsset
                                    )
                                  );
                                }
                              }}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Remove from Project
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <header className="mb-8">
                <p className="text-sm text-slate-500">SoundVault / Game Projects</p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight">Game Projects</h2>
                <p className="mt-2 text-slate-500">
                  Organize your audio assets by game project.
                </p>
              </header>

              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="font-bold">Create a Project</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Add a project to organize your game audio.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    placeholder="Enter project name..."
                    className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={createProject}
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    + Create Project
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-bold">Your Projects</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {projects.length} saved project(s)
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from(
                  new Set([
                    ...projects,
                    ...assets
                      .map((asset) => asset.project.trim())
                      .filter((project) => project && project !== "Unassigned"),
                  ])
                )
                  .sort((a, b) => a.localeCompare(b))
                  .map((project) => {
                    const assetCount = assets.filter(
                      (asset) => asset.project === project
                    ).length;

                    return (
                      <div
                        key={project}
                        className="rounded-2xl border border-slate-200 bg-white p-5"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-700">
                            ▧
                          </div>
                          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                            Game Project
                          </span>
                        </div>

                        <h4 className="mt-4 text-lg font-bold">{project}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          {assetCount} audio asset(s)
                        </p>

                        <div className="mt-5 flex flex-col gap-2">
                          <button
                            onClick={() => setSelectedProject(project)}
                            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                          >
                            View Assets
                          </button>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const newName = prompt(
                                  `Rename "${project}" to:`,
                                  project
                                );

                                if (newName !== null) {
                                  renameProject(project, newName);
                                }
                              }}
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
                            >
                              Rename
                            </button>

                            <button
                              onClick={() => deleteProject(project)}
                              className="flex-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {projects.length === 0 &&
                !assets.some(
                  (asset) =>
                    asset.project.trim() && asset.project !== "Unassigned"
                ) && (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <p className="text-lg font-semibold">No projects yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Create your first game project to get started.
                    </p>
                  </div>
                )}
            </div>
          )
        ) : activeTab === "library" ? (
          <>
            <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm text-slate-500">SoundVault / Overview</p><h2 className="mt-1 text-3xl font-bold tracking-tight">Game Audio Library</h2><p className="mt-2 text-slate-500">Import WAV and MP3 files, preview sounds, and organize them across projects.</p></div><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">DT</div><div><p className="text-sm font-semibold">My Workspace</p><p className="text-xs text-slate-500">Local demo library</p></div></div></header>

            <div className="mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:flex-row sm:items-center"><div><h3 className="font-semibold text-indigo-950">Add sounds without typing file paths</h3><p className="mt-1 text-sm leading-6 text-indigo-900">Select one or more WAV or MP3 files from your computer. SoundVault fills in each filename automatically.</p></div><div><input ref={fileInputRef} type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" multiple onChange={importFiles} className="hidden" /><button onClick={() => fileInputRef.current?.click()} className="whitespace-nowrap rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">+ Import Audio Files</button></div></div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-center"><div><h3 className="text-lg font-bold">Audio Assets</h3><p className="mt-1 text-sm text-slate-500">Search filenames, projects, categories, tags, and notes.</p></div><div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search audio assets..." aria-label="Search audio assets" className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-56" /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filter by audio category" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500"><option>All</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></div></div>
              {selectedIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-indigo-50 px-5 py-4">
                  <p className="text-sm font-medium text-indigo-900">
                    {selectedIds.length} asset(s) selected
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          bulkChangeCategory(event.target.value);
                          event.target.value = "";
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      aria-label="Change category of selected assets"
                    >
                      <option value="" disabled>Change Category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>

                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          bulkAssignProject(event.target.value);
                          event.target.value = "";
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      aria-label="Assign project to selected assets"
                    >
                      <option value="" disabled>Assign Project</option>
                      {projects.map((project) => (
                        <option key={project} value={project}>
                          {project}
                        </option>
                      ))}
                      <option value="Unassigned">Unassigned</option>
                    </select>

                    {/* New project input and button */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(event) => setNewProjectName(event.target.value)}
                        placeholder="New project name"
                        className="w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />

                      <button
                        onClick={createAndAssignProject}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Assign New Project
                      </button>
                    </div>

                    <button
                      onClick={createProject}
                      className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      Create Project
                    </button>

                    <button
                      onClick={() => {
                        const oldName = prompt("Enter the current project name:");

                        if (oldName === null) return;

                        if (!projects.includes(oldName)) {
                          alert("Project not found.");
                          return;
                        }

                        const newName = prompt("Enter the new project name:");

                        if (newName === null) return;

                        renameProject(oldName, newName);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Rename Project
                    </button>

                    <button
                      onClick={() => {
                        const projectName = prompt("Enter the project name to delete:");

                        if (projectName === null) return;

                        if (!projects.includes(projectName)) {
                          alert("Project not found.");
                          return;
                        }

                        deleteProject(projectName);
                      }}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete Project
                    </button>

                    {/* Bulk tag management */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(event) => setNewTagName(event.target.value)}
                        placeholder="New tag"
                        className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      />

                      <button
                        onClick={bulkAddTag}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                      >
                        Add Tag
                      </button>
                    </div>

                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (event.target.value) {
                          bulkRemoveTag(event.target.value);
                          event.target.value = "";
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      aria-label="Remove tag from selected assets"
                    >
                      <option value="" disabled>Remove Tag</option>
                      {Array.from(
                        new Set(
                          assets
                            .filter((asset) => selectedIds.includes(asset.id))
                            .flatMap((asset) => asset.tags)
                        )
                      ).map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={bulkDeleteAssets}
                      className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete Selected
                    </button>

                    <button
                      onClick={() => setSelectedIds([])}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Clear Selection
                    </button>

                  </div>
                </div>
              )}
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>
                <th className="px-5 py-4">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all filtered audio assets"
                    disabled={filteredAssets.length === 0}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                </th>
                <th className="px-5 py-4 font-semibold">Audio Asset</th><th className="px-5 py-4 font-semibold">Category</th><th className="px-5 py-4 font-semibold">Project</th><th className="px-5 py-4 font-semibold">Tags</th><th className="px-5 py-4 font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
                  {filteredAssets.map((asset) => <tr key={asset.id} className="transition hover:bg-slate-50">{editingId === asset.id ? <td colSpan={6} className="p-4"><AssetForm value={editAsset} onChange={(key, value) => setEditAsset((current) => ({ ...current, [key]: value }))} onSubmit={saveEdit} onCancel={() => setEditingId(null)} /></td> : <>
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(asset.id)}
                        onChange={() => toggleAssetSelection(asset.id)}
                        aria-label={`Select ${asset.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </td>
                    <td className="min-w-64 px-5 py-4"><p className="font-semibold">{asset.name}</p><p className="mt-1 break-all text-xs text-slate-500">{asset.fileName}</p>{asset.notes && <p className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{asset.notes}</p>}{asset.previewUrl ? <div className="mt-3 max-w-xs"><audio controls preload="metadata" src={asset.previewUrl} onPlay={() => setPlayingId(asset.id)} onPause={() => setPlayingId((current) => current === asset.id ? null : current)} className="h-9 w-full" /><p className="mt-1 text-xs text-emerald-700">{playingId === asset.id ? "Playing preview" : "Ready to preview"}</p></div> : <p className="mt-2 text-xs text-amber-700">Demo item — import a file to enable playback.</p>}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{asset.category}</td><td className="whitespace-nowrap px-5 py-4 text-slate-600">{asset.project}</td><td className="min-w-40 px-5 py-4"><div className="flex flex-wrap gap-1.5">{asset.tags.length ? asset.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>) : <span className="text-xs text-slate-400">No tags</span>}</div></td><td className="whitespace-nowrap px-5 py-4"><div className="flex gap-2"><button onClick={() => startEditing(asset)} className="rounded border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100">Edit</button><button onClick={() => deleteAsset(asset.id)} className="rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Delete</button></div></td></>}</tr>)}
                  {filteredAssets.length === 0 && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No audio assets match your search or filters.</td></tr>}
                </tbody></table></div><div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">Showing {filteredAssets.length} of {assets.length} audio assets</div>
            </section>
            <p className="mt-6 text-center text-xs text-slate-400">SoundVault · Imported files stay in your browser session · Built with Next.js and TypeScript</p>
            <p className="mt-2 text-center text-xs text-slate-400">
              {storageMessage}. Audio and metadata are stored locally in this browser.
              Keep backups of important source files.
            </p>

          </>
        ) : (
          <div>
            <header className="mb-8">
              <p className="text-sm text-slate-500">SoundVault / Overview</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">
                Overview
              </h2>
              <p className="mt-2 text-slate-500">
                Your game audio workspace at a glance.
              </p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Audio Assets"
                value={String(assets.length)}
                detail="Items in your library"
                icon="♫"
                color="indigo"
              />
              <MetricCard
                title="Unassigned Assets"
                value={String(unassignedCount)}
                detail="Not linked to a project yet"
                icon="?"
                color="amber"
              />
              <MetricCard
                title="Categories Used"
                value={String(categoryCount)}
                detail="Different audio types"
                icon="▤"
                color="emerald"
              />
              <MetricCard
                title="Linked Projects"
                value={String(projectCount)}
                detail="Projects with assigned audio"
                icon="⌂"
                color="violet"
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold">Welcome to SoundVault</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Manage your game audio assets, preview sounds, and organize
                them by project.
              </p>

              <button
                onClick={() => setActiveTab("library")}
                className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Open Audio Library
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Recent Audio Activity
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your latest imported and edited audio assets.
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab("library")}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  View All Assets
                </button>
              </div>

              {recentAssets.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recentAssets.map((asset) => {
                    const wasEdited =
                      Boolean(
                        asset.updatedAt &&
                        (!asset.createdAt || asset.updatedAt > asset.createdAt)
                      );

                    const activityTime = asset.updatedAt ?? asset.createdAt ?? 0;

                    return (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between gap-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {asset.name}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {asset.fileName}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-xs font-medium text-slate-600">
                            {wasEdited ? "Edited" : "Added"}
                          </span>
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(activityTime).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">
                  No recent activity yet. Import an audio file or edit an asset to see it here.
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function AssetForm({ value, onChange, onSubmit, onCancel }: { value: AssetFormValues; onChange: <K extends keyof AssetFormValues>(key: K, nextValue: AssetFormValues[K]) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  return <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"><h3 className="text-lg font-bold sm:col-span-2 lg:col-span-3">Edit audio details</h3><label className="text-sm font-medium">Asset Name *<input required value={value.name} onChange={(event) => onChange("name", event.target.value)} className={inputClass} placeholder="e.g. Old Wooden Door Creak" /></label><label className="text-sm font-medium">Category<select value={value.category} onChange={(event) => onChange("category", event.target.value)} className={inputClass}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm font-medium">Game Project<input value={value.project} onChange={(event) => onChange("project", event.target.value)} className={inputClass} placeholder="e.g. Horror Prototype" /></label><label className="text-sm font-medium">Tags<input value={value.tags} onChange={(event) => onChange("tags", event.target.value)} className={inputClass} placeholder="wood, creak, interior" /><span className="mt-1 block text-xs font-normal text-slate-500">Separate tags with commas.</span></label><label className="text-sm font-medium sm:col-span-2">Sound Design Notes<textarea value={value.notes} onChange={(event) => onChange("notes", event.target.value)} className={inputClass} rows={2} placeholder="Describe the sound or intended use..." /></label><div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><button type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Save Changes</button><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold hover:bg-slate-100">Cancel</button></div></form>;
}

function MetricCard({ title, value, detail, icon, color }: { title: string; value: string; detail: string; icon: string; color: "indigo" | "amber" | "emerald" | "violet" }) {
  const iconColors = { indigo: "bg-indigo-100 text-indigo-700", amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700", violet: "bg-violet-100 text-violet-700" };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{title}</p><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${iconColors[color]}`}>{icon}</div></div><p className="mt-4 break-words text-2xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>;
}
