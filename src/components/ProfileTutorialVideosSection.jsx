import React, { useState, useEffect } from 'react';
import { systems } from '../layout/systemsConfig';
import supabase from '../systems/checklist/SupabaseClient';
import { Video, Play, ChevronRight, Info, AlertCircle, FileText, CheckCircle2, Shield, Sparkles } from 'lucide-react';

export default function ProfileTutorialVideosSection({ currentUser }) {
  const [selectedSystemId, setSelectedSystemId] = useState('checklist');
  const [selectedPageKey, setSelectedPageKey] = useState('/dashboard/admin');
  const [selectedPageName, setSelectedPageName] = useState('Dashboard');
  
  const [activeVideo, setActiveVideo] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [expandedSystem, setExpandedSystem] = useState('checklist');

  // Filter allowed pages for current employee if permission restricted
  const role = (currentUser?.role || localStorage.getItem('role') || 'User').toLowerCase();
  const isAdmin = role === 'admin' || role === 'masteradmin' || (currentUser?.userName || '').toLowerCase() === 'admin';

  let rawAccess = currentUser?.accessStrings || currentUser?.master_user_system_page_access || localStorage.getItem('master_user_system_page_access') || [];
  if (typeof rawAccess === 'string') {
    try { rawAccess = JSON.parse(rawAccess); } catch(e) { rawAccess = []; }
  }
  if (!Array.isArray(rawAccess) && rawAccess && typeof rawAccess === 'object') {
    rawAccess = Object.keys(rawAccess);
  }

  // Extract permitted system IDs (e.g. 'hr', 'checklist', 'inventory', 'purchase')
  const userPermittedSystems = Array.isArray(rawAccess)
    ? [...new Set(rawAccess.map(item => typeof item === 'string' ? item.split('.')[0].toLowerCase().trim() : '').filter(Boolean))]
    : [];

  // Load video when selected page changes
  useEffect(() => {
    if (selectedPageKey) {
      loadVideoForPage(selectedPageKey);
    }
  }, [selectedPageKey]);

  const loadVideoForPage = async (pageKey) => {
    setLoadingVideo(true);
    setActiveVideo(null);

    try {
      // 1. Try Supabase query
      const { data, error } = await supabase
        .from('page_tutorial_videos')
        .select('*')
        .eq('page_key', pageKey)
        .maybeSingle();

      if (data && data.video_url) {
        setActiveVideo(data);
      } else {
        // 2. Check localStorage fallback
        const local = localStorage.getItem(`drinqkart_tutorial_video_${pageKey}`);
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (parsed && parsed.video_url) {
              setActiveVideo(parsed);
            }
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

    // YouTube regex embed converter
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
    }

    // Vimeo regex embed converter
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return url;
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 flex flex-col gap-6">
      
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-900 text-amber-400 rounded-2xl shadow-sm">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-950 tracking-tight flex items-center gap-2">
              Page Tutorial & Training Videos
              <span className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                Interactive Learning
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Select any system page from the sidebar to watch uploaded training videos and operational guidelines
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout: Left Sidebar + Right Video Player Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[480px]">
        
        {/* Left Sidebar: System & Page Tree Navigation (4 cols) */}
        <div className="lg:col-span-4 bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-col gap-3 max-h-[600px] overflow-y-auto">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 px-1 flex items-center justify-between">
            <span>System Pages</span>
            <span className="text-[10px] font-bold text-slate-500">All Modules</span>
          </h3>

          <div className="flex flex-col gap-2">
            {systems.map((sys) => {
              const isExpanded = expandedSystem === sys.id;
              const subtabs = sys.subtabs || [];
              const Icon = sys.icon;

              return (
                <div key={sys.id} className="flex flex-col rounded-xl border border-slate-200/70 bg-white overflow-hidden shadow-2xs">
                  {/* System Header Accordion Toggle */}
                  <button
                    onClick={() => setExpandedSystem(isExpanded ? null : sys.id)}
                    className="w-full px-3 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {Icon && <Icon className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span className="text-xs font-black text-slate-900 truncate">{sys.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-amber-600' : ''}`} />
                  </button>

                  {/* Sub-pages List */}
                  {isExpanded && (
                    <div className="flex flex-col border-t border-slate-100 bg-slate-50/50 p-1.5 gap-1">
                      {subtabs.map((tab, idx) => {
                        if (tab.type === 'header') {
                          return (
                            <span key={idx} className="text-[10px] font-black uppercase text-slate-400 tracking-wider px-2 pt-1 pb-0.5">
                              {tab.label}
                            </span>
                          );
                        }

                        const pageKey = tab.to || `${sys.base}?page=${tab.label}`;
                        const isSelected = selectedPageKey === pageKey;

                        // Check if employee is restricted and doesn't have access to this system
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
                                ? 'bg-slate-900 text-amber-400 shadow-xs'
                                : 'text-slate-700 hover:bg-slate-200/60'
                            }`}
                          >
                            <span className="truncate">{tab.label}</span>
                            {isSelected && <Play className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />}
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

        {/* Right Pane: Video Viewer & Description Card (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900 rounded-2xl p-5 border border-slate-800 text-white flex flex-col justify-between relative min-h-[420px]">
          
          {loadingVideo ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <span className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
              <span className="text-xs font-bold">Loading tutorial video...</span>
            </div>
          ) : activeVideo ? (
            <div className="flex flex-col gap-4 w-full">
              
              {/* Video Player */}
              <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 aspect-video relative">
                {activeVideo.video_type === 'file' ? (
                  <video
                    controls
                    src={activeVideo.video_url}
                    className="w-full h-full object-contain"
                  />
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

              {/* Video Meta Info & Description */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[11px] font-extrabold text-amber-400 uppercase tracking-wider block">
                      {activeVideo.system_name || 'System Tutorial'}
                    </span>
                    <h3 className="text-lg font-black text-white tracking-tight">
                      {activeVideo.page_name || selectedPageName} Tutorial Video
                    </h3>
                  </div>

                  <span className="bg-slate-800 text-slate-300 text-[11px] font-semibold px-3 py-1 rounded-full border border-slate-700">
                    Uploaded by: <strong className="text-white font-bold">{activeVideo.created_by || 'Admin'}</strong>
                  </span>
                </div>

                {/* Description */}
                {activeVideo.description ? (
                  <div className="bg-slate-800/60 rounded-xl p-3.5 border border-slate-800/80 flex items-start gap-2.5 mt-1">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider">Video Notes & Instructions</span>
                      <p className="text-xs text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                        {activeVideo.description}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No description provided for this tutorial video.</p>
                )}
              </div>

            </div>
          ) : (
            /* Empty State when no video is uploaded for the selected page */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
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
  );
}
