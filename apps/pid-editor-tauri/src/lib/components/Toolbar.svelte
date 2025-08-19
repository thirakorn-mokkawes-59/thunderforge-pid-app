<script lang="ts">
  import { diagram } from '$lib/stores/diagram';
  import ExportImportModal from './ExportImportModal.svelte';
  import { onMount } from 'svelte';
  import { Bell, User } from 'lucide-svelte';
  
  let showExportImportModal = false;
  let isEditingName = false;
  let editingName = '';
  
  // Make the function available immediately, not just after mount
  function handleOpenExportImport(event: Event) {
    console.log('Toolbar: Received open-export-import event');
    showExportImportModal = true;
  }
  
  onMount(() => {
    console.log('Toolbar mounted, setting up export modal listener');
    window.addEventListener('open-export-import', handleOpenExportImport);
    
    return () => {
      window.removeEventListener('open-export-import', handleOpenExportImport);
    };
  });
  
  function newDiagram() {
    if (confirm('Create a new diagram? Any unsaved changes will be lost.')) {
      diagram.clear();
    }
  }
  
  
  function openExportImport() {
    console.log('Opening export/import modal via button click');
    showExportImportModal = true;
  }
  
  // Load auto-save from localStorage
  function loadAutoSave() {
    const saved = localStorage.getItem('pid-editor-autosave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (confirm(`Load auto-saved diagram from ${new Date(data.timestamp).toLocaleString()}?`)) {
          diagram.clear();
          data.elements?.forEach(el => diagram.addElement(el));
          data.connections?.forEach(conn => diagram.addConnection(conn));
        }
      } catch (e) {
        console.error('Failed to load auto-save:', e);
        alert('Failed to load auto-save. The file may be corrupted.');
      }
    } else {
      alert('No auto-save found.');
    }
  }
  
  // Handle name editing
  function handleNameEdit() {
    isEditingName = true;
    editingName = $diagram.name;
  }
  
  function handleNameSave() {
    if (editingName.trim()) {
      diagram.setName(editingName.trim());
    }
    isEditingName = false;
  }
  
  function handleNameKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleNameSave();
    } else if (event.key === 'Escape') {
      isEditingName = false;
      editingName = $diagram.name;
    }
  }
  
  // Custom action to focus input on mount
  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

<div class="toolbar">
  <div class="toolbar-section">
    <button class="toolbar-button" on:click={newDiagram} title="New Diagram" aria-label="Create new diagram">
      New
    </button>
    
    <button class="toolbar-button" on:click={openExportImport} title="Export/Import" aria-label="Export or Import diagram">
      Export/Import
    </button>
    
    <button class="toolbar-button" on:click={loadAutoSave} title="Restore Auto-save" aria-label="Restore from auto-save">
      Restore
    </button>
  </div>
  
  <div class="toolbar-center">
    {#if isEditingName}
      <input
        type="text"
        class="canvas-name-input"
        bind:value={editingName}
        on:blur={handleNameSave}
        on:keydown={handleNameKeydown}
        use:focusOnMount
      />
    {:else}
      <span 
        class="canvas-name" 
        on:dblclick={handleNameEdit}
        title="Double-click to edit"
      >
        {$diagram.name}
      </span>
    {/if}
  </div>
  
  <div class="toolbar-section">
    <button class="notification-button" title="Notifications" aria-label="Notifications">
      <Bell size={16} strokeWidth={2} />
    </button>
    <button class="user-button" title="User Account" aria-label="User Account">
      <User size={16} strokeWidth={2} />
    </button>
  </div>
</div>

<ExportImportModal 
  show={showExportImportModal} 
  onClose={() => showExportImportModal = false} 
/>

<style>
  .toolbar {
    height: 24px;
    background: #1f2937;
    border-bottom: 1px solid #374151;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    gap: 0.5rem;
    flex-shrink: 0;
    font-size: 0.75rem;
  }
  
  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .toolbar-button {
    background: transparent;
    border: none;
    padding: 2px 6px;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    transition: color 0.2s;
    font-size: 0.75rem;
    border-radius: 3px;
  }
  
  .toolbar-button:hover:not(:disabled) {
    color: #e5e7eb;
    background: rgba(156, 163, 175, 0.1);
  }
  
  .toolbar-button.active {
    color: #60a5fa;
  }
  
  .toolbar-button.active:hover:not(:disabled) {
    color: #93bbfc;
  }
  
  .toolbar-button:active,
  .toolbar-button:focus {
    outline: none;
    color: #9ca3af;
  }
  
  .toolbar-button.active:active,
  .toolbar-button.active:focus {
    color: #60a5fa;
  }
  
  .toolbar-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  
  .toolbar-button svg {
    width: 14px;
    height: 14px;
  }
  
  .toolbar-center {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .canvas-name {
    color: #e5e7eb;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.025em;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }
  
  .canvas-name:hover {
    background-color: rgba(156, 163, 175, 0.1);
  }
  
  .canvas-name-input {
    background: rgba(31, 41, 55, 0.8);
    border: 1px solid #60a5fa;
    color: #e5e7eb;
    font-size: 0.875rem;
    font-weight: 500;
    letter-spacing: 0.025em;
    padding: 2px 8px;
    border-radius: 4px;
    outline: none;
    min-width: 150px;
    text-align: center;
  }
  
  .canvas-name-input:focus {
    background: rgba(31, 41, 55, 1);
    border-color: #93bbfc;
  }
  
  .user-button {
    background: transparent;
    border: none;
    padding: 4px;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }
  
  .user-button:hover {
    color: #e5e7eb;
    background: rgba(156, 163, 175, 0.1);
  }
  
  .user-button:active,
  .user-button:focus {
    outline: none;
    color: #9ca3af;
  }
  
  .user-button svg {
    width: 16px;
    height: 16px;
  }
  
  .notification-button {
    background: transparent;
    border: none;
    padding: 4px;
    color: #9ca3af;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
    margin-right: 8px;
  }
  
  .notification-button:hover {
    color: #e5e7eb;
    background: rgba(156, 163, 175, 0.1);
  }
  
  .notification-button:active,
  .notification-button:focus {
    outline: none;
    color: #9ca3af;
  }
  
  .notification-button svg {
    width: 16px;
    height: 16px;
  }
</style>