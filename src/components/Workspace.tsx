import { Upload, FileText, Image as ImageIcon, File, Loader2, Download, Trash2, FolderArchive, ArrowRight, HardDrive, FileArchive, Video, LayoutGrid, List, FolderPlus, Folder, Plus, PenLine, X, Sparkles } from 'lucide-react';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { supabase, clearStaleSupabaseTokens } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { FloatingEditorToolbar, TextStylePreset, TextAlignment } from './FloatingEditorToolbar';
import { triggerCapsuleFeedback } from '../lib/feedback';

interface WorkspaceFolder {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

// Define a simple type for files stored in Supabase
interface WorkspaceFile {
  id: string;
  name: string;
  type: string;
  size: number;
  s3_key: string;
  folder_id: string | null;
  created_at: string;
}

type ViewMode = 'grid' | 'list';
type FileFilter = 'all' | 'documents' | 'images' | 'media' | 'other' | 'folder';

export function Workspace() {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FileFilter>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Folder Creation Modal State
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Quick Study Note Scratchpad State (with FloatingEditorToolbar)
  const [isNoteScratchpadOpen, setIsNoteScratchpadOpen] = useState(false);
  const [scratchpadNoteText, setScratchpadNoteText] = useState('');
  const [scratchpadTitle, setScratchpadTitle] = useState('');
  const [scratchpadStyle, setScratchpadStyle] = useState<TextStylePreset>('Style 01');
  const [scratchpadAlign, setScratchpadAlign] = useState<TextAlignment>('left');
  const [scratchpadBold, setScratchpadBold] = useState(false);
  const [scratchpadItalic, setScratchpadItalic] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const isInternalSyncFile = (f: any) =>
    !f || f.type === 'application/vnd.eduai.sync+json' || f.name === '__edu_account_sync__.json';

  const fetchData = async () => {
    try {
      setLoading(true);
      const localFiles = localStorage.getItem('workspace_files_local');
      const localFolders = localStorage.getItem('workspace_folders_local');
      const parseVisibleFiles = (raw: string | null) => {
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter((f) => !isInternalSyncFile(f)) : [];
        } catch {
          return [];
        }
      };

      if (!supabase) {
        if (localFiles) setFiles(parseVisibleFiles(localFiles));
        if (localFolders) setFolders(JSON.parse(localFolders));
        return;
      }

      const res = await supabase.auth.getUser();
      if (res?.error) {
        if (res.error.message?.includes('Refresh Token') || res.error.message?.includes('refresh_token')) {
          clearStaleSupabaseTokens();
        }
        if (localFiles) setFiles(parseVisibleFiles(localFiles));
        if (localFolders) setFolders(JSON.parse(localFolders));
        return;
      }
      const user = res?.data?.user;
      if (!user) {
        if (localFiles) setFiles(parseVisibleFiles(localFiles));
        if (localFolders) setFolders(JSON.parse(localFolders));
        return;
      }

      const [filesData, foldersData] = await Promise.all([
        supabase
          .from('workspace_files')
          .select('*')
          .eq('user_id', user.id)
          .neq('type', 'application/vnd.eduai.sync+json')
          .order('created_at', { ascending: false }),
        supabase.from('workspace_folders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      if (filesData.error) {
        if (localFiles) {
          setFiles(parseVisibleFiles(localFiles));
        }
      } else if (filesData.data) {
        const visibleFiles = filesData.data.filter((f: any) => !isInternalSyncFile(f));
        setFiles(visibleFiles);
        localStorage.setItem('workspace_files_local', JSON.stringify(visibleFiles));
      }

      if (foldersData.error) {
        if (localFolders) {
          setFolders(JSON.parse(localFolders));
        }
      } else if (foldersData.data) {
        setFolders(foldersData.data);
        localStorage.setItem('workspace_folders_local', JSON.stringify(foldersData.data));
      }
    } catch (err) {
      console.warn('Workspace fetch notice:', err);
      const localFiles = localStorage.getItem('workspace_files_local');
      if (localFiles) {
        try {
          const parsed = JSON.parse(localFiles);
          if (Array.isArray(parsed)) setFiles(parsed.filter((f) => !isInternalSyncFile(f)));
        } catch (_) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setIsCreatingFolder(true);
    const newFolder: WorkspaceFolder = {
      id: crypto.randomUUID(),
      name: newFolderName.trim(),
      color: '#6366f1',
      created_at: new Date().toISOString()
    };

    try {
      if (supabase) {
        const res = await supabase.auth.getUser();
        const user = res?.data?.user;
        if (user) {
          const { data, error } = await supabase.from('workspace_folders').insert({
            user_id: user.id,
            name: newFolderName.trim(),
            color: '#6366f1'
          }).select().single();

          if (!error && data) {
            setFolders([data, ...folders]);
            localStorage.setItem('workspace_folders_local', JSON.stringify([data, ...folders]));
            setIsCreateFolderModalOpen(false);
            setNewFolderName('');
            return;
          }
        }
      }

      const updatedFolders = [newFolder, ...folders];
      setFolders(updatedFolders);
      localStorage.setItem('workspace_folders_local', JSON.stringify(updatedFolders));
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
    } catch (err) {
      console.warn('Folder create error, saved locally:', err);
      const updatedFolders = [newFolder, ...folders];
      setFolders(updatedFolders);
      localStorage.setItem('workspace_folders_local', JSON.stringify(updatedFolders));
      setIsCreateFolderModalOpen(false);
      setNewFolderName('');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this folder? All files within might be orphaned.')) return;
    
    try {
      if (supabase) {
        await supabase.from('workspace_folders').delete().eq('id', id);
      }
      
      const updatedFolders = folders.filter(f => f.id !== id);
      setFolders(updatedFolders);
      localStorage.setItem('workspace_folders_local', JSON.stringify(updatedFolders));
      
      if (currentFolder === id) {
        setCurrentFolder(null);
        setFilter('all');
      }
      const updatedFiles = files.map(f => f.folder_id === id ? { ...f, folder_id: null } : f);
      setFiles(updatedFiles);
      localStorage.setItem('workspace_files_local', JSON.stringify(updatedFiles));
    } catch (err) {
      console.warn('Folder delete notice:', err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      let fileKey = `workspace/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

      // 1. Try unified direct upload endpoint
      try {
        const uploadRes = await fetch(`/api/upload-direct?filename=${encodeURIComponent(file.name)}&prefix=workspace`, {
          method: 'POST',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (uploadRes.ok) {
          const resData = await uploadRes.json();
          if (resData.key) {
            fileKey = resData.key;
          }
        } else {
          // Fallback: Presigned URL request
          const presignRes = await fetch('/api/presigned-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              fileType: file.type || 'application/octet-stream',
              prefix: 'workspace',
              operation: 'upload'
            }),
          });
          if (presignRes.ok) {
            const { presignedUrl, fileKey: pKey } = await presignRes.json();
            if (presignedUrl) {
              const isDirect = presignedUrl.includes('/api/upload-direct');
              await fetch(presignedUrl, {
                method: isDirect ? 'POST' : 'PUT',
                body: file,
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
              });
              if (pKey) fileKey = pKey;
            }
          }
        }
      } catch (networkUploadErr) {
        console.warn('Network upload notice (saving locally):', networkUploadErr);
      }

      const newLocalFile: WorkspaceFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        s3_key: fileKey,
        folder_id: currentFolder,
        created_at: new Date().toISOString()
      };

      // 2. Persist metadata to Supabase if authenticated, or localStorage as instant fallback
      let savedToDb = false;
      if (supabase) {
        try {
          const res = await supabase.auth.getUser();
          const user = res?.data?.user;
          if (user) {
            const { error: insertError } = await supabase.from('workspace_files').insert({
              user_id: user.id,
              name: file.name,
              type: file.type || 'application/octet-stream',
              size: file.size,
              s3_key: fileKey,
              folder_id: currentFolder
            });
            if (!insertError) {
              savedToDb = true;
              await fetchData();
            }
          }
        } catch (dbErr) {
          console.warn('Database record insert notice:', dbErr);
        }
      }

      if (!savedToDb) {
        const updated = [newLocalFile, ...files.filter(f => f.id !== newLocalFile.id)];
        setFiles(updated);
        localStorage.setItem('workspace_files_local', JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = (key: string, name: string) => {
    const url = `/api/download?key=${encodeURIComponent(key)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name; // Try forcing download attribute
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      if (supabase) {
        await supabase.from('workspace_files').delete().eq('id', id);
      }
      const updated = files.filter(f => f.id !== id);
      setFiles(updated);
      localStorage.setItem('workspace_files_local', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
      const updated = files.filter(f => f.id !== id);
      setFiles(updated);
      localStorage.setItem('workspace_files_local', JSON.stringify(updated));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const totalSize = useMemo(() => files.reduce((acc, f) => acc + f.size, 0), [files]);

  const getFileCategory = (type: string): FileFilter => {
    if (type.includes('pdf') || type.includes('document') || type.includes('text') || type.includes('msword')) return 'documents';
    if (type.includes('image')) return 'images';
    if (type.includes('video') || type.includes('audio')) return 'media';
    return 'other';
  };

  const getFileIcon = (type: string) => {
    const category = getFileCategory(type);
    switch (category) {
      case 'documents': return <FileText className="w-6 h-6 text-blue-500" />;
      case 'images': return <ImageIcon className="w-6 h-6 text-emerald-500" />;
      case 'media': return <Video className="w-6 h-6 text-purple-500" />;
      default:
        if (type.includes('zip') || type.includes('tar') || type.includes('rar')) return <FileArchive className="w-6 h-6 text-amber-500" />;
        return <File className="w-6 h-6 text-slate-500" />;
    }
  };

  const filteredFiles = useMemo(() => {
    if (filter === 'folder') {
      return files.filter(f => f.folder_id === currentFolder);
    }
    const filtered = currentFolder ? files.filter(f => f.folder_id === currentFolder) : files;
    if (filter === 'all') return filtered;
    return filtered.filter(f => getFileCategory(f.type) === filter);
  }, [files, filter, currentFolder]);

  const StorageProgress = () => {
    const LIMIT = 5 * 1024 * 1024 * 1024; // 5GB limit (mock)
    const percentage = Math.min(100, (totalSize / LIMIT) * 100);
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center h-full">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 leading-tight">Storage usage</h3>
            <p className="text-xs text-slate-500">{formatSize(totalSize)} of 5 GB used</p>
          </div>
        </div>
        <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${percentage > 90 ? 'bg-red-500' : 'bg-brand-500'}`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Workspace
          </h1>
          <p className="text-slate-500 mt-2">
            Securely store and organize your assignments, notes, and study materials.
          </p>
        </div>
        <div className="flex items-center gap-2">
           <button
            onClick={() => {
              triggerCapsuleFeedback({ pitch: 620, volume: 0.14, hapticDuration: 10 });
              setIsNoteScratchpadOpen(true);
            }}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium transition-colors cursor-pointer"
          >
            <PenLine className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            Study Note
          </button>
           <button
            onClick={() => setIsCreateFolderModalOpen(true)}
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium transition-colors cursor-pointer"
          >
            <FolderPlus className="w-5 h-5 text-slate-400" />
            New Folder
          </button>
           <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
            {isUploading ? 'Uploading...' : 'Upload File'}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 border border-slate-200 bg-white rounded-2xl p-4 shadow-sm h-fit">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-3">Filter by type</h3>
          <ul className="space-y-1">
            {[
              { id: 'all', label: 'All Files', icon: FolderArchive, count: files.length },
              { id: 'documents', label: 'Documents', icon: FileText, count: files.filter(f => getFileCategory(f.type) === 'documents').length },
              { id: 'images', label: 'Images', icon: ImageIcon, count: files.filter(f => getFileCategory(f.type) === 'images').length },
              { id: 'media', label: 'Media', icon: Video, count: files.filter(f => getFileCategory(f.type) === 'media').length },
              { id: 'other', label: 'Other', icon: File, count: files.filter(f => getFileCategory(f.type) === 'other').length },
            ].map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => {
                     setFilter(f.id as FileFilter);
                     if (f.id !== 'folder') setCurrentFolder(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${filter === f.id && !currentFolder ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <f.icon className={`w-4 h-4 ${filter === f.id && !currentFolder ? 'text-brand-600' : 'text-slate-400'}`} />
                    {f.label}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md ${filter === f.id && !currentFolder ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                    {f.count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          
          <div className="mt-6 pt-6 border-t border-slate-100">
             <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-3">Folders</h3>
             <ul className="space-y-1 max-h-[30vh] overflow-y-auto">
               {folders.map(folder => (
                 <li key={folder.id} className="group relative">
                   <button
                     onClick={() => {
                       setCurrentFolder(folder.id);
                       setFilter('folder');
                     }}
                     className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentFolder === folder.id ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                     <div className="flex items-center gap-3">
                       <Folder className={`w-4 h-4 ${currentFolder === folder.id ? 'text-brand-600' : 'text-slate-400'}`} style={{ color: currentFolder !== folder.id ? folder.color : undefined }} />
                       <span className="truncate pr-6">{folder.name}</span>
                     </div>
                   </button>
                   <button 
                     onClick={(e) => handleDeleteFolder(folder.id, e)}
                     className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                 </li>
               ))}
               {folders.length === 0 && (
                 <li className="px-3 py-2 text-xs text-slate-400 italic">No folders created yet</li>
               )}
             </ul>
          </div>

          <div className="mt-8">
            <StorageProgress />
          </div>
        </div>

        <div className="md:col-span-3 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {currentFolder ? folders.find(f => f.id === currentFolder)?.name : filter} Files
            </h2>
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="min-h-[400px]">
            {loading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-300 mb-4">
                  <FolderArchive className="w-8 h-8" />
                </div>
                <h3 className="text-slate-800 font-semibold">No files found</h3>
                <p className="text-slate-500 text-sm mt-1 mb-4 max-w-sm">No files match your current filter, or you haven't uploaded any resources yet.</p>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Upload a file
                </button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
                {filteredFiles.map((file) => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    key={file.id} 
                    className={viewMode === 'grid' 
                      ? "flex flex-col bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group"
                      : "flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 sm:px-5 sm:py-4 hover:shadow-sm transition-all group"
                    }
                  >
                    {viewMode === 'grid' ? (
                      <>
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
                           <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-400 group-hover:scale-110 transition-transform">
                             {getFileIcon(file.type)}
                           </div>
                           <h4 className="font-medium text-slate-800 text-sm break-words w-full line-clamp-2" title={file.name}>{file.name}</h4>
                        </div>
                        <div className="flex justify-between items-center w-full mt-4 pt-4 border-t border-slate-100">
                          <span className="text-xs text-slate-400 font-medium">{formatSize(file.size)}</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleDownload(file.s3_key, file.name)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-md transition-colors"><Download className="w-4 h-4" /></button>
                             <button onClick={() => handleDelete(file.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-md transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 flex-1 overflow-hidden">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <h4 className="font-medium text-slate-900 text-sm truncate" title={file.name}>{file.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                              <span>{formatSize(file.size)}</span>
                              <span>•</span>
                              <span>{new Date(file.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-4">
                          <button onClick={() => handleDownload(file.s3_key, file.name)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2">
                            <Download className="w-4 h-4" /> Download
                          </button>
                          <button onClick={() => handleDelete(file.id)} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isCreateFolderModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateFolderModalOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-xl z-50 overflow-hidden"
            >
              <form onSubmit={handleCreateFolder}>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">New Folder</h3>
                  <p className="text-sm text-slate-500 mb-6">Create a folder to organize your materials.</p>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="folderName" className="block text-sm font-medium text-slate-700 mb-1">
                        Folder Name
                      </label>
                      <input
                        type="text"
                        id="folderName"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="e.g. History 101 Notes"
                        className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateFolderModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingFolder || !newFolderName.trim()}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingFolder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Folder
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quick Study Note Scratchpad Modal with FloatingEditorToolbar */}
      <AnimatePresence>
        {isNoteScratchpadOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNoteScratchpadOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-50 overflow-hidden flex flex-col p-6 gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
                    <PenLine className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Study Note Scratchpad</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Rich text editor with style presets</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNoteScratchpadOpen(false)}
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={scratchpadTitle}
                onChange={(e) => setScratchpadTitle(e.target.value)}
                placeholder="Note Title (e.g., Quantum Mechanics Summary)"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white font-medium text-sm outline-none focus:border-brand-500"
              />

              {/* Floating Text Editor Toolbar */}
              <div className="flex justify-center -mb-2">
                <FloatingEditorToolbar
                  currentStyle={scratchpadStyle}
                  onStyleChange={setScratchpadStyle}
                  alignment={scratchpadAlign}
                  onAlignmentChange={setScratchpadAlign}
                  isBold={scratchpadBold}
                  onToggleBold={() => setScratchpadBold(b => !b)}
                  isItalic={scratchpadItalic}
                  onToggleItalic={() => setScratchpadItalic(i => !i)}
                  onActionTrigger={() => {
                    if ('speechSynthesis' in window && scratchpadNoteText) {
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(new SpeechSynthesisUtterance(scratchpadNoteText));
                    }
                  }}
                  actionTooltip="Listen to Note"
                />
              </div>

              <textarea
                value={scratchpadNoteText}
                onChange={(e) => setScratchpadNoteText(e.target.value)}
                placeholder="Write your study notes, key takeaways, and flashcard concepts here..."
                rows={5}
                style={{ textAlign: scratchpadAlign }}
                className={`w-full p-4 rounded-2xl resize-none outline-none border transition-colors ${
                  scratchpadBold ? 'font-bold' : ''
                } ${scratchpadItalic ? 'italic' : ''} ${
                  scratchpadStyle === 'Style 01' 
                    ? 'font-serif text-sm leading-relaxed' 
                    : scratchpadStyle === 'Style 02' 
                      ? 'font-sans font-bold text-base' 
                      : scratchpadStyle === 'Style 03' 
                        ? 'font-serif italic text-sm border-l-4 border-brand-500' 
                        : 'font-mono text-xs'
                } bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:border-brand-500`}
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-400">Auto-saved to local workspace</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsNoteScratchpadOpen(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!scratchpadNoteText.trim() && !scratchpadTitle.trim()) return;
                      const stored = (() => {
                        try { return JSON.parse(localStorage.getItem('workspace_notes') || '[]'); } catch { return []; }
                      })();
                      stored.unshift({
                        id: crypto.randomUUID(),
                        title: scratchpadTitle.trim() || 'Untitled Study Note',
                        note: scratchpadNoteText.trim(),
                        style: scratchpadStyle,
                        createdAt: new Date().toISOString()
                      });
                      try { localStorage.setItem('workspace_notes', JSON.stringify(stored)); } catch {}
                      triggerCapsuleFeedback({ pitch: 700, volume: 0.16, hapticDuration: 12 });
                      setIsNoteScratchpadOpen(false);
                      setScratchpadNoteText('');
                      setScratchpadTitle('');
                    }}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-full text-xs font-semibold shadow-md shadow-brand-500/25 transition-all cursor-pointer"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
