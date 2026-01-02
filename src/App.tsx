import React, { useState, useEffect } from 'react';
import { DAWProvider, useDAW } from './context/DAWContext';
import TransportBar from './components/TransportBar';
import SideBrowser from './components/SideBrowser';
import ArrangementView from './components/ArrangementView';
import MixerView from './components/MixerView';
import PluginEditor from './components/PluginEditor';
import AuthScreen from './components/AuthScreen';
import TrackCreationBar from './components/TrackCreationBar';
import SaveProjectModal from './components/SaveProjectModal';
import LoadProjectModal from './components/LoadProjectModal';
import ExportModal from './components/ExportModal';
import ShareModal from './components/ShareModal';
import AudioSettingsPanel from './components/AudioSettingsPanel';
import { supabaseManager } from './services/SupabaseManager';
import { PluginInstance, ViewMode } from './types';
import { SessionSerializer } from './services/SessionSerializer';
import { ProjectIO } from './services/ProjectIO';

// Composant Interne qui consomme le contexte
const DAWLayout: React.FC = () => {
  const { state, user, setUser, updateTrack, selectTrack, addTrack, updatePluginParams, addPlugin, toggleDelayComp, setView, loadProject, seek } = useDAW();
  
  // État UI local
  const [activePlugin, setActivePlugin] = useState<{trackId: string, plugin: PluginInstance} | null>(null);
  const [browserWidth, setBrowserWidth] = useState(300);
  const [isBrowserOpen, setIsBrowserOpen] = useState(true);

  // Modals State
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [isLoadMenuOpen, setIsLoadMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAudioSettingsOpen, setIsAudioSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Auth Check au démarrage
  useEffect(() => {
     const u = supabaseManager.getUser();
     if(u) setUser(u);
  }, [setUser]);

  // Handlers
  const handleSaveCloud = async (name: string) => {
      try {
          const updatedState = { ...state, name };
          await supabaseManager.saveUserSession(updatedState);
          alert("Sauvegarde Cloud réussie !");
      } catch(e: any) {
          alert("Erreur: " + e.message);
      }
  };

  const handleSaveLocal = (name: string) => {
      const updatedState = { ...state, name };
      SessionSerializer.downloadLocalJSON(updatedState, name);
  };

  const handleSaveAsCopy = async (name: string) => {
      try {
          await supabaseManager.saveProjectAsCopy(state, name);
          alert("Copie sauvegardée !");
      } catch(e: any) {
          alert("Erreur: " + e.message);
      }
  };

  const handleLoadCloud = async (id: string) => {
      try {
          const loaded = await supabaseManager.loadUserSession(id);
          if (loaded) loadProject(loaded);
      } catch(e) { console.error(e); }
  };

  const handleLoadLocal = async (file: File) => {
      try {
          if (file.name.endsWith('.zip')) {
              const loaded = await ProjectIO.loadProject(file);
              loadProject(loaded);
          } else {
              const text = await file.text();
              loadProject(JSON.parse(text));
          }
      } catch(e) { console.error(e); }
  };

  if (!user) {
      return <AuthScreen onAuthenticated={setUser} />;
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#0c0d10] text-white overflow-hidden transition-colors duration-300">
      
      {/* 1. TRANSPORT BAR */}
      <div className="relative z-50">
        <TransportBar 
           currentView={state.currentView}
           onChangeView={setView}
           onOpenSaveMenu={() => setIsSaveMenuOpen(true)}
           onOpenLoadMenu={() => setIsLoadMenuOpen(true)}
           onExportMix={() => setIsExportMenuOpen(true)}
           onShareProject={() => setIsShareModalOpen(true)}
           onOpenAudioEngine={() => setIsAudioSettingsOpen(true)}
           onToggleDelayComp={toggleDelayComp}
           showBrowserToggle={true}
           isBrowserOpen={isBrowserOpen}
           onToggleBrowser={() => setIsBrowserOpen(!isBrowserOpen)}
        />
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* SIDE BROWSER */}
        {isBrowserOpen && (
           <div style={{ width: browserWidth }} className="border-r border-white/5 bg-[#08090b] flex-shrink-0">
              <SideBrowser 
                 user={user}
                 onTabChange={() => {}}
              />
           </div>
        )}

        {/* ARRANGEMENT / MIXER VIEW */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0c0d10] relative">
            {state.currentView === 'ARRANGEMENT' ? (
                <ArrangementView 
                   tracks={state.tracks}
                   currentTime={state.currentTime}
                   bpm={state.bpm}
                   selectedTrackId={state.selectedTrackId}
                   onSelectTrack={selectTrack}
                   onUpdateTrack={updateTrack}
                   onSeek={seek} // Retrieved from context in hook but passed down here requires hook destructuring
                   isLoopActive={state.isLoopActive}
                   loopStart={state.loopStart}
                   loopEnd={state.loopEnd}
                   onSetLoop={() => { /* Need Loop Setter in Context */ }}
                   onDropPluginOnTrack={(tid, type) => addPlugin(tid, type)}
                   onReorderTracks={() => {}}
                   recStartTime={state.recStartTime}
                   onSelectPlugin={(tid, p) => setActivePlugin({ trackId: tid, plugin: p })}
                />
            ) : (
                <MixerView 
                   tracks={state.tracks}
                   onUpdateTrack={updateTrack}
                   onRequestAddPlugin={(tid) => { /* Logic to open menu */ }}
                />
            )}
            
            {/* Flottant : Création de Piste */}
            <TrackCreationBar onCreateTrack={addTrack} />
        </main>
      </div>

      {/* 3. MODALS & OVERLAYS */}
      {activePlugin && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="relative" onMouseDown={e => e.stopPropagation()}>
                <PluginEditor 
                    plugin={activePlugin.plugin}
                    trackId={activePlugin.trackId}
                    onClose={() => setActivePlugin(null)}
                    onUpdateParams={(p) => updatePluginParams(activePlugin.trackId, activePlugin.plugin.id, p)}
                />
             </div>
          </div>
      )}

      {isSaveMenuOpen && (
          <SaveProjectModal 
             isOpen={isSaveMenuOpen} 
             onClose={() => setIsSaveMenuOpen(false)} 
             currentName={state.name} 
             user={user} 
             onSaveCloud={handleSaveCloud}
             onSaveLocal={handleSaveLocal}
             onSaveAsCopy={handleSaveAsCopy}
             onOpenAuth={() => setIsAuthOpen(true)}
          />
      )}

      {isLoadMenuOpen && (
          <LoadProjectModal 
             isOpen={isLoadMenuOpen}
             onClose={() => setIsLoadMenuOpen(false)}
             user={user}
             onLoadCloud={handleLoadCloud}
             onLoadLocal={handleLoadLocal}
             onOpenAuth={() => setIsAuthOpen(true)}
          />
      )}

      {isExportMenuOpen && <ExportModal isOpen={isExportMenuOpen} onClose={() => setIsExportMenuOpen(false)} projectState={state} />}
      {isShareModalOpen && <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} onShare={() => {}} projectName={state.name} />}
      {isAudioSettingsOpen && <AudioSettingsPanel onClose={() => setIsAudioSettingsOpen(false)} />}
      
      {isAuthOpen && <AuthScreen onAuthenticated={(u) => { setUser(u); setIsAuthOpen(false); }} />}

    </div>
  );
};

export default function App() {
  return (
    <DAWProvider>
      <DAWLayout />
    </DAWProvider>
  );
}