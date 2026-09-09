import React, { useState, useEffect } from 'react';
import { X, Video, Play, ChevronRight, Info } from 'lucide-react';
import { systems } from '../layout/systemsConfig';
import supabase from '../systems/checklist/SupabaseClient';

export default function TutorialVideosModal({ isOpen, onClose, currentUser }) {
  const [selectedSystemId, setSelectedSystemId] = useState('checklist');
  const [selectedPageKey, setSelectedPageKey] = useState('/dashboard/admin');
  const [selectedPageName, setSelectedPageName] = useState('Dashboard');
  const [expandedSystem, setExpandedSystem] = useState('checklist');
  const [activeVideo, setActiveVideo] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  const role = (currentUser?.role || localStorage.getItem('role') || 'User').toLowerCase();
  const isAdmin = role === 'admin' || role === 'masteradmin' || (currentUser?.user_name || currentUser?.username || '').toLowerCase() === 'admin';

  let rawAccess = currentUser?.master_user_system_page_access || localStorage.getItem('master_user_system_page_access') || [];
  if (typeof rawAccess === 'string') {
    try { rawAccess = JSON.parse(rawAccess); } catch(e) { rawAccess = []; }
  }
  if (!Array.isArray(rawAccess) && rawAccess && typeof rawAccess === 'object') {
    rawAccess = Object.keys(rawAccess);
  }
  const userPermittedSystems = Array.isArray(rawAccess)
    ? [...new Set(rawAccess.map(item => typeof item === 'string' ? item.split('.')[0].toLowerCase().trim() : '').filter(Boolean))]
    : [];

  useEffect(() => {
    if (isOpen && selectedPageKey) {
      loadVideoForPage(selectedPageKey);
    }
  }, [isOpen, selectedPageKey]);

  const loadVideoForPage = async (pageKey) => {
    setLoadingVideo(true);
    setActiveVideo(null);
    try {
      const { data } = await supabase
        .from('page_tutorial_videos')
        .select('*')
        .eq('page_key', pageKey)
        .maybeSingle();

      if (data && data.video_url) {
        setActiveVideo(data);
      } else {
        const local = localStorage.getItem(`drinqkart_tutorial_video_${pageKey}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed && parsed.video_url) setActiveVideo(parsed);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Error fetching tutorial video for page:', err);
    } finally {
      setLoadingVideo(false);
    }
  };

  const getEmbedUrl = (url, type) => {
    if (!url) return '';
    if (type === 'file') return url;
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-6xl w-full h-[90vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden relative">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-sm">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Page Tutorial & Training Videos
                <span className="text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                  Interactive Learning
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Select any page from the left sidebar to watch training videos and operational guidelines
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body: 2-Column Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Sidebar Tree (4 Cols) */}
          <div className="lg:col-span-4 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-1 border-b border-slate-200/80 pb-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                System Pages Directory
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                Select Page
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {systems.map((sys) => {
                const isExpanded = expandedSystem === sys.id;
                const subtabs = sys.subtabs || [];
                const Icon = sys.icon;

                return (
                  <div key={sys.id} className="flex flex-col rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
                    <button
                      onClick={() => setExpandedSystem(isExpanded ? null : sys.id)}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {Icon && <Icon className="w-4 h-4 text-amber-600 shrink-0" />}
                        <span className="text-xs font-black text-slate-900 truncate">{sys.label}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-amber-600' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="flex flex-col border-t border-slate-100 bg-slate-50/60 p-1.5 gap-1">
                        {subtabs.map((tab, idx) => {
                          if (tab.type === 'header') {
                            return (
                              <span key={idx} className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 pt-1.5 pb-0.5">
                                {tab.label}
                              </span>
                            );
                          }

                          const pageKey = tab.to || `${sys.base}?page=${tab.label}`;
                          const isSelected = selectedPageKey === pageKey;

                          if (!isAdmin && userPermittedSystems.length > 0 && !userPermittedSystems.includes(sys.id)) {
                            return null;
                          }

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedSystemId(sys.id);
                                setSelectedPageKey(pageKey);
                                setSelectedPageName(tab.label);
                              }}
                              className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold text-left flex items-center justify-between transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-700 hover:bg-slate-200/60'
                              }`}
                            >
                              <span className="truncate">{tab.label}</span>
                              {isSelected && <Play className="w-3 h-3 fill-white text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Main Video Viewer (8 Cols) */}
          <div className="lg:col-span-8 bg-slate-900 p-6 text-white flex flex-col justify-between overflow-y-auto custom-scrollbar">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">
                  {systems.find(s => s.id === selectedSystemId)?.label || 'System Module'}
                </span>
                <h3 className="text-lg font-black text-white tracking-tight">
                  {selectedPageName} Tutorial Video
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                Route: {selectedPageKey}
              </span>
            </div>

            {loadingVideo ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <span className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                <span className="text-xs font-bold">Loading tutorial video for {selectedPageName}...</span>
              </div>
            ) : activeVideo ? (
              <div className="flex flex-col gap-5 w-full">
                
                {/* Video Player */}
                <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 aspect-video relative">
                  {activeVideo.video_type === 'file' ? (
                    <video controls src={activeVideo.video_url} className="w-full h-full object-contain" />
                  ) : (
                    <iframe
                      src={getEmbedUrl(activeVideo.video_url, activeVideo.video_type)}
                      title={activeVideo.page_name || 'Tutorial Video'}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>

                {/* Description & Guidelines */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="text-sm font-black text-white">Guidelines & Notes</h4>
                    <span className="bg-slate-800 text-slate-300 text-[11px] font-semibold px-3 py-1 rounded-full border border-slate-700">
                      Uploaded by: <strong className="text-white font-bold">{activeVideo.created_by || 'Admin'}</strong>
                    </span>
                  </div>

                  {activeVideo.description ? (
                    <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80 flex items-start gap-3">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">Instructions</span>
                        <p className="text-xs text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
                          {activeVideo.description}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No description provided for this video.</p>
                  )}
                </div>

              </div>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50 my-6">
                <div className="p-4 bg-slate-800/80 rounded-full text-slate-400 border border-slate-700">
                  <Video className="w-10 h-10 text-amber-400/70" />
                </div>
                <div className="max-w-md flex flex-col gap-1">
                  <h4 className="text-base font-black text-white">No Tutorial Video Uploaded Yet</h4>
                  <p className="text-xs text-slate-400 font-medium">
                    There is currently no training video available for <strong className="text-amber-400 font-bold">{selectedPageName}</strong>. 
                    Admins can click the <strong className="text-white">"Add Tutorial Video"</strong> button on that page to upload one.
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
