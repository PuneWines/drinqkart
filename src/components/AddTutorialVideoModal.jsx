import React, { useState, useEffect } from 'react';
import { X, Upload, Link as LinkIcon, Video, Check, AlertCircle, Loader2 } from 'lucide-react';
import supabase from '../systems/checklist/SupabaseClient';
import { systems } from '../layout/systemsConfig';

export default function AddTutorialVideoModal({ isOpen, onClose, currentLocation, targetSystem, currentUser }) {
  const [systemId, setSystemId] = useState('checklist');
  const [pageKey, setPageKey] = useState('');
  const [pageName, setPageName] = useState('');
  const [videoType, setVideoType] = useState('file'); // 'file' | 'link'
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-detect current system and page name whenever modal opens or location changes
  useEffect(() => {
    if (!isOpen) return;

    let targetPath = '';

    if (targetSystem) {
      setSystemId(targetSystem.id || 'checklist');
      setPageName(targetSystem.label || targetSystem.name || 'System Page');
      targetPath = targetSystem.base || targetSystem.to || `/systems/${targetSystem.id}`;
      setPageKey(targetPath);
    } else {
      const pathname = currentLocation?.pathname || window.location.pathname;
      const search = currentLocation?.search || window.location.search;
      targetPath = `${pathname}${search}`;
      setPageKey(targetPath);

      let matchedSys = systems.find(s => pathname.startsWith(s.base));
      if (!matchedSys) matchedSys = systems[0];
      setSystemId(matchedSys.id);

      let foundPageName = '';
      for (const sys of systems) {
        if (!sys.subtabs) continue;
        for (const tab of sys.subtabs) {
          if (tab.to && (tab.to === pathname || tab.to === targetPath)) {
            foundPageName = tab.label;
            break;
          }
        }
        if (foundPageName) break;
      }
      setPageName(foundPageName || matchedSys.label);
    }

    // Reset error, success & form states for a clean new entry
    setErrorMessage('');
    setSuccessMessage('');
    setSelectedFile(null);
    setVideoUrl('');
    setDescription('');
  }, [isOpen, currentLocation, targetSystem]);

  if (!isOpen) return null;

  const currentSystemObj = systems.find(s => s.id === systemId) || systems[0];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (.mp4, .webm, .mov, etc.).');
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setErrorMessage('Video file size exceeds 100MB limit.');
      return;
    }

    setErrorMessage('');
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (videoType === 'file' && !selectedFile && !videoUrl) {
      setErrorMessage('Please select a video file to upload.');
      return;
    }

    if (videoType === 'link' && !videoUrl.trim()) {
      setErrorMessage('Please enter a valid video link/URL.');
      return;
    }

    setUploading(true);

    try {
      let finalVideoUrl = videoUrl;
      let storagePath = null;

      // 1. Handle file upload if direct file selected
      if (videoType === 'file' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const sanitizedPageName = pageName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const fileName = `tutorial_${sanitizedPageName}_${Date.now()}.${fileExt}`;
        storagePath = fileName;

        let bucket = 'tutorial_videos';
        let { data: uploadData, error: uploadErr } = await supabase.storage
          .from(bucket)
          .upload(fileName, selectedFile, { cacheControl: '3600', upsert: true });

        // Fallback to 'checklist' bucket if 'tutorial_videos' does not exist
        if (uploadErr) {
          console.warn(`Upload to "${bucket}" notice:`, uploadErr.message, 'Falling back to "checklist" bucket.');
          bucket = 'checklist';
          const fallbackRes = await supabase.storage
            .from(bucket)
            .upload(fileName, selectedFile, { cacheControl: '3600', upsert: true });
          uploadData = fallbackRes.data;
          uploadErr = fallbackRes.error;
        }

        if (uploadErr) {
          throw new Error(uploadErr.message || 'Failed to upload video file.');
        }

        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
        finalVideoUrl = urlData?.publicUrl || '';
      }

      const uploaderName = currentUser?.user_name || currentUser?.username || 'Admin';

      const videoPayload = {
        page_key: pageKey,
        page_name: pageName || currentSystemObj.label,
        system_id: systemId,
        system_name: currentSystemObj.label,
        video_type: videoType,
        video_url: finalVideoUrl,
        storage_path: storagePath,
        description: description.trim(),
        created_by: uploaderName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 2. Try inserting to Supabase table 'page_tutorial_videos' as new row
      const { error: dbErr } = await supabase
        .from('page_tutorial_videos')
        .insert([videoPayload]);

      if (dbErr) {
        console.warn('Supabase DB insert notice for page_tutorial_videos:', dbErr.message);
      }

      // 3. Update localStorage array as sync fallback
      const localKey = `drinqkart_tutorial_videos_${systemId}`;
      const existingLocalRaw = localStorage.getItem(localKey);
      let localList = [];
      if (existingLocalRaw) {
        try { localList = JSON.parse(existingLocalRaw); } catch(e) {}
      }
      localList.unshift(videoPayload);
      localStorage.setItem(localKey, JSON.stringify(localList));

      // Global store of all video page keys for easy profile listing
      const allKeysRaw = localStorage.getItem('drinqkart_all_tutorial_video_keys');
      let allKeys = [];
      if (allKeysRaw) {
        try { allKeys = JSON.parse(allKeysRaw); } catch(e) {}
      }
      if (!allKeys.includes(pageKey)) {
        allKeys.push(pageKey);
        localStorage.setItem('drinqkart_all_tutorial_video_keys', JSON.stringify(allKeys));
      }

      setSuccessMessage('Tutorial video uploaded successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err) {
      console.error('Error saving tutorial video:', err);
      setErrorMessage(err.message || 'An error occurred while saving the tutorial video.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-md">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Add / Edit Page Tutorial Video</h2>
              <p className="text-xs text-slate-600 font-semibold">Upload or attach a video tutorial for this page</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-rose-800 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-emerald-800 font-bold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* 1. System Name Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              System Name <span className="text-rose-500">*</span>
            </label>
            <select
              value={systemId}
              onChange={(e) => {
                const selectedId = e.target.value;
                setSystemId(selectedId);
                const selectedSysObj = systems.find(s => s.id === selectedId);
                if (selectedSysObj) {
                  setPageName(selectedSysObj.label);
                  setPageKey(selectedSysObj.base || `/systems/${selectedSysObj.id}`);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
            >
              {systems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.label}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Video Source Type Toggle */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              Video Type <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVideoType('file')}
                className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  videoType === 'file'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Direct File Upload
              </button>
              <button
                type="button"
                onClick={() => setVideoType('link')}
                className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                  videoType === 'link'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" /> Video URL / Link
              </button>
            </div>
          </div>

          {/* 4. Video Selection (File or Link) */}
          {videoType === 'file' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Select Video File (.mp4, .webm)
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-amber-400 hover:file:bg-slate-800 cursor-pointer"
              />
              {selectedFile && (
                <span className="text-[11px] font-bold text-emerald-700">
                  Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Video Link / Embed URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="e.g. https://www.youtube.com/watch?v=..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
              />
            </div>
          )}

          {/* 5. Video Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-700">
              Video Description & Key Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain key steps, rules, or workflows covered in this tutorial video..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Video...
                </>
              ) : (
                'Save Tutorial Video'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
