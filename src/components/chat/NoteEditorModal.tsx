import React, { useState, useEffect } from 'react';
import { 
  X, BookOpen, Sparkles, Plus, Trash2, Users, Lock, 
  Globe, Shield, Check, UserPlus, FileText, ChevronRight,
  Info, AlertCircle
} from 'lucide-react';
import { 
  SharedBookNote, SharedNotePermission, 
  NoteCollaborator, ChatUser, Conversation 
} from './types';
import { mockBooks } from '../../data';

interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit?: SharedBookNote | null;
  currentUser: ChatUser;
  allUsers: ChatUser[];
  conversations: Conversation[];
  activeConversation?: Conversation;
  onSaveNote: (note: SharedBookNote) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  onClose,
  noteToEdit,
  currentUser,
  allUsers,
  conversations,
  activeConversation,
  onSaveNote,
}) => {
  const [title, setTitle] = useState('');
  const [selectedBookId, setSelectedBookId] = useState(mockBooks[0]?.id || '1');
  const [chapterOrPage, setChapterOrPage] = useState('');
  const [takeawayInputs, setTakeawayInputs] = useState<string[]>(['']);
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [permissionType, setPermissionType] = useState<SharedNotePermission>('group');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [collaborators, setCollaborators] = useState<NoteCollaborator[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Group conversations available
  const groupConversations = conversations.filter(c => c.type === 'group');

  useEffect(() => {
    if (noteToEdit) {
      setTitle(noteToEdit.title || '');
      setSelectedBookId(noteToEdit.bookId || mockBooks[0]?.id || '1');
      setChapterOrPage(noteToEdit.chapterOrPage || '');
      const existingTakeaways = Array.isArray(noteToEdit.keyTakeaways) ? noteToEdit.keyTakeaways : [];
      setTakeawayInputs(existingTakeaways.length > 0 ? existingTakeaways : ['']);
      setContent(noteToEdit.content || '');
      setTagsInput((noteToEdit.tags || []).join(', '));
      setPermissionType(noteToEdit.permissionType || 'group');
      setSelectedUserIds(noteToEdit.allowedUserIds || []);
      setSelectedGroupIds(noteToEdit.allowedGroupIds || []);
      setCollaborators(noteToEdit.collaborators || []);
    } else {
      // New note default
      setTitle('');
      setSelectedBookId(mockBooks[0]?.id || '1');
      setChapterOrPage('Chapter 1: Key Concepts');
      setTakeawayInputs([
        'Core fundamental concept takeaway',
        'Practical implication or textbook example'
      ]);
      setContent('### Summary & Reflection\nWrite detailed collaborative notes, formulas, or synthesized learning points here.');
      setTagsInput('StudyNotes, KeyTakeaways');
      
      const defaultPerm: SharedNotePermission = activeConversation?.type === 'group' ? 'group' : 'individual';
      setPermissionType(defaultPerm);

      const defaultGroup = activeConversation?.type === 'group' ? [activeConversation.id] : [];
      setSelectedGroupIds(defaultGroup);

      const currentUid = currentUser?.id || 'current-user-id';
      const defaultUsers = activeConversation?.type === 'direct' 
        ? [currentUid, ...(activeConversation.participants || [])]
        : [currentUid];
      setSelectedUserIds(Array.from(new Set(defaultUsers)));

      setCollaborators([
        {
          userId: currentUid,
          userName: currentUser?.name || 'You',
          userRole: currentUser?.role || 'student',
          permission: 'admin',
          addedAt: new Date().toISOString()
        }
      ]);
    }
    setErrorMsg(null);
  }, [noteToEdit, isOpen, activeConversation?.id]);

  if (!isOpen) return null;

  const handleAddTakeaway = () => {
    setTakeawayInputs(prev => [...prev, '']);
  };

  const handleUpdateTakeaway = (index: number, val: string) => {
    setTakeawayInputs(prev => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleRemoveTakeaway = (index: number) => {
    if (takeawayInputs.length <= 1) {
      setTakeawayInputs(['']);
      return;
    }
    setTakeawayInputs(prev => prev.filter((_, i) => i !== index));
  };

  const toggleUserId = (uid: string) => {
    setSelectedUserIds(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );

    // Also update collaborators list with 'edit' or 'view'
    setCollaborators(prev => {
      const exists = prev.some(c => c.userId === uid);
      if (exists) {
        return prev.filter(c => c.userId !== uid);
      } else {
        const found = allUsers.find(u => u.id === uid);
        return [
          ...prev,
          {
            userId: uid,
            userName: found?.name || 'User',
            userRole: found?.role || 'student',
            permission: 'edit',
            addedAt: new Date().toISOString()
          }
        ];
      }
    });
  };

  const toggleGroupId = (gid: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(gid) ? prev.filter(id => id !== gid) : [...prev, gid]
    );
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter a descriptive title for this shared note.');
      return;
    }

    const cleanTakeaways = takeawayInputs.map(t => t.trim()).filter(Boolean);
    if (cleanTakeaways.length === 0) {
      setErrorMsg('Please add at least one key takeaway bullet point.');
      return;
    }

    const matchedBook = mockBooks.find(b => b.id === selectedBookId) || mockBooks[0];

    const cleanTags = tagsInput
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    // Build finalized note
    const finalNote: SharedBookNote = {
      id: noteToEdit ? noteToEdit.id : `note-${Date.now()}`,
      title: title.trim(),
      bookId: matchedBook.id,
      bookTitle: matchedBook.title,
      bookAuthor: matchedBook.author,
      bookCover: matchedBook.coverImage,
      chapterOrPage: chapterOrPage.trim() || undefined,
      keyTakeaways: cleanTakeaways,
      content: content.trim(),
      tags: cleanTags.length > 0 ? cleanTags : ['Takeaway', 'StudyNote'],
      authorId: noteToEdit ? noteToEdit.authorId : currentUser.id,
      authorName: noteToEdit ? noteToEdit.authorName : currentUser.name,
      authorRole: noteToEdit ? noteToEdit.authorRole : currentUser.role,
      authorAvatar: noteToEdit ? noteToEdit.authorAvatar : currentUser.avatar,
      conversationId: activeConversation?.id,
      permissionType,
      allowedUserIds: permissionType === 'individual' ? Array.from(new Set([currentUser.id, ...selectedUserIds])) : [currentUser.id],
      allowedGroupIds: permissionType === 'group' ? selectedGroupIds : [],
      collaborators: collaborators.length > 0 ? collaborators : [
        {
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          permission: 'admin',
          addedAt: new Date().toISOString()
        }
      ],
      isPinned: noteToEdit ? noteToEdit.isPinned : false,
      createdAt: noteToEdit ? noteToEdit.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSaveNote(finalNote);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden z-10 animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {noteToEdit ? 'Edit Shared Book Note' : 'Create Shared Book Takeaway'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Collaborate on takeaways with individual or group permissions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Note Title & Topic *
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Core Takeaways on Newton's Laws & Momentum"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              required
            />
          </div>

          {/* Book Selection & Chapter/Page */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Target Book / Syllabus *
              </label>
              <select
                value={selectedBookId}
                onChange={e => setSelectedBookId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {mockBooks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title} ({b.author})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                Chapter / Section / Pages
              </label>
              <input
                type="text"
                value={chapterOrPage}
                onChange={e => setChapterOrPage(e.target.value)}
                placeholder="e.g. Chapter 3, pp. 45–62"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Bulleted Key Takeaways */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Key Takeaways (Bulleted Highlights) *
              </label>
              <button
                type="button"
                onClick={handleAddTakeaway}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bullet</span>
              </button>
            </div>

            <div className="space-y-2">
              {takeawayInputs.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={val}
                    onChange={e => handleUpdateTakeaway(idx, e.target.value)}
                    placeholder={`Takeaway point #${idx + 1}...`}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTakeaway(idx)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Remove bullet"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Content / Markdown Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Synthesis & Discussion Notes (Markdown supported)
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Add comprehensive commentary, definitions, formulas, or study questions..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="e.g. CBC, Physics, Form4, ExamRevision"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* VIEW & COLLABORATION PERMISSIONS */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/80 border border-indigo-100 dark:border-slate-700 space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Sharing & View Permissions
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Choose who can view and collaborate on these book takeaways:
              </p>
            </div>

            {/* Permission Selector Radio Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Group */}
              <button
                type="button"
                onClick={() => setPermissionType('group')}
                className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1 transition-all cursor-pointer ${
                  permissionType === 'group'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Users className="w-4 h-4" />
                  {permissionType === 'group' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs font-bold mt-1">Study Group</span>
                <span className="text-[10px] opacity-80 leading-tight">Entire study circle</span>
              </button>

              {/* Individual */}
              <button
                type="button"
                onClick={() => setPermissionType('individual')}
                className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1 transition-all cursor-pointer ${
                  permissionType === 'individual'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <UserPlus className="w-4 h-4" />
                  {permissionType === 'individual' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs font-bold mt-1">Individual</span>
                <span className="text-[10px] opacity-80 leading-tight">Specific peers</span>
              </button>

              {/* Public */}
              <button
                type="button"
                onClick={() => setPermissionType('public')}
                className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1 transition-all cursor-pointer ${
                  permissionType === 'public'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Globe className="w-4 h-4" />
                  {permissionType === 'public' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs font-bold mt-1">Public</span>
                <span className="text-[10px] opacity-80 leading-tight">All classmates</span>
              </button>

              {/* Private */}
              <button
                type="button"
                onClick={() => setPermissionType('private')}
                className={`p-2.5 rounded-xl border text-left flex flex-col items-start gap-1 transition-all cursor-pointer ${
                  permissionType === 'private'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <Lock className="w-4 h-4" />
                  {permissionType === 'private' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className="text-xs font-bold mt-1">Private</span>
                <span className="text-[10px] opacity-80 leading-tight">Only me</span>
              </button>
            </div>

            {/* If Group Permission Selected: Group Picker */}
            {permissionType === 'group' && (
              <div className="pt-2 border-t border-indigo-100 dark:border-slate-700/60">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Allowed Study Groups & Classrooms:
                </label>
                {groupConversations.length === 0 ? (
                  <p className="text-xs text-slate-500">No active groups found. Please create or join a group first.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {groupConversations.map(grp => {
                      const isSelected = selectedGroupIds.includes(grp.id);
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => toggleGroupId(grp.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span>{grp.groupAvatar || '👥'}</span>
                          <span>{grp.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* If Individual Permission Selected: User Picker */}
            {permissionType === 'individual' && (
              <div className="pt-2 border-t border-indigo-100 dark:border-slate-700/60">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Specific Peers & Instructors:
                </label>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                  {allUsers
                    .filter(u => u.id !== currentUser.id)
                    .map(usr => {
                      const isSelected = selectedUserIds.includes(usr.id);
                      return (
                        <button
                          key={usr.id}
                          type="button"
                          onClick={() => toggleUserId(usr.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <img src={usr.avatar} alt={usr.name} className="w-4 h-4 rounded-full object-cover" />
                          <span>{usr.name}</span>
                          <span className="text-[9px] uppercase opacity-75">({usr.role})</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{noteToEdit ? 'Save Changes' : 'Publish & Share Takeaways'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
